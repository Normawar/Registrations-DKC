
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
    prompt: `You are an expert at parsing messy, real-world HTML. I will provide the full HTML source of a USCF player search results page.

Your task is to extract player information. The data is inside a \`<table>\`.
The table header row contains \`<td>\` elements like \`USCF ID\`, \`Rating\`, \`State\`, and \`Name\`.
Each subsequent \`<tr>\` in that table represents a player.

For each player row, please extract the following details from the corresponding \`<td>\` elements:
- \`uscfId\`: The player's 8-digit USCF ID. This will be the first column.
- \`rating\`: The player's regular USCF rating. This is the second column. This must be a number. If the text is 'UNR' or 'Unrated', the value should be null.
- \`state\`: The player's two-letter state abbreviation. This is the eighth column.
- \`fullName\`: The player's name, which is in the last column inside an \`<a>\` tag. It will be in "LAST, FIRST" format.

Clean up any extra whitespace or \`&nbsp;\` from the extracted text.

The final output must be a JSON object with a "players" key, which is an array of these player objects.

If the HTML contains the text "No players found" or "Players found: 0", or if you cannot find any player data rows, return an empty "players" array. Do not invent any players.

Here is an example of the HTML structure you will be parsing:
\`\`\`html
<center>
  <div class='contentheading'>Player Search Results</div>
  <FORM ACTION='./player-search.php' METHOD='GET'>
    <table>
      <tr><td colspan=7>Players found: 1</td></tr>
      <tr><td>USCF ID</td><td>Rating</td><td>Q Rtg</td><td>BL Rtg</td><td>OL R</td><td>OL Q</td><td>OL BL</td><td>State</td><td>Exp Date</td><td>Name</td></tr>
      <tr>
        <td valign=top>16153316 &nbsp;&nbsp;</td>
        <td valign=top>319 &nbsp;&nbsp;</td>
        <td valign=top>340 &nbsp;&nbsp;</td>
        <td valign=top>Unrated &nbsp;&nbsp;</td>
        <td valign=top>Unrated &nbsp;&nbsp;</td>
        <td valign=top>Unrated &nbsp;&nbsp;</td>
        <td valign=top>Unrated &nbsp;&nbsp;</td>
        <td valign=top>TX &nbsp;&nbsp;</td>
        <td valign=top>2025-11-30 &nbsp;&nbsp;</td>
        <td valign=top><a href=https://www.uschess.org/msa/MbrDtlMain.php?16153316 >GUERRA, KALI RENAE</a></td>
      </tr>
    </table>
  </form>
</center>
\`\`\`

Based on that example, you would produce this JSON:
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
    
    // Reformat name from "First Last" to "Last, First" for the USCF search engine.
    let searchName = name.trim();
    const nameParts = searchName.split(' ').filter(p => p);
    if (nameParts.length > 1 && !searchName.includes(',')) {
        const lastName = nameParts.pop();
        const firstName = nameParts.join(' ');
        searchName = `$\{lastName}, $\{firstName}`;
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

      // The AI prompt will handle cases like "No players found", so we can remove the explicit check here.
      
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
          reformattedName = `$\{nameParts[1]} $\{nameParts[0]}`;
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
