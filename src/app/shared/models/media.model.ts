/** Scope of an upload — determines the server-side S3 key prefix. */
export type MediaScope = 'academy-logo' | 'facility-media';

/** Body for POST /media/presign. */
export interface PresignRequest {
  fileName: string;
  contentType: string;
  scope: MediaScope;
}

/** Response from POST /media/presign. */
export interface PresignResponse {
  uploadUrl: string; // presigned S3 PUT url
  key: string; // S3 object key
  publicUrl: string; // public (CloudFront/S3) url to persist in IMedia.url
}
