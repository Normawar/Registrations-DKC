
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
    model: 'googleai/gemini-1.5-pro-latest',
    input: { schema: z.string() },
    output: { schema: LookupUscfPlayerOutputSchema },
    prompt: `You are an expert at parsing text from HTML. I will provide the full HTML source of a USCF player detail page.

Your task is to find and parse the player's details from the page. The data is often inside a \`<pre>\` tag, but you should look for the text labels to be certain, as the structure can vary. Spaces around the colon in labels may vary (e.g., "Name :" vs "Name:").

Please extract the following details by finding their labels in the text, and format them into a JSON object:

- \`fullName\`: Find the label "Name" and extract the player's name that follows it (e.g., after "Name :").
- \`rating\`: Find the label "Rating" and extract the player's USCF rating. This must be a number. If it is "Unrated" or blank, omit the field.
- \`expirationDate\`: Find the label "Expires" and extract the date. Format this as YYYY-MM-DD.
- \`error\`: If the HTML contains the exact text "This player is not in our database", set this field to "Player not found with this USCF ID." and leave the other fields blank.

Example of the text content to look for:
\`\`\`
---------------------------------------------------------------------------------------
USCF ID : 12345678      Name : DOE, JOHN M                             Address: ANYTOWN, TX 12345
---------------------------------------------------------------------------------------
 Birth : 1990-01-01  Sex : M   Federation:      Rating: 1500  Expires: 2025-12-31   Updated: 2024-01-01
---------------------------------------------------------------------------------------
\`\`\`

Based on that example, you would produce this JSON:
{
  "fullName": "DOE, JOHN M",
  "rating": 1500,
  "expirationDate": "2025-12-31"
}

Now, please parse the full HTML source code provided below.

\`\`\`html
{{{_input}}}
\`\`\`
`
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
      
      const { output } = await lookupPrompt(html);
      
      if (!output) {
          return { error: "AI model failed to parse the player data." };
      }
      
      if (output.error) {
        return { error: output.error };
      }

      // Re-format name from "LAST, FIRST" to "FIRST LAST" for display
      if (output.fullName) {
          const nameParts = output.fullName.split(',').map(p => p.trim());
          if (nameParts.length >= 2) {
              const firstNameParts = nameParts.slice(1);
              output.fullName = `${firstNameParts.join(' ')} ${nameParts[0]}`;
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
