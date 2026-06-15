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

#[derive(Clone, Copy, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseMovement {
    pub x: i32,
    pub y: i32,
    pub wheel_x: i32,
    pub wheel_y: i32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardMouseSnapshot {
    pub supported: bool,
    pub error: Option<String>,
    pub pressed_keys: Vec<u32>,
    pub mouse_buttons: MouseButtons,
    pub movement: MouseMovement,
    pub updated_at_ms: u128,
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{emit_or_log, KeyboardMouseSnapshot, MouseButtons, MouseMovement};
    use std::collections::BTreeSet;
    use std::ptr::null_mut;
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex, OnceLock};
    use std::thread;
    use std::time::Instant;
    use tauri::AppHandle;
    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, HC_ACTION, HHOOK,
        KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP,
        WM_LBUTTONDBLCLK, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDBLCLK, WM_MBUTTONDOWN,
        WM_MBUTTONUP, WM_MOUSEHWHEEL, WM_MOUSEWHEEL, WM_RBUTTONDBLCLK, WM_RBUTTONDOWN,
        WM_RBUTTONUP, WM_SYSKEYDOWN, WM_SYSKEYUP, WM_XBUTTONDBLCLK, WM_XBUTTONDOWN, WM_XBUTTONUP,
        XBUTTON1, XBUTTON2,
    };

    const MAX_TRANSIENT_ACCUMULATION: i32 = 999;

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
        movement: MouseMovement,
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
        while event_receiver.recv().is_ok() {
            emit_or_log(&app, "keyboard-mouse-state", take_snapshot(&shared));
        }
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
                WM_MOUSEWHEEL => record_wheel(0, signed_high_word(hook.mouseData) as i32),
                WM_MOUSEHWHEEL => record_wheel(signed_high_word(hook.mouseData) as i32, 0),
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

    fn record_wheel(x: i32, y: i32) -> Option<InputSignal> {
        let mut shared = hook_state().lock().ok()?;
        if x == 0 && y == 0 {
            return None;
        }

        shared.input.movement.wheel_x =
            clamp_transient(shared.input.movement.wheel_x.saturating_add(x));
        shared.input.movement.wheel_y =
            clamp_transient(shared.input.movement.wheel_y.saturating_add(y));
        shared.input.updated_at_ms = shared.started_at.elapsed().as_millis();
        Some(InputSignal::Immediate)
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
            Ok(mut shared) => {
                let snapshot = KeyboardMouseSnapshot {
                    supported: true,
                    error: None,
                    pressed_keys: shared.input.pressed_keys.iter().copied().collect(),
                    mouse_buttons: shared.input.mouse_buttons.clone(),
                    movement: shared.input.movement,
                    updated_at_ms: shared.input.updated_at_ms,
                };
                shared.input.movement = MouseMovement::default();
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

    fn signed_high_word(value: u32) -> i16 {
        high_word(value) as i16
    }

    fn clamp_transient(value: i32) -> i32 {
        value.clamp(-MAX_TRANSIENT_ACCUMULATION, MAX_TRANSIENT_ACCUMULATION)
    }

    impl KeyboardMouseSnapshot {
        fn unsupported(error: String) -> Self {
            Self {
                supported: false,
                error: Some(error),
                pressed_keys: Vec::new(),
                mouse_buttons: MouseButtons::default(),
                movement: MouseMovement::default(),
                updated_at_ms: 0,
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn signed_high_word_reads_negative_wheel_delta() {
            let encoded = (0xff88_u32) << 16;

            assert_eq!(signed_high_word(encoded), -120);
        }

        #[test]
        fn transient_values_are_clamped() {
            assert_eq!(clamp_transient(2_000), MAX_TRANSIENT_ACCUMULATION);
            assert_eq!(clamp_transient(-2_000), -MAX_TRANSIENT_ACCUMULATION);
        }

        #[test]
        fn wheel_delta_constant_matches_windows_notch_size() {
            assert_eq!(
                windows_sys::Win32::UI::WindowsAndMessaging::WHEEL_DELTA,
                120
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::{emit_or_log, KeyboardMouseSnapshot, MouseButtons, MouseMovement};
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
                    movement: MouseMovement::default(),
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
