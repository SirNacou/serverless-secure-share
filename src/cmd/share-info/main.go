package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"slices"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
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
	PayloadText   *string  `dynamodbav:"payload_text" json:"payload_text"`
}

type ShareInfoResponse struct {
	LinkID        string  `json:"link_id"`
	ShareName     string  `json:"share_name"`
	AssetType     string  `json:"asset_type"`
	Visibility    string  `json:"visibility"`
	Status        string  `json:"status"`
	DownloadCount int64   `json:"download_count"`
	MaxDownloads  *int64  `json:"max_downloads"`
	PayloadText   *string `json:"payload_text,omitempty"` // TEXT only
	Filename      *string `json:"filename,omitempty"`     // FILE only
}

func NewShareInfoResponse(share *ShareItem) ShareInfoResponse {
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
	linkID, ok := event.PathParameters["shareId"]
	if !ok {
		return jsonResponse(400, ErrorResponse{Error: "Missing link identifier."})
	}

	authorizer := event.RequestContext.Authorizer
	username := ""
	if authorizer != nil && authorizer.JWT != nil {
		username = authorizer.JWT.Claims["username"]
	}

	output, err := dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &tableName,
		Key: map[string]types.AttributeValue{
			"link_id": &types.AttributeValueMemberS{Value: linkID},
		},
	})

	if err != nil {
		log.Printf("Get item error: %v", err)
		return jsonResponse(500, ErrorResponse{Error: "Internal server error"})
	}

	if output.Item == nil {
		return jsonResponse(404, ErrorResponse{Error: "Resource not found or expired."})
	}
	share := new(ShareItem)
	if err := attributevalue.UnmarshalMap(output.Item, share); err != nil {
		log.Printf("Unmarshall error: %v", err)
		return jsonResponse(500, ErrorResponse{Error: "Internal server error"})
	}

	if share.TTL != nil && *share.TTL < time.Now().Unix() {
		return jsonResponse(404, ErrorResponse{Error: "Resource has expired."})
	}

	if share.Visibility == "private" {
		if username == "" {
			return jsonResponse(403, ErrorResponse{Error: "Resource is private."})
		}

		isOwned := share.OwnerUsername == username
		isAllowed := slices.Contains(share.AllowedUsers, username)
		if !isOwned && !isAllowed {
			return jsonResponse(403, ErrorResponse{Error: "Access Denied: User identity not authorized to read this share."})
		}
	}

	return jsonResponse(200, NewShareInfoResponse(share))

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
