
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
    
    // The modern, more reliable member detail page
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

      // Name and ID are in a consistent <font> tag
      const nameIdMatch = text.match(/<font size=\+1><b>\d+:\s*(.*?)<\/b><\/font>/i);
      if (nameIdMatch && nameIdMatch[1]) {
          const rawName = nameIdMatch[1].trim();
          const nameParts = rawName.split(',');
          if (nameParts.length > 1) { // Format: LAST, FIRST MIDDLE
              output.lastName = nameParts.shift()!.trim();
              const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/).filter(Boolean);
              output.firstName = firstAndMiddleParts.shift() || '';
              output.middleName = firstAndMiddleParts.join(' ');
          } else { // Assume FIRST MIDDLE LAST
              const firstAndMiddleParts = rawName.split(/\s+/).filter(Boolean);
              output.lastName = firstAndMiddleParts.pop() || '';
              output.firstName = firstAndMiddleParts.shift() || '';
              output.middleName = firstAndMiddleParts.join(' ');
          }
      }

      // Helper to find a value in a row by its label, which is more robust
      const findValueInRow = (label: string): string | undefined => {
          const rows = text.split(/<tr/i);
          const rowWithLabel = rows.find(r => new RegExp(label, 'i').test(r));
          if (rowWithLabel) {
              const valueMatch = rowWithLabel.match(/<b>(.*?)<\/b>/i);
              if (valueMatch && valueMatch[1]) {
                   return valueMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
              }
          }
          return undefined;
      }
      
      const ratingText = findValueInRow('Regular Rating');
      if (ratingText) {
          const ratingMatch = ratingText.match(/^(\d+)/); 
          if (ratingMatch && ratingMatch[1]) {
              output.rating = parseInt(ratingMatch[1], 10);
          }
      }
      
      const expiresText = findValueInRow('Expiration Dt.');
      if (expiresText) {
          const dateMatch = expiresText.match(/(\d{4}-\d{2}-\d{2})/);
           if (dateMatch && dateMatch[1]) {
             output.expirationDate = dateMatch[1];
           } else {
             const otherDateMatch = expiresText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
             if (otherDateMatch && otherDateMatch[1]) {
                const [month, day, year] = otherDateMatch[1].split('/');
                output.expirationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
             }
           }
      }

       const stateText = findValueInRow('>State<'); // Use angle brackets to be more specific
       if (stateText) {
         const stateMatch = stateText.trim().match(/^([A-Z]{2})/);
         if (stateMatch && stateMatch[1]) {
           output.state = stateMatch[1];
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
