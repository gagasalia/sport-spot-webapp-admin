export const environment = {
  production: true,
  // No dedicated prod API stage exists yet — production builds target the
  // staging API Gateway stage until `sls deploy --stage prod` is set up.
  apiUrl: 'https://staging-api.sportspace.ge',
};
