/**
 * Client-side image processing for uploads (docs/22 media pipeline).
 *
 * Every admin-uploaded image is downscaled and re-encoded to webp IN THE
 * BROWSER before it ever reaches S3, in two renditions:
 *  - web   (≤ {@link WEB_MAX_PX}px longest side)  — detail hero / lightbox;
 *  - thumb (≤ {@link THUMB_MAX_PX}px longest side) — cards, lists, grids.
 *
 * Processing client-side is deliberate: the API runs on Lambda behind a ~6MB
 * payload cap (docs/09 §3), so originals never transit the backend — only the
 * already-small webp renditions go straight to S3 via presigned POST.
 */

export interface ImageRendition {
  blob: Blob;
  width: number;
  height: number;
}

export interface ProcessedImage {
  web: ImageRendition;
  thumb: ImageRendition;
  /** Mime of BOTH renditions: image/webp, or image/jpeg on old encoders. */
  type: string;
}

/** Longest-side cap of the full-size (web) rendition. */
export const WEB_MAX_PX = 1600;

/** Longest-side cap of the card/list (thumb) rendition. */
export const THUMB_MAX_PX = 480;

const WEB_QUALITY = 0.82;
const THUMB_QUALITY = 0.78;
const JPEG_FALLBACK_QUALITY = 0.85;

type DecodedImage = ImageBitmap | HTMLImageElement;

/**
 * Decodes `file` and renders both renditions. Never upscales — an image
 * smaller than the cap is only re-encoded. Throws when the file cannot be
 * decoded or encoded (caller falls back to uploading the original).
 */
export async function processImageForUpload(
  file: File,
): Promise<ProcessedImage> {
  const source = await decodeImage(file);
  try {
    const web = await renderRendition(source, WEB_MAX_PX, WEB_QUALITY);
    const thumb = await renderRendition(source, THUMB_MAX_PX, THUMB_QUALITY);
    return { web, thumb, type: web.blob.type };
  } finally {
    if ('close' in source) {
      source.close();
    }
  }
}

/**
 * createImageBitmap honours EXIF orientation by default in every current
 * browser; the <img> path is the fallback for formats it rejects.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> decoder
    }
  }
  return loadViaObjectUrl(file);
}

function loadViaObjectUrl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Cannot decode image: ${file.name}`));
    };
    image.src = url;
  });
}

async function renderRendition(
  source: DecodedImage,
  maxPx: number,
  quality: number,
): Promise<ImageRendition> {
  const sourceWidth =
    'naturalWidth' in source ? source.naturalWidth : source.width;
  const sourceHeight =
    'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Decoded image has no dimensions');
  }

  const scale = Math.min(1, maxPx / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable');
  }
  context.drawImage(source, 0, 0, width, height);

  // Encoders that don't speak webp (canvas.toBlob silently falls back to png,
  // typed differently) get a jpeg instead — still small, still cache-friendly.
  let blob = await encode(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') {
    blob = await encode(canvas, 'image/jpeg', JPEG_FALLBACK_QUALITY);
  }
  if (!blob) {
    throw new Error('Image encoding failed');
  }
  return { blob, width, height };
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** `photo.PNG` → `photo`; used to derive the rendition file names. */
export function fileStem(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? 'image';
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base) || 'image';
}

/** Maps the encoded mime to the rendition file extension. */
export function extensionFor(type: string): string {
  return type === 'image/jpeg' ? 'jpg' : 'webp';
}
