
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
    prompt: `You are an expert at parsing messy HTML. I will provide the HTML source code of a USCF player search results page.

Your task is to find the table containing the player search results. The header row for this table will look like this:
\`\`\`html
<tr><td>USCF ID</td><td>Rating</td><td>Q Rtg</td><td>BL Rtg</td><td>OL R</td><td>OL Q</td><td>OL BL</td><td>State</td><td>Exp Date</td><td>Name</td></tr>
\`\`\`

For each player data row *after* that header, extract the following details into a JSON object:

- \`uscfId\`: The player's 8-digit USCF ID. This is in the first \`<td>\`.
- \`fullName\`: The player's name. This is inside an \`<a>\` tag in the tenth and final \`<td>\`.
- \`rating\`: The player's regular USCF rating from the "Rating" column. This is in the second \`<td>\`. This must be a number. If the rating is "Unrated" or blank, omit this field from the JSON object.
- \`state\`: The player's two-letter state abbreviation. This is in the eighth \`<td>\`.

If the HTML contains the exact text "Total players found: 0", or if you cannot find the results table described above, return an empty array for the "players" field.

Example of a player data row in the HTML table:
\`\`\`html
<tr><td valign=top>16153316 &nbsp;&nbsp;</td><td valign=top>319 &nbsp;&nbsp;</td><td valign=top>340 &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>Unrated &nbsp;&nbsp;</td><td valign=top>TX &nbsp;&nbsp;</td><td valign=top>2025-11-30 &nbsp;&nbsp;</td><td valign=top><a href=...>GUERRA, KALI RENAE</a></td></tr>
\`\`\`

Based on that example row, you would produce this JSON object inside the "players" array:
{
  "uscfId": "16153316",
  "fullName": "GUERRA, KALI RENAE",
  "rating": 319,
  "state": "TX"
}

Now, please parse the full HTML source code provided below.

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

      // The prompt now handles the "0 players found" case. If the array is empty, it's a valid result.
      if (output.players.length === 0) {
        return { players: [] };
      }
      
      const players: PlayerSearchResult[] = output.players.map(player => {
        const nameParts = player.fullName.split(',').map((p: string) => p.trim());
        const reformattedName = nameParts.length >= 2
          ? `${nameParts[1]} ${nameParts[0]}`
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
        // Avoid exposing JSON parsing errors to the user if the server sends HTML unexpectedly
        if (error.message.toLowerCase().includes('json')) {
            return { players: [], error: `Received an unexpected response from the server. Please try again.` };
        }
        return { players: [], error: `An unexpected error occurred: ${error.message}` };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
