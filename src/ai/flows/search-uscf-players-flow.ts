
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
    
    const baseUrl = 'http://msa.uschess.org/MbrLst.php';
    
    const searchParams = new URLSearchParams({
        // FNM (First Name), FLNM (Last Name), ST (State)
        FLNM: lastName,
        FNM: firstName || '',
        ST: state === 'ALL' ? '' : state || '',
    });
    
    const url = `${baseUrl}?${searchParams.toString()}`;

    try {
      const response = await fetch(url, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const text = await response.text();
      
      if (text.includes("no members that match this criteria")) {
        return { players: [] };
      }

      if (text.includes("more than 100 members that match")) {
        return { players: [], error: "Your search is too broad and returned more than 100 players. Please be more specific by adding a first name or state." };
      }

      const lines = text.split('\n');
      const players: PlayerSearchResult[] = [];
      
      const headerIndex = lines.findIndex(line => line.includes("ID   | Name"));
      if (headerIndex === -1) {
          return { players: [], error: "Could not find player data block in the response. The USCF website may have changed its format." };
      }

      // Data starts 2 lines after the header
      for (let i = headerIndex + 2; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length < 10) continue; // Skip empty or short lines

        try {
            const uscfId = line.substring(1, 9).trim();
            if (!/^\d{8}$/.test(uscfId)) continue;

            const rawName = line.substring(12, 46).trim();
            const stateAbbr = line.substring(48, 51).trim();
            const expDateStr = line.substring(53, 63).trim();
            const ratingStr = line.substring(65).trim();

            let fullName = rawName;
            const nameParts = rawName.split(',');
            if (nameParts.length > 1) {
                const lastNamePart = nameParts.shift()!.trim();
                const firstNameAndMiddle = nameParts.join(',').trim();
                fullName = `${firstNameAndMiddle} ${lastNamePart}`.trim();
            }

            const rating = parseInt(ratingStr, 10);
            
            players.push({
                uscfId,
                fullName,
                state: stateAbbr,
                rating: !isNaN(rating) ? rating : undefined,
                expirationDate: expDateStr || undefined,
            });

        } catch (parseError) {
            console.error(`Failed to parse player line: "${line}"`, parseError);
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
