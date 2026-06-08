# controllerX

Transparent desktop controller overlay for Xbox and PlayStation gamepads.

[中文说明](README_zh.md)

controllerX shows a floating gamepad on your desktop and updates it as you press buttons, move sticks, or pull triggers. It is useful for gameplay recording, streaming, testing controller input, and checking whether a controller is being detected correctly.

## Features

- Transparent, always-on-top overlay window.
- Supports Xbox 360, Xbox One, Xbox Series, DualShock 3, DualShock 4, DualSense, and common XInput-compatible controllers.
- Tray menu for show/hide, click-through mode, lock position, quick sizes, and quit.
- Saves your overlay settings, including opacity, scale, position, deadzone, sensitivity, and axis inversion.
- Keeps updating on Windows even when the overlay is click-through or not focused.
- Shows a clear message when a controller or visual preset is not supported.
- Includes simulation, debug, and hardware verification tools for development and testing.

## Current Limitations

- DualShock 4 input matching is implemented, but a DualShock 4 visual preset is not currently available in the bundled assets. The app will show a no-visual-preset message for DS4. See `docs/ds4-asset-status.md`.
- Some controller calibration and hot-plug checks need real hardware testing. See `docs/verification.md`.
- Local Windows installer builds are unsigned unless you provide a code-signing certificate. See `docs/release.md`.

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
