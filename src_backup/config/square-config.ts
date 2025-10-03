
function getEnvOrFallback(envVar: string | undefined, fallback: string): string {
  // Use fallback if envVar is undefined, null, or an empty string
  return (envVar && envVar.trim() !== '') ? envVar : fallback;
}

export const squareConfig = {
  accessToken: getEnvOrFallback(process.env.SQUARE_ACCESS_TOKEN, "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC"),
  applicationId: getEnvOrFallback(process.env.SQUARE_APPLICATION_ID, "sq0idp-2nOEj3tUd-PtlED-EdE3MQ"),
  environment: (getEnvOrFallback(process.env.SQUARE_ENVIRONMENT, "production")) as "production" | "sandbox",
  locationId: getEnvOrFallback(process.env.SQUARE_LOCATION_ID, "CTED7GVSVH5H8")
};
