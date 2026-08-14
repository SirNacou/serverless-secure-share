package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type App struct {
	dbClient   *dynamodb.Client
	s3Client   *s3.Client
	tableName  string
	bucketName string
}

func newApp(ctx context.Context) (*App, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	return &App{
		dbClient:   dynamodb.NewFromConfig(cfg),
		s3Client:   s3.NewFromConfig(cfg),
		tableName:  os.Getenv("TABLE_NAME"),
		bucketName: os.Getenv("BUCKET_NAME"),
	}, nil
}

var uploadKeyRegex = regexp.MustCompile(`uploads/([^/]+)/`)

func (a *App) HandleRequest(ctx context.Context, event json.RawMessage) error {
	var lambdaEvent struct {
		Records []json.RawMessage `json:"Records"`
	}
	if err := json.Unmarshal(event, &lambdaEvent); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	for _, rawRecord := range lambdaEvent.Records {
		var s3Event events.S3Event
		if err := json.Unmarshal(rawRecord, &s3Event); err == nil && len(s3Event.Records) > 0 {
			if err := a.handleS3Event(ctx, s3Event); err != nil {
				log.Printf("S3 event handling error: %v", err)
			}
			continue
		}

		var ddbEvent events.DynamoDBEvent
		if err := json.Unmarshal(rawRecord, &ddbEvent); err == nil && len(ddbEvent.Records) > 0 {
			if err := a.handleDynamoDBEvent(ctx, ddbEvent); err != nil {
				log.Printf("DynamoDB event handling error: %v", err)
			}
			continue
		}
	}

	return nil
}

func (a *App) handleS3Event(ctx context.Context, event events.S3Event) error {
	for _, record := range event.Records {
		fileKey := strings.ReplaceAll(record.S3.Object.Key, "+", " ")
		fileKey, err := urlDecode(fileKey)
		if err != nil {
			log.Printf("Failed to decode S3 key: %v", err)
			continue
		}

		match := uploadKeyRegex.FindStringSubmatch(fileKey)
		if match == nil {
			continue
		}

		uploadID := match[1]

		_, err = a.dbClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName: aws.String(a.tableName),
			Key: map[string]types.AttributeValue{
				"link_id": &types.AttributeValueMemberS{Value: uploadID},
			},
			UpdateExpression: aws.String("SET #statusAttr = :newStatus"),
			ExpressionAttributeNames: map[string]string{
				"#statusAttr": "status",
			},
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":newStatus": &types.AttributeValueMemberS{Value: "AVAILABLE"},
			},
		})
		if err != nil {
			return fmt.Errorf("failed to update status for %s: %w", uploadID, err)
		}

		log.Printf("Synchronized status to AVAILABLE for file asset: %s", uploadID)
	}

	return nil
}

func (a *App) handleDynamoDBEvent(ctx context.Context, event events.DynamoDBEvent) error {
	for _, record := range event.Records {
		if record.EventName != "REMOVE" {
			continue
		}

		oldImage := record.Change.OldImage
		if oldImage == nil {
			continue
		}

		assetType, ok := oldImage["asset_type"]
		if !ok || assetType.String() != "FILE" {
			continue
		}

		fileKeyAttr, ok := oldImage["fileKey"]
		if !ok || fileKeyAttr.String() == "" {
			continue
		}

		fileKey := fileKeyAttr.String()
		log.Printf("DynamoDB TTL Triggered: Purging orphaned S3 binary: %s", fileKey)

		_, err := a.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(a.bucketName),
			Key:    aws.String(fileKey),
		})
		if err != nil {
			return fmt.Errorf("failed to delete S3 object %s: %w", fileKey, err)
		}

		log.Printf("Successfully purged S3 binary: %s", fileKey)
	}

	return nil
}

func urlDecode(s string) (string, error) {
	decoded := s
	decoded = strings.ReplaceAll(decoded, "+", " ")
	return decoded, nil
}

func main() {
	ctx := context.Background()
	app, err := newApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}

	lambda.Start(app.HandleRequest)
}
