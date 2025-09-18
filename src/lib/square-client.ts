import { Client, Environment } from 'square';
import { squareConfig } from '../config/square-config';

export async function getSquareClient(): Promise<Client> {
  const environment = squareConfig.environment === 'production' 
    ? Environment.Production 
    : Environment.Sandbox;

  console.log('Square client configured with environment:', environment);
  console.log('Using access token from:', process.env.SQUARE_ACCESS_TOKEN ? 'ENV VAR' : 'FALLBACK');

  return new Client({
    accessToken: squareConfig.accessToken,
    environment: environment,
  });
}

export async function getSquareLocationId(): Promise<string> {
  console.log('Using location ID from:', process.env.SQUARE_LOCATION_ID ? 'ENV VAR' : 'FALLBACK');
  return squareConfig.locationId;
}