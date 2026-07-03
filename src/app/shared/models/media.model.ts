/** Scope of an upload — determines the server-side S3 key prefix. */
export type MediaScope = 'academy-logo' | 'facility-media';

/** Body for POST /media/presign. */
export interface PresignRequest {
  fileName: string;
  contentType: string;
  scope: MediaScope;
}

/** Response from POST /media/presign (presigned POST flow). */
export interface PresignResponse {
  uploadUrl: string; // presigned S3 POST url (the bucket endpoint)
  fields: Record<string, string>; // form fields to append BEFORE the file
  key: string; // S3 object key
  publicUrl: string; // public (CloudFront/S3) url to persist in IMedia.url
}
