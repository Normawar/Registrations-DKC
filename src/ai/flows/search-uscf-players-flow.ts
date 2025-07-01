
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
      const stripTags = (str: string) => str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      
      // Find the header row to dynamically map column names to indices
      const headerRowIndex = allHtmlRows.findIndex(row =>
        row.includes('Rating') && row.includes('State') && row.includes('Expires') && row.includes('Name')
      );

      if (headerRowIndex === -1) {
          console.error("USCF Search: Could not find header row. Full response snippet:", html.substring(0, 3000));
          return { players: [], error: "Could not find the results table header. The website layout may have changed." };
      }

      const headerCells = allHtmlRows[headerRowIndex].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const columnIndexMap: { [key: string]: number } = {};
      
      headerCells.forEach((cell, index) => {
          const headerText = stripTags(cell);
          if (headerText.includes('Rating')) columnIndexMap['rating'] = index;
          if (headerText.includes('State')) columnIndexMap['state'] = index;
          if (headerText.includes('Expires')) columnIndexMap['expires'] = index;
          if (headerText.includes('Name') && headerText.includes('ID')) columnIndexMap['name'] = index;
      });

      // Process player rows which come after the header
      for (let i = headerRowIndex + 1; i < allHtmlRows.length; i++) {
        const row = allHtmlRows[i];

        if (row.includes('</table')) {
            break;
        }

        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
        if (cells.length === 0) {
            continue;
        }
        
        const nameCellContent = cells[columnIndexMap['name']];
        if (!nameCellContent || !nameCellContent.includes('MbrDtlMain.php?')) {
            continue; // Not a player row
        }
        
        const idMatch = nameCellContent.match(/MbrDtlMain.php\?(\d{8})/);
        if (!idMatch || !idMatch[1]) {
            console.warn("USCF Search: Found a player row but could not extract USCF ID from it. Skipping.", nameCellContent);
            continue; 
        }
        const uscfId = idMatch[1];
        
        const ratingStr = columnIndexMap['rating'] !== undefined && cells[columnIndexMap['rating']] ? stripTags(cells[columnIndexMap['rating']]) : '';
        const stateAbbr = columnIndexMap['state'] !== undefined && cells[columnIndexMap['state']] ? stripTags(cells[columnIndexMap['state']]) : '';
        const expirationDateRaw = columnIndexMap['expires'] !== undefined && cells[columnIndexMap['expires']] ? stripTags(cells[columnIndexMap['expires']]) : '';
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
            console.warn("USCF Search: Could not parse full name into parts from:", fullNameRaw);
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
        console.error("USCF Search: Found no players, but did not see 'No players found' message. Parsing likely failed. Full response snippet:", html.substring(0, 3000));
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
