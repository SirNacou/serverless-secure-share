export type AssetType = "FILE" | "TEXT";

// Response shape matching the metadata engine return values
export interface ShareUploadResponse {
	uploadId: string;
	uploadUrl?: string; // Provided strictly when asset_type is "FILE"
	directText?: boolean; // Provided strictly when asset_type is "TEXT"
}

// Error payload contract for catch blocks
export interface ApiErrorResponse {
	error: string;
}

export interface ShareListItem {
	link_id: string;
	share_name: string;
	asset_type: AssetType;
	visibility: "public" | "private";
	status: string;
	download_count: number;
	max_downloads: number | null;
	created_at?: number;
	ttl: number;
	filename?: string;
	allowed_users?: string[];
	owner_username?: string;
}

export interface ShareListResponse {
	shares: ShareListItem[];
	count: number;
}

export interface ShareInfoResponse {
	link_id: string;
	share_name: string;
	asset_type: AssetType;
	visibility: "public" | "private";
	status?: string;
	download_count?: number;
	max_downloads?: number | null;
	payload_text?: string;
	filename?: string;
}

export interface ShareConsumeResponse {
	link_id: string;
	share_name: string;
	asset_type: AssetType;
	visibility: "public" | "private";
	payload_text?: string;
	filename?: string;
	downloadUrl?: string;
}
