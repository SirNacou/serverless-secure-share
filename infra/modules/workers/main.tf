# ── IAM for s3-sync worker ──────────────────────────────────────────
resource "aws_iam_role" "s3_sync" {
  name = "${var.project_name}-s3-sync-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_sync_logs" {
  role       = aws_iam_role.s3_sync.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "s3_sync" {
  name = "${var.project_name}-s3-sync-policy"
  role = aws_iam_role.s3_sync.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:UpdateItem"]
        Resource = [
          var.metadata_table_arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
        ]
        Resource = [
          var.metadata_table_stream_arn,
        ]
      },
      {
        Effect = "Allow"
        Action = ["s3:DeleteObject"]
        Resource = [
          "${var.bucket_arn}/uploads/*",
        ]
      },
    ]
  })
}

# ── s3-sync Lambda ─────────────────────────────────────────────────
resource "aws_lambda_function" "s3_sync" {
  function_name    = "${var.project_name}-s3-sync"
  role             = aws_iam_role.s3_sync.arn
  runtime          = "provided.al2023"
  handler          = "bootstrap"
  memory_size      = 128
  timeout          = 30
  filename         = "${path.module}/../../build/lambda/s3-sync/bootstrap.zip"
  source_code_hash = filebase64sha256("${path.module}/../../build/lambda/s3-sync/bootstrap.zip")

  environment {
    variables = {
      TABLE_NAME  = var.metadata_table_name
      BUCKET_NAME = var.bucket_name
    }
  }
}

resource "aws_lambda_permission" "s3_sync" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_sync.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.bucket_arn
}

resource "aws_s3_bucket_notification" "s3_sync" {
  bucket = var.bucket_id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_sync.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
  }

  depends_on = [aws_lambda_permission.s3_sync]
}

resource "aws_lambda_event_source_mapping" "s3_sync_stream" {
  event_source_arn = var.metadata_table_stream_arn
  function_name    = aws_lambda_function.s3_sync.arn
  starting_position = "LATEST"
  batch_size       = 10
}

# ── IAM for audit-logger worker ────────────────────────────────────
resource "aws_iam_role" "audit_logger" {
  name = "${var.project_name}-audit-logger-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "audit_logger_logs" {
  role       = aws_iam_role.audit_logger.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "audit_logger_dynamo" {
  name = "${var.project_name}-audit-logger-dynamo"
  role = aws_iam_role.audit_logger.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:PutItem"]
        Resource = [
          var.audit_log_table_arn,
          "${var.audit_log_table_arn}/index/*",
        ]
      },
    ]
  })
}

resource "aws_iam_role_policy" "audit_logger_sqs" {
  name = "${var.project_name}-audit-logger-sqs"
  role = aws_iam_role.audit_logger.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = [
          var.audit_queue_arn,
        ]
      },
    ]
  })
}

# ── audit-logger Lambda ────────────────────────────────────────────
resource "aws_lambda_function" "audit_logger" {
  function_name    = "${var.project_name}-audit-logger"
  role             = aws_iam_role.audit_logger.arn
  runtime          = "provided.al2023"
  handler          = "bootstrap"
  memory_size      = 128
  timeout          = 30
  filename         = "${path.module}/../../build/lambda/audit-logger/bootstrap.zip"
  source_code_hash = filebase64sha256("${path.module}/../../build/lambda/audit-logger/bootstrap.zip")

  environment {
    variables = {
      AUDIT_TABLE_NAME = var.audit_log_table_name
    }
  }
}

resource "aws_lambda_event_source_mapping" "audit_sqs" {
  event_source_arn                   = var.audit_queue_arn
  function_name                      = aws_lambda_function.audit_logger.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
}
