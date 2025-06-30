
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
  fullName: z.string().describe("The player's full name."),
  rating: z.number().optional().describe("The player's regular USCF rating. Should be a number, not 'UNR' or '0' if unrated."),
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
    input: { schema: z.string() },
    output: { schema: SearchUscfPlayersOutputSchema },
    prompt: `You are an expert at parsing structured HTML.
The provided text is the HTML content of a USCF player search results page.
Your task is to extract the details for each player listed in the results table.

Here is the structure of the HTML table:
- The table follows a \`<h3>Player Search Results</h3>\` heading.
- The header row has a \`class="header"\` and 10 columns: USCF ID, Rating, Q Rtg, BL Rtg, OL R, OL Q, OL BL, State, Exp Date, Name.
- Each data row (\`<tr>\`) represents a single player.

Your parsing rules:
1.  Iterate through each \`<tr>\` in the results table, skipping the header row.
2.  For each player row, extract the following information from the \`<td>\` cells:
    - **uscfId**: From cell 1. This is the 8-digit number inside the \`<a>\` tag.
    - **rating**: From cell 2. This is the player's regular rating.
        - If the value is a number (e.g., "1111"), use that number.
        - If the value is a provisional rating (e.g., "417/5"), extract the number before the slash (e.g., 417).
        - If the value is "Unrated" or not a number, the rating should be \`undefined\`.
    - **state**: From cell 8. This is the two-letter state abbreviation.
    - **fullName**: From cell 10. This is the player's name (e.g., "GUERRA, ZEFERINO ANTONIO").
3.  Collect all found players into the \`players\` array. Do not invent players. If the text indicates "No players found", return an empty array.

Example Input HTML Snippet:
\`\`\`html
<table border="1" cellpadding="2" cellspacing="0" width="100%">
<tr class="header">
<td>USCF ID</td><td>Rating</td><td>Q Rtg</td><td>BL Rtg</td><td>OL R</td><td>OL Q</td><td>OL BL</td><td>State</td><td>Exp Date</td><td>Name</td>
</tr>
<tr>
<td><a href="MbrDtlMain.php?14922025">14922025</a></td><td align="right">1111</td><td align="right">1112</td><td align="right">644</td><td align="right">Unrated</td><td align="right">Unrated</td><td align="right">Unrated</td><td>TX</td><td>2025-11-30</td><td>GUERRA, ZEFERINO ANTONIO</td>
</tr>
<tr>
<td><a href="MbrDtlMain.php?16595724">16595724</a></td><td align="right">417/5</td><td align="right">420/5</td><td align="right">Unrated</td><td align="right">Unrated</td><td align="right">TX</td><td>2019-01-31</td><td>GUTIERREZ, ZEFERINO</td>
</tr>
</table>
\`\`\`

Here is the HTML content to parse:
{{{_input}}}`
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
    
    const stateParam = (state && state !== 'ALL') ? state : '';
    const url = `https://www.uschess.org/datapage/player-search.php?name=${encodeURIComponent(name)}&state=${encodeURIComponent(stateParam)}&ratingmin=&ratingmax=&order=N&rating=R&mode=Find`;
    
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();

      if (html.includes("No players found")) {
          return { players: [] };
      }
      
      const { output } = await searchPrompt(html);
      
      if (!output) {
          return { players: [], error: "AI model failed to parse the player data." };
      }
      
      // Post-process players: reformat names and trim whitespace.
      let players = output.players.map(player => {
        let reformattedName = player.fullName.trim();
        // Re-format name from "LAST, FIRST" to "FIRST LAST" for display
        const nameParts = reformattedName.split(',').map(p => p.trim());
        if (nameParts.length >= 2) {
          reformattedName = `${nameParts[1]} ${nameParts[0]}`;
        }
        return {
          ...player,
          fullName: reformattedName,
        };
      });

      // If a state was specified in the search, filter the results to only include players from that state.
      // This is a safeguard in case the website returns players from other states or the AI includes them.
      if (state && state !== "ALL") {
        players = players.filter(player => player.state?.toUpperCase() === state.toUpperCase());
      }

      return { players };

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        return { players: [], error: error.message };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
