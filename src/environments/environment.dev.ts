export const environment = {
  production: false,
  // apiUrl: 'https://q8fxvkk6e4.execute-api.eu-north-1.amazonaws.com/staging',
  // TEMP (Claude, phone-auth verification): local API — revert to staging below.
  apiUrl: 'http://localhost:3000',
  // Player app — public links (the local webapp dev server).
  siteUrl: 'http://localhost:4200',
  // apiUrl: 'https://staging-api.sportspace.ge',
  // Coaches module (docs/26 WP-1d): routes + nav entry exist only while true.
  // Off until real coaches are listed (owner decision 2026-09-29); the player
  // site has the same flag for the public pages.
  coachesEnabled: false,
};
