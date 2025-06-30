
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
- The header row has a \`class="header"\`.
- Data rows (\`<tr>\`) often have a \`bgcolor\` attribute.
- **Crucially, each data row can contain information for one OR two players.**
- A block of data for a single player consists of 7 \`<td>\` cells: ID, Name, Rating, St, Expires, Mbr, Tot.
- If a \`<tr>\` contains 14 \`<td>\` cells, it represents two players. The first 7 cells are for the first player, and the next 7 are for the second player.

Your parsing rules:
1.  Iterate through each \`<tr>\` in the results table (skip the header).
2.  For each \`<tr>\`, check the number of \`<td>\` cells.
3.  **If there are 14 \`<td>\` cells:**
    - Parse the first player from cells 1-7.
    - Parse the second player from cells 8-14.
4.  **If there are 7 \`<td>\` cells:**
    - Parse the single player from those cells.
5.  For each player found, extract the following:
    - **uscfId**: The 8-digit number from the first \`<td>\` of their block. It's inside an \`<a>\` tag.
    - **fullName**: The player's name from the second \`<td>\` of their block (e.g., "GUERRA, ANTHONY J").
    - **rating**: The number from the third \`<td>\` of their block. If 'UNR' or not a number, the value should be \`undefined\`.
    - **state**: The two-letter state abbreviation from the fourth \`<td>\` of their block.
6.  Collect all found players into the \`players\` array. Do not invent players. If no players are found, return an empty array.

Example Input HTML Snippet with two players in one row:
\`\`\`html
<TR bgcolor="#E6E6E6">
<TD><A href="/msa/thin3.php?12722825">12722825</A></TD>
<TD>GUERRA, ANTHONY</TD>
<TD align=right>1502</TD>
<TD>TX</TD>
<TD>2024-09-30</TD>
<TD>REG</TD>
<TD align=right> 594.0</TD>
<TD><A href="/msa/thin3.php?12815593">12815593</A></TD>
<TD>GUERRA, ANTHONY J</TD>
<TD align=right>1661</TD>
<TD>TX</TD>
<TD>2024-11-30</TD>
<TD>REG</TD>
<TD align=right> 268.0</TD>
</TR>
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
