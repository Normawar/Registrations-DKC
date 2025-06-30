import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const plugins = [];

// Conditionally initialize the Google AI plugin only if an API key is provided.
if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
  plugins.push(googleAI());
} else {
  // Log a helpful warning message on the server if the key is missing.
  if (typeof window === 'undefined') {
    console.warn(`
[GENKIT] ----------------------------------------------------------------
[GENKIT] WARNING: Your Gemini API key is not set.
[GENKIT] The AI features of this application will not work.
[GENKIT]
[GENKIT] To fix this, get an API key from Google AI Studio:
[GENKIT] >>> https://aistudio.google.com/app/apikey
[GENKIT]
[GENKIT] Then, add it to your .env file like this:
[GENKIT] GEMINI_API_KEY="YOUR_API_KEY_HERE"
[GENKIT]
[GENKIT] After adding the key, you must restart the development server.
[GENKIT] ----------------------------------------------------------------
`);
  }
}

export const ai = genkit({
  plugins: plugins,
  model: 'googleai/gemini-1.5-pro-latest',
});
