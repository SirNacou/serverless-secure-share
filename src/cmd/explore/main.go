package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"sort"
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
)

type ShareItem struct {
	models.ShareItem
	OwnerDisplayName string `dynamodbav:"-" json:"owner_display_name,omitempty"`
}

type ProfileItem struct {
	Username    string `dynamodbav:"username"`
	DisplayName string `dynamodbav:"display_name"`
}

type ExploreResponse struct {
	Shares []ShareItem `json:"shares"`
	Count  int         `json:"count"`
}

type App struct {
	dbClient         *dynamodb.Client
	verifier         *utils.Verifier
	tableName        string
	profileTableName string
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
		dbClient:         dynamodb.NewFromConfig(cfg),
		verifier:         verifier,
		tableName:        os.Getenv("TABLE_NAME"),
		profileTableName: os.Getenv("PROFILE_TABLE_NAME"),
	}, nil
}

func computeStatus(item ShareItem) string {
	now := time.Now().Unix()
	if item.TTL != nil && *item.TTL <= now {
		return "EXPIRED"
	}
	if item.MaxDownloads != nil && item.DownloadCount >= *item.MaxDownloads {
		return "CONSUMED"
	}
	return item.Status
}

func matchesSearch(item ShareItem, query string) bool {
	if query == "" {
		return true
	}
	q := strings.ToLower(query)
	return strings.Contains(strings.ToLower(item.ShareName), q) ||
		strings.Contains(strings.ToLower(item.LinkID), q)
}

func (a *App) queryPublicShares(ctx context.Context) ([]ShareItem, error) {
	output, err := a.dbClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(a.tableName),
		IndexName:              aws.String("by_visibility"),
		KeyConditionExpression: aws.String("visibility = :public"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":public": &types.AttributeValueMemberS{Value: "public"},
		},
		ScanIndexForward: aws.Bool(false),
	})
	if err != nil {
		return nil, err
	}

	var items []ShareItem
	if err := attributevalue.UnmarshalListOfMaps(output.Items, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (a *App) queryOwnerShares(ctx context.Context, username string) ([]ShareItem, error) {
	output, err := a.dbClient.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(a.tableName),
		IndexName:              aws.String("by_owner"),
		KeyConditionExpression: aws.String("owner_username = :username"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":username": &types.AttributeValueMemberS{Value: username},
		},
	})
	if err != nil {
		return nil, err
	}

	var items []ShareItem
	if err := attributevalue.UnmarshalListOfMaps(output.Items, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (a *App) scanSharedWithUser(ctx context.Context, username string) ([]ShareItem, error) {
	output, err := a.dbClient.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(a.tableName),
		FilterExpression: aws.String("visibility = :private AND contains(allowed_users, :username)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":private":  &types.AttributeValueMemberS{Value: "private"},
			":username": &types.AttributeValueMemberS{Value: username},
		},
	})
	if err != nil {
		return nil, err
	}

	var items []ShareItem
	if err := attributevalue.UnmarshalListOfMaps(output.Items, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (a *App) fetchDisplayNames(ctx context.Context, usernames []string) (map[string]string, error) {
	displayNameMap := make(map[string]string)
	if len(usernames) == 0 || a.profileTableName == "" {
		return displayNameMap, nil
	}

	// DynamoDB BatchGetItem enforces a maximum limit of 100 keys per request
	const batchSize = 100
	for i := 0; i < len(usernames); i += batchSize {
		end := i + batchSize
		if end > len(usernames) {
			end = len(usernames)
		}
		batch := usernames[i:end]

		keys := make([]map[string]types.AttributeValue, len(batch))
		for j, username := range batch {
			keys[j] = map[string]types.AttributeValue{
				"username": &types.AttributeValueMemberS{Value: username},
			}
		}

		input := &dynamodb.BatchGetItemInput{
			RequestItems: map[string]types.KeysAndAttributes{
				a.profileTableName: {
					Keys:                 keys,
					ProjectionExpression: aws.String("username, display_name"),
					ConsistentRead:       aws.Bool(true),
				},
			},
		}

		output, err := a.dbClient.BatchGetItem(ctx, input)
		if err != nil {
			return nil, err
		}

		if items, ok := output.Responses[a.profileTableName]; ok {
			for _, rawItem := range items {
				var profile ProfileItem
				if err := attributevalue.UnmarshalMap(rawItem, &profile); err == nil {
					if profile.Username != "" && profile.DisplayName != "" {
						displayNameMap[profile.Username] = profile.DisplayName
					}
				}
			}
		}
	}

	return displayNameMap, nil
}

func (a *App) HandleRequest(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var currentUsername string
	if a.verifier != nil {
		currentUsername = a.verifier.UsernameFromRequest(event.Headers)
	}

	q := strings.TrimSpace(event.QueryStringParameters["q"])
	seen := make(map[string]ShareItem)

	processItems := func(items []ShareItem) {
		for _, item := range items {
			item.Status = computeStatus(item)
			if item.Status != "EXPIRED" && matchesSearch(item, q) {
				seen[item.LinkID] = item
			}
		}
	}

	// Fetch public shares via GSI
	publicShares, err := a.queryPublicShares(ctx)
	if err != nil {
		log.Printf("Query public shares error: %v", err)
		return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
	}
	processItems(publicShares)

	// 2 & 3. If authenticated, fetch owned and shared shares
	if currentUsername != "" {
		ownerShares, err := a.queryOwnerShares(ctx, currentUsername)
		if err != nil {
			log.Printf("Query owner shares error: %v", err)
			return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
		}
		processItems(ownerShares)

		sharedShares, err := a.scanSharedWithUser(ctx, currentUsername)
		if err != nil {
			log.Printf("Scan shared shares error: %v", err)
			return utils.JsonResponse(500, models.ErrorResponse{Error: "Internal server error"})
		}
		processItems(sharedShares)
	}

	// Deduplicate into slice and sort descending by created_at
	shares := make([]ShareItem, 0, len(seen))
	for _, item := range seen {
		shares = append(shares, item)
	}

	sort.Slice(shares, func(i, j int) bool {
		var aTime, bTime int64
		if shares[i].CreatedAt != nil {
			aTime = *shares[i].CreatedAt
		}
		if shares[j].CreatedAt != nil {
			bTime = *shares[j].CreatedAt
		}
		return aTime > bTime
	})

	// Resolve owner display names via BatchGetItem
	ownerUsernames := make([]string, 0)
	ownerMap := make(map[string]bool)
	for _, s := range shares {
		if s.OwnerUsername != "" && !ownerMap[s.OwnerUsername] {
			ownerMap[s.OwnerUsername] = true
			ownerUsernames = append(ownerUsernames, s.OwnerUsername)
		}
	}

	if len(ownerUsernames) > 0 {
		displayNameMap, err := a.fetchDisplayNames(ctx, ownerUsernames)
		if err != nil {
			log.Printf("Fetch display names error: %v", err)
		} else {
			for i := range shares {
				if dName, ok := displayNameMap[shares[i].OwnerUsername]; ok {
					shares[i].OwnerDisplayName = dName
				}
			}
		}
	}

	return utils.JsonResponse(200, ExploreResponse{
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
