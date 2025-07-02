
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
    // Use the www.uschess.org endpoint which is more stable than the msa subdomain.
    const url = `https://www.uschess.org/msa/thin3.php?${uscfId}`;
    
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        return { uscfId, error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const text = await response.text();
      
      if (text.includes("This player is not in our database")) {
        return { uscfId, error: "Player not found with this USCF ID." };
      }
      
      const output: LookupUscfPlayerOutput = { uscfId };
      
      const nameMatch = text.match(/Name\s*:\s*(.*)/);
      if (!nameMatch || !nameMatch[1]) {
        console.error("USCF Lookup: Could not find 'Name:' field on page. Full response:", text.substring(0, 1000));
        return { uscfId, error: "Could not find player's name field on the page. The website layout may have changed." };
      }
      
      const rawName = nameMatch[1].replace(/<[^>]+>/g, '').trim(); // Format: LAST, FIRST MIDDLE
      const nameParts = rawName.split(',');
      if (nameParts.length > 1) {
          output.lastName = nameParts.shift()!.trim();
          const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/).filter(Boolean);
          output.firstName = firstAndMiddleParts.shift() || '';
          output.middleName = firstAndMiddleParts.join(' ');
      } else {
          output.lastName = rawName;
      }
      
      const ratingLineMatch = text.match(/Regular:\s*(.*)/);
      if (ratingLineMatch && ratingLineMatch[1]) {
        const ratingText = ratingLineMatch[1].trim();
        const numericPartMatch = ratingText.match(/(\d+)/);
        if (numericPartMatch && numericPartMatch[1]) {
            output.rating = parseInt(numericPartMatch[1], 10);
        }
      }
      
      const expiresMatch = text.match(/Expires\s*:\s*(\d{4}-\d{2}-\d{2})/);
      if (expiresMatch && expiresMatch[1]) {
        output.expirationDate = expiresMatch[1];
      }
      
      // Regex to find state, e.g., ", TX 78501"
      const stateMatch = text.match(/,\s*([A-Z]{2})\s+\d{5}/);
      if (stateMatch && stateMatch[1]) {
        output.state = stateMatch[1];
      }

      if (!output.lastName && !output.firstName) {
          console.error("USCF Lookup: Failed to parse player name from raw string:", rawName);
          return { uscfId, error: "Found the player's name field, but could not parse the name from it." };
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
