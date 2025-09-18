export const squareConfig = {
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  applicationId: process.env.SQUARE_APPLICATION_ID,
  environment: (process.env.SQUARE_ENVIRONMENT || "production") as "production" | "sandbox",
  locationId: process.env.SQUARE_LOCATION_ID
};
