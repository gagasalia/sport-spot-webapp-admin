export const environment = {
  production: true,
  // Live stage: the prod API Gateway stage behind api.sportspace.ge.
  apiUrl: 'https://api.sportspace.ge',
  // Player app — public links (e.g. a directory venue's partner facility page).
  siteUrl: 'https://www.sportspace.ge',
  // Coaches module (docs/26 WP-1d): routes + nav entry exist only while true.
  // Off until real coaches are listed (owner decision 2026-09-29); the player
  // site has the same flag for the public pages.
  coachesEnabled: false,
};
