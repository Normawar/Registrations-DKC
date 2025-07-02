
'use server';
/**
 * @fileOverview Searches for USCF players by name, extracts their IDs, and then looks up each player individually.
 *
 * - searchUscfPlayers - A function that handles the player search process.
 * - SearchUscfPlayersInput - The input type for the searchUscfPlayers function.
 * - SearchUscfPlayersOutput - The return type for the searchUscfPlayers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { lookupUscfPlayer } from './lookup-uscf-player-flow';

const SearchUscfPlayersInputSchema = z.object({
  firstName: z.string().optional().describe("The player's first name."),
  lastName: z.string().describe("The player's last name."),
  state: z.string().optional().describe("The player's two-letter state abbreviation. e.g., TX"),
});
export type SearchUscfPlayersInput = z.infer<typeof SearchUscfPlayersInputSchema>;

const PlayerSearchResultSchema = z.object({
  uscfId: z.string().describe("The player's USCF ID."),
  firstName: z.string().optional().describe("The player's first name."),
  middleName: z.string().optional().describe("The player's middle name or initial."),
  lastName: z.string().optional().describe("The player's last name."),
  rating: z.number().optional().describe("The player's regular USCF rating. Should be a number, not 'Unrated'."),
  state: z.string().optional().describe("The player's state abbreviation."),
  expirationDate: z.string().optional().describe("The player's USCF membership expiration date in YYYY-MM-DD format."),
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
  async ({ firstName, lastName, state }) => {
    if (!lastName) {
      return { players: [], error: 'Player last name cannot be empty.' };
    }
    
    const url = 'https://www.uschess.org/datapage/player-search.php';
    const params = new URLSearchParams();
    params.append('p_last_name', lastName);
    if (firstName) {
        params.append('p_first_name', firstName);
    }
    if (state && state !== 'ALL') {
        params.append('p_state', state);
    }
    params.append('psubmit', 'Search');

    try {
      // Step 1: Fetch the search results page.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Origin': 'https://www.uschess.org',
            'Referer': 'https://www.uschess.org/datapage/player-search.php'
        },
        body: params.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      if (html.toLowerCase().includes("no players found")) {
        return { players: [] };
      }
      
      // Step 2: Extract all possible USCF IDs from the returned page.
      const ids = new Set<string>();

      // Strategy 1: Find all IDs from multi-result links (e.g., MbrDtlMain.php?12345678)
      const multiResultMatches = html.matchAll(/MbrDtlMain\.php\?(\d{8})/gi);
      for (const match of multiResultMatches) {
        if (match[1]) ids.add(match[1]);
      }
      
      // Strategy 2: If no list was found, it might be a single player page.
      if (ids.size === 0) {
        // Try to find an ID from a MbrDtlMain.php title format
        const singleResultMatch = html.match(/<b>(\d{8}):\s*.*?<\/b>/i);
        if (singleResultMatch && singleResultMatch[1]) {
            ids.add(singleResultMatch[1]);
        }
        // Also check if it's a thin3.php page redirect
        else if (html.includes("<h2>USCF Member Lookup</h2>")) {
            const idMatch = html.match(/name=memid[^>]*value='(\d{8})'/i);
            if (idMatch && idMatch[1]) {
                ids.add(idMatch[1]);
            }
        }
      }

      if (ids.size === 0) {
        return { players: [], error: "Found a results page, but was unable to extract any player IDs. The website layout may have changed." };
      }

      // Step 3: Look up each unique ID using the dedicated lookup flow.
      const playerLookupPromises = Array.from(ids).map(uscfId => lookupUscfPlayer({ uscfId }));
      const lookupResults = await Promise.all(playerLookupPromises);
      
      const players: PlayerSearchResult[] = lookupResults
        .filter(p => !p.error && p.uscfId) // Filter out any failed lookups
        .map(p => ({
            uscfId: p.uscfId!,
            firstName: p.firstName,
            middleName: p.middleName,
            lastName: p.lastName,
            rating: p.rating,
            state: p.state,
            expirationDate: p.expirationDate,
        }));
      
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
