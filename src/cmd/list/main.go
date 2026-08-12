package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var (
	headers = map[string]string{
		"Content-Type":                "application/json",
		"Access-Control-Allow-Origin": "*",
	}
	dynamoClient *dynamodb.Client
	tableName    string
)

type ShareItem struct {
	LinkID        string   `dynamodbav:"link_id" json:"link_id"`
	ShareName     string   `dynamodbav:"share_name" json:"share_name"`
	AssetType     string   `dynamodbav:"asset_type" json:"asset_type"`
	Visibility    string   `dynamodbav:"visibility" json:"visibility"`
	CreatedAt     *int64   `dynamodbav:"created_at" json:"created_at"`
	Filename      *string  `dynamodbav:"filename" json:"filename"`
	AllowedUsers  []string `dynamodbav:"allowed_users" json:"allowed_users"`
	OwnerUsername string   `dynamodbav:"owner_username" json:"owner_username"`
	TTL           *int64   `dynamodbav:"ttl,omitempty" json:"ttl,omitempty"`
	MaxDownloads  *int     `dynamodbav:"max_downloads,omitempty" json:"max_downloads,omitempty"`
	DownloadCount int      `dynamodbav:"download_count" json:"download_count"`
	Status        string   `dynamodbav:"status" json:"status"`
}

type SuccessResponse struct {
	Shares []ShareItem `json:"shares"`
	Count  int         `json:"count"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func init() {
	tableName = os.Getenv("TABLE_NAME")
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("unable to load default config, %v", err)
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
}

func handler(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	if event.RequestContext.Authorizer == nil || event.RequestContext.Authorizer.JWT == nil {
		return jsonResponse(401, ErrorResponse{Error: "Unauthorized"})
	}

	username, ok := event.RequestContext.Authorizer.JWT.Claims["username"]
	if !ok {
		return jsonResponse(401, ErrorResponse{Error: "Unauthorized"})
	}

	output, err := dynamoClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              &tableName,
		IndexName:              aws.String("by_owner"),
		KeyConditionExpression: aws.String("owner_username = :username"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":username": &types.AttributeValueMemberS{Value: username},
		},
	})
	if err != nil {
		log.Printf("List shares error: %v", err)
		return jsonResponse(500, ErrorResponse{Error: "Internal server error"})
	}

	shares := make([]ShareItem, 0)
	if err := attributevalue.UnmarshalListOfMaps(output.Items, &shares); err != nil {
		log.Printf("Umarshall error: %v", err)
		return jsonResponse(500, ErrorResponse{Error: "Internal server error"})
	}

	now := time.Now().Unix()
	for i := range shares {
		if shares[i].TTL != nil && *shares[i].TTL <= now {
			shares[i].Status = "EXPIRED"
		} else if shares[i].MaxDownloads != nil && shares[i].DownloadCount >= *shares[i].MaxDownloads {
			shares[i].Status = "CONSUMED"
		}
	}

	return jsonResponse(200, SuccessResponse{
		Shares: shares,
		Count:  len(shares),
	})
}

func jsonResponse(statusCode int, payload any) (events.APIGatewayV2HTTPResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		body = []byte(`{"error": "Internal server error"}`)
		statusCode = 500
	}

	return events.APIGatewayV2HTTPResponse{
		StatusCode: statusCode,
		Headers:    headers,
		Body:       string(body),
	}, nil
}

func main() {
	lambda.Start(handler)
}
