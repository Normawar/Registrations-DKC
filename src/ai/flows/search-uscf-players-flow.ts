
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
      const players: PlayerSearchResult[] = [];
      const stripTags = (str: string) => str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

      // Find the index of the header row using case-insensitive checks.
      const headerRowIndex = allHtmlRows.findIndex(row => {
          const lowerCaseRow = row.toLowerCase();
          return lowerCaseRow.includes("<td>uscf id</td>") &&
                 lowerCaseRow.includes("<td>rating</td>") &&
                 lowerCaseRow.includes("<td>name</td>");
      });

      if (headerRowIndex === -1) {
          console.error("USCF Search: Could not find the results table header. The website layout may have changed. Full response snippet:", html.substring(0, 3000));
          return { players: [], error: "Could not find the results table header. The website layout may have changed." };
      }

      // The player rows are all the rows after the header.
      const playerRows = allHtmlRows.slice(headerRowIndex + 1);

      for (const row of playerRows) {
        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
        
        // A valid player row has 10 columns according to the provided HTML.
        if (cells.length < 10) {
            continue; 
        }

        const player: Partial<PlayerSearchResult> = {};

        // Extract Name and USCF ID from the link in column 9.
        const nameCellContent = cells[9];
        const linkMatch = nameCellContent.match(/<a href=["']?https?:\/\/www\.uschess\.org\/msa\/MbrDtlMain\.php\?(\d+)["']?\s*>/i);
        
        if (linkMatch) {
            player.uscfId = linkMatch[1];
            const fullNameRaw = stripTags(nameCellContent); // e.g., "CASTILLO, COSME"
            const nameParts = fullNameRaw.split(',');
            if (nameParts.length > 1) {
                player.lastName = nameParts.shift()!.trim();
                const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/).filter(Boolean);
                player.firstName = firstAndMiddleParts.shift() || '';
                player.middleName = firstAndMiddleParts.join(' ');
            } else {
                player.lastName = fullNameRaw;
            }
        } else {
            // If there's no valid link, it's not a player row.
            continue;
        }

        // Extract Rating from column 1.
        const ratingText = stripTags(cells[1]);
        if (ratingText && ratingText.toLowerCase() !== 'unrated') {
            const numericPartMatch = ratingText.match(/(\d+)/); // Extracts the first number, handles "145/13"
            if (numericPartMatch && numericPartMatch[1]) {
                player.rating = parseInt(numericPartMatch[1], 10);
            }
        }

        // Extract State from column 7.
        const stateText = stripTags(cells[7]);
        if (stateText && /^[A-Z]{2}$/.test(stateText)) {
            player.state = stateText;
        }
        
        // Extract Expiration Date from column 8.
        const dateText = stripTags(cells[8]);
        if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
            player.expirationDate = dateText;
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

    