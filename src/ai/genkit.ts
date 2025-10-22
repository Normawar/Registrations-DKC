import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Firebase Admin will be initialized by the centralized function when needed

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-pro-latest',
});