export const environment = {
  production: false,
  apiUrl: 'https://staging-api.sportspace.ge',
  // Player app — public links (e.g. a directory venue's partner facility page).
  siteUrl: 'https://staging.sportspace.ge',
  // Coaches module (docs/26 WP-1d): routes + nav entry exist only while true.
  // Off until real coaches are listed (owner decision 2026-09-29); the player
  // site has the same flag for the public pages.
  coachesEnabled: false,
};
