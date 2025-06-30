
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

const lookupPrompt = ai.definePrompt({
    name: 'lookupUscfPlayerPrompt',
    input: { schema: z.string() },
    output: { schema: LookupUscfPlayerOutputSchema },
    prompt: `You are an expert at parsing structured text.
The provided text is from a USCF player lookup page.
Your task is to extract the player's full name, their regular rating, and their membership expiration date.

The input will be the text content inside a \`<pre>\` tag. Parse this text according to the following rules:
1.  Find the line that starts with "Name:". The player's full name follows this label, in "LASTNAME, FIRSTNAME" format.
2.  Find the line that contains the word "regular". The rating is the number immediately following "Rate:". Extract only the number.
3.  On the same line as the rating, find "Exp:". The membership expiration date follows this label in "YYYY-MM-DD" format.
4.  If the input text contains "This player is not in our database", it means the player was not found. In this case, set the 'error' field in your output to "Player not found with this USCF ID." and leave other fields empty.
5.  If you cannot find a specific field, leave it undefined in the output.

Here is the text content to parse:
{{{_input}}}`
});

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
    const url = `http://msa.uschess.org/thin3.php?${uscfId}&_cacheBust=${Date.now()}`;
    
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
      if (!response.ok) {
        return { error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      const preRegex = /<pre>([\s\S]*?)<\/pre>/i;
      const match = html.match(preRegex);

      if (!match || match.length < 2) {
          if (html.includes("This player is not in our database")) {
              return { error: "Player not found with this USCF ID." };
          }
          return { error: "Could not find player data in the response from the USCF website." };
      }

      const textContent = match[1].trim();
      
      const { output } = await lookupPrompt(textContent);
      
      if (!output) {
          return { error: "AI model failed to parse the player data." };
      }

      // Re-format name from "LAST, FIRST" to "FIRST LAST" for display
      if (output.fullName) {
          const nameParts = output.fullName.split(',').map(p => p.trim());
          if (nameParts.length === 2) {
              output.fullName = `${nameParts[1]} ${nameParts[0]}`;
          }
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
