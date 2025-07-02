
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
      
      // Step 2: Try to find multiple player IDs first
      const ids = new Set<string>();
      const multiResultMatches = html.matchAll(/MbrDtlMain\.php\?(\d+)/gi);
      for (const match of multiResultMatches) {
        if (match[1]) {
          ids.add(match[1]);
        }
      }

      // If we found multiple players, look them all up.
      if (ids.size > 0) {
        const playerLookupPromises = Array.from(ids).map(uscfId => lookupUscfPlayer({ uscfId }));
        const lookupResults = await Promise.all(playerLookupPromises);
        
        const players: PlayerSearchResult[] = lookupResults
          .filter(p => !p.error && p.uscfId)
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
      }
      
      // Step 3: If no multiple players found, it must be a single player page.
      
      // A) Check for the simple `thin3.php` redirect format first.
      if (html.includes("<h2>USCF Member Lookup</h2>")) {
          const playerData = await parseThin3Page(html, '');
          if (playerData.error) {
              return { players: [], error: playerData.error };
          }
          return { players: [playerData] };
      }
      
      // B) If not, it's probably the full `MbrDtlMain.php` page. Parse it directly.
      const player: Partial<PlayerSearchResult> = {};

      const nameMatch = html.match(/<b>(\d{8}):\s*([\s\S]*?)<\/b>/i);
      if (nameMatch && nameMatch[1] && nameMatch[2]) {
          player.uscfId = nameMatch[1];
          const nameParts = nameMatch[2].trim().split(/\s+/);
          player.lastName = nameParts.pop() || '';
          player.firstName = nameParts.shift() || '';
          if (nameParts.length > 0) {
              player.middleName = nameParts.join(' ');
          }
      } else {
          // If we can't even get the ID and name, we can't proceed.
          console.error("USCF Search: Could not parse ID and Name from single result page.");
          return { players: [], error: "Found a results page, but was unable to extract any player data. The website layout may have changed." };
      }

      const ratingMatch = html.match(/Regular Rating[\s\S]*?<b><nobr>(\d+)/i);
      if (ratingMatch && ratingMatch[1]) {
          player.rating = parseInt(ratingMatch[1], 10);
      }

      const stateMatch = html.match(/State[\s\S]*?<b>\s*(\w+)\s*<\/b>/i);
      if (stateMatch && stateMatch[1]) {
          player.state = stateMatch[1].trim();
      }

      const expMatch = html.match(/Expiration Dt\.[\s\S]*?<b>(.*?)<\/b>/i);
      if (expMatch && expMatch[1]) {
          player.expirationDate = expMatch[1].trim();
      }

      return { players: [player as PlayerSearchResult] };

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        return { players: [], error: `An unexpected error occurred: ${error.message}` };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);

    