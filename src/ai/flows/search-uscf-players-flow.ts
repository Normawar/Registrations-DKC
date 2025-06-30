
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
    prompt: `You are an expert at parsing structured HTML into JSON.
The provided text is the HTML content of a USCF player search results page.
Your task is to find the table of players and extract the details for each player into a JSON object matching the provided schema.

The table to parse is the one that immediately follows a \`<h3>Player Search Results</h3>\` heading.
The player data is contained within plain \`<tr>\` elements. The header row (\`<tr class="header">\`) should be ignored.

For each data row, extract the text content from its \`<td>\` children, ignoring any inner tags like \`<font>\` or \`<a>\`:
- **uscfId**: The 8-digit number from the link in the first \`<td>\`. The link will be in the format \`MbrDtlMain.php?12345678\`.
- **rating**: The regular rating from the second \`<td>\`. If it's provisional (e.g., "417/5"), use the number before the slash. If it's "Unrated", not a number, or blank, the rating field should be omitted or set to \`undefined\`.
- **state**: The two-letter state abbreviation from the eighth \`<td>\`.
- **fullName**: The player's name from the tenth \`<td>\`. This name may be inside an \`<a>\` tag. Extract only the text of the name.

Here is an example of how to map a single HTML row to the desired JSON output:

**Example HTML:**
\`\`\`html
<tr>
    <td><font size=-1><a href="MbrDtlMain.php?12345678">12345678</a></font></td>
    <td align="center"><font size=-1>1500</font></td>
    <td align="center"><font size=-1>1450</font></td>
    <td align="center"><font size=-1></font></td>
    <td align="center"><font size=-1></font></td>
    <td align="center"><font size=-1></font></td>
    <td align="center"><font size=-1></font></td>
    <td align="center"><font size=-1>TX</font></td>
    <td align="center"><font size=-1>2025-12-31</font></td>
    <td><font size=-1><a href="MbrDtlMain.php?12345678">DOE, JOHN</a></font></td>
</tr>
\`\`\`

**Corresponding JSON entry for the \`players\` array:**
\`\`\`json
{
  "uscfId": "12345678",
  "fullName": "DOE, JOHN",
  "rating": 1500,
  "state": "TX"
}
\`\`\`

Now, parse the following HTML and provide the full JSON output. Do not invent players. If the HTML indicates "No players found", you must return an empty \`players\` array.

HTML to parse:
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
