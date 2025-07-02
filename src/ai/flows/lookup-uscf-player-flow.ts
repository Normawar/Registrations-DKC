
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
    
    // Use MbrDtlMain.php as it's the canonical source page.
    const url = `https://www.uschess.org/msa/MbrDtlMain.php?${uscfId}`;
    
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
      
      if (text.includes("Invalid ID") || text.trim() === '') {
        return { uscfId, error: "Player not found with this USCF ID." };
      }
      
      const output: LookupUscfPlayerOutput = { uscfId };

      // Helper to clean up extracted text by removing HTML entities and extra whitespace
      const cleanText = (str: string) => str.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

      // Extract Name from title: <font size=+1><b>16153316: KALI RENAE GUERRA</b></font>
      const nameIdMatch = text.match(/<font size=\+1><b>\d+:\s*([^<]+)<\/b><\/font>/i);
      if (nameIdMatch && nameIdMatch[1]) {
          const nameParts = cleanText(nameIdMatch[1]).split(' ');
          output.lastName = nameParts.pop() || '';
          output.firstName = nameParts.shift() || '';
          output.middleName = nameParts.join(' ');
      }

      // Extract Regular Rating from: Regular Rating ... <b><nobr>319&nbsp;&nbsp;2024-02</nobr></b>
      const ratingMatch = text.match(/Regular Rating[\s\S]*?<b><nobr>([^<]+)<\/nobr><\/b>/i);
      if (ratingMatch && ratingMatch[1]) {
        const ratingText = cleanText(ratingMatch[1]);
        const numericRating = ratingText.match(/^(\d+)/); // Get leading digits
        if (numericRating && numericRating[1]) {
          output.rating = parseInt(numericRating[1], 10);
        }
      }

      // Extract Expiration Date from: Expiration Dt. ... <td><b>2025-11-30</b></td>
      const expirationMatch = text.match(/Expiration Dt\.[\s\S]*?<td><b>([\d-]+)<\/b><\/td>/i);
      if (expirationMatch && expirationMatch[1]) {
        output.expirationDate = cleanText(expirationMatch[1]);
      }
      
      // Extract State from: State ... <td><b> TX </b></td>
      const stateMatch = text.match(/State[\s\S]*?<td><b>([^<]+)<\/b><\/td>/i);
      if (stateMatch && stateMatch[1]) {
        output.state = cleanText(stateMatch[1]);
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
