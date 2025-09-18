import { Client, Environment } from 'square';
import { squareConfig } from '../config/square-config';

export async function getSquareClient(): Promise<Client> {
  const environment = squareConfig.environment === 'production' 
    ? Environment.Production 
    : Environment.Sandbox;

  return new Client({
    accessToken: squareConfig.accessToken,
    environment: environment,
  });
}

export async function getSquareLocationId(): Promise<string> {
  return squareConfig.locationId;
}
