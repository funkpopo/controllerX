param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(
        "xbox-360",
        "xbox-one",
        "xbox-series",
        "dualshock-3",
        "dualshock-4",
        "dualsense",
        "generic-xinput"
    )]
    [string]$ProfileId,

    [Parameter(Mandatory = $true)]
    [ValidateSet("usb", "bluetooth", "wireless-receiver", "driver-supported-wireless")]
    [string]$Connection,

    [Parameter(Mandatory = $true)]
    [string]$DeviceName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[0-9a-fA-F]{4}$")]
    [string]$VendorId,

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[0-9a-fA-F]{4}$")]
    [string]$ProductId
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$ReportDir = Join-Path $ProjectRoot "verification-reports"
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeName = ($DeviceName -replace "[^a-zA-Z0-9._-]+", "-").Trim("-")
$reportPath = Join-Path $ReportDir "$timestamp-$ProfileId-$Connection-$VendorId-$ProductId-$safeName.md"

$content = @"
# Hardware Verification Report

Created: $(Get-Date -Format o)

## Device

- Profile: ``$ProfileId``
- Connection: ``$Connection``
- Device name: ``$DeviceName``
- VID: ``0x$($VendorId.ToLowerInvariant())``
- PID: ``0x$($ProductId.ToLowerInvariant())``
- Windows version:
- controllerX build:
- Tester:

## Expected Behavior

- Auto profile selects ``$ProfileId``.
- Unsupported state is shown only when the connected hardware does not expose a required mapped input.
- No other controller image is used as a visual replacement.

## Hot-Plug

- [ ] App shows no-device state before connection.
- [ ] Connect event appears in the debug Device events list.
- [ ] App returns to no-device state after disconnect.
- [ ] Disconnect event appears in the debug Device events list.
- [ ] Reconnect returns to the same profile without restarting the app.
- Notes:

## Buttons

- [ ] South
- [ ] East
- [ ] West
- [ ] North
- [ ] Left bumper
- [ ] Right bumper
- [ ] Select / Share / Back
- [ ] Start / Options / Menu
- [ ] Mode / Guide / PS
- [ ] Left thumb
- [ ] Right thumb
- [ ] D-Pad up
- [ ] D-Pad down
- [ ] D-Pad left
- [ ] D-Pad right
- Notes:

## Axes

- [ ] Left stick X moves in the same visual direction as hardware input.
- [ ] Left stick Y moves in the same visual direction as hardware input.
- [ ] Right stick X moves in the same visual direction as hardware input.
- [ ] Right stick Y moves in the same visual direction as hardware input.
- [ ] Left trigger shows gradual partial pressure.
- [ ] Right trigger shows gradual partial pressure.
- Notes:

## Window And Tray

- [ ] Transparent background is visible.
- [ ] Window stays always on top.
- [ ] Taskbar entry exists.
- [ ] Tray show/hide works.
- [ ] Click-through passes mouse events to the desktop/game underneath.
- [ ] Lock-position prevents resizing.
- [ ] Position and size persist after restart.
- [ ] Toolbar hides after idle when enabled.
- Notes:

## Result

- [ ] Passed
- [ ] Failed
- Failure reason:
"@

[System.IO.File]::WriteAllText(
    $reportPath,
    $content,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host $reportPath
