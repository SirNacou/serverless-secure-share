package main

import (
	"context"
	"encoding/json"
	"errors"
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
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/google/uuid"
)

type AuditMeta struct {
	ShareName     string
	AssetType     string
	Visibility    string
	OwnerUsername string
	CreatedAt     *int64
	ShareTTL      *int64
}

type ResponseBody struct {
	LinkID      string `json:"link_id"`
	ShareName   string `json:"share_name"`
	AssetType   string `json:"asset_type"`
	Visibility  string `json:"visibility"`
	Filename    string `json:"filename,omitempty"`
	DownloadURL string `json:"downloadUrl,omitempty"`
	PayloadText string `json:"payload_text,omitempty"`
}

type App struct {
	dbClient      *dynamodb.Client
	s3Client      *s3.Client
	presignClient *s3.PresignClient
	sqsClient     *sqs.Client
	verifier      *utils.Verifier
	tableName     string
	bucketName    string
	auditQueueURL string
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

	s3Client := s3.NewFromConfig(cfg)

	return &App{
		dbClient:      dynamodb.NewFromConfig(cfg),
		s3Client:      s3Client,
		presignClient: s3.NewPresignClient(s3Client),
		sqsClient:     sqs.NewFromConfig(cfg),
		verifier:      verifier,
		tableName:     os.Getenv("TABLE_NAME"),
		bucketName:    os.Getenv("BUCKET_NAME"),
		auditQueueURL: os.Getenv("AUDIT_QUEUE_URL"),
	}, nil
}

func (a *App) resolveActor(headers map[string]string) string {
	if a.verifier == nil {
		return "GUEST"
	}
	username := a.verifier.UsernameFromRequest(headers)
	if username != "" {
		return username
	}
	return "GUEST"
}

func (a *App) fetchShareItem(ctx context.Context, linkID string) (*models.ShareItem, error) {
	dbResult, err := a.dbClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(a.tableName),
		Key: map[string]types.AttributeValue{
			"link_id": &types.AttributeValueMemberS{Value: linkID},
		},
	})
	if err != nil {
		return nil, err
	}

	if len(dbResult.Item) == 0 {
		return nil, nil
	}

	var item models.ShareItem
	if err := attributevalue.UnmarshalMap(dbResult.Item, &item); err != nil {
		return nil, err
	}

	return &item, nil
}

func (a *App) validateAccess(item *models.ShareItem, actor string) (status string, code int, err error) {
	if item.TTL != nil && time.Now().Unix() > *item.TTL {
		return "EXPIRED", 404, errors.New("Resource has expired.")
	}

	if item.Visibility == "private" {
		if actor == "GUEST" {
			return "UNAUTHORIZED_403", 403, errors.New("Access Denied: Private asset authorization header missing.")
		}

		isOwner := item.OwnerUsername == actor
		isAllowed := slices.Contains(item.AllowedUsers, actor)

		if !isOwner && !isAllowed {
			return "UNAUTHORIZED_403", 403, errors.New("Access Denied: User identity not authorized to read this share.")
		}
	}

	if item.MaxDownloads != nil && item.DownloadCount >= *item.MaxDownloads {
		return "EXPIRED", 410, errors.New("Share has reached its download limit.")
	}

	return "", 0, nil
}

func (a *App) buildResponseBody(ctx context.Context, item *models.ShareItem) (ResponseBody, error) {
	resp := ResponseBody{
		LinkID:     item.LinkID,
		ShareName:  extractMeta(item).ShareName,
		AssetType:  item.AssetType,
		Visibility: item.Visibility,
	}

	if item.AssetType == "FILE" {
		if item.Status != "AVAILABLE" || item.FileKey == "" || item.Filename == nil {
			return resp, errors.New("File state sync unconfirmed by pipeline.")
		}

		filename := *item.Filename
		s3Command := &s3.GetObjectInput{
			Bucket:                     aws.String(a.bucketName),
			Key:                        aws.String(item.FileKey),
			ResponseContentDisposition: aws.String(fmt.Sprintf("attachment; filename=\"%s\"", filename)),
		}

		presignedReq, err := a.presignClient.PresignGetObject(ctx, s3Command, s3.WithPresignExpires(300*time.Second))
		if err != nil {
			return resp, fmt.Errorf("presign failed: %w", err)
		}

		resp.Filename = filename
		resp.DownloadURL = presignedReq.URL
	}

	if item.AssetType == "TEXT" && item.PayloadText != nil {
		resp.PayloadText = *item.PayloadText
	}

	return resp, nil
}

func (a *App) incrementDownloadCount(ctx context.Context, linkID string, item *models.ShareItem) error {
	_, updateErr := a.dbClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(a.tableName),
		Key: map[string]types.AttributeValue{
			"link_id": &types.AttributeValueMemberS{Value: linkID},
		},
		UpdateExpression:    aws.String("ADD #count :inc"),
		ConditionExpression: aws.String("attribute_not_exists(#max) OR #count < #max"),
		ExpressionAttributeNames: map[string]string{
			"#count": "download_count",
			"#max":   "max_downloads",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":inc": &types.AttributeValueMemberN{Value: "1"},
		},
	})

	if updateErr != nil {
		var condFailed *types.ConditionalCheckFailedException
		if errors.As(updateErr, &condFailed) {
			return errors.New("download limit reached")
		}
		return updateErr
	}

	newCount := item.DownloadCount + 1
	if item.MaxDownloads != nil && newCount >= *item.MaxDownloads {
		a.markConsumed(ctx, linkID, item.FileKey)
	}

	return nil
}

