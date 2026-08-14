package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"errors"

	"github.com/SirNacou/serverless-secure-share/internal/models"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type App struct {
	dbClient  *dynamodb.Client
	tableName string
}

func newApp(ctx context.Context) (*App, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	return &App{
		dbClient:  dynamodb.NewFromConfig(cfg),
		tableName: os.Getenv("AUDIT_TABLE_NAME"),
	}, nil
}

func (a *App) HandleRequest(ctx context.Context, event events.SQSEvent) error {
	var failedMessages []string

	for _, record := range event.Records {
		var body models.AuditMessage
		if err := json.Unmarshal([]byte(record.Body), &body); err != nil {
			log.Printf("Failed to parse SQS message body: %v", err)
			failedMessages = append(failedMessages, record.MessageId)
			continue
		}

		ttl := time.Now().Unix() + 7776000 // 90-day retention

		item := map[string]types.AttributeValue{
			"log_id":    &types.AttributeValueMemberS{Value: body.LogID},
			"link_id":   &types.AttributeValueMemberS{Value: body.LinkID},
			"actor":     &types.AttributeValueMemberS{Value: body.Actor},
			"timestamp": &types.AttributeValueMemberN{Value: strconv.FormatInt(body.Timestamp, 10)},
			"action":    &types.AttributeValueMemberS{Value: body.Action},
			"status":    &types.AttributeValueMemberS{Value: body.Status},
			"ttl":       &types.AttributeValueMemberN{Value: strconv.FormatInt(ttl, 10)},
		}

		if body.ShareName != "" {
			item["share_name"] = &types.AttributeValueMemberS{Value: body.ShareName}
		}
		if body.AssetType != "" {
			item["asset_type"] = &types.AttributeValueMemberS{Value: body.AssetType}
		}
		if body.Visibility != "" {
			item["visibility"] = &types.AttributeValueMemberS{Value: body.Visibility}
		}
		if body.OwnerUsername != "" {
			item["owner_username"] = &types.AttributeValueMemberS{Value: body.OwnerUsername}
		}
		if body.CreatedAt != nil {
			item["created_at"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*body.CreatedAt, 10)}
		}
		if body.ShareTTL != nil {
			item["share_ttl"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*body.ShareTTL, 10)}
		}

		_, err := a.dbClient.PutItem(ctx, &dynamodb.PutItemInput{
			TableName:           aws.String(a.tableName),
			ConditionExpression: aws.String("attribute_not_exists(log_id)"),
			Item:                item,
		})
		if err != nil {
			var condFailed *types.ConditionalCheckFailedException
			if errors.As(err, &condFailed) {
				continue
			}
			log.Printf("Audit log write failed: %v", err)
			failedMessages = append(failedMessages, record.MessageId)
		}
	}

	if len(failedMessages) > 0 {
		return fmt.Errorf("batch processing completed with %d failures", len(failedMessages))
	}

	return nil
}

func main() {
	ctx := context.Background()
	app, err := newApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}

	lambda.Start(app.HandleRequest)
}
