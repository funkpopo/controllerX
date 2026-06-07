# controllerX

controllerX is a transparent desktop gamepad overlay for Xbox and PlayStation controllers.

The app is a Tauri 2 desktop shell with a React/TypeScript renderer and a Rust `gilrs` input layer. It renders controller bodies and overlay sprites from copied `input-overlay` PNG/JSON presets. Runtime controller polling, profile matching, settings, tray handling, and rendering logic are implemented independently.

## Implemented Scope

- Transparent, frameless, always-on-top desktop overlay window.
- Windows taskbar entry and system tray menu for show/hide, click-through, lock-position, common sizes, and quit.
- Persistent settings for selected preset, opacity, scale, click-through, lock-position, toolbar idle hiding, window position/size, deadzones, sensitivity, and axis inversion.
- Explicit controller profiles for Xbox 360, Xbox One, Xbox Series, DualShock 3, DualShock 4, DualSense, and generic XInput-compatible devices.
- Explicit DualSense Mute/TouchPad and DualShock 4 TouchPad fields from SDL/input-overlay button semantics for rendering and verification.
- Explicit VID/PID matching table with per-device override slots for USB/Bluetooth variants.
- Unsupported-device and missing-required-input states are reported directly; the UI does not substitute another controller image.
- Strict preset validation rejects unsupported input-overlay element types and button codes before rendering.
- Simulation mode for UI testing without hardware, including explicit hot-plug and PlayStation extension-button scenarios.
- Debug panel and active-value labels for calibration.
- Hardware verification panel for collecting real-device button, axis, hot-plug, visual, and window/tray evidence into Markdown reports.
- External blocker audit script for checking DS4 asset availability, hardware evidence reports, window/tray evidence, and installer signing status without converting missing evidence into a passing state.
- Windows installer signing script and tagged-release gate that require real Authenticode signatures before publishing release artifacts.
- Partial analog trigger visualization.
- TypeScript and Rust unit tests.
- Local unsigned Windows installer packaging and GitHub release workflow.

## Known External Blocks

- DualShock 4 input matching is implemented, but no DS4 PNG/JSON preset was found in the checked `input-overlay` snapshot or release preset packages. The app shows an explicit no-visual-preset state for DS4. See `docs/ds4-asset-status.md`.
- Real controller calibration and hot-plug verification require physical controllers. The app includes a hardware verification panel for collecting evidence, but the rows remain blocked until the exact device and connection type are tested. See `docs/verification.md`.
- Signed Windows installers require a code-signing certificate and secret configuration. See `docs/release.md`.

## Development

Install dependencies:

```powershell
npm install
```

Run the desktop app:

```powershell
npm run tauri:dev
```

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

Build unsigned Windows bundles:

```powershell
npm run tauri:build
```

Expected local outputs:

- `src-tauri/target/release/bundle/nsis/controllerX_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/controllerX_0.1.0_x64_en-US.msi`

Audit external blockers:

```powershell
.\scripts\audit-external-blockers.ps1
```

Use `-Scope Signing -FailOnBlocked` for a signed-installer gate only. Use `-FailOnBlocked` with the default full scope only for a release gate that should fail when DS4 assets, real hardware evidence, Windows desktop interaction evidence, or valid installer signatures are still missing. Use `-ReportDir <path>` to audit Markdown reports exported from the installed app data directory.

Sign built Windows installers with a real code-signing certificate:

```powershell
.\scripts\sign-windows-installers.ps1 -CertificatePath C:\certs\controllerx.pfx -CertificatePassword $env:WINDOWS_SIGNING_CERTIFICATE_PASSWORD
.\scripts\sign-windows-installers.ps1 -CertificateThumbprint 0123456789ABCDEF0123456789ABCDEF01234567
```

The signing script fails if `signtool.exe`, the signing identity, the MSI/EXE pair, timestamping, or post-signing Authenticode validation is missing.

## Third-party Assets

Controller PNG assets and preset JSON files are stored under `public/vendor/input-overlay`.
See `third_party/input-overlay/NOTICE.md` for source, copied file list, and licensing notes.
