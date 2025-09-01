import { Client, Environment } from 'square';

/**
 * Throws an error if Square credentials are not set in the environment.
 */
function checkSquareCredentials() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || accessToken.startsWith('YOUR_') || !locationId || locationId.startsWith('YOUR_')) {
    const missingVars: string[] = [];
    if (!accessToken || accessToken.startsWith('YOUR_')) missingVars.push('SQUARE_ACCESS_TOKEN');
    if (!locationId || locationId.startsWith('YOUR_')) missingVars.push('SQUARE_LOCATION_ID');
    
    const errorMessage = `Square configuration is incomplete. Please set: ${missingVars.join(
        ', '
      )} in your .env file. You can find these credentials in your Square Developer Dashboard.`;

    console.error(`SQUARE_CONFIG_ERROR: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

/**
 * Returns an initialized Square client.
 * Throws an error if credentials are not configured.
 * @returns {Promise<Client>} The initialized Square client.
 */
export async function getSquareClient(): Promise<Client> {
  checkSquareCredentials();
  return new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production,
  });
}

/**
 * Returns the configured Square Location ID.
 * Throws an error if not configured.
 * @returns {Promise<string>} The Square Location ID.
 */
export async function getSquareLocationId(): Promise<string> {
  checkSquareCredentials();
  return process.env.SQUARE_LOCATION_ID!;
}
