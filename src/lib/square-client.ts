
import { Client, Environment } from 'square';

/**
 * Throws an error if Square credentials are not set in the environment.
 */
function checkSquareCredentials() {
  console.log('=== COMPLETE ENV DEBUG ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('All env vars:', Object.keys(process.env).sort());
  console.log('Square-related vars:', Object.keys(process.env).filter(k => k.includes('SQUARE')));
  console.log('SQUARE_ACCESS_TOKEN value:', process.env.SQUARE_ACCESS_TOKEN ? 'EXISTS' : 'MISSING');
  console.log('SQUARE_LOCATION_ID value:', process.env.SQUARE_LOCATION_ID ? 'EXISTS' : 'MISSING');
  console.log('=== END DEBUG ===');
  
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
  checkSquareCredentials(); // This will run the debug logging
  
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' 
    ? Environment.Production 
    : Environment.Sandbox;

  console.log('Square client configured with environment:', environment);

  return new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: environment,
  });
}

/**
 * Returns the configured Square Location ID.
 * Throws an error if not configured.
 * @returns {Promise<string>} The Square Location ID.
 */
export async function getSquareLocationId(): Promise<string> {
  checkSquareCredentials(); // This will run the debug logging
  return process.env.SQUARE_LOCATION_ID!;
}
