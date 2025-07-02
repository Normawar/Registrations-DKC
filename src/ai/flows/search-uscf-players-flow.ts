
'use server';
/**
 * @fileOverview Searches for USCF players by name from the USCF MSA website.
 *
 * - searchUscfPlayers - A function that handles the player search process.
 * - SearchUscfPlayersInput - The input type for the searchUscfPlayers function.
 * - SearchUscfPlayersOutput - The return type for the searchUscfPlayers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
      
      if (html.includes("No players found")) {
        return { players: [] };
      }

      const allHtmlRows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      const stripTags = (str: string) => str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      
      const players: PlayerSearchResult[] = [];

      for (const row of allHtmlRows) {
        // A player row is identifiable by the unique link pattern. This is the most reliable anchor.
        const idMatch = row.match(/MbrDtlMain\.php\?([^"&']+)/);
        if (!idMatch || !idMatch[1]) {
            continue; // This is not a player row (e.g., header, spacer), skip it.
        }
        const uscfId = idMatch[1];
        
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        if (cells.length === 0) continue;

        const player: Partial<PlayerSearchResult> = { uscfId };

        // Iterate over ALL cells to find data points by their distinct patterns.
        // This is safer than assuming column order.
        for (const cell of cells) {
            const text = stripTags(cell);

            // Check for Name from the cell containing the link
            if (cell.includes(`MbrDtlMain.php?${uscfId}`)) {
                const fullNameRaw = stripTags(cell);
                const nameParts = fullNameRaw.split(',');
                if (nameParts.length > 1) {
                    player.lastName = nameParts.shift()!.trim();
                    const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/).filter(Boolean);
                    player.firstName = firstAndMiddleParts.shift() || '';
                    player.middleName = firstAndMiddleParts.join(' ');
                } else {
                    player.lastName = fullNameRaw;
                }
            }
            
            // Check for a rating. A rating is a number, possibly with extra text (e.g., "/13", "(P6)").
            // It extracts the first number found in the cell's text.
            const ratingMatch = text.match(/(\d+)/);
            if (ratingMatch && ratingMatch[0] && player.rating === undefined) {
              // Heuristic to avoid confusing an ID with a rating. A cell with just a number that matches the ID is almost certainly the ID column.
              if (text !== uscfId) {
                player.rating = parseInt(ratingMatch[0], 10);
              }
            }

            // Check for State
            const stateMatch = text.match(/^[A-Z]{2}$/);
            if (stateMatch && player.state === undefined) {
                player.state = stateMatch[0];
            }
            
            // Check for Expiration Date
            const expiresMatch = text.match(/^\d{4}-\d{2}-\d{2}$/);
            if (expiresMatch && player.expirationDate === undefined) {
                player.expirationDate = expiresMatch[0];
            }
        }
        
        // Only add the player if we successfully parsed at least a last name.
        if (player.lastName) {
            players.push(player as PlayerSearchResult);
        }
      }

      if (players.length === 0 && !html.includes("No players found")) {
        console.error("USCF Search: Found a results page, but was unable to extract any player data. The website layout may have changed. Full response snippet:", html.substring(0, 3000));
        return { players: [], error: "Found a results page, but was unable to extract any player data. The website layout may have changed." };
      }
      
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
