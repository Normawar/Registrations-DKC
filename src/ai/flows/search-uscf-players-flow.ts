
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

Here are the rules for parsing:
1.  Find the main table which is located after a '<h3>Player Search Results</h3>' tag.
2.  Skip the header row. The header row is a \`<tr>\` with \`class="header"\`.
3.  Player data is located in subsequent \`<tr>\` elements, which often have a \`bgcolor\` attribute.
4.  For each player row, extract the following information from the \`<td>\` (table cell) elements:
    - **uscfId**: The 8-digit number from the first \`<td>\`. It's within an \`<a>\` tag.
    - **fullName**: The player's name from the second \`<td>\`. It is in "LAST, FIRST" format.
    - **rating**: The rating number from the third \`<td>\`. If the content is 'UNR', '0', or not a number, the value should be \`undefined\`.
    - **state**: The two-letter state abbreviation from the fourth \`<td>\`.
5.  Format the output as a JSON object matching the schema. Do not invent players or data. If no players are found in the table, return an empty \`players\` array.

Example Input HTML Snippet:
\`\`\`html
...
<tr class="header">
  <td><b>ID</b></td>
  <td><b>Name</b></td>
  <td><b>Rating</b></td>
  <td><b>St</b></td>
  <td><b>Expires</b></td>
</tr>
<tr bgcolor="#E6E6E6">
  <td><a href="/msa/thin3.php?14828139">14828139</a></td>
  <td>GUERRA, ANTHONY J</td>
  <td align="right">1596</td>
  <td>TX</td>
  <td>2024-11-30</td>
</tr>
...
\`\`\`
Example JSON data to extract for the snippet above:
\`{ "uscfId": "14828139", "fullName": "GUERRA, ANTHONY J", "rating": 1596, "state": "TX" }\`


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
    let url = `https://www.uschess.org/datapage/player-search.php?name=${encodeURIComponent(name)}`;
    if (state && state !== "ALL") {
        url += `&state=${encodeURIComponent(state)}`;
    }
    
    try {
      const response = await fetch(url);
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
        if (nameParts.length === 2) {
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
