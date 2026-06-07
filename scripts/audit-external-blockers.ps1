param(
    [string]$ReportDir = "",
    [string]$InputOverlayRepo = "https://github.com/univrsal/input-overlay.git",
    [ValidateSet("All", "Signing")]
    [string]$Scope = "All",
    [switch]$SkipUpstreamInputOverlayCheck,
    [switch]$FailOnBlocked
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

$script:PassCount = 0
$script:BlockedCount = 0
$script:InfoCount = 0

function Write-AuditItem {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("PASS", "BLOCKED", "INFO")]
        [string]$Status,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Detail = ""
    )

    $color = switch ($Status) {
        "PASS" { "Green" }
        "BLOCKED" { "Yellow" }
        default { "Gray" }
    }

    Write-Host "[$Status] $Name" -ForegroundColor $color
    if ($Detail.Trim().Length -gt 0) {
        Write-Host "  $Detail"
    }

    switch ($Status) {
        "PASS" { $script:PassCount++ }
        "BLOCKED" { $script:BlockedCount++ }
        "INFO" { $script:InfoCount++ }
    }
}

function Invoke-GitCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$CommandArguments
    )

    $output = & git @CommandArguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($CommandArguments -join ' ') failed with exit code $LASTEXITCODE`: $($output -join [Environment]::NewLine)"
    }

    return @($output)
}

function Resolve-Signtool {
    $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    $sdkRoots = @(
        ${env:ProgramFiles(x86)},
        $env:ProgramFiles
    ) |
        Where-Object { $_ -and $_.Trim().Length -gt 0 } |
        ForEach-Object { Join-Path $_ "Windows Kits\10\bin" } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Container }

    $sdkSigntool = @(
        foreach ($sdkRoot in $sdkRoots) {
            Get-ChildItem -Path $sdkRoot -Recurse -Filter "signtool.exe" -File -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" }
        }
    ) | Sort-Object FullName -Descending | Select-Object -First 1

    if ($null -eq $sdkSigntool) {
        return $null
    }

    return $sdkSigntool.FullName
}

function Get-ReportDirectories {
    $directories = New-Object System.Collections.Generic.List[string]

    if ($ReportDir.Trim().Length -gt 0) {
        if (Test-Path -LiteralPath $ReportDir) {
            $directories.Add((Resolve-Path -LiteralPath $ReportDir).Path)
        }
        return @($directories)
    }

    $workspaceReports = Join-Path $ProjectRoot "verification-reports"
    if (Test-Path -LiteralPath $workspaceReports) {
        $directories.Add((Resolve-Path -LiteralPath $workspaceReports).Path)
    }

    if ($env:APPDATA) {
        $appDataReports = Join-Path $env:APPDATA "dev.controllerx.overlay\verification-reports"
        if (Test-Path -LiteralPath $appDataReports) {
            $directories.Add((Resolve-Path -LiteralPath $appDataReports).Path)
        }
    }

    return @($directories | Select-Object -Unique)
}

function Get-HardwareReports {
    $directories = @(Get-ReportDirectories)
    if ($directories.Count -eq 0) {
        return @()
    }

    return @(
        foreach ($directory in $directories) {
            Get-ChildItem -Path $directory -Filter "*.md" -File -ErrorAction Stop |
                ForEach-Object {
                    [pscustomobject]@{
                        Path = $_.FullName
                        Content = Get-Content -LiteralPath $_.FullName -Raw
                    }
                }
        }
    )
}

function Test-ReportLine {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,
        [Parameter(Mandatory = $true)]
        [string]$Line
    )

    return $Content.Contains($Line)
}

function Test-ReadyHardwareReport {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,
        [Parameter(Mandatory = $true)]
        [string]$ProfileId,
        [Parameter(Mandatory = $true)]
        [string[]]$Connections
    )

    $profileMatched =
        (Test-ReportLine -Content $Content -Line "- Expected profile: ``$ProfileId``") -or
        (Test-ReportLine -Content $Content -Line "- Profile: ``$ProfileId``")
    if (-not $profileMatched) {
        return $false
    }

    $connectionMatched = $false
    foreach ($connection in $Connections) {
        if (Test-ReportLine -Content $Content -Line "- Connection: ``$connection``") {
            $connectionMatched = $true
            break
        }
    }

    if (-not $connectionMatched) {
        return $false
    }

    $requiredEvidenceLines = @(
        "- Profile match: yes",
        "- Simulation observed during session: no",
        "- [x] Real connect event captured",
        "- [x] Real disconnect event captured",
        "- Status: Ready for tester signoff"
    )

    foreach ($line in $requiredEvidenceLines) {
        if (-not (Test-ReportLine -Content $Content -Line $line)) {
            return $false
        }
    }

    return $true
}

function Find-ReadyHardwareReport {
    param(
        [AllowEmptyCollection()]
        [object[]]$Reports,
        [Parameter(Mandatory = $true)]
        [string]$ProfileId,
        [Parameter(Mandatory = $true)]
        [string[]]$Connections
    )

    foreach ($report in $Reports) {
        if (Test-ReadyHardwareReport -Content $report.Content -ProfileId $ProfileId -Connections $Connections) {
            return $report
        }
    }

    return $null
}

function Test-ProfileGate {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [AllowEmptyCollection()]
        [object[]]$Reports,
        [Parameter(Mandatory = $true)]
        [string]$ProfileId,
        [Parameter(Mandatory = $true)]
        [string[]]$Connections
    )

    $match = Find-ReadyHardwareReport -Reports $Reports -ProfileId $ProfileId -Connections $Connections
    if ($null -eq $match) {
        Write-AuditItem -Status "BLOCKED" -Name $Name -Detail "No app-generated report has Ready for tester signoff, matching profile, real connect/disconnect, and simulation=no."
        return
    }

    Write-AuditItem -Status "PASS" -Name $Name -Detail $match.Path
}

function Test-Ds4LocalAssets {
    $assetRoot = Join-Path $ProjectRoot "public\vendor\input-overlay"
    if (-not (Test-Path -LiteralPath $assetRoot)) {
        Write-AuditItem -Status "BLOCKED" -Name "DualShock 4 local visual asset" -Detail "Missing input-overlay asset root: $assetRoot"
        return
    }

    $pattern = "(?i)(ds4|dualshock[-_ ]?4|ps4|playstation[-_ ]?4)"
    $files = @(Get-ChildItem -Path $assetRoot -Recurse -File)
    $pngFiles = @($files | Where-Object { $_.FullName -match $pattern -and $_.Extension -ieq ".png" })
    $jsonFiles = @($files | Where-Object { $_.FullName -match $pattern -and $_.Extension -ieq ".json" })

    if ($pngFiles.Count -gt 0 -and $jsonFiles.Count -gt 0) {
        Write-AuditItem -Status "PASS" -Name "DualShock 4 local visual asset" -Detail "Found $($pngFiles.Count) PNG and $($jsonFiles.Count) JSON DS4-matching asset files under public/vendor/input-overlay."
        return
    }

    Write-AuditItem -Status "BLOCKED" -Name "DualShock 4 local visual asset" -Detail "No DS4-matching PNG/JSON pair exists under public/vendor/input-overlay."
}

function Test-Ds4UpstreamAssets {
    if ($SkipUpstreamInputOverlayCheck) {
        Write-AuditItem -Status "INFO" -Name "input-overlay upstream DS4 asset check" -Detail "Skipped by parameter."
        return
    }

    try {
        Get-Command git -ErrorAction Stop | Out-Null

        $tempParent = Join-Path ([System.IO.Path]::GetTempPath()) "controllerx-input-overlay-audit"
        New-Item -ItemType Directory -Path $tempParent -Force | Out-Null
        $repoDir = Join-Path $tempParent ([Guid]::NewGuid().ToString("N"))

        try {
            Invoke-GitCapture -CommandArguments @(
                "clone",
                "--filter=blob:none",
                "--depth",
                "1",
                "--sparse",
                $InputOverlayRepo,
                $repoDir
            ) | Out-Null

            $headLines = @(Invoke-GitCapture -CommandArguments @("-C", $repoDir, "rev-parse", "HEAD"))
            $head = $headLines[0]
            $paths = @(Invoke-GitCapture -CommandArguments @("-C", $repoDir, "ls-tree", "-r", "--name-only", "HEAD"))
            $pattern = "(?i)(ds4|dualshock[-_ ]?4|ps4|playstation[-_ ]?4)"
            $pngPaths = @($paths | Where-Object { $_ -match $pattern -and $_ -match "\.png$" })
            $jsonPaths = @($paths | Where-Object { $_ -match $pattern -and $_ -match "\.json$" })

            if ($pngPaths.Count -gt 0 -and $jsonPaths.Count -gt 0) {
                Write-AuditItem -Status "PASS" -Name "input-overlay upstream DS4 asset check" -Detail "HEAD $head contains DS4-matching PNG/JSON paths."
            }
            else {
                Write-AuditItem -Status "BLOCKED" -Name "input-overlay upstream DS4 asset check" -Detail "HEAD $head contains no DS4-matching PNG/JSON pair."
            }
        }
        finally {
            $resolvedParent = (Resolve-Path -LiteralPath $tempParent).Path
            $resolvedRepo = $null
            if (Test-Path -LiteralPath $repoDir) {
                $resolvedRepo = (Resolve-Path -LiteralPath $repoDir).Path
            }

            if ($resolvedRepo -and $resolvedRepo.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
                Remove-Item -LiteralPath $resolvedRepo -Recurse -Force
            }
        }
    }
    catch {
        Write-AuditItem -Status "BLOCKED" -Name "input-overlay upstream DS4 asset check" -Detail "Could not verify upstream repository: $($_.Exception.Message)"
    }
}

function Test-WindowTrayEvidence {
    param(
        [AllowEmptyCollection()]
        [object[]]$Reports
    )

    $requiredLines = @(
        "- [x] Transparent background visible",
        "- [x] Window stays always on top",
        "- [x] Taskbar entry exists",
        "- [x] Tray show/hide works",
        "- [x] Click-through passes mouse events",
        "- [x] Lock-position prevents resize/move changes",
        "- [x] Position and size persist after restart",
        "- [x] Toolbar hides after idle when enabled",
        "- Status: Ready for tester signoff"
    )

    foreach ($report in $Reports) {
        $complete = $true
        foreach ($line in $requiredLines) {
            if (-not (Test-ReportLine -Content $report.Content -Line $line)) {
                $complete = $false
                break
            }
        }

        if ($complete) {
            Write-AuditItem -Status "PASS" -Name "Windows transparent window and tray evidence" -Detail $report.Path
            return
        }
    }

    Write-AuditItem -Status "BLOCKED" -Name "Windows transparent window and tray evidence" -Detail "No Ready report includes all window/tray manual checks."
}

function Test-SigningEvidence {
    param(
        [switch]$SkipCertificateStoreCheck
    )

    $bundleRoot = Join-Path $ProjectRoot "src-tauri\target\release\bundle"
    if (-not (Test-Path -LiteralPath $bundleRoot)) {
        Write-AuditItem -Status "BLOCKED" -Name "Windows installer signatures" -Detail "Missing bundle output directory: $bundleRoot"
    }
    else {
        $bundles = @(Get-ChildItem -Path $bundleRoot -Recurse -File |
            Where-Object { $_.Extension -iin @(".msi", ".exe") })
        $msiCount = @($bundles | Where-Object { $_.Extension -ieq ".msi" }).Count
        $exeCount = @($bundles | Where-Object { $_.Extension -ieq ".exe" }).Count

        if ($bundles.Count -eq 0 -or $msiCount -eq 0 -or $exeCount -eq 0) {
            Write-AuditItem -Status "BLOCKED" -Name "Windows installer signatures" -Detail "Expected both MSI and NSIS/EXE bundle outputs before signature verification."
        }
        else {
            $signatureRows = @(
                foreach ($bundle in $bundles) {
                    $signature = Get-AuthenticodeSignature -FilePath $bundle.FullName
                    [pscustomobject]@{
                        Path = $bundle.FullName
                        Status = [string]$signature.Status
                    }
                }
            )

            $invalid = @($signatureRows | Where-Object { $_.Status -ne "Valid" })
            $detail = ($signatureRows | ForEach-Object { "$($_.Status): $($_.Path)" }) -join "; "
            if ($invalid.Count -eq 0) {
                Write-AuditItem -Status "PASS" -Name "Windows installer signatures" -Detail $detail
            }
            else {
                Write-AuditItem -Status "BLOCKED" -Name "Windows installer signatures" -Detail $detail
            }
        }
    }

    if ($SkipCertificateStoreCheck) {
        Write-AuditItem -Status "INFO" -Name "Windows code-signing certificate store" -Detail "Skipped because this audit scope verifies already-built installer signatures."
    }
    else {
        $currentUserCerts = @(Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue)
        $localMachineCerts = @(Get-ChildItem Cert:\LocalMachine\My -CodeSigningCert -ErrorAction SilentlyContinue)
        $certCount = $currentUserCerts.Count + $localMachineCerts.Count
        if ($certCount -gt 0) {
            Write-AuditItem -Status "PASS" -Name "Windows code-signing certificate" -Detail "$certCount code-signing certificate(s) found in CurrentUser/LocalMachine certificate stores."
        }
        else {
            Write-AuditItem -Status "BLOCKED" -Name "Windows code-signing certificate" -Detail "No code-signing certificate found in CurrentUser or LocalMachine My stores."
        }
    }

    $signtool = Resolve-Signtool
    if ($null -eq $signtool) {
        Write-AuditItem -Status "BLOCKED" -Name "signtool.exe availability" -Detail "signtool.exe is not available on PATH or in the Windows SDK."
    }
    else {
        Write-AuditItem -Status "PASS" -Name "signtool.exe availability" -Detail $signtool
    }
}

Write-Host "controllerX external blocker audit started at $(Get-Date -Format o)"
Write-Host "Project root: $ProjectRoot"
Write-Host "Scope: $Scope"

if ($Scope -eq "All") {
    $reports = @(Get-HardwareReports)
    $reportDirectories = @(Get-ReportDirectories)
    if ($reportDirectories.Count -eq 0) {
        Write-AuditItem -Status "INFO" -Name "Hardware verification report directories" -Detail "No verification report directory found. Pass -ReportDir to audit exported app-data reports."
    }
    else {
        Write-AuditItem -Status "INFO" -Name "Hardware verification report directories" -Detail ($reportDirectories -join "; ")
    }
    Write-AuditItem -Status "INFO" -Name "Hardware verification reports found" -Detail "$($reports.Count) Markdown report(s)."

    Test-Ds4LocalAssets
    Test-Ds4UpstreamAssets

    $hardwareGates = @(
        @{ Name = "Xbox 360 hardware hot-plug/calibration evidence"; ProfileId = "xbox-360"; Connections = @("usb", "wireless-receiver") },
        @{ Name = "Xbox One USB hardware hot-plug/calibration evidence"; ProfileId = "xbox-one"; Connections = @("usb") },
        @{ Name = "Xbox One Bluetooth hardware hot-plug/calibration evidence"; ProfileId = "xbox-one"; Connections = @("bluetooth") },
        @{ Name = "Xbox Series USB hardware hot-plug/calibration evidence"; ProfileId = "xbox-series"; Connections = @("usb") },
        @{ Name = "Xbox Series Bluetooth hardware hot-plug/calibration evidence"; ProfileId = "xbox-series"; Connections = @("bluetooth") },
        @{ Name = "DualShock 3 hardware hot-plug/calibration evidence"; ProfileId = "dualshock-3"; Connections = @("usb", "driver-supported-wireless") },
        @{ Name = "DualShock 4 USB hardware input evidence"; ProfileId = "dualshock-4"; Connections = @("usb") },
        @{ Name = "DualShock 4 Bluetooth hardware input evidence"; ProfileId = "dualshock-4"; Connections = @("bluetooth") },
        @{ Name = "DualSense USB hardware hot-plug/calibration evidence"; ProfileId = "dualsense"; Connections = @("usb") },
        @{ Name = "DualSense Bluetooth hardware hot-plug/calibration evidence"; ProfileId = "dualsense"; Connections = @("bluetooth") },
        @{ Name = "Generic XInput hardware hot-plug/calibration evidence"; ProfileId = "generic-xinput"; Connections = @("usb", "bluetooth", "wireless-receiver", "driver-supported-wireless") }
    )

    foreach ($gate in $hardwareGates) {
        Test-ProfileGate -Name $gate.Name -Reports $reports -ProfileId $gate.ProfileId -Connections $gate.Connections
    }

    Test-WindowTrayEvidence -Reports $reports
    Test-SigningEvidence
}
else {
    Test-SigningEvidence -SkipCertificateStoreCheck
}

Write-Host "Summary: $script:PassCount pass, $script:BlockedCount blocked, $script:InfoCount info."
Write-Host "This audit reports external evidence status only; it does not mark todo.md rows complete."

if ($FailOnBlocked -and $script:BlockedCount -gt 0) {
    exit 2
}
