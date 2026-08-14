package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
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

const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

var (
	customIDRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{2,62}[a-zA-Z0-9]$`)
	uuidRegex     = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	sanitizeRegex = regexp.MustCompile(`[^a-zA-Z0-9.-]`)
)

type CreateShareRequest struct {
	Name          string      `json:"name"`
	PayloadType   string      `json:"payloadType"`
	Filename      string      `json:"filename"`
	ContentType   string      `json:"contentType"`
	TextContent   string      `json:"textContent"`
	Visibility    string      `json:"visibility"`
	TargetUsers   []string    `json:"targetUsers"`
	LifespanHours interface{} `json:"lifespanHours"`
	MaxDownloads  interface{} `json:"maxDownloads"`
	CustomID      string      `json:"customId"`
}
type CreateShareResponse struct {
	UploadID   string `json:"uploadId"`
	DirectText bool   `json:"directText,omitempty"`
	UploadURL  string `json:"uploadUrl,omitempty"`
}

type App struct {
	dbClient      *dynamodb.Client
	s3Client      *s3.Client
	presignClient *s3.PresignClient
	sqsClient     *sqs.Client
	tableName     string
	bucketName    string
	auditQueueURL string
}

func newApp(ctx context.Context) (*App, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	return &App{
		dbClient:      dynamodb.NewFromConfig(cfg),
		s3Client:      s3Client,
		presignClient: s3.NewPresignClient(s3Client),
		sqsClient:     sqs.NewFromConfig(cfg),
		tableName:     os.Getenv("TABLE_NAME"),
		bucketName:    os.Getenv("BUCKET_NAME"),
		auditQueueURL: os.Getenv("AUDIT_QUEUE_URL"),
	}, nil
}
func (a *App) checkCustomIDConflict(ctx context.Context, customID string) (bool, error) {
	dbResult, err := a.dbClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(a.tableName),
		Key: map[string]types.AttributeValue{
			"link_id": &types.AttributeValueMemberS{Value: customID},
		},
	})
	if err != nil {
		return false, err
	}

	if len(dbResult.Item) == 0 {
		return false, nil
	}

	var item models.ShareItem
	if err := attributevalue.UnmarshalMap(dbResult.Item, &item); err != nil {
		return false, err
	}

	now := time.Now().Unix()
	if item.TTL != nil && *item.TTL > now && (item.Status == "AVAILABLE" || item.Status == "PENDING_UPLOAD") {
		return true, nil
	}

	return false, nil
}

func (a *App) emitAudit(ctx context.Context, linkID, ownerUsername, shareName, assetType, visibility, status string, createdAt, ttl int64) {
	if a.auditQueueURL == "" {
		return
	}

	msg := models.AuditMessage{
		LogID:         uuid.Must(uuid.NewV7()).String(),
		LinkID:        linkID,
		ShareName:     shareName,
		AssetType:     assetType,
		Visibility:    visibility,
		OwnerUsername: ownerUsername,
		Actor:         ownerUsername,
		Timestamp:     time.Now().UnixMilli(),
		Action:        "SHARE_CREATED",
		Status:        status,
		CreatedAt:     &createdAt,
		ShareTTL:      &ttl,
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

func validateCustomID(id string) bool {
	if len(id) < 4 || len(id) > 64 {
		return false
	}
	if !customIDRegex.MatchString(id) {
		return false
	}
	if uuidRegex.MatchString(id) {
		return false
	}
	return true
}

func extractUsername(context events.APIGatewayV2HTTPRequestContext) string {
	if context.Authorizer != nil && context.Authorizer.JWT != nil {
		if username, ok := context.Authorizer.JWT.Claims["username"]; ok {
			return username
		}
	}
	return ""
}

func generateShortID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	var sb strings.Builder
	sb.Grow(8)
	for i := 0; i < 8; i++ {
		sb.WriteByte(charset[int(b[i])%len(charset)])
	}
	return sb.String()
}

func sanitizeFilename(filename string) string {
	base := filepath.Base(filename)
	return sanitizeRegex.ReplaceAllString(base, "_")
}

func toInt64(v interface{}) int64 {
	switch val := v.(type) {
	case float64:
		return int64(val)
	case int64:
		return val
	case int:
		return int64(val)
	case string:
		n, err := strconv.ParseInt(val, 10, 64)
		if err != nil {
			return 0
		}
		return n
	default:
		return 0
	}
}

func (a *App) HandleRequest(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	ownerUsername := extractUsername(event.RequestContext)
	if ownerUsername == "" {
		return utils.JsonResponse(401, models.ErrorResponse{Error: "Unauthorized"})
	}

	var req CreateShareRequest
	log.Printf("DEBUG: event.Body = [%s]", event.Body)

	body := event.Body
	if len(body) > 0 && body[0] == '[' {
		var arr []CreateShareRequest
		if err := json.Unmarshal([]byte(body), &arr); err != nil {
			log.Printf("DEBUG: array unmarshal error: %v", err)
			return utils.JsonResponse(400, models.ErrorResponse{Error: "Invalid JSON request body"})
		}
		if len(arr) == 0 {
			return utils.JsonResponse(400, models.ErrorResponse{Error: "Empty request body"})
		}
		req = arr[0]
	} else {
		if err := json.Unmarshal([]byte(body), &req); err != nil {
			log.Printf("DEBUG: unmarshal error: %v", err)
			return utils.JsonResponse(400, models.ErrorResponse{Error: "Invalid JSON request body"})
		}
	}

	lifespanHours := toInt64(req.LifespanHours)
	if lifespanHours <= 0 {
		lifespanHours = 1
	}

	var maxDownloads *int64
	if req.MaxDownloads != nil {
		n := toInt64(req.MaxDownloads)
		maxDownloads = &n
	}

	var linkID string
	if req.CustomID != "" {
		if !validateCustomID(req.CustomID) {
			return utils.JsonResponse(400, models.ErrorResponse{
				Error: "Invalid custom ID: must be 4-64 characters, using only A-Z, a-z, 0-9, hyphens, and underscores.",
			})
		}

		conflict, err := a.checkCustomIDConflict(ctx, req.CustomID)
		if err != nil {
			log.Printf("Custom ID conflict check failed: %v", err)
			return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal Configuration Failure"})
		}
		if conflict {
			return utils.JsonResponse(409, models.ErrorResponse{Error: "This custom ID is already in use by an active share."})
		}
		linkID = req.CustomID
	} else {
		linkID = generateShortID()
	}

	safeShareName := strings.TrimSpace(req.Name)
	if safeShareName == "" {
		safeShareName = "Untitled Share"
	}

	now := time.Now().Unix()
	ttlTimestamp := now + (lifespanHours * 3600)

	itemMap := map[string]types.AttributeValue{
		"link_id":        &types.AttributeValueMemberS{Value: linkID},
		"share_name":     &types.AttributeValueMemberS{Value: safeShareName},
		"owner_username": &types.AttributeValueMemberS{Value: ownerUsername},
		"visibility":     &types.AttributeValueMemberS{Value: req.Visibility},
		"created_at":     &types.AttributeValueMemberN{Value: strconv.FormatInt(now, 10)},
		"ttl":            &types.AttributeValueMemberN{Value: strconv.FormatInt(ttlTimestamp, 10)},
		"download_count": &types.AttributeValueMemberN{Value: "0"},
	}

	if len(req.TargetUsers) > 0 {
		itemMap["allowed_users"] = &types.AttributeValueMemberSS{Value: req.TargetUsers}
	} else {
		itemMap["allowed_users"] = &types.AttributeValueMemberNULL{Value: true}
	}

	if maxDownloads != nil && *maxDownloads > 0 {
		itemMap["max_downloads"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(*maxDownloads, 10)}
	}

	if req.PayloadType == "text" {
		itemMap["asset_type"] = &types.AttributeValueMemberS{Value: "TEXT"}
		itemMap["payload_text"] = &types.AttributeValueMemberS{Value: req.TextContent}
		itemMap["status"] = &types.AttributeValueMemberS{Value: "AVAILABLE"}

		_, err := a.dbClient.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(a.tableName),
			Item:      itemMap,
		})
		if err != nil {
			log.Printf("PutItem text error: %v", err)
			return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal Configuration Failure"})
		}

		a.emitAudit(ctx, linkID, ownerUsername, safeShareName, "TEXT", req.Visibility, "AVAILABLE", now, ttlTimestamp)

		return utils.JsonResponse(200, CreateShareResponse{
			UploadID:   linkID,
			DirectText: true,
		})
	}

	safeFilename := sanitizeFilename(req.Filename)
	s3ObjectKey := fmt.Sprintf("uploads/%s/%s", linkID, safeFilename)

	itemMap["asset_type"] = &types.AttributeValueMemberS{Value: "FILE"}
	itemMap["fileKey"] = &types.AttributeValueMemberS{Value: s3ObjectKey}
	itemMap["filename"] = &types.AttributeValueMemberS{Value: safeFilename}
	itemMap["status"] = &types.AttributeValueMemberS{Value: "PENDING_UPLOAD"}

	_, err := a.dbClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(a.tableName),
		Item:      itemMap,
	})
	if err != nil {
		log.Printf("PutItem file error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal Configuraion Failure"})
	}

	a.emitAudit(ctx, linkID, ownerUsername, safeShareName, "FILE", req.Visibility, "PENDING_UPLOAD", now, ttlTimestamp)

	s3Command := &s3.PutObjectInput{
		Bucket:      aws.String(a.bucketName),
		Key:         aws.String(s3ObjectKey),
		ContentType: aws.String(req.ContentType),
	}

	presignedReq, err := a.presignClient.PresignPutObject(ctx, s3Command, s3.WithPresignExpires(900*time.Second))
	if err != nil {
		log.Printf("PresignPutObject error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal Configuration Failure"})
	}

	return utils.JsonResponse(200, CreateShareResponse{
		UploadID:  linkID,
		UploadURL: presignedReq.URL,
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
