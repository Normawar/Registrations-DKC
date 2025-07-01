
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
    model: 'googleai/gemini-1.5-pro-latest',
    input: { schema: z.string() },
    output: { schema: SearchUscfPlayersOutputSchema },
    prompt: `You are an expert at parsing HTML tables. Given the following HTML from the USCF player search, extract the player details into a JSON object.

The data for each player is in a \`<tr>\` element.
- The 1st column (\`<td>\`) contains the USCF ID.
- The 2nd column (\`<td>\`) contains the Full Name.
- The 3rd column (\`<td>\`) contains the State.
- The 4th column (\`<td>\`) contains the Rating.

Create a JSON object with a "players" key, which is an array of player objects. Each object should have:
- "uscfId" (string)
- "fullName" (string)
- "rating" (number, or null if unrated/missing)
- "state" (string)

Here is an example of a row:
\`\`\`html
<tr><td><font face=verdana,helvetica,arial size=2>16439198</font></td><td align=left><font face=verdana,helvetica,arial size=2><a href=./MbrDtlMain.php?16439198>GUERRA, KALI ANN</a></font></td><td align=center><font face=verdana,helvetica,arial size=2>TX</font></td><td align=right><font face=verdana,helvetica,arial size=2>1084</font></td></tr>
\`\`\`

For that row, you would produce this player object:
\`\`\`json
{
  "uscfId": "16439198",
  "fullName": "GUERRA, KALI ANN",
  "rating": 1084,
  "state": "TX"
}
\`\`\`

If the provided HTML is empty, contains no player rows, or explicitly says "No players found", return an empty "players" array.

Here is the HTML to parse:
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
    
    // Reformat name from "First Last" to "Last, First" for the USCF search engine.
    let searchName = name.trim();
    const nameParts = searchName.split(' ').filter(p => p);
    if (nameParts.length > 1 && !searchName.includes(',')) {
        const lastName = nameParts.pop();
        const firstName = nameParts.join(' ');
        searchName = `${lastName}, ${firstName}`;
    }

    const stateParam = (state && state !== 'ALL') ? state : '';
    const url = `https://www.uschess.org/datapage/player-search.php?name=${encodeURIComponent(searchName)}&state=${encodeURIComponent(stateParam)}&ratingmin=&ratingmax=&order=N&rating=R&mode=Find&_cacheBust=${Date.now()}`;
    
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

      if (html.includes("No players found")) {
          return { players: [] };
      }
      
      // Extract just the results table to give the AI a cleaner input
      const listStartIndex = html.indexOf('<!-- Here is the list of players -->');
      let tableHtml = html;

      if (listStartIndex !== -1) {
          const tableStartIndex = html.indexOf('<table', listStartIndex);
          const tableEndIndex = html.indexOf('</table>', tableStartIndex);

          if (tableStartIndex !== -1 && tableEndIndex !== -1) {
              tableHtml = html.substring(tableStartIndex, tableEndIndex + '</table>'.length);
          }
      }

      const { output } = await searchPrompt(tableHtml);
      
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
