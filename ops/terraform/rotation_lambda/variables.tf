variable "region" {
  description = "AWS region to deploy the Lambda"
  type        = string
  default     = "us-east-1"
}

variable "lambda_name" {
  description = "Name for the rotation Lambda"
  type        = string
  default     = "rotation-lambda"
}

variable "bucket_name" {
  description = "S3 bucket to store rotation artifacts"
  type        = string

  validation {
    condition     = length(trimspace(var.bucket_name)) > 0
    error_message = "bucket_name must not be empty."
  }
}

variable "backup_prefix" {
  description = "S3 key prefix to place rotation artifacts"
  type        = string
  default     = "rotations/"
}

variable "kms_key_arn" {
  description = "KMS key or alias ARN used to generate data keys"
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^arn:aws[a-zA-Z-]*:kms:[a-z0-9-]+:[0-9]{12}:(key|alias)/.+$", var.kms_key_arn))
    error_message = "kms_key_arn must be a valid AWS KMS key or alias ARN."
  }
}

variable "schedule_expression" {
  description = "EventBridge schedule expression (rate or cron)"
  type        = string
  default     = "rate(7 days)"
}

variable "lambda_timeout_seconds" {
  description = "Rotation Lambda timeout in seconds"
  type        = number
  default     = 60

  validation {
    condition     = var.lambda_timeout_seconds >= 1 && var.lambda_timeout_seconds <= 900
    error_message = "lambda_timeout_seconds must be between 1 and 900 seconds."
  }
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention for the rotation Lambda"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_in_days)
    error_message = "log_retention_in_days must be an AWS-supported retention value."
  }
}
