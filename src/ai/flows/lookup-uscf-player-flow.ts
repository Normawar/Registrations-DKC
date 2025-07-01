
'use server';
/**
 * @fileOverview Looks up a USCF player by their ID from the USCF MSA website.
 *
 * - lookupUscfPlayer - A function that handles the player lookup process.
 * - LookupUscfPlayerInput - The input type for the lookupUscfPlayer function.
 * - LookupUscfPlayerOutput - The return type for the lookupUscfPlayer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const LookupUscfPlayerInputSchema = z.object({
  uscfId: z.string().describe('The USCF ID of the player to look up.'),
});
export type LookupUscfPlayerInput = z.infer<typeof LookupUscfPlayerInputSchema>;

const LookupUscfPlayerOutputSchema = z.object({
  fullName: z.string().optional().describe("The player's full name as returned by the lookup, in LAST, FIRST format."),
  rating: z.number().optional().describe("The player's regular USCF rating."),
  expirationDate: z.string().optional().describe("The player's USCF membership expiration date in YYYY-MM-DD format."),
  error: z.string().optional().describe("An error message if the lookup failed or the player was not found.")
});
export type LookupUscfPlayerOutput = z.infer<typeof LookupUscfPlayerOutputSchema>;

export async function lookupUscfPlayer(input: LookupUscfPlayerInput): Promise<LookupUscfPlayerOutput> {
  return lookupUscfPlayerFlow(input);
}

const lookupUscfPlayerFlow = ai.defineFlow(
  {
    name: 'lookupUscfPlayerFlow',
    inputSchema: LookupUscfPlayerInputSchema,
    outputSchema: LookupUscfPlayerOutputSchema,
  },
  async ({ uscfId }) => {
    if (!uscfId || !/^\d{8}$/.test(uscfId)) {
      return { error: 'Invalid USCF ID format. It must be an 8-digit number.' };
    }
    const url = `http://msa.uschess.org/thin3.php?${uscfId}`;
    
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      if (!response.ok) {
        return { error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      if (html.includes("This player is not in our database")) {
        return { error: "Player not found with this USCF ID." };
      }
      
      const preMatch = html.match(/<pre>([\s\S]*?)<\/pre>/i);
      if (!preMatch || !preMatch[1]) {
        console.error("USCF Lookup Response (No <pre> tag found):", html.substring(0, 500));
        return { error: "Could not find player data block in the lookup results. The USCF website may be temporarily unavailable or blocking requests." };
      }
      const text = preMatch[1];
      
      const output: LookupUscfPlayerOutput = {};
      
      const nameMatch = text.match(/Name\s*:\s*(.*)/);
      if (nameMatch && nameMatch[1]) {
        const rawName = nameMatch[1].trim();
        const nameParts = rawName.split(',').map(p => p.trim());
        if (nameParts.length >= 2) {
            const lastName = nameParts[0];
            const firstName = nameParts.slice(1).join(' ');
            output.fullName = `${firstName} ${lastName}`.trim();
        } else {
            output.fullName = rawName;
        }
      }
      
      const ratingMatch = text.match(/Regular:\s*(\d+)/);
      if (ratingMatch && ratingMatch[1]) {
        output.rating = parseInt(ratingMatch[1], 10);
      }
      
      const expiresMatch = text.match(/Expires:\s*(\d{4}-\d{2}-\d{2})/);
      if (expiresMatch && expiresMatch[1]) {
        output.expirationDate = expiresMatch[1];
      }
      
      if (!output.fullName) {
          console.error("USCF Lookup Response (Name not found):", html.substring(0, 500));
          return { error: "Could not parse player name from the page." };
      }
      
      return output;

    } catch (error) {
      console.error("Error in lookupUscfPlayerFlow:", error);
      if (error instanceof Error) {
        return { error: error.message };
      }
      return { error: 'An unexpected error occurred during the lookup.' };
    }
  }
);