func (a *App) markConsumed(ctx context.Context, linkID string, fileKey string) {
	_, err := a.dbClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(a.tableName),
		Key: map[string]types.AttributeValue{
			"link_id": &types.AttributeValueMemberS{Value: linkID},
		},
		UpdateExpression: aws.String("SET #statusAttr = :newStatus"),
		ExpressionAttributeNames: map[string]string{
			"#statusAttr": "status",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":newStatus": &types.AttributeValueMemberS{Value: "CONSUMED"},
		},
	})
	if err != nil {
		log.Printf("Failed to mark share as CONSUMED: %v", err)
	}

	if fileKey != "" {
		_, err := a.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(a.bucketName),
			Key:    aws.String(fileKey),
		})
		if err != nil {
			log.Printf("Failed to delete S3 object on limit hit: %v", err)
		}
	}
}

func (a *App) emitAudit(ctx context.Context, linkID, actor, action, status string, meta AuditMeta) {
	if a.auditQueueURL == "" {
		return
	}

	msg := models.AuditMessage{
		LogID:         uuid.Must(uuid.NewV7()).String(),
		LinkID:        linkID,
		Actor:         actor,
		Timestamp:     time.Now().Unix(),
		Action:        action,
		Status:        status,
		ShareName:     meta.ShareName,
		AssetType:     meta.AssetType,
		Visibility:    meta.Visibility,
		OwnerUsername: meta.OwnerUsername,
		CreatedAt:     meta.CreatedAt,
		ShareTTL:      meta.ShareTTL,
	}

	body, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal audit message: %v", err)
		return
	}

	_, err = a.sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(a.auditQueueURL),
		MessageBody: aws.String(string(body)),
	})
	if err != nil {
		log.Printf("SQS SendMessage failed: %v", err)
	}
}

func extractMeta(item *models.ShareItem) AuditMeta {
	if item == nil {
		return AuditMeta{
			ShareName:     "Unknown",
			AssetType:     "UNKNOWN",
			Visibility:    "unknown",
			OwnerUsername: "unknown",
		}
	}

	meta := AuditMeta{
		ShareName:     "Untitled Share",
		AssetType:     "UNKNOWN",
		Visibility:    "unknown",
		OwnerUsername: "unknown",
		CreatedAt:     item.CreatedAt,
		ShareTTL:      item.TTL,
	}
	if item.ShareName != "" {
		meta.ShareName = item.ShareName
	}
	if item.AssetType != "" {
		meta.AssetType = item.AssetType
	}
	if item.Visibility != "" {
		meta.Visibility = item.Visibility
	}
	if item.OwnerUsername != "" {
		meta.OwnerUsername = item.OwnerUsername
	}
	return meta
}

func (a *App) HandleRequest(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	linkID := event.PathParameters["shareId"]
	if linkID == "" {
		return utils.JsonResponse(400, models.ErrorResponse{Error: "Missing link identifier."})
	}

	actor := a.resolveActor(event.Headers)

	item, err := a.fetchShareItem(ctx, linkID)
	if err != nil {
		log.Printf("Get item error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}

	if item == nil {
		a.emitAudit(ctx, linkID, actor, "METADATA_LOAD", "EXPIRED", extractMeta(nil))
		return utils.JsonResponse(404, models.ErrorResponse{Error: "Resource not found or expired."})
	}

	meta := extractMeta(item)

	status, statusCode, accessErr := a.validateAccess(item, actor)
	if accessErr != nil {
		a.emitAudit(ctx, linkID, actor, "METADATA_LOAD", status, meta)
		return utils.JsonResponse(statusCode, models.ErrorResponse{Error: accessErr.Error()})
	}

	responseBody, buildErr := a.buildResponseBody(ctx, item)
	if buildErr != nil {
		a.emitAudit(ctx, linkID, actor, "DOWNLOAD_EXECUTION", "EXPIRED", meta)
		return utils.JsonResponse(400, models.ErrorResponse{Error: buildErr.Error()})
	}

	if err := a.incrementDownloadCount(ctx, linkID, item); err != nil {
		a.emitAudit(ctx, linkID, actor, "DOWNLOAD_EXECUTION", "EXPIRED", meta)
		return utils.JsonResponse(410, models.ErrorResponse{Error: "Share has reached its download limit."})
	}

	action := "METADATA_LOAD"
	if item.AssetType == "FILE" {
		action = "DOWNLOAD_EXECUTION"
	}
	a.emitAudit(ctx, linkID, actor, action, "SUCCESS", meta)

	return utils.JsonResponse(200, responseBody)
}

func main() {
	ctx := context.Background()
	app, err := newApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}

	lambda.Start(app.HandleRequest)
}
