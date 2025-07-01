
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
    
    // This new URL returns JSON, which is much more reliable than parsing HTML.
    const url = 'https://new.uschess.org/civicrm/player/search/results?reset=1&force=1';
    
    try {
      const searchParams = new URLSearchParams();
      searchParams.append('player_name', name);
      if (state && state !== 'ALL') {
          searchParams.append('state[]', state);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest', // Tells the server we want a data response (JSON)
        },
        body: searchParams.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF API. Status: ${response.status}` };
      }
      
      const data = await response.json();
      
      if (!data || !data.records) {
          return { players: [], error: "Received invalid data from the USCF API." };
      }

      const players: PlayerSearchResult[] = data.records.map((record: any) => {
        // Re-format name from "LAST, FIRST MIDDLE" to "FIRST MIDDLE LAST"
        const nameParts = record.sort_name.split(',').map((p: string) => p.trim());
        const reformattedName = nameParts.length >= 2
          ? `${nameParts[1]} ${nameParts[0]}`
          : record.sort_name;
        
        const rating = record.uscf_rating ? parseInt(record.uscf_rating, 10) : undefined;
        
        return {
          uscfId: record.uscf_id,
          fullName: reformattedName,
          rating: isNaN(rating) ? undefined : rating,
          state: state && state !== 'ALL' ? state : record.state_province_abbreviation, // Use input state or abbreviation if available
        };
      });
      
      return { players };

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        return { players: [], error: `An unexpected error occurred: ${error.message}` };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
