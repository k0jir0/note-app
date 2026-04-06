param(
    [switch]$WithWorker,
    [switch]$UsePm2,
    [switch]$Production,
    [switch]$CurrentWindow,
    [int]$Port = 3000,
    [int]$StartupTimeoutSec = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSCommandPath
Set-Location $projectRoot

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)

    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Wait-ForLocalHttpReady {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSec = 25,
        [string]$Path = '/auth/login'
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $probeUri = "http://localhost:$Port$Path"
    $lastFailure = "No listener detected on localhost:$Port."

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $probeUri -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $probeUri
            }

            $lastFailure = "Unexpected HTTP status $($response.StatusCode) from $probeUri."
        } catch {
            $lastFailure = $_.Exception.Message
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Local app did not become ready on $probeUri within $TimeoutSec seconds. Last check: $lastFailure"
}

function Start-LocalProcessWindow {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$CommandText
    )

    $escapedRoot = $projectRoot.Replace("'", "''")
    $escapedTitle = $Title.Replace("'", "''")
    $escapedCommand = $CommandText.Replace("'", "''")
    $bootstrap = "& { Set-Location '$escapedRoot'; `$Host.UI.RawUI.WindowTitle = '$escapedTitle'; `$env:PORT = '$Port'; Invoke-Expression '$escapedCommand' }"

    if ($CurrentWindow) {
        Invoke-Expression $CommandText
        return
    }

    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        $bootstrap
    )
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    throw "Dependencies are not installed. Run 'npm install' in $projectRoot first."
}

if ($UsePm2) {
    if (-not (Test-CommandExists -Name 'pm2')) {
        throw "PM2 is not installed or not on PATH. Install it with 'npm install -g pm2' before using -UsePm2."
    }

    $env:PORT = "$Port"
    $targetApps = if ($WithWorker) { 'helios-web,helios-worker' } else { 'helios-web' }

    pm2 start ecosystem.config.cjs --only $targetApps --update-env
    pm2 status
    Write-Host "PM2 started $targetApps from $projectRoot on port $Port."
    return
}

$webCommand = if ($Production) { 'npm start' } else { 'npm run start-dev' }
$webLabel = if ($Production) { 'test-app web (prod)' } else { 'test-app web (dev)' }
$webProcess = Start-LocalProcessWindow -Title $webLabel -CommandText $webCommand

if (-not $CurrentWindow) {
    $probeUri = Wait-ForLocalHttpReady -Port $Port -TimeoutSec $StartupTimeoutSec
    Write-Host "Verified local web app is reachable at $probeUri."
}

if ($WithWorker) {
    Start-LocalProcessWindow -Title 'test-app background worker' -CommandText 'npm run worker'
}

$workerMessage = if ($WithWorker) { ' and the background worker' } else { '' }
$windowMessage = if ($CurrentWindow) { 'current shell' } else { 'new PowerShell window(s)' }
Write-Host "Started the web app$workerMessage in $windowMessage from $projectRoot on port $Port."
