
'use server';

import { Client, Environment } from 'square';
import { squareConfig } from '@/config/square-config';

let squareClient: Client;
let locationId: string;

function initializeSquare() {
  const { accessToken, environment } = squareConfig;

  if (!accessToken || accessToken.startsWith('YOUR_')) {
    console.error('Square access token is missing or invalid. Please check your .env file.');
    throw new Error('Square API credentials are not configured.');
  }

  squareClient = new Client({
    accessToken: accessToken,
    environment: environment === 'production' ? Environment.Production : Environment.Sandbox,
  });

  locationId = squareConfig.locationId;
}

export async function getSquareClient(): Promise<Client> {
  if (!squareClient) {
    initializeSquare();
  }
  return squareClient;
}

export async function getSquareLocationId(): Promise<string> {
    if (!locationId) {
        initializeSquare();
    }
    return locationId;
}
