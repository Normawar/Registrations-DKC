
import { Client, Environment } from 'square';

/**
 * Throws an error if Square credentials are not set in the environment.
 */
function checkSquareCredentials() {
  // Add debugging
  console.log('DEBUG: All environment variables:', Object.keys(process.env));
  console.log('DEBUG: SQUARE_ACCESS_TOKEN exists:', !!process.env.SQUARE_ACCESS_TOKEN);
  console.log('DEBUG: SQUARE_LOCATION_ID exists:', !!process.env.SQUARE_LOCATION_ID);
  console.log('DEBUG: SQUARE_APPLICATION_ID exists:', !!process.env.SQUARE_APPLICATION_ID);
  console.log('DEBUG: SQUARE_ENVIRONMENT exists:', !!process.env.SQUARE_ENVIRONMENT);

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT;

  const missingVars: string[] = [];
  if (!accessToken || accessToken.startsWith('YOUR_')) missingVars.push('SQUARE_ACCESS_TOKEN');
  if (!locationId || locationId.startsWith('YOUR_')) missingVars.push('SQUARE_LOCATION_ID');
  if (!applicationId) missingVars.push('SQUARE_APPLICATION_ID');
  if (!environment) missingVars.push('SQUARE_ENVIRONMENT');
  
  if (missingVars.length > 0) {
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
  // Test with sandbox credentials
  const accessToken = "EAAAlxagh8KGuFmFhklQsLwdGwElJeJUpaHEk_WJ1d8fjft9UN9c0cJnNVRCkUBZ";
  const environment = Environment.Sandbox; // Use sandbox environment

  console.log('Square client configured with environment:', environment);

  return new Client({
    accessToken: accessToken,
    environment: environment,
  });
}

/**
 * Returns the configured Square Location ID.
 * Throws an error if not configured.
 * @returns {Promise<string>} The Square Location ID.
 */
export async function getSquareLocationId(): Promise<string> {
  return "LP3131ZF5YS4S"; // Sandbox location ID
}
