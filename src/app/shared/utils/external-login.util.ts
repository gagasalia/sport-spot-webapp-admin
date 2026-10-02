/**
 * External sign-in helpers (Google — docs/29, Facebook — docs/30) shared by the
 * customers pages and the user-management screens. The API identity rule is
 * "player = phone OR googleId OR facebookId": a player that signed up through
 * an external provider carries the provider flag but NO phone — a transitional
 * state the webapp closes with its "add your phone" step — so every admin
 * surface must tolerate it. Google always brings an email; Facebook may not
 * (phone-registered Facebook users, or an unticked email permission), so an
 * external-only player can have no phone AND no email.
 */
export type ExternalProvider = 'google' | 'facebook';

/** Display order of the provider chips. */
export const EXTERNAL_PROVIDERS: readonly ExternalProvider[] = ['google', 'facebook'];

/** Brand names — shown as-is in both languages, never run through `tr`. */
export const EXTERNAL_PROVIDER_LABELS: Readonly<Record<ExternalProvider, string>> = {
  google: 'Google',
  facebook: 'Facebook',
};

export interface IdentityFields {
  phone?: string | null;
  email?: string | null;
  googleLinked?: boolean | null;
  /** Raw Google subject — only on un-sanitized /um documents. */
  googleId?: string | null;
  facebookLinked?: boolean | null;
  /** Raw Graph API user id — only on un-sanitized /um documents. */
  facebookId?: string | null;
}

/**
 * The account can sign in with Google: the served `googleLinked` flag, or —
 * on raw /um documents that predate the flag — the subject's presence.
 */
export function isGoogleLinked(u: IdentityFields | null | undefined): boolean {
  return !!u && (!!u.googleLinked || !!u.googleId);
}

/** The account can sign in with Facebook (served flag or raw id, as above). */
export function isFacebookLinked(u: IdentityFields | null | undefined): boolean {
  return !!u && (!!u.facebookLinked || !!u.facebookId);
}

/** Every provider the account can sign in with, in chip order. */
export function externalProviders(u: IdentityFields | null | undefined): ExternalProvider[] {
  const linked: Record<ExternalProvider, boolean> = {
    google: isGoogleLinked(u),
    facebook: isFacebookLinked(u),
  };
  return EXTERNAL_PROVIDERS.filter((p) => linked[p]);
}

/** At least one external provider is linked. */
export function isExternallyLinked(u: IdentityFields | null | undefined): boolean {
  return externalProviders(u).length > 0;
}

/** Signed up through an external provider and has not added a phone yet. */
export function isExternalOnly(u: IdentityFields | null | undefined): boolean {
  return isExternallyLinked(u) && !u?.phone;
}

/** "Google", "Facebook", "Google / Facebook" — '' when nothing is linked. */
export function externalProviderNames(u: IdentityFields | null | undefined): string {
  return externalProviders(u)
    .map((p) => EXTERNAL_PROVIDER_LABELS[p])
    .join(' / ');
}

/**
 * Live account = at least one identity field survives. A hard-deleted account
 * keeps its booking-event history rows with every identity field absent; an
 * external-only player has no phone but still has its provider flag (and,
 * except on some Facebook accounts, an email).
 */
export function hasLiveAccount(u: IdentityFields | null | undefined): boolean {
  return !!u && (!!u.phone || !!u.email || isExternallyLinked(u));
}
