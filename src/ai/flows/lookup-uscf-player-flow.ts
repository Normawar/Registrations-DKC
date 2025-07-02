
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

      // The name is the most stable element, in an <h4> tag.
      const nameMatch = text.match(/<h4>\s*([\s\S]*?)\s*<\/h4>/i);
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

      // Extract all table data cells and clean them
      const cells = text.match(/<TD[^>]*>[\s\S]*?<\/TD>/gi)?.map(cell => cell.replace(/<[^>]+>/g, '').trim()) || [];
      
      // Find data by looking for labels in the cell array
      const findValueByLabel = (label: string): string | undefined => {
          const labelIndex = cells.findIndex(cell => cell.includes(label));
          if (labelIndex !== -1 && labelIndex + 1 < cells.length) {
              return cells[labelIndex + 1];
          }
          return undefined;
      };

      const ratingText = findValueByLabel('Regular Rating');
      if (ratingText) {
          const ratingMatch = ratingText.match(/^(\d+)/); // Match only numbers at the start of the string
          if (ratingMatch && ratingMatch[1]) {
              output.rating = parseInt(ratingMatch[1], 10);
          }
      }
      
      const expiresText = findValueByLabel('Expires');
      if (expiresText) {
          const dateMatch = expiresText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch && dateMatch[1]) {
              const [month, day, year] = dateMatch[1].split('/');
              output.expirationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
      }

      // State is usually in the address line like "City, ST ZIP"
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
