param(
    [switch]$WithWorker,
    [switch]$UsePm2,
    [switch]$Production,
    [switch]$CurrentWindow,
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSCommandPath
Set-Location $projectRoot

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)

    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
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
    ) | Out-Null
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    throw "Dependencies are not installed. Run 'npm install' in $projectRoot first."
}

if ($UsePm2) {
    if (-not (Test-CommandExists -Name 'pm2')) {
        throw "PM2 is not installed or not on PATH. Install it with 'npm install -g pm2' before using -UsePm2."
    }

    $env:PORT = "$Port"
    $targetApps = if ($WithWorker) { 'note-app-web,note-app-worker' } else { 'note-app-web' }

    pm2 start ecosystem.config.cjs --only $targetApps --update-env
    pm2 status
    Write-Host "PM2 started $targetApps from $projectRoot on port $Port."
    return
}

$webCommand = if ($Production) { 'npm start' } else { 'npm run start-dev' }
$webLabel = if ($Production) { 'test-app web (prod)' } else { 'test-app web (dev)' }
Start-LocalProcessWindow -Title $webLabel -CommandText $webCommand

if ($WithWorker) {
    Start-LocalProcessWindow -Title 'test-app realtime worker' -CommandText 'npm run worker'
}

$workerMessage = if ($WithWorker) { ' and the realtime worker' } else { '' }
$windowMessage = if ($CurrentWindow) { 'current shell' } else { 'new PowerShell window(s)' }
Write-Host "Started the web app$workerMessage in $windowMessage from $projectRoot on port $Port."
