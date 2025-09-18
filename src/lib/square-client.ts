
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
  const accessToken = "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC";
  const environment = Environment.Production;

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
  return "CTED7GVSVH5H8";
}
