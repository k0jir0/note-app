output "lambda_function_name" {
  description = "Rotation Lambda name"
  value       = aws_lambda_function.rotation.function_name
}

output "lambda_function_arn" {
  description = "Rotation Lambda ARN"
  value       = aws_lambda_function.rotation.arn
}

output "lambda_log_group_name" {
  description = "CloudWatch log group for the rotation Lambda"
  value       = aws_cloudwatch_log_group.rotation.name
}

output "schedule_rule_name" {
  description = "EventBridge schedule rule name"
  value       = aws_cloudwatch_event_rule.schedule.name
}
