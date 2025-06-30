
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
    prompt: `You are an expert at parsing structured HTML tables.
The provided text is the HTML content of a USCF player search results page.
Your task is to extract the details for each player listed in the table.

Here are the rules for parsing:
1.  Find the main table containing the player data. It usually comes after a '<h3>Player Search Results</h3>'.
2.  Each player is in a '<tr>' (table row). Skip the header row.
3.  Extract the following information from the '<td>' (table cell) elements for each player:
    - USCF ID: This is the 8-digit number, typically in the first column.
    - Full Name: This is the player's name, usually in the second column.
    - Rating: This is the regular rating number. If it's 'UNR' (unrated) or '0', treat it as an undefined or null value for the number field.
    - State: The two-letter state abbreviation.
4.  If the text contains "No players found", return an empty array for 'players'.
5.  If you encounter any other issues, set the 'error' field in the output.

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
    if (state) {
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
      
      // Clean up names which might have extra whitespace
      output.players = output.players.map(player => ({
        ...player,
        fullName: player.fullName.trim()
      }));

      return output;

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        return { players: [], error: error.message };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
