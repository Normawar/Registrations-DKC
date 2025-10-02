import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK for Genkit environment
if (admin.apps.length === 0) {
  admin.initializeApp();
  console.log('Firebase Admin SDK initialized for Genkit.');
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-pro-latest',
});
