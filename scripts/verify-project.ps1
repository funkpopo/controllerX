param(
    [switch]$RequireSignedInstallers
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$CommandArguments,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    Write-Host "==> $FilePath $($CommandArguments -join ' ')" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        & $FilePath @CommandArguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($CommandArguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-RequiredBundle {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativeDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Pattern,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $bundleDirectory = Join-Path $ProjectRoot $RelativeDirectory
    if (-not (Test-Path -LiteralPath $bundleDirectory)) {
        throw "Missing $Description bundle directory: $bundleDirectory"
    }

    $matches = @(Get-ChildItem -Path $bundleDirectory -Filter $Pattern -File |
        Sort-Object LastWriteTime -Descending
    )

    if ($matches.Count -eq 0) {
        throw "Missing $Description bundle matching $Pattern."
    }

    return $matches[0]
}

Write-Host "controllerX verification started at $(Get-Date -Format o)"
Write-Host "Project root: $ProjectRoot"

Invoke-CheckedCommand -FilePath "npm.cmd" -CommandArguments @("run", "check") -WorkingDirectory $ProjectRoot
Invoke-CheckedCommand -FilePath "npm.cmd" -CommandArguments @("run", "test") -WorkingDirectory $ProjectRoot
Invoke-CheckedCommand -FilePath "npm.cmd" -CommandArguments @("run", "build") -WorkingDirectory $ProjectRoot
Invoke-CheckedCommand -FilePath "cargo" -CommandArguments @("fmt", "--", "--check") -WorkingDirectory (Join-Path $ProjectRoot "src-tauri")
Invoke-CheckedCommand -FilePath "cargo" -CommandArguments @("test") -WorkingDirectory (Join-Path $ProjectRoot "src-tauri")
Invoke-CheckedCommand -FilePath "npm.cmd" -CommandArguments @("run", "tauri:build") -WorkingDirectory $ProjectRoot

$msi = Get-RequiredBundle -RelativeDirectory "src-tauri\target\release\bundle\msi" -Pattern "*.msi" -Description "MSI"
$nsis = Get-RequiredBundle -RelativeDirectory "src-tauri\target\release\bundle\nsis" -Pattern "*.exe" -Description "NSIS"
$bundles = @($msi, $nsis)

Write-Host "Bundle outputs:" -ForegroundColor Cyan
foreach ($bundle in $bundles) {
    $signature = Get-AuthenticodeSignature -FilePath $bundle.FullName
    Write-Host "  $($bundle.FullName)"
    Write-Host "    Size: $($bundle.Length) bytes"
    Write-Host "    Signature: $($signature.Status)"

    if ($RequireSignedInstallers -and $signature.Status -ne "Valid") {
        throw "Installer is not signed with a valid Authenticode signature: $($bundle.FullName)"
    }
}

Write-Host "controllerX verification completed at $(Get-Date -Format o)"
