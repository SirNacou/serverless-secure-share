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
