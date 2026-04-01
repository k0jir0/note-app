[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$LambdaName,

    [Parameter(Mandatory)]
    [string]$BucketName,

    [string]$Region = "us-east-1",
    [string]$Prefix = "rotations/",
    [int]$ArtifactWaitSeconds = 90,
    [int]$LogLookbackMinutes = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-AwsJson {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $output = & aws @Arguments --output json 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI failed: aws $($Arguments -join ' ')`n$output"
    }

    $text = ($output | Out-String).Trim()
    if (-not $text) {
        return $null
    }

    return $text | ConvertFrom-Json
}

$tempResponse = Join-Path ([System.IO.Path]::GetTempPath()) ("rotation-lambda-invoke-{0}.json" -f ([System.Guid]::NewGuid().ToString("N")))
$invokeStartedAt = [DateTimeOffset]::UtcNow

try {
    Write-Host "Invoking $LambdaName in $Region..."
    $invokeRaw = & aws lambda invoke --function-name $LambdaName --region $Region --cli-binary-format raw-in-base64-out --payload "{}" $tempResponse 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Lambda invoke failed.`n$invokeRaw"
    }

    $invokeMetadataText = ($invokeRaw | Out-String).Trim()
    $invokeMetadata = if ($invokeMetadataText) {
        $invokeMetadataText | ConvertFrom-Json
    } else {
        [pscustomobject]@{}
    }

    if ($invokeMetadata -is [System.Array]) {
        $invokeMetadata = $invokeMetadata[-1]
    }

    $responsePayload = if (Test-Path $tempResponse) { Get-Content $tempResponse -Raw } else { "" }

    $functionError = $null
    $statusCode = $null

    if ($invokeMetadata.PSObject.Properties.Match("FunctionError").Count -gt 0) {
        $functionError = $invokeMetadata.FunctionError
    }

    if ($invokeMetadata.PSObject.Properties.Match("StatusCode").Count -gt 0) {
        $statusCode = [int]$invokeMetadata.StatusCode
    }

    if ($functionError) {
        throw "Lambda returned FunctionError '$functionError'. Payload: $responsePayload"
    }

    if ($statusCode -and ($statusCode -lt 200 -or $statusCode -ge 300)) {
        throw "Lambda returned unexpected status code '$statusCode'. Payload: $responsePayload"
    }

    Write-Host "Waiting for a new S3 artifact under s3://$BucketName/$Prefix ..."
    $artifact = $null
    $deadline = (Get-Date).AddSeconds($ArtifactWaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $listing = Invoke-AwsJson -Arguments @("s3api", "list-objects-v2", "--bucket", $BucketName, "--prefix", $Prefix, "--region", $Region)
        $contents = @($listing.Contents) | Where-Object { $_ }
        $artifact = $contents |
            Sort-Object { [DateTimeOffset]$_.LastModified } -Descending |
            Where-Object { [DateTimeOffset]$_.LastModified -ge $invokeStartedAt.AddSeconds(-5) } |
            Select-Object -First 1

        if ($artifact) {
            break
        }

        Start-Sleep -Seconds 5
    }

    if (-not $artifact) {
        throw "No new rotation artifact appeared in s3://$BucketName/$Prefix within $ArtifactWaitSeconds seconds."
    }

    Write-Host "Created artifact: s3://$BucketName/$($artifact.Key)"

    $logGroupName = "/aws/lambda/$LambdaName"
    $logStreams = Invoke-AwsJson -Arguments @("logs", "describe-log-streams", "--log-group-name", $logGroupName, "--order-by", "LastEventTime", "--descending", "--limit", "5", "--region", $Region)
    $latestStream = @($logStreams.logStreams) | Select-Object -First 1
    if (-not $latestStream) {
        throw "No CloudWatch log streams found in $logGroupName."
    }

    $startTime = [int64]$invokeStartedAt.AddMinutes(-1).ToUnixTimeMilliseconds()
    $events = Invoke-AwsJson -Arguments @("logs", "get-log-events", "--log-group-name", $logGroupName, "--log-stream-name", $latestStream.logStreamName, "--start-time", "$startTime", "--limit", "50", "--region", $Region)
    $messages = @($events.events | ForEach-Object { $_.message }) | Where-Object { $_ }

    if (-not $messages) {
        throw "No recent CloudWatch log events found for $LambdaName."
    }

    Write-Host "Recent CloudWatch log events:"
    $messages | ForEach-Object { Write-Host $_ }

    Write-Host "Integration test completed successfully." -ForegroundColor Green
} finally {
    Remove-Item $tempResponse -ErrorAction SilentlyContinue
}
