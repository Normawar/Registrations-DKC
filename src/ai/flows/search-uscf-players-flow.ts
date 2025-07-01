
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
  uscfId: z.string().describe("The player's 8-digit USCF ID."),
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

      const players: PlayerSearchResult[] = [];
      const allHtmlRows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

      // Find the header row to know where data starts
      const headerRowIndex = allHtmlRows.findIndex(row => row.includes("USCF ID</td>") && row.includes("Name</td>"));
      if (headerRowIndex === -1) {
        console.error("USCF Search: Could not find the header row in the results table.");
        return { players: [], error: "Could not find the header row in the results table. The website layout may have changed." };
      }
      
      // Start processing rows after the header
      for (let i = headerRowIndex + 1; i < allHtmlRows.length; i++) {
        const row = allHtmlRows[i];

        // Stop if we hit the footer row which contains form inputs
        if (row.includes("Search Again") || row.includes("<input")) break;
        
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
        
        // Player rows should have at least 10 cells. The name cell is the 10th (index 9).
        if (cells.length < 10) {
            continue;
        }

        const nameCellContent = cells[9];
        // Ensure it's a player link row before proceeding
        if (!nameCellContent || !nameCellContent.includes('MbrDtlMain.php')) {
            continue;
        }

        const stripTags = (str: string) => str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        
        const idMatch = nameCellContent.match(/MbrDtlMain.php\?(\d{8})/);
        
        if (!idMatch || !idMatch[1]) {
            continue; 
        }
        const uscfId = idMatch[1];
        
        const ratingStr = stripTags(cells[1]);
        const stateAbbr = stripTags(cells[7]);
        const expirationDateRaw = stripTags(cells[8]);
        const fullNameRaw = stripTags(nameCellContent);
        
        let parsedFirstName, parsedMiddleName, parsedLastName;
        const nameParts = fullNameRaw.split(','); // Format: LAST, FIRST MIDDLE
        if (nameParts.length > 1) {
            parsedLastName = nameParts.shift()!.trim();
            const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/).filter(Boolean);
            parsedFirstName = firstAndMiddleParts.shift() || '';
            parsedMiddleName = firstAndMiddleParts.join(' ');
        } else {
            parsedLastName = fullNameRaw;
        }
        
        const rating = ratingStr && !isNaN(parseInt(ratingStr, 10)) ? parseInt(ratingStr, 10) : undefined;
        
        const expiresMatch = expirationDateRaw?.match(/(\d{4}-\d{2}-\d{2})/);
        const expirationDate = expiresMatch ? expiresMatch[1] : undefined;

        players.push({
            uscfId,
            firstName: parsedFirstName,
            lastName: parsedLastName,
            middleName: parsedMiddleName,
            state: stateAbbr,
            rating,
            expirationDate,
        });
      }

      if (players.length === 0 && !html.includes("No players found")) {
        console.error("USCF Search: Found no players, but did not see 'No players found' message. Parsing likely failed.");
        return { players: [], error: "Found a results table, but was unable to extract any player data. The website layout may have changed." };
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
