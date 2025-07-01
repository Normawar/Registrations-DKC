
'use server';
/**
 * @fileOverview Searches for USCF players by name from the USCF website.
 *
 * - searchUscfPlayers - A function that handles the player search process.
 * - SearchUscfPlayersInput - The input type for the searchUscfPlayers function.
 * - SearchUscfPlayersOutput - The return type for the searchUscfPlayers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SearchUscfPlayersInputSchema = z.object({
  name: z.string().describe('The name of the player to search for.'),
  state: z.string().optional().describe("The player's two-letter state abbreviation. e.g., TX"),
});
export type SearchUscfPlayersInput = z.infer<typeof SearchUscfPlayersInputSchema>;

const PlayerSearchResultSchema = z.object({
  uscfId: z.string().describe("The player's 8-digit USCF ID."),
  fullName: z.string().describe("The player's full name in LAST, FIRST format."),
  rating: z.number().optional().describe("The player's regular USCF rating. Should be a number, not 'Unrated'."),
  state: z.string().optional().describe("The player's state abbreviation."),
});

const SearchUscfPlayersOutputSchema = z.object({
    players: z.array(PlayerSearchResultSchema).describe("An array of players found."),
    error: z.string().optional().describe("An error message if the search failed or no players were found.")
});
export type SearchUscfPlayersOutput = z.infer<typeof SearchUscfPlayersOutputSchema>;
export type PlayerSearchResult = z.infer<typeof PlayerSearchResultSchema>;


export async function searchUscfPlayers(input: SearchUscfPlayersInput): Promise<SearchUscfPlayersOutput> {
  return searchUscfPlayersFlow(input);
}

const searchPrompt = ai.definePrompt({
    name: 'searchUscfPlayersPrompt',
    model: 'googleai/gemini-1.5-pro-latest',
    input: { schema: z.string() },
    output: { schema: SearchUscfPlayersOutputSchema },
    prompt: `You are an expert at parsing messy HTML into structured JSON. I will provide the HTML source code of a USCF player search results page. Your task is to extract the details for each player found and return them in a JSON array.

**RULES:**
1.  Find the results table which has a header row with columns like "USCF ID", "Rating", "State", and "Name".
2.  For each player row, extract the \`uscfId\` (1st column), \`rating\` (2nd column), \`state\` (8th column), and \`fullName\` (10th column). The full name is the text within the \`<a>\` tag.
3.  The \`rating\` must be a number. If a player's rating is "Unrated" or blank, you must **omit** the \`rating\` field for that player in the JSON output.
4.  If the page contains the text "Total players found: 0", or if you cannot find the results table, you must return an empty array for the "players" field, like this: \`{"players": []}\`.

Here is an example to guide you.

**EXAMPLE INPUT HTML:**
\`\`\`html
<center><div class='contentheading'>Player Search Results</div><FORM ACTION='./player-search.php' METHOD='GET'><table><tr><td colspan=7>Players found: 1</td></tr>
<tr><td>USCF ID</td><td>Rating</td><td>Q Rtg</td><td>BL Rtg</td><td>OL R</td><td>OL Q</td><td>OL BL</td><td>State</td><td>Exp Date</td><td>Name</td></tr><tr><td valign=top>16153316 &nbsp;&nbsp;</td><td valign=top>319 &nbsp;&nbsp;</td><td valign=top>340 &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>TX &nbsp;&nbsp;</td><td valign=top>2025-11-30 &nbsp;&nbsp;</td><td valign=top><a href=https://www.uschess.org/msa/MbrDtlMain.php?16153316 >GUERRA, KALI RENAE</a></td>
</tr>
</table></form>
</center>
\`\`\`

**EXAMPLE OUTPUT JSON for the above HTML:**
\`\`\`json
{
  "players": [
    {
      "uscfId": "16153316",
      "fullName": "GUERRA, KALI RENAE",
      "rating": 319,
      "state": "TX"
    }
  ]
}
\`\`\`

Now, parse the following HTML and provide the JSON output.

**ACTUAL INPUT HTML:**
\`\`\`html
{{{_input}}}
\`\`\`
`
});


const searchUscfPlayersFlow = ai.defineFlow(
  {
    name: 'searchUscfPlayersFlow',
    inputSchema: SearchUscfPlayersInputSchema,
    outputSchema: SearchUscfPlayersOutputSchema,
  },
  async ({ name, state }) => {
    if (!name) {
      return { players: [], error: 'Player name cannot be empty.' };
    }
    
    // Use the older but more consistent HTML search page
    const searchParams = new URLSearchParams({
        name: name,
        rating: 'R', // Search for regular ratings
    });
    if (state && state !== 'ALL') {
        searchParams.append('state', state);
    }
    
    const url = `http://www.uschess.org/msa/player-search.php?${searchParams.toString()}&_cacheBust=${Date.now()}`;
    
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
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      const { output } = await searchPrompt(html);

      if (!output) {
          return { players: [], error: "AI model failed to parse the player data." };
      }
      
      if (output.error) {
          return { players: [], error: output.error };
      }
      
      if (output.players.length === 0) {
        return { players: [] };
      }
      
      const players: PlayerSearchResult[] = output.players.map(player => {
        const nameParts = player.fullName.split(',').map((p: string) => p.trim());
        const firstNameParts = nameParts.slice(1);
        const lastName = nameParts[0];

        const reformattedName = firstNameParts.length > 0
          ? `${firstNameParts.join(' ')} ${lastName}`
          : player.fullName;
        
        return {
          ...player,
          fullName: reformattedName,
        };
      });
      
      return { players };

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('json')) {
            return { players: [], error: `Received an unexpected response from the server. Please try again.` };
        }
        return { players: [], error: `An unexpected error occurred: ${error.message}` };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
