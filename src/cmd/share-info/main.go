package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"slices"
	"time"

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
	verifier  *utils.Verifier
	tableName string
}

func newApp(ctx context.Context) (*App, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	region := os.Getenv("AWS_REGION")
	userPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	clientID := os.Getenv("COGNITO_CLIENT_ID")

	verifier, err := utils.NewVerifier(ctx, region, userPoolID, clientID)
	if err != nil {
		log.Printf("warning: unable to create verifier: %v", err)
	}

	return &App{
		dbClient:  dynamodb.NewFromConfig(cfg),
		verifier:  verifier,
		tableName: os.Getenv("TABLE_NAME"),
	}, nil
}

type ShareInfoResponse struct {
	LinkID        string  `json:"link_id"`
	ShareName     string  `json:"share_name"`
	AssetType     string  `json:"asset_type"`
	Visibility    string  `json:"visibility"`
	Status        string  `json:"status"`
	DownloadCount int64   `json:"download_count"`
	MaxDownloads  *int64  `json:"max_downloads"`
	PayloadText   *string `json:"payload_text,omitempty"`
	Filename      *string `json:"filename,omitempty"`
}

func newShareInfoResponse(share *models.ShareItem) ShareInfoResponse {
	if share.ShareName == "" {
		share.ShareName = "Untitled Share"
	}
	var maxDownloads *int64
	if share.MaxDownloads != nil {
		v := int64(*share.MaxDownloads)
		maxDownloads = &v
	}
	return ShareInfoResponse{
		LinkID:        share.LinkID,
		ShareName:     share.ShareName,
		AssetType:     share.AssetType,
		Visibility:    share.Visibility,
		Status:        share.Status,
		DownloadCount: int64(share.DownloadCount),
		MaxDownloads:  maxDownloads,
		PayloadText:   share.PayloadText,
		Filename:      share.Filename,
	}
}

func (a *App) HandleRequest(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	linkID, ok := event.PathParameters["shareId"]
	if !ok {
		return utils.JsonResponse(400, models.ErrorResponse{Error: "Missing link identifier."})
	}

	username := a.verifier.UsernameFromRequest(event.Headers)

	output, err := a.dbClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(a.tableName),
		Key: map[string]types.AttributeValue{
			"link_id": &types.AttributeValueMemberS{Value: linkID},
		},
	})
	if err != nil {
		log.Printf("Get item error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	if output.Item == nil {
		return utils.JsonResponse(404, models.ErrorResponse{Error: "Resource not found or expired."})
	}
	share := new(models.ShareItem)
	if err := attributevalue.UnmarshalMap(output.Item, share); err != nil {
		log.Printf("Unmarshall error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	if share.TTL != nil && *share.TTL < time.Now().Unix() {
		return utils.JsonResponse(404, models.ErrorResponse{Error: "Resource has expired."})
	}

	if share.Visibility == "private" {
		if username == "" {
			return utils.JsonResponse(403, models.ErrorResponse{Error: "Access Denied: Private asset authorization header missing."})
		}

		isOwned := share.OwnerUsername == username
		isAllowed := slices.Contains(share.AllowedUsers, username)
		if !isOwned && !isAllowed {
			return utils.JsonResponse(403, models.ErrorResponse{Error: "Access Denied: User identity not authorized to read this share."})
		}
	}

	return utils.JsonResponse(200, newShareInfoResponse(share))
}

func main() {
	ctx := context.Background()
	app, err := newApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}

	lambda.Start(app.HandleRequest)
}
