
'use server';

import { Client, Environment } from 'square';

// This file is deprecated. The hard-coded client initialization is now done
// directly inside each server action that requires it. This was done to
// resolve persistent environment and initialization-related errors.
// The functions below are kept for reference but should not be used.

export async function getSquareClient(): Promise<Client> {
  throw new Error("getSquareClient is deprecated. Initialize the Square client directly in your server action.");
}

export async function getSquareLocationId(): Promise<string> {
  throw new Error("getSquareLocationId is deprecated. Use the hard-coded location ID directly in your server action.");
}
