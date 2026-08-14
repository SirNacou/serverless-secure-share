package models

type ShareItem struct {
	LinkID        string   `dynamodbav:"link_id" json:"link_id"`
	ShareName     string   `dynamodbav:"share_name" json:"share_name"`
	AssetType     string   `dynamodbav:"asset_type" json:"asset_type"`
	Visibility    string   `dynamodbav:"visibility" json:"visibility"`
	OwnerUsername string   `dynamodbav:"owner_username" json:"owner_username"`
	AllowedUsers  []string `dynamodbav:"allowed_users" json:"allowed_users"`
	TTL           *int64   `dynamodbav:"ttl" json:"ttl"`
	CreatedAt     *int64   `dynamodbav:"created_at" json:"created_at"`
	MaxDownloads  *int     `dynamodbav:"max_downloads" json:"max_downloads"`
	DownloadCount int      `dynamodbav:"download_count" json:"download_count"`
	Status        string   `dynamodbav:"status" json:"status"`
	FileKey       string   `dynamodbav:"fileKey" json:"fileKey"`
	Filename      *string  `dynamodbav:"filename" json:"filename"`
	PayloadText   *string  `dynamodbav:"payload_text" json:"payload_text"`
}
