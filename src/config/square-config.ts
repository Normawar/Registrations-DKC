console.log('=== LOADING SQUARE CONFIG ===');
console.log('Environment variables:');
console.log('SQUARE_ACCESS_TOKEN exists:', !!process.env.SQUARE_ACCESS_TOKEN);
console.log('SQUARE_ACCESS_TOKEN value (first 10):', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 10) + '...' || 'UNDEFINED');
console.log('SQUARE_ENVIRONMENT:', process.env.SQUARE_ENVIRONMENT || 'UNDEFINED');
console.log('SQUARE_LOCATION_ID:', process.env.SQUARE_LOCATION_ID || 'UNDEFINED');

export const squareConfig = {
  accessToken: process.env.SQUARE_ACCESS_TOKEN || "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
  applicationId: process.env.SQUARE_APPLICATION_ID || "sq0idp-2nOEj3tUd-PtlED-EdE3MQ",
  environment: (process.env.SQUARE_ENVIRONMENT || "sandbox") as "production" | "sandbox",
  locationId: process.env.SQUARE_LOCATION_ID || "CTED7GVSVH5H8"
};

console.log('Final config values:');
console.log('accessToken (first 10):', squareConfig.accessToken.substring(0, 10) + '...');
console.log('environment:', squareConfig.environment);
console.log('locationId:', squareConfig.locationId);
console.log('=== END SQUARE CONFIG LOADING ===');
