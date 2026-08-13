package main

import (
	"context"
	"fmt"
	"log"
	"os"
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
	tableName string
}

func newApp(ctx context.Context) (*App, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	return &App{
		dbClient:  dynamodb.NewFromConfig(cfg),
		tableName: os.Getenv("TABLE_NAME"),
	}, nil
}

type SuccessResponse struct {
	Shares []models.ShareItem `json:"shares"`
	Count  int                `json:"count"`
}

func (a *App) HandleRequest(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	if event.RequestContext.Authorizer == nil || event.RequestContext.Authorizer.JWT == nil {
		return utils.JsonResponse(401, models.ErrorResponse{Error: "Unauthorized"})
	}

	username, ok := event.RequestContext.Authorizer.JWT.Claims["username"]
	if !ok {
		return utils.JsonResponse(401, models.ErrorResponse{Error: "Unauthorized"})
	}

	output, err := a.dbClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(a.tableName),
		IndexName:              aws.String("by_owner"),
		KeyConditionExpression: aws.String("owner_username = :username"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":username": &types.AttributeValueMemberS{Value: username},
		},
	})
	if err != nil {
		log.Printf("List shares error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	shares := make([]models.ShareItem, 0)
	if err := attributevalue.UnmarshalListOfMaps(output.Items, &shares); err != nil {
		log.Printf("Unmarshall error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	now := time.Now().Unix()
	for i := range shares {
		if shares[i].TTL != nil && *shares[i].TTL <= now {
			shares[i].Status = "EXPIRED"
		} else if shares[i].MaxDownloads != nil && shares[i].DownloadCount >= *shares[i].MaxDownloads {
			shares[i].Status = "CONSUMED"
		}
	}

	return utils.JsonResponse(200, SuccessResponse{
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
