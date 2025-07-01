
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
    
    // Using the simpler, more reliable text-based search page.
    const url = 'https://www.uschess.org/msa/MbrLst.php';
    const searchParams = new URLSearchParams({
        LAST: lastName,
        FIRST: firstName || '',
        ST: state === 'ALL' ? '' : state || '',
        RATING: 'R', // Regular rating
        EXPIRES: 'E', // Expiration date
        PHOTOS: 'N', // No photos
        MEMTYPE: 'M', // All member types
        ORDER: 'N' // Order by name
    });
    
    const searchUrl = `${url}?${searchParams.toString()}`;

    try {
      const response = await fetch(searchUrl, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      if (html.includes("Your search returned more than 250 names.")) {
        return { players: [], error: "Your search is too broad and returned more than 250 names. Please be more specific." };
      }
      if (html.includes("No players that match your search criteria were found.")) {
        return { players: [] };
      }
      
      const preMatch = html.match(/<pre>([\s\S]*?)<\/pre>/i);
      if (!preMatch || !preMatch[1]) {
        console.error("USCF Search Response (No <pre> tag found):", html.substring(0, 500));
        return { players: [], error: "Could not find player data block in the search results. The USCF website may have changed its format." };
      }
      
      const text = preMatch[1];
      const lines = text.split('\n');
      const players: PlayerSearchResult[] = [];

      const dataStartIndex = lines.findIndex(line => line.startsWith('-----------------'));
      if (dataStartIndex === -1) {
          console.error("USCF Search Response (Could not find data separator '---'):", html.substring(0, 1000));
          return { players: [], error: "Failed to parse player data from the USCF website. The format may have changed."};
      }
      
      for (let i = dataStartIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length === 0 || line.length < 90) continue;

        try {
          const uscfId = line.substring(3, 11).trim();
          if (!uscfId || !/^\d+$/.test(uscfId)) continue;
          
          const fullNameRaw = line.substring(92).trim();
          const stateAbbr = line.substring(25, 27).trim();
          const ratingStr = line.substring(29, 38).trim().split('/')[0].trim();
          const expDateStr = line.substring(14, 24).trim();

          let fullName = fullNameRaw;
          if (fullNameRaw.includes(',')) {
              const nameParts = fullNameRaw.split(',').map(p => p.trim());
              const lastNamePart = nameParts[0];
              const firstNameAndMiddle = nameParts.slice(1).join(' ');
              fullName = `${firstNameAndMiddle} ${lastNamePart}`.trim();
          }

          const rating = parseInt(ratingStr, 10);

          players.push({
              uscfId,
              fullName,
              state: stateAbbr,
              rating: !isNaN(rating) ? rating : undefined,
              expirationDate: /^\d{4}-\d{2}-\d{2}$/.test(expDateStr) ? expDateStr : undefined,
          });
        } catch (parseError) {
          console.error(`Failed to parse line: "${line}"`, parseError);
          continue;
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
