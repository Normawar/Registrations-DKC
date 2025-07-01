
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

      // Instead of parsing a specific table, find all table rows and check them individually.
      // This is more resilient to table structure changes (e.g., missing <thead> or <tbody>).
      const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      const players: PlayerSearchResult[] = [];

      for (const row of rows) {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];

        // A valid player row should have an ID in the first cell and at least 5 columns.
        if (cells.length < 5) {
          continue;
        }

        const idCellContent = cells[0];
        const uscfIdMatch = idCellContent.match(/>(\d{8})</);
        if (!uscfIdMatch) {
          continue; // Not a valid player row if there's no 8-digit ID in the first cell.
        }
        
        const uscfId = uscfIdMatch[1];
        
        // Use a function to strip HTML tags for safety.
        const stripTags = (str: string) => str.replace(/<[^>]+>/g, '').trim();

        const fullNameRaw = stripTags(cells[1]);
        const expirationDate = stripTags(cells[2]);
        const stateAbbr = stripTags(cells[3]);
        const ratingStr = stripTags(cells[4]);
        
        let parsedFirstName, parsedMiddleName, parsedLastName;
        const nameParts = fullNameRaw.split(',');
        if (nameParts.length > 1) {
            parsedLastName = nameParts.shift()!.trim();
            const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/);
            parsedFirstName = firstAndMiddleParts.shift() || '';
            parsedMiddleName = firstAndMiddleParts.join(' ');
        } else {
            parsedLastName = fullNameRaw;
        }
        
        const rating = ratingStr && !isNaN(parseInt(ratingStr)) ? parseInt(ratingStr, 10) : undefined;
        
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
        console.error("USCF Search: Found no players, but did not see 'No players found' message. HTML might have changed.");
        return { players: [], error: "Could not find the player data table in the response. The website layout may have changed." };
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
