
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
    prompt: `Hey, I have a block of text with a USCF player's record. I need you to pull out a few details into a JSON object.

The data is in a fixed-width format. Here's what I need:
- \`fullName\`: The player's name, which you'll find right after "Name :".
- \`rating\`: The player's rating, found after "Rating:". This should be a number.
- \`expirationDate\`: The membership expiration date, found after "Expires:". Please format this as YYYY-MM-DD.
- \`error\`: If you see the exact text "This player is not in our database", please put the message "Player not found with this USCF ID." in this field and leave the others blank.

Here's an example of the text format:
\`\`\`
---------------------------------------------------------------------------------------
USCF ID : 12345678      Name : DOE, JOHN M                             Address: ANYTOWN, TX 12345
---------------------------------------------------------------------------------------
 Birth : 1990-01-01  Sex : M   Federation:      Rating: 1500  Expires: 2025-12-31   Updated: 2024-01-01
---------------------------------------------------------------------------------------
\`\`\`
And for that, I'd expect this JSON:
{
  "fullName": "DOE, JOHN M",
  "rating": 1500,
  "expirationDate": "2025-12-31"
}

Ok, here's the text block. Let me know what you find.

\`\`\`
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
          if (nameParts.length >= 2) {
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
