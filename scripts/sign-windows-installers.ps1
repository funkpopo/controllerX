param(
    [string]$BundleRoot = "",
    [string]$CertificatePath = "",
    [string]$CertificatePassword = "",
    [string]$CertificateThumbprint = "",
    [switch]$UseMachineStore,
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [string]$SigntoolPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

if ($BundleRoot.Trim().Length -eq 0) {
    $BundleRoot = Join-Path $ProjectRoot "src-tauri\target\release\bundle"
}

function Resolve-Signtool {
    if ($SigntoolPath.Trim().Length -gt 0) {
        if (-not (Test-Path -LiteralPath $SigntoolPath -PathType Leaf)) {
            throw "signtool.exe was not found at the supplied path: $SigntoolPath"
        }

        return (Resolve-Path -LiteralPath $SigntoolPath).Path
    }

    $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($null -eq $command) {
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
            throw "signtool.exe is required for signed Windows installers and was not found on PATH or in the Windows SDK."
        }

        return $sdkSigntool.FullName
    }

    return $command.Source
}

function Get-RequiredBundles {
    if (-not (Test-Path -LiteralPath $BundleRoot -PathType Container)) {
        throw "Missing Tauri bundle directory: $BundleRoot"
    }

    $bundles = @(Get-ChildItem -Path $BundleRoot -Recurse -File |
        Where-Object { $_.Extension -iin @(".msi", ".exe") } |
        Sort-Object FullName)

    $msiCount = @($bundles | Where-Object { $_.Extension -ieq ".msi" }).Count
    $exeCount = @($bundles | Where-Object { $_.Extension -ieq ".exe" }).Count
    if ($bundles.Count -eq 0 -or $msiCount -eq 0 -or $exeCount -eq 0) {
        throw "Expected both MSI and NSIS/EXE installers under $BundleRoot before signing."
    }

    return $bundles
}

function Get-CertificateArguments {
    $hasPfx = $CertificatePath.Trim().Length -gt 0
    $hasThumbprint = $CertificateThumbprint.Trim().Length -gt 0

    if ($hasPfx -eq $hasThumbprint) {
        throw "Provide exactly one signing identity: -CertificatePath for a PFX file or -CertificateThumbprint for an installed code-signing certificate."
    }

    if ($hasPfx) {
        if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) {
            throw "Code-signing PFX file was not found: $CertificatePath"
        }

        if ($CertificatePassword.Trim().Length -eq 0) {
            throw "CertificatePassword is required when signing with a PFX file."
        }

        return @("/f", (Resolve-Path -LiteralPath $CertificatePath).Path, "/p", $CertificatePassword)
    }

    $thumbprint = ($CertificateThumbprint -replace "\s+", "").ToUpperInvariant()
    if ($thumbprint -notmatch "^[0-9A-F]{40}$") {
        throw "CertificateThumbprint must be a 40-character SHA-1 thumbprint."
    }

    $arguments = @("/sha1", $thumbprint)
    if ($UseMachineStore) {
        $arguments += "/sm"
    }

    return $arguments
}

function Invoke-SigntoolChecked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Signtool,
        [Parameter(Mandatory = $true)]
        [string[]]$CommandArguments
    )

    & $Signtool @CommandArguments
    if ($LASTEXITCODE -ne 0) {
        throw "signtool.exe failed with exit code $LASTEXITCODE."
    }
}

function Assert-ValidSignature {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileInfo]$Bundle
    )

    $signature = Get-AuthenticodeSignature -FilePath $Bundle.FullName
    if ($signature.Status -ne "Valid") {
        throw "Installer signature is not valid for $($Bundle.FullName): $($signature.Status)"
    }

    if ($null -eq $signature.SignerCertificate) {
        throw "Installer has a valid signature status but no signer certificate was reported: $($Bundle.FullName)"
    }

    Write-Host "Valid signature: $($Bundle.FullName)"
    Write-Host "  Signer: $($signature.SignerCertificate.Subject)"
}

$signtool = Resolve-Signtool
$bundles = @(Get-RequiredBundles)
$certificateArguments = @(Get-CertificateArguments)

if ($TimestampUrl.Trim().Length -eq 0) {
    throw "TimestampUrl is required so signed installers remain verifiable after certificate expiry."
}

Write-Host "Signing $($bundles.Count) Windows installer bundle(s)."
foreach ($bundle in $bundles) {
    $arguments = @(
        "sign",
        "/fd",
        "SHA256",
        "/tr",
        $TimestampUrl,
        "/td",
        "SHA256"
    ) + $certificateArguments + @($bundle.FullName)

    Invoke-SigntoolChecked -Signtool $signtool -CommandArguments $arguments
    Assert-ValidSignature -Bundle $bundle
}

Write-Host "Windows installer signing completed."
