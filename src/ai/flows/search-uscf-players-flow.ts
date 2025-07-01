
'use server';
/**
 * @fileOverview Searches for USCF players by name from the USCF website.
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
    
    // Use the secure HTTPS endpoint for searching.
    const baseUrl = 'https://www.uschess.org/datapage/player-search.php';
    
    const searchParams = new URLSearchParams({
        name: lastName,
        f_name: firstName || '', // Pass first name to make search more specific
        state: state === 'ALL' ? '' : state || '',
        rating_op: '>', // Operator for rating
        rating: '0',     // Rating value, > 0 to get all players
        gender: 'B',     // Both genders
        rating_type: 'R',// Regular rating
        rep: 'N',        // Representative type? 'N' for none
        sort: 'N'        // Sort by Name
    });
    
    const searchUrl = `${baseUrl}?${searchParams.toString()}`;

    try {
      const response = await fetch(searchUrl, {
        cache: 'no-store',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        },
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      if (html.includes("more than 100 members that match")) {
        return { players: [], error: "Your search is too broad and returned more than 100 players. Please be more specific by adding a first name or state." };
      }
      if (html.includes("no members that match")) {
        return { players: [] };
      }
      
      // A more robust regex that looks for the content of the table header ("ID Number"), not a specific class name.
      const tableMatch = html.match(/<table[^>]*>([\s\S]*?ID Number[\s\S]*?)<\/table>/i);
      if (!tableMatch || !tableMatch[1]) {
          console.error("USCF Search Response (No results table found):", html.substring(0, 1000));
          return { players: [], error: "Could not find the results table in the response. The USCF website may have changed its format."};
      }
      
      const tableHtml = tableMatch[1];
      const rowMatches = [...tableHtml.matchAll(/<tr.*?>([\s\S]*?)<\/tr>/gi)];
      
      if (rowMatches.length < 2) { // Should be at least a header row and one data row
          return { players: [] };
      }
      
      let allPlayers: PlayerSearchResult[] = [];

      // Skip header row (index 0)
      for (let i = 1; i < rowMatches.length; i++) {
        const rowHtml = rowMatches[i][1];
        const cellMatches = [...rowHtml.matchAll(/<td.*?>([\s\S]*?)<\/td>/gi)];
        
        if (cellMatches.length < 4) continue; // Expect at least 4 columns

        try {
            const idAndNameHtml = cellMatches[0][1];
            // The link may be in MbrDtlMain.php or thin3.php, be more flexible
            const linkMatch = idAndNameHtml.match(/<a href="[^"]*?(\d{8})">([\s\S]*?)<\/a>/i);
            if (!linkMatch) continue;
            
            const uscfId = linkMatch[1].trim();
            const rawName = linkMatch[2].replace(/<.*?>/g, '').trim();
            
            let fullName = rawName;
            if (rawName.includes(',')) {
                const nameParts = rawName.split(',').map(p => p.trim());
                const lastNamePart = nameParts[0];
                const firstNameAndMiddle = nameParts.slice(1).join(' ');
                fullName = `${firstNameAndMiddle} ${lastNamePart}`.trim();
            }

            const ratingStr = cellMatches[1][1].trim();
            const rating = parseInt(ratingStr, 10);

            const expDateStr = cellMatches[2][1].trim();
            let expirationDate: string | undefined;
            if (expDateStr && expDateStr !== '9999-12-31') {
                const dateParts = expDateStr.split('/');
                if (dateParts.length === 3) {
                    expirationDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
                }
            }
            
            const stateAbbr = cellMatches[3][1].trim();
            
            allPlayers.push({
                uscfId,
                fullName,
                state: stateAbbr,
                rating: !isNaN(rating) ? rating : undefined,
                expirationDate,
            });

        } catch (parseError) {
          console.error(`Failed to parse row: "${rowHtml}"`, parseError);
          continue;
        }
      }
      
      return { players: allPlayers };

    } catch (error) {
      console.error("Error in searchUscfPlayersFlow:", error);
      if (error instanceof Error) {
        return { players: [], error: `An unexpected error occurred: ${error.message}` };
      }
      return { players: [], error: 'An unexpected error occurred during the search.' };
    }
  }
);
