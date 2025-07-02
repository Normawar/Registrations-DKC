
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

      const allTables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
      const resultsTableHtml = allTables.find(table => table.includes('MbrDtlMain.php'));

      if (!resultsTableHtml) {
          console.error("USCF Search: Could not find the main results table container. The website layout may have changed.");
          return { players: [], error: "Could not find the main results table container. The website layout may have changed." };
      }
      
      const allHtmlRows = resultsTableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      const stripTags = (str: string) => str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      
      const players: PlayerSearchResult[] = [];
      let headerMap: Record<string, number> | null = null;
      
      for (const row of allHtmlRows) {
        // Use more specific, case-sensitive text to identify the exact header row
        if (row.includes('>USCF ID<') && row.includes('>Rating<') && row.includes('>Name<')) {
            headerMap = {};
            const headerCells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
            headerCells.forEach((cell, index) => {
                const cleanHeader = stripTags(cell).toLowerCase();
                if (cleanHeader.includes('uscf id')) headerMap!['uscfid_col'] = index;
                if (cleanHeader === 'rating') headerMap!['rating'] = index;
                if (cleanHeader === 'state') headerMap!['state'] = index;
                if (cleanHeader.includes('exp date')) headerMap!['expirationdate'] = index;
                if (cleanHeader === 'name') headerMap!['name'] = index;
            });
            break; 
        }
      }

      if (!headerMap) {
        console.error("USCF Search: Could not find the results table header. The website layout may have changed. Full response snippet:", resultsTableHtml.substring(0, 2000));
        return { players: [], error: "Could not find the results table header. The website layout may have changed." };
      }
      
      for (const row of allHtmlRows) {
        const idMatch = row.match(/MbrDtlMain\.php\?(\d+)/);
        if (!idMatch) {
            continue; // Skip header and footer rows
        }

        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        if (cells.length < Object.keys(headerMap).length) continue;

        const player: Partial<PlayerSearchResult> = {};
        
        if (headerMap.name !== undefined && cells[headerMap.name]) {
            const nameCell = cells[headerMap.name];
            const linkMatch = nameCell.match(/<a href=["'][^"']+?\?(\d+)["']>([\s\S]+?)<\/a>/);
            if (linkMatch && linkMatch[1] && linkMatch[2]) {
                player.uscfId = linkMatch[1];
                const fullNameRaw = stripTags(linkMatch[2]); // Format: LAST, FIRST MIDDLE
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
        }
        
        if (!player.uscfId && headerMap.uscfid_col !== undefined && cells[headerMap.uscfid_col]) {
            player.uscfId = stripTags(cells[headerMap.uscfid_col]);
        }
        
        if (!player.uscfId) {
            continue;
        }

        if (headerMap.rating !== undefined && cells[headerMap.rating]) {
            const ratingText = stripTags(cells[headerMap.rating]);
            if (ratingText.toLowerCase() !== 'unrated') {
                const numericPartMatch = ratingText.match(/(\d+)/);
                if (numericPartMatch && numericPartMatch[1]) {
                    player.rating = parseInt(numericPartMatch[1], 10);
                }
            }
        }

        if (headerMap.state !== undefined && cells[headerMap.state]) {
            player.state = stripTags(cells[headerMap.state]);
        }
        
        if (headerMap.expirationdate !== undefined && cells[headerMap.expirationdate]) {
            const dateText = stripTags(cells[headerMap.expirationdate]);
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
                player.expirationDate = dateText;
            }
        }
        
        if (player.uscfId && player.lastName) {
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
