package models

type AuditMessage struct {
	LogID         string `json:"log_id"`
	LinkID        string `json:"link_id"`
	Actor         string `json:"actor"`
	Timestamp     int64  `json:"timestamp"`
	Action        string `json:"action"`
	Status        string `json:"status"`
	ShareName     string `json:"share_name"`
	AssetType     string `json:"asset_type"`
	Visibility    string `json:"visibility"`
	OwnerUsername string `json:"owner_username"`
	CreatedAt     *int64 `json:"created_at,omitempty"`
	ShareTTL      *int64 `json:"share_ttl,omitempty"`
}
