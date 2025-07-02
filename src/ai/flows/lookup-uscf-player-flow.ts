
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
    // Use the main member detail page which is more structured and reliable.
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
      
      if (text.includes("The member you requested is not in our database")) {
        return { uscfId, error: "Player not found with this USCF ID." };
      }
      
      const output: LookupUscfPlayerOutput = { uscfId };

      // Helper function to extract data from a table row based on a label.
      const extractData = (label: string): string | null => {
        const regex = new RegExp(`<TD.*?>\\s*${label}\\s*<\\/TD>[\\s\\S]*?<TD.*?>(.*?)<`, "i");
        const match = text.match(regex);
        if (match && match[1]) {
            return match[1].replace(/<[^>]+>/g, '').trim();
        }
        return null;
      }
      
      // The name is typically in an <h4> tag.
      const nameMatch = text.match(/<h4>([\s\S]*?)<\/h4>/i);
      if (nameMatch && nameMatch[1]) {
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
      }

      // Extract rating. The value is usually preceded by "R: ".
      const ratingText = extractData('Regular Rating');
      if (ratingText) {
          const ratingMatch = ratingText.match(/(\d+)/);
          if (ratingMatch && ratingMatch[1]) {
              output.rating = parseInt(ratingMatch[1], 10);
          }
      }
      
      // Extract expiration date.
      const expiresText = extractData('Expires');
      if (expiresText) {
          const dateMatch = expiresText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch && dateMatch[1]) {
              // Convert MM/DD/YYYY to YYYY-MM-DD
              const [month, day, year] = dateMatch[1].split('/');
              output.expirationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
      }

      // Extract state from the address block.
      const stateMatch = text.match(/,\s*([A-Z]{2})\s+\d{5}/);
      if (stateMatch && stateMatch[1]) {
        output.state = stateMatch[1];
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
