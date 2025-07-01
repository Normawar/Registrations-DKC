
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
  fullName: z.string().describe("The player's full name in FIRST LAST format."),
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
    
    // Use the modern player search endpoint which is more stable.
    const url = 'https://www.uschess.org/msa/player-search.php';
    const fullName = `${firstName || ''} ${lastName}`.trim();

    const body = new URLSearchParams({
        name: fullName,
        state: state === 'ALL' ? '' : state || '',
        rating_op: 'ge', // Greater than or equal to
        rating: '', // No rating filter
        fide_op: 'ge',
        fide_rating: '',
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Origin': 'https://www.uschess.org',
            'Referer': 'https://www.uschess.org/msa/player-search.php',
        },
        body: body.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const text = await response.text();
      
      if (text.includes("No players that match your criteria were found")) {
        return { players: [] };
      }
      
      // Instead of finding a specific table, find all table rows and parse them.
      // A valid player row is identified by having an 8-digit USCF ID in the first cell.
      const rowMatches = [...text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      const players: PlayerSearchResult[] = [];

      if (rowMatches.length === 0) {
          console.error("USCF Search response did not contain any table rows. Full response:", text.substring(0, 2000));
          return { players: [], error: "Could not find any player data in the response. The USCF website format may have changed." };
      }
      
      for (const rowMatch of rowMatches) {
        const rowContent = rowMatch[1];
        const cellMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        
        if (cellMatches.length < 6) continue; // Skip header rows or malformed rows

        try {
            const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '').trim();

            const uscfId = stripHtml(cellMatches[0][1]);
            
            // Heuristic to identify a player row: the first cell must be an 8-digit ID.
            if (!/^\d{8}$/.test(uscfId)) continue; 

            let fullNameRaw = stripHtml(cellMatches[1][1]); // Format: LAST, FIRST MIDDLE
            const ratingStr = stripHtml(cellMatches[2][1]);
            const stateAbbr = stripHtml(cellMatches[3][1]);
            const expirationDateStr = stripHtml(cellMatches[5][1]); // Format: YYYY-MM-DD
            
            let fullName = fullNameRaw;
            const nameParts = fullNameRaw.split(',');
            if (nameParts.length > 1) {
                const lastNamePart = nameParts.shift()!.trim();
                const firstNameAndMiddle = nameParts.join(',').trim();
                fullName = `${firstNameAndMiddle} ${lastNamePart}`.trim();
            }

            const rating = ratingStr ? parseInt(ratingStr, 10) : undefined;
            const expirationDate = /^\d{4}-\d{2}-\d{2}$/.test(expirationDateStr) ? expirationDateStr : undefined;
            
            players.push({
                uscfId,
                fullName,
                state: stateAbbr,
                rating: !isNaN(rating as number) ? rating : undefined,
                expirationDate,
            });

        } catch (parseError) {
            console.error(`Failed to parse a potential player row: "${rowContent}"`, parseError);
            continue; // Move to the next row
        }
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
