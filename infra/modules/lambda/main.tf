locals {
  api_handlers = {
    upload = {
      route      = "POST /api/upload"
      auth       = true
      memory_size = 128
      env = {
        TABLE_NAME      = var.metadata_table_name
        BUCKET_NAME     = var.bucket_name
        AUDIT_QUEUE_URL = var.audit_queue_url
      }
      iam_actions = {
        dynamodb = ["dynamodb:GetItem", "dynamodb:PutItem"]
        s3       = ["s3:PutObject"]
        sqs      = ["sqs:SendMessage"]
      }
    }
    download = {
      route      = "POST /api/share/{shareId}/consume"
      auth       = false
      memory_size = 128
      env = {
        TABLE_NAME           = var.metadata_table_name
        BUCKET_NAME          = var.bucket_name
        AUDIT_QUEUE_URL      = var.audit_queue_url
        COGNITO_USER_POOL_ID = var.user_pool_id
        COGNITO_CLIENT_ID    = var.user_pool_client_id
      }
      iam_actions = {
        dynamodb = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        s3       = ["s3:GetObject", "s3:DeleteObject", "s3:PutObject"]
        sqs      = ["sqs:SendMessage"]
      }
    }
    list = {
      route      = "GET /api/shares"
      auth       = true
      memory_size = 128
      env = {
        TABLE_NAME = var.metadata_table_name
      }
      iam_actions = {
        dynamodb = ["dynamodb:Query"]
      }
    }
    share-info = {
      route      = "GET /api/share/{shareId}"
      auth       = false
      memory_size = 128
      env = {
        TABLE_NAME           = var.metadata_table_name
        COGNITO_USER_POOL_ID = var.user_pool_id
        COGNITO_CLIENT_ID    = var.user_pool_client_id
      }
      iam_actions = {
        dynamodb = ["dynamodb:GetItem"]
      }
    }
    explore = {
      route      = "GET /api/explore"
      auth       = false
      memory_size = 128
      env = {
        TABLE_NAME           = var.metadata_table_name
        PROFILE_TABLE_NAME   = var.user_profiles_table_name
        COGNITO_USER_POOL_ID = var.user_pool_id
        COGNITO_CLIENT_ID    = var.user_pool_client_id
      }
      iam_actions = {
        dynamodb = ["dynamodb:Query", "dynamodb:Scan", "dynamodb:GetItem", "dynamodb:BatchGetItem"]
      }
    }
    activity = {
      route      = "GET /api/activity"
      auth       = true
      memory_size = 128
      env = {
        AUDIT_TABLE_NAME = var.audit_log_table_name
      }
      iam_actions = {
        dynamodb = ["dynamodb:Query"]
      }
    }
    profile = {
      route      = "GET /api/profile"
      auth       = true
      memory_size = 128
      env = {
        PROFILE_TABLE_NAME      = var.user_profiles_table_name
        DISPLAY_NAMES_TABLE_NAME = var.display_names_table_name
      }
      iam_actions = {
        dynamodb = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
      }
    }
    profile-put = {
      route      = "PUT /api/profile"
      auth       = true
      memory_size = 128
      env = {
        PROFILE_TABLE_NAME      = var.user_profiles_table_name
        DISPLAY_NAMES_TABLE_NAME = var.display_names_table_name
      }
      iam_actions = {
        dynamodb = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
      }
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each = local.api_handlers

  name = "${var.project_name}-${each.key}-lambda-role"

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

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  for_each = local.api_handlers

  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda" {
  for_each = local.api_handlers

  name = "${var.project_name}-${each.key}-policy"
  role = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect   = "Allow"
          Action   = each.value.iam_actions.dynamodb
          Resource = [
            "arn:aws:dynamodb:*:*:table/${var.metadata_table_name}",
            "arn:aws:dynamodb:*:*:table/${var.metadata_table_name}/index/*",
            "arn:aws:dynamodb:*:*:table/${var.audit_log_table_name}",
            "arn:aws:dynamodb:*:*:table/${var.audit_log_table_name}/index/*",
            "arn:aws:dynamodb:*:*:table/${var.user_profiles_table_name}",
            "arn:aws:dynamodb:*:*:table/${var.user_profiles_table_name}/index/*",
            "arn:aws:dynamodb:*:*:table/${var.display_names_table_name}",
            "arn:aws:dynamodb:*:*:table/${var.display_names_table_name}/index/*",
          ]
        },
      ],
      lookup(each.value.iam_actions, "s3", null) != null ? [{
        Effect   = "Allow"
        Action   = each.value.iam_actions.s3
        Resource = ["${var.bucket_arn}/*"]
      }] : [],
      lookup(each.value.iam_actions, "sqs", null) != null ? [{
        Effect   = "Allow"
        Action   = each.value.iam_actions.sqs
        Resource = [var.audit_queue_arn]
      }] : [],
    )
  })
}

resource "aws_lambda_function" "api" {
  for_each = local.api_handlers

  function_name = "${var.project_name}-${each.key}"
  role          = aws_iam_role.lambda[each.key].arn
  runtime       = "provided.al2023"
  handler       = "bootstrap"
  memory_size   = each.value.memory_size
  timeout       = 30

  filename         = "${path.module}/../../build/lambda/${each.key}/bootstrap.zip"
  source_code_hash = filebase64sha256("${path.module}/../../build/lambda/${each.key}/bootstrap.zip")

  environment {
    variables = each.value.env
  }
}

resource "aws_apigatewayv2_integration" "api" {
  for_each = local.api_handlers

  api_id                 = var.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api[each.key].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  for_each = local.api_handlers

  api_id             = var.api_id
  route_key          = each.value.route
  target             = "integrations/${aws_apigatewayv2_integration.api[each.key].id}"
  authorization_type = each.value.auth ? "JWT" : "NONE"
  authorizer_id      = each.value.auth ? var.authorizer_id : null
}

resource "aws_lambda_permission" "api" {
  for_each = local.api_handlers

  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*"
}
