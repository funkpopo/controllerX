use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseButtons {
    pub left: bool,
    pub right: bool,
    pub middle: bool,
    pub x1: bool,
    pub x2: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardMouseSnapshot {
    pub supported: bool,
    pub error: Option<String>,
    pub pressed_keys: Vec<u32>,
    pub mouse_buttons: MouseButtons,
    pub updated_at_ms: u128,
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{emit_or_log, KeyboardMouseSnapshot, MouseButtons};
    use std::collections::BTreeSet;
    use std::ptr::null_mut;
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex, OnceLock};
    use std::thread;
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Manager};
    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, HC_ACTION, HHOOK,
        KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP,
        WM_LBUTTONDBLCLK, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDBLCLK, WM_MBUTTONDOWN,
        WM_MBUTTONUP, WM_RBUTTONDBLCLK, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
        WM_XBUTTONDBLCLK, WM_XBUTTONDOWN, WM_XBUTTONUP, XBUTTON1, XBUTTON2,
    };

    use crate::window_control::MAIN_WINDOW;

    /// Coalesce hook-driven snapshots to ~60/s so high-rate typing/clicking does
    /// not flood the webview; the hook thread still records every edge.
    const SNAPSHOT_EMIT_MIN_INTERVAL: Duration = Duration::from_millis(16);
    /// While the overlay is hidden, keep hook state warm but emit much less often.
    const HIDDEN_EMIT_MIN_INTERVAL: Duration = Duration::from_millis(200);

    static HOOK_STATE: OnceLock<Arc<Mutex<HookSharedState>>> = OnceLock::new();

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum InputSignal {
        Immediate,
    }

    #[derive(Debug)]
    struct HookSharedState {
        started_at: Instant,
        input: KeyboardMouseInputState,
        event_sender: mpsc::Sender<InputSignal>,
    }

    #[derive(Clone, Debug, Default)]
    struct KeyboardMouseInputState {
        pressed_keys: BTreeSet<u32>,
        mouse_buttons: MouseButtons,
        updated_at_ms: u128,
    }

    pub fn spawn_keyboard_mouse_poll(app: AppHandle) {
        let (event_sender, event_receiver) = mpsc::channel();
        let shared = Arc::new(Mutex::new(HookSharedState {
            started_at: Instant::now(),
            input: KeyboardMouseInputState::default(),
            event_sender,
        }));

        if HOOK_STATE.set(shared.clone()).is_err() {
            emit_or_log(
                &app,
                "keyboard-mouse-error",
                "keyboard/mouse hook state is already initialized".to_string(),
            );
            return;
        }

        let emitter_app = app.clone();
        let emitter_state = shared.clone();
        thread::spawn(move || emit_loop(emitter_app, emitter_state, event_receiver));

        thread::spawn(move || install_hook_loop(app));
    }

    fn emit_loop(
        app: AppHandle,
        shared: Arc<Mutex<HookSharedState>>,
        event_receiver: mpsc::Receiver<InputSignal>,
    ) {
        let mut last_emit = Instant::now() - SNAPSHOT_EMIT_MIN_INTERVAL;
        let mut pending = false;
        let mut was_visible = true;

        loop {
            let window_visible = main_window_visible(&app);
            if window_visible && !was_visible {
                // Force a fresh snapshot when the overlay returns so the UI is
                // not stuck on a stale pre-hide state.
                pending = true;
            }
            was_visible = window_visible;

            let min_interval = if window_visible {
                SNAPSHOT_EMIT_MIN_INTERVAL
            } else {
                HIDDEN_EMIT_MIN_INTERVAL
            };

            // Block until the next hook signal, or until a pending emit is due.
            let wait = if pending {
                min_interval.saturating_sub(last_emit.elapsed())
            } else {
                Duration::from_secs(3600)
            };

            match event_receiver.recv_timeout(wait) {
                Ok(_) => {
                    pending = true;
                    // Drain any backlog so one emit covers the latest state.
                    while event_receiver.try_recv().is_ok() {}
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }

            if !pending {
                continue;
            }

            if last_emit.elapsed() < min_interval {
                continue;
            }

            // When hidden, still coalesce but do not push high-rate traffic.
            // State continues to be updated by hooks regardless.
            if !window_visible && last_emit.elapsed() < HIDDEN_EMIT_MIN_INTERVAL {
                continue;
            }

            emit_or_log(&app, "keyboard-mouse-state", take_snapshot(&shared));
            last_emit = Instant::now();
            pending = false;
        }
    }

    fn main_window_visible(app: &AppHandle) -> bool {
        app.get_webview_window(MAIN_WINDOW)
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(true)
    }

    fn install_hook_loop(app: AppHandle) {
        let hooks = match install_hooks() {
            Ok(hooks) => hooks,
            Err(error) => {
                emit_or_log(&app, "keyboard-mouse-error", error.clone());
                emit_or_log(
                    &app,
                    "keyboard-mouse-state",
                    KeyboardMouseSnapshot::unsupported(error),
                );
                return;
            }
        };

        emit_or_log(&app, "keyboard-mouse-state", take_snapshot(hook_state()));

        let mut message = MSG::default();
        loop {
            let result = unsafe { GetMessageW(&mut message, null_mut(), 0, 0) };
            if result <= 0 {
                break;
            }
        }

        unsafe {
            UnhookWindowsHookEx(hooks.keyboard);
            UnhookWindowsHookEx(hooks.mouse);
        }
    }

    fn install_hooks() -> Result<HookHandles, String> {
        let keyboard =
            unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), null_mut(), 0) };
        if keyboard.is_null() {
            return Err("failed to install global keyboard hook".to_string());
        }

        let mouse = unsafe { SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), null_mut(), 0) };
        if mouse.is_null() {
            unsafe {
                UnhookWindowsHookEx(keyboard);
            }
            return Err("failed to install global mouse hook".to_string());
        }

        Ok(HookHandles { keyboard, mouse })
    }

    struct HookHandles {
        keyboard: HHOOK,
        mouse: HHOOK,
    }

    unsafe extern "system" fn keyboard_hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code == HC_ACTION as i32 {
            let hook = unsafe { *(lparam as *const KBDLLHOOKSTRUCT) };
            let signal = match wparam as u32 {
                WM_KEYDOWN | WM_SYSKEYDOWN => record_key(hook.vkCode, true),
                WM_KEYUP | WM_SYSKEYUP => record_key(hook.vkCode, false),
                _ => None,
            };
            notify(signal);
        }

        unsafe { CallNextHookEx(null_mut(), code, wparam, lparam) }
    }

    unsafe extern "system" fn mouse_hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code == HC_ACTION as i32 {
            let hook = unsafe { *(lparam as *const MSLLHOOKSTRUCT) };
            let signal = match wparam as u32 {
                WM_LBUTTONDOWN | WM_LBUTTONDBLCLK => record_mouse_button(MouseButton::Left, true),
                WM_LBUTTONUP => record_mouse_button(MouseButton::Left, false),
                WM_RBUTTONDOWN | WM_RBUTTONDBLCLK => record_mouse_button(MouseButton::Right, true),
                WM_RBUTTONUP => record_mouse_button(MouseButton::Right, false),
                WM_MBUTTONDOWN | WM_MBUTTONDBLCLK => record_mouse_button(MouseButton::Middle, true),
                WM_MBUTTONUP => record_mouse_button(MouseButton::Middle, false),
                WM_XBUTTONDOWN | WM_XBUTTONDBLCLK => record_x_button(hook.mouseData, true),
                WM_XBUTTONUP => record_x_button(hook.mouseData, false),
                _ => None,
            };
            notify(signal);
        }

        unsafe { CallNextHookEx(null_mut(), code, wparam, lparam) }
    }

    #[derive(Clone, Copy)]
    enum MouseButton {
        Left,
        Right,
        Middle,
        X1,
        X2,
    }

    fn record_key(vk_code: u32, pressed: bool) -> Option<InputSignal> {
        if vk_code == 0 {
            return None;
        }

        let mut shared = hook_state().lock().ok()?;
        let changed = if pressed {
            shared.input.pressed_keys.insert(vk_code)
        } else {
            shared.input.pressed_keys.remove(&vk_code)
        };

        if changed {
            shared.input.updated_at_ms = shared.started_at.elapsed().as_millis();
            Some(InputSignal::Immediate)
        } else {
            None
        }
    }

    fn record_mouse_button(button: MouseButton, pressed: bool) -> Option<InputSignal> {
        let mut shared = hook_state().lock().ok()?;
        let slot = match button {
            MouseButton::Left => &mut shared.input.mouse_buttons.left,
            MouseButton::Right => &mut shared.input.mouse_buttons.right,
            MouseButton::Middle => &mut shared.input.mouse_buttons.middle,
            MouseButton::X1 => &mut shared.input.mouse_buttons.x1,
            MouseButton::X2 => &mut shared.input.mouse_buttons.x2,
        };

        if *slot == pressed {
            return None;
        }

        *slot = pressed;
        shared.input.updated_at_ms = shared.started_at.elapsed().as_millis();
        Some(InputSignal::Immediate)
    }

    fn record_x_button(mouse_data: u32, pressed: bool) -> Option<InputSignal> {
        match high_word(mouse_data) {
            XBUTTON1 => record_mouse_button(MouseButton::X1, pressed),
            XBUTTON2 => record_mouse_button(MouseButton::X2, pressed),
            _ => None,
        }
    }

    fn notify(signal: Option<InputSignal>) {
        let Some(signal) = signal else {
            return;
        };

        let sender = match hook_state().lock() {
            Ok(shared) => shared.event_sender.clone(),
            Err(_) => return,
        };
        let _ = sender.send(signal);
    }

    fn take_snapshot(shared: &Arc<Mutex<HookSharedState>>) -> KeyboardMouseSnapshot {
        match shared.lock() {
            Ok(shared) => {
                let snapshot = KeyboardMouseSnapshot {
                    supported: true,
                    error: None,
                    pressed_keys: shared.input.pressed_keys.iter().copied().collect(),
                    mouse_buttons: shared.input.mouse_buttons.clone(),
                    updated_at_ms: shared.input.updated_at_ms,
                };
                snapshot
            }
            Err(_) => KeyboardMouseSnapshot::unsupported(
                "keyboard/mouse hook state lock is poisoned".to_string(),
            ),
        }
    }

    fn hook_state() -> &'static Arc<Mutex<HookSharedState>> {
        HOOK_STATE
            .get()
            .expect("keyboard/mouse hook state is initialized before hooks are installed")
    }

    fn high_word(value: u32) -> u16 {
        ((value >> 16) & 0xffff) as u16
    }

    impl KeyboardMouseSnapshot {
        fn unsupported(error: String) -> Self {
            Self {
                supported: false,
                error: Some(error),
                pressed_keys: Vec::new(),
                mouse_buttons: MouseButtons::default(),
                updated_at_ms: 0,
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::{emit_or_log, KeyboardMouseSnapshot, MouseButtons};
    use std::thread;
    use tauri::AppHandle;

    pub fn spawn_keyboard_mouse_poll(app: AppHandle) {
        thread::spawn(move || {
            emit_or_log(
                &app,
                "keyboard-mouse-state",
                KeyboardMouseSnapshot {
                    supported: false,
                    error: Some(
                        "global keyboard/mouse overlay is currently supported on Windows only"
                            .to_string(),
                    ),
                    pressed_keys: Vec::new(),
                    mouse_buttons: MouseButtons::default(),
                    updated_at_ms: 0,
                },
            );
        });
    }
}

pub fn spawn_keyboard_mouse_poll(app: AppHandle) {
    platform::spawn_keyboard_mouse_poll(app);
}

fn emit_or_log<T>(app: &AppHandle, event: &str, payload: T)
where
    T: Serialize + Clone,
{
    if let Err(error) = app.emit(event, payload) {
        eprintln!("Failed to emit {event}: {error}");
    }
}
