/**
 * Google sign-in helpers (docs/29) shared by the customers pages and the
 * user-management screens. A Google-only player carries `email` +
 * `googleLinked` but NO phone — a transitional state the webapp closes with
 * its "add your phone" step — so every admin surface must tolerate it.
 */
export interface IdentityFields {
  phone?: string | null;
  email?: string | null;
  googleLinked?: boolean | null;
  /** Raw Google subject — only on un-sanitized /um documents. */
  googleId?: string | null;
}

/**
 * The account can sign in with Google: the served `googleLinked` flag, or —
 * on raw /um documents that predate the flag — the subject's presence.
 */
export function isGoogleLinked(u: IdentityFields | null | undefined): boolean {
  return !!u && (!!u.googleLinked || !!u.googleId);
}

/** A Google player that has not added a phone yet. */
export function isGoogleOnly(u: IdentityFields | null | undefined): boolean {
  return isGoogleLinked(u) && !u?.phone;
}

/**
 * Live account = at least one identity field survives. A hard-deleted account
 * keeps its booking-event history rows with every identity field absent; a
 * Google-only player has no phone but still has its email + googleLinked.
 */
export function hasLiveAccount(u: IdentityFields | null | undefined): boolean {
  return !!u && (!!u.phone || !!u.email || isGoogleLinked(u));
}
