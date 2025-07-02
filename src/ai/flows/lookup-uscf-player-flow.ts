
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
  uscfId: z.string().describe("The player's USCF ID."),
  firstName: z.string().optional().describe("The player's first name."),
  middleName: z.string().optional().describe("The player's middle name or initial."),
  lastName: z.string().optional().describe("The player's last name."),
  state: z.string().optional().describe("The player's state abbreviation."),
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
    if (!uscfId) {
      return { uscfId: '', error: 'A USCF ID must be provided.' };
    }
    
    // Use thin3.php as it's a more stable, data-focused endpoint.
    const url = `https://www.uschess.org/msa/thin3.php?${uscfId}`;
    
    try {
      const response = await fetch(url, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return { uscfId, error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const text = await response.text();
      
      if (text.includes("Invalid ID") || text.trim() === '' || !text.includes("USCF Member Lookup")) {
        return { uscfId, error: "Player not found with this USCF ID." };
      }
      
      const output: LookupUscfPlayerOutput = { uscfId };

      // Helper function to extract the value from an input tag
      const extractInputValue = (html: string, name: string): string | null => {
        const regex = new RegExp(`name=${name}[^>]*value='([^']*)'`, 'i');
        const match = html.match(regex);
        return match ? match[1].trim() : null;
      };

      // Extract Full Name
      const fullName = extractInputValue(text, 'memname');
      if (fullName) {
          const nameParts = fullName.split(' ').filter(p => p);
          output.lastName = nameParts.pop() || '';
          output.firstName = nameParts.shift() || '';
          output.middleName = nameParts.join(' ');
      }

      // Extract State
      const state = extractInputValue(text, 'state_country');
      if (state) {
        output.state = state;
      }

      // Extract Membership Expiration Date
      const expirationDate = extractInputValue(text, 'memexpdt');
      if (expirationDate) {
        output.expirationDate = expirationDate;
      }

      // Extract Regular Rating
      const ratingString = extractInputValue(text, 'rating1');
      if (ratingString && ratingString.toLowerCase() !== 'unrated') {
        const ratingMatch = ratingString.match(/^(\d+)/);
        if (ratingMatch && ratingMatch[1]) {
          output.rating = parseInt(ratingMatch[1], 10);
        }
      }
      
      if (!output.lastName && !output.firstName) {
        return { uscfId, error: "Could not parse player name from the details page." };
      }
      
      return output;

    } catch (error) {
      console.error("Error in lookupUscfPlayerFlow:", error);
      if (error instanceof Error) {
        return { uscfId, error: error.message };
      }
      return { uscfId, error: 'An unexpected error occurred during the lookup.' };
    }
  }
);
