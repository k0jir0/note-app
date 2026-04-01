[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BucketName,

    [Parameter(Mandatory)]
    [string]$KmsKeyArn,

    [string]$Region = "us-east-1",
    [string]$LambdaName = "rotation-lambda",
    [string]$BackupPrefix = "rotations/",
    [string]$ScheduleExpression = "rate(7 days)",
    [switch]$Apply,
    [string]$AwsProfile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
    if ($AwsProfile) {
        $env:AWS_PROFILE = $AwsProfile
        Write-Host "Using AWS profile: $AwsProfile"
    }

    terraform init -input=false
    if ($LASTEXITCODE -ne 0) {
        throw "terraform init failed"
    }

    terraform validate
    if ($LASTEXITCODE -ne 0) {
        throw "terraform validate failed"
    }

    $planArgs = @(
        "plan",
        "-input=false",
        "-out=tfplan",
        "-var", "region=$Region",
        "-var", "bucket_name=$BucketName",
        "-var", "kms_key_arn=$KmsKeyArn",
        "-var", "lambda_name=$LambdaName",
        "-var", "backup_prefix=$BackupPrefix",
        "-var", "schedule_expression=$ScheduleExpression"
    )

    terraform @planArgs
    if ($LASTEXITCODE -ne 0) {
        throw "terraform plan failed"
    }

    if (-not $Apply) {
        Write-Host "Plan created successfully. Re-run with -Apply to deploy." -ForegroundColor Yellow
        return
    }

    terraform apply -input=false -auto-approve tfplan
    if ($LASTEXITCODE -ne 0) {
        throw "terraform apply failed"
    }

    Write-Host "Rotation Lambda deployment completed." -ForegroundColor Green
} finally {
    Pop-Location
}
