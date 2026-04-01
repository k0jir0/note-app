param(
    [int]$Port = 3000,
    [string]$Path = '/auth/login',
    [int]$TimeoutSec = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$probeUri = "http://localhost:$Port$Path"

try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $probeUri -TimeoutSec $TimeoutSec
    Write-Host "OK $probeUri -> HTTP $($response.StatusCode)"
    exit 0
} catch {
    $message = $_.Exception.Message
    Write-Error "Local app health check failed for $probeUri. $message"
    Write-Host "If the app is not running, start it from the repo root with:"
    Write-Host "  .\\run-local.ps1 -CurrentWindow"
    Write-Host "or"
    Write-Host "  npm run start-dev"
    exit 1
}