
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
import { parseThin3Page } from '@/lib/actions/uscf-parser';

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
  quickRating: z.string().optional().describe("The player's quick rating string.")
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
      
      // If we found IDs from a list, look them up and return.
      if (ids.size > 0) {
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
              quickRating: p.quickRating,
          }));
        
        return { players };
      }

      // If no list was found, it might be a single player page (MbrDtlMain.php or thin3.php).
      // We can parse the data directly from this page.
      const idMatch = html.match(/<b>(\d{8}):\s*.*?<\/b>/i);
      const uscfId = idMatch ? idMatch[1] : null;

      if (uscfId) {
        // This is a MbrDtlMain.php page, let's try to parse it directly.
        const parsedData = await parseThin3Page(html, uscfId);
        if (parsedData.error) {
            // Fallback to just doing a lookup if parsing fails.
             const lookupResult = await lookupUscfPlayer({ uscfId });
             if (lookupResult.error) {
                 return { players: [], error: lookupResult.error };
             }
             return { players: [lookupResult as PlayerSearchResult] };
        }
        return { players: [parsedData as PlayerSearchResult] };
      }

      // Final check: if we're on a thin3.php page directly
      if (html.includes("<h2>USCF Member Lookup</h2>")) {
          const idFromInput = html.match(/name=memid[^>]*value='(\d{8})'/i);
          if (idFromInput && idFromInput[1]) {
             const parsedData = await parseThin3Page(html, idFromInput[1]);
              if (parsedData.error) {
                  return { players: [], error: parsedData.error };
              }
              return { players: [parsedData as PlayerSearchResult] };
          }
      }

      // If we still haven't found anything, then the layout has likely changed.
      return { players: [], error: "Found a results page, but was unable to extract any player data. The website layout may have changed." };

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        return { players: [], error: `An unexpected error occurred: ${error.message}` };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
