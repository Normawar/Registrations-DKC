export const squareConfig = {
  accessToken: process.env.SQUARE_ACCESS_TOKEN || "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
  applicationId: process.env.SQUARE_APPLICATION_ID || "sq0idp-2nOEj3tUd-PtlED-EdE3MQ",
  environment: (process.env.SQUARE_ENVIRONMENT || "production") as "production" | "sandbox",
  locationId: process.env.SQUARE_LOCATION_ID || "CTED7GVSVH5H8"
};
