# Rotation Lambda Runbook

## Purpose

Use this runbook to manually trigger, verify, roll back, and audit the rotation Lambda that writes KMS-encrypted data-key artifacts to S3.

## Prerequisites

- AWS CLI authenticated to the target account.
- Access to the Lambda, EventBridge rule, CloudWatch Logs, S3 bucket, and CloudTrail.
- The deployment variables used by the Terraform module:
  - Lambda name
  - Artifact bucket and prefix
  - KMS key ARN
  - AWS region

## Manual invoke

```powershell
aws lambda invoke \
  --function-name rotation-lambda \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  invoke-response.json

Get-Content invoke-response.json
```

Expected result: the function returns `status = ok` and reports the S3 object key that was written.

## Verification steps

1. Verify the latest artifact in S3:

```powershell
aws s3 ls s3://<bucket>/rotations/ --recursive | Select-Object -Last 5
```

2. Review recent CloudWatch logs:

```powershell
aws logs tail /aws/lambda/rotation-lambda --follow --since 15m --region us-east-1
```

3. Run the staging integration helper when you want the end-to-end verification flow:

```powershell
pwsh ./ops/terraform/rotation_lambda/integration-test.ps1 \
  -LambdaName rotation-lambda \
  -BucketName <bucket> \
  -Region us-east-1 \
  -Prefix rotations/
```

## Rollback

1. Disable the EventBridge schedule immediately if the function is unhealthy:

```powershell
aws events disable-rule --name rotation-lambda-schedule --region us-east-1
```

2. Revert the Terraform or Lambda source change in Git, then redeploy from the previous known-good commit.

3. Re-run the integration test and confirm a healthy invoke before re-enabling the schedule.

## Audit and investigation

Review CloudTrail for the following activity around a deployment or manual invoke:

- `AssumeRoleWithWebIdentity`
- `GenerateDataKey`
- `PutObject`
- `Invoke`

Example CloudTrail query:

```powershell
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GenerateDataKey \
  --max-results 20 \
  --region us-east-1
```

## Disable the schedule

Use this during incident response or when you need to pause automated rotation without deleting the Lambda.

```powershell
aws events disable-rule --name rotation-lambda-schedule --region us-east-1
aws events describe-rule --name rotation-lambda-schedule --region us-east-1
```

Re-enable it after the issue is resolved:

```powershell
aws events enable-rule --name rotation-lambda-schedule --region us-east-1
```

## OIDC deployment notes

- Staging and production should use GitHub OIDC with short-lived AWS role assumption.
- Keep the staging role minimal and validate there before promoting to production.
- Production promotion should happen by protected workflow or release tag.
