
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
    prompt: `You are an expert at parsing HTML tables. Your task is to extract player data from the provided HTML content of a USCF player search results page.

1.  Locate the \`<table>\` that contains a row with the class "header" (\`<tr class="header">\`). This header row contains column titles like "ID", "Reg", "Name", etc.
2.  Ignore the header row itself.
3.  Process all subsequent \`<tr>\` elements within that table's body. Each \`<tr>\` represents a player.
4.  For each player row, extract the following data from its child \`<td>\` elements:
    - **uscfId**: Found in the first \`<td>\`. Extract the 8-digit number from the link's \`href\` attribute (e.g., from \`./MbrDtlMain.php?12345678\`).
    - **rating**: Found in the second \`<td>\`. This is the regular rating. If it contains a slash (e.g., "1234/5"), use the number before the slash. If it is "Unrated" or "unr", omit the rating field.
    - **state**: Found in the fifth \`<td>\`. This is the two-letter state abbreviation.
    - **fullName**: Found in the sixth \`<td>\`. Extract the name text, which is typically in "LAST, FIRST" format.
5.  If the HTML contains the text "No players found", return an empty \`players\` array.
6.  Return the data as a JSON object matching the provided output schema. Do not include players that do not have a USCF ID.

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
