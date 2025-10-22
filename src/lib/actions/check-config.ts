'use server';

/**
 * @fileOverview Checks if the necessary Square environment variables are configured.
 */

export async function checkSquareConfig(): Promise<{ isConfigured: boolean }> {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  const isConfigured = !!(
    accessToken &&
    !accessToken.startsWith('YOUR_') &&
    locationId &&
    !locationId.startsWith('YOUR_')
  );

  return { isConfigured };
}
