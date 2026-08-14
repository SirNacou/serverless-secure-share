package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"sort"

	"github.com/SirNacou/serverless-secure-share/internal/models"
	"github.com/SirNacou/serverless-secure-share/internal/utils"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
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

type AuditEvent struct {
	LogID         string `dynamodbav:"log_id" json:"log_id"`
	LinkID        string `dynamodbav:"link_id" json:"link_id"`
	Actor         string `dynamodbav:"actor" json:"actor"`
	Timestamp     int64  `dynamodbav:"timestamp" json:"timestamp"`
	Action        string `dynamodbav:"action" json:"action"`
	Status        string `dynamodbav:"status" json:"status"`
	ShareName     string `dynamodbav:"share_name" json:"share_name"`
	AssetType     string `dynamodbav:"asset_type" json:"asset_type"`
	Visibility    string `dynamodbav:"visibility" json:"visibility"`
	OwnerUsername string `dynamodbav:"owner_username" json:"owner_username"`
	CreatedAt     *int64 `dynamodbav:"created_at" json:"created_at"`
	ShareTTL      *int64 `dynamodbav:"share_ttl" json:"share_ttl"`
}

type ActivityShare struct {
	AuditEvent
	CreatedAt *int64 `json:"created_at"`
	ShareTTL  *int64 `json:"share_ttl"`
}

type ActivityResponse struct {
	Shares []ActivityShare `json:"shares"`
	Count  int             `json:"count"`
}

func (a *App) HandleRequest(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	if event.RequestContext.Authorizer == nil || event.RequestContext.Authorizer.JWT == nil {
		return utils.JsonResponse(401, models.ErrorResponse{Error: "Unauthorized"})
	}

	ownerUsername, ok := event.RequestContext.Authorizer.JWT.Claims["username"]
	if !ok || ownerUsername == "" {
		return utils.JsonResponse(401, models.ErrorResponse{Error: "Unauthorized"})
	}

	output, err := a.dbClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(a.tableName),
		IndexName:              aws.String("by_owner"),
		KeyConditionExpression: aws.String("owner_username = :owner"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":owner": &types.AttributeValueMemberS{Value: ownerUsername},
		},
		ScanIndexForward: aws.Bool(false),
	})
	if err != nil {
		log.Printf("Activity query error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	var auditEvents []AuditEvent
	if err := attributevalue.UnmarshalListOfMaps(output.Items, &auditEvents); err != nil {
		log.Printf("Unmarshal error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	latestByLink := make(map[string]*AuditEvent)
	createdByLink := make(map[string]*AuditEvent)

	for i := range auditEvents {
		evt := &auditEvents[i]

		existing, ok := latestByLink[evt.LinkID]
		if !ok || evt.Timestamp > existing.Timestamp {
			latestByLink[evt.LinkID] = evt
		}

		if evt.Action == "SHARE_CREATED" {
			existingCreated, ok := createdByLink[evt.LinkID]
			if !ok || evt.Timestamp < existingCreated.Timestamp {
				createdByLink[evt.LinkID] = evt
			}
		}
	}

	shares := make([]ActivityShare, 0, len(latestByLink))
	for _, evt := range latestByLink {
		share := ActivityShare{
			AuditEvent: *evt,
			CreatedAt:  evt.CreatedAt,
			ShareTTL:   evt.ShareTTL,
		}

		if createdEvt, ok := createdByLink[evt.LinkID]; ok {
			if createdEvt.CreatedAt != nil {
				share.CreatedAt = createdEvt.CreatedAt
			} else if createdEvt.Timestamp > 0 {
				ts := createdEvt.Timestamp / 1000
				share.CreatedAt = &ts
			}
			if createdEvt.ShareTTL != nil {
				share.ShareTTL = createdEvt.ShareTTL
			}
		}

		shares = append(shares, share)
	}

	sort.Slice(shares, func(i, j int) bool {
		return shares[i].Timestamp > shares[j].Timestamp
	})

	return utils.JsonResponse(200, ActivityResponse{
		Shares: shares,
		Count:  len(shares),
	})
}

func main() {
	ctx := context.Background()
	app, err := newApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}

	lambda.Start(app.HandleRequest)
}
