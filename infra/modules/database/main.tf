resource "aws_dynamodb_table" "share_metadata" {
  name         = "${var.project_name}-share-metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "link_id"

  attribute {
    name = "link_id"
    type = "S"
  }

  attribute {
    name = "owner_username"
    type = "S"
  }

  attribute {
    name = "visibility"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  stream_enabled   = true
  stream_view_type = "OLD_IMAGE"

  global_secondary_index {
    name            = "by_owner"
    hash_key        = "owner_username"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "by_visibility"
    hash_key        = "visibility"
    range_key       = "created_at"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "user_profiles" {
  name         = "${var.project_name}-user-profiles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }
}

resource "aws_dynamodb_table" "display_names" {
  name         = "${var.project_name}-display-names"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "display_name"

  attribute {
    name = "display_name"
    type = "S"
  }
}

resource "aws_dynamodb_table" "audit_log" {
  name         = "${var.project_name}-audit-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "log_id"

  attribute {
    name = "log_id"
    type = "S"
  }

  attribute {
    name = "link_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "owner_username"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  global_secondary_index {
    name            = "by_link_id"
    hash_key        = "link_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "by_owner"
    hash_key        = "owner_username"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
}
