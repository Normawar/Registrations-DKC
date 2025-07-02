
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
    
    // Use the simpler, more reliable 'thin3' details page which returns data in input fields.
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
      
      if (text.includes("Invalid ID") || text.trim() === '') {
        return { uscfId, error: "Player not found with this USCF ID." };
      }
      
      const output: LookupUscfPlayerOutput = { uscfId };

      // Helper function to extract value from an <input> tag based on its name attribute.
      const getInputValue = (name: string): string | null => {
        const regex = new RegExp(`<input[^>]+name=['"]?${name}['"]?[^>]+value=['"]([^'"]+)['"]`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
      };

      // Extract Name
      const rawName = getInputValue('p_name'); // Format: LASTNAME, FIRSTNAME MIDDLENAME
      if (rawName) {
        const [lastName, firstAndMiddle] = rawName.split(',').map(s => s.trim());
        output.lastName = lastName;
        if (firstAndMiddle) {
          const nameParts = firstAndMiddle.split(/\s+/).filter(Boolean);
          output.firstName = nameParts.shift() || '';
          output.middleName = nameParts.join(' ');
        }
      }

      // Extract Rating and Expiration Date from the same input field
      const ratingAndExpValue = getInputValue('rating1'); // Format: '319* 2024-02-01' or 'UNRATED'
      if (ratingAndExpValue && !ratingAndExpValue.toLowerCase().includes('unrated')) {
        const parts = ratingAndExpValue.split(/\s+/).filter(Boolean);
        const ratingStr = parts[0]?.replace(/[^\d]/g, ''); // Get only digits from first part
        if (ratingStr) {
          output.rating = parseInt(ratingStr, 10);
        }

        // The date is typically the last part
        const datePart = parts[parts.length - 1];
        if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            output.expirationDate = datePart;
        }
      }

      // Extract State
      const state = getInputValue('p_state');
      if (state) {
        output.state = state;
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
