import { Client, Environment } from 'square';
import { squareConfig } from '../config/square-config';

export async function getSquareClient(): Promise<Client> {
  const environment = squareConfig.environment === 'production' 
    ? Environment.Production 
    : Environment.Sandbox;

  if (!squareConfig.accessToken) {
    throw new Error('Square Access Token is not configured. Please check your environment variables.');
  }

  return new Client({
    accessToken: squareConfig.accessToken,
    environment: environment,
  });
}

export async function getSquareLocationId(): Promise<string> {
  if (!squareConfig.locationId) {
    throw new Error('Square Location ID is not configured. Please check your environment variables.');
  }
  return squareConfig.locationId;
}
