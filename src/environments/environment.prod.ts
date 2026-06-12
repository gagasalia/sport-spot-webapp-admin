export const environment = {
  production: true,
  // No dedicated prod API stage exists yet — production builds target the
  // staging API Gateway stage until `sls deploy --stage prod` is set up.
  apiUrl: 'https://q8fxvkk6e4.execute-api.eu-north-1.amazonaws.com/staging',
  academyId: '69dc16b831529a7612f0eca3',
};
