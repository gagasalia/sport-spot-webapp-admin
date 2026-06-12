import { JwtPayload } from '../models/auth.model';

/**
 * Decodes a base64url-encoded string (the JWT segment alphabet) to UTF-8 text.
 * base64url replaces `+`/`/` with `-`/`_` and omits `=` padding.
 */
function base64UrlDecode(segment: string): string {
  let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }

  const binary = atob(base64);
  // Re-decode as UTF-8 so multi-byte characters survive.
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decodes the payload of a JWT without verifying its signature.
 * Returns `null` for malformed tokens — the server is the source of truth
 * for validity, this is only used client-side for role checks / display.
 */
export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}
