# controllerX

Transparent desktop input overlay for Xbox and PlayStation gamepads, keyboards, and mice.

[中文说明](README_zh.md)

controllerX shows floating input overlays on your desktop and updates them as you press controller buttons, move sticks, type on the keyboard, or use the mouse. It is useful for gameplay recording, streaming, testing input devices, and checking whether a controller is being detected correctly.

## Features

- Transparent, always-on-top overlay window.
- Supports Xbox 360, Xbox One, Xbox Series, DualShock 3, DualShock 4, DualSense, and common XInput-compatible controllers.
- Shows a keyboard/mouse overlay with a fixed 64-key compact layout and mouse buttons.
- Tray menu for show/hide, click-through mode, lock position, language selection, and quit.
- Saves your overlay settings, including language, opacity, position, deadzone, sensitivity, and axis inversion.
- Keeps controller and keyboard/mouse input updating on Windows even when the overlay is click-through or not focused.
- Shows a clear message when a controller or visual preset is not supported.
- Includes simulation, debug, and hardware verification tools for development and testing.

## Requirements

- Windows for the current desktop overlay workflow.
- Node.js and npm.
- Rust and Cargo.
- Tauri 2 system requirements installed on your machine.

## Run Locally

Install dependencies:

```powershell
npm install
```

Start the desktop app:

```powershell
npm run tauri:dev
```

## Checks

Run frontend checks:

```powershell
npm run check
npm run test
npm run build
```

Run Rust checks:

```powershell
Push-Location src-tauri
cargo fmt -- --check
cargo test
Pop-Location
```

You can also run the project verification script:

```powershell
.\scripts\verify-project.ps1
```

## Build

Build unsigned Windows installers:

```powershell
npm run tauri:build
```

Expected local outputs:

- `src-tauri/target/release/bundle/nsis/controllerX_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/controllerX_0.1.0_x64_en-US.msi`

## Assets

Controller images and preset files are stored in `public/vendor/input-overlay`.
Licensing and source notes are available in `third_party/input-overlay/NOTICE.md`.
