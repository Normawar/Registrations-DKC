
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
    
    // Use the www.uschess.org endpoint which is more stable than the msa subdomain.
    const baseUrl = 'https://www.uschess.org/msa/MbrLst.php';
    
    const searchParams = new URLSearchParams({
        // LNM (Last Name Match), FNM (First Name Match), ST (State)
        LNM: lastName,
        FNM: firstName || '',
        ST: state === 'ALL' ? '' : state || '',
    });
    
    const url = `${baseUrl}?${searchParams.toString()}`;

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
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
      
      // Make header check more robust to spacing changes
      const headerIndex = lines.findIndex(line => line.includes("ID") && line.includes("Name") && line.includes("St"));
      if (headerIndex === -1) {
          return { players: [], error: "Could not find player data block in the response. The USCF website may have changed its format." };
      }

      // Data starts 2 lines after the header
      for (let i = headerIndex + 2; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length < 10) continue; // Skip empty or short lines

        try {
            // More robust parsing logic that does not depend on fixed-width columns.
            const uscfId = line.substring(0, 8).trim();
            if (!/^\d{8}$/.test(uscfId)) continue;
    
            let restOfLine = line.substring(8).trim();
            
            let rating: number | undefined;
            const ratingMatch = restOfLine.match(/(\d{3,4})$/);
            if (ratingMatch) {
                rating = parseInt(ratingMatch[1], 10);
                restOfLine = restOfLine.substring(0, restOfLine.length - ratingMatch[1].length).trim();
            }
    
            let expirationDate: string | undefined;
            const dateMatch = restOfLine.match(/(\d{4}-\d{2}-\d{2})$/);
            if (dateMatch) {
                expirationDate = dateMatch[1];
                restOfLine = restOfLine.substring(0, restOfLine.length - dateMatch[1].length).trim();
            }
    
            let stateAbbr: string | undefined;
            const stateMatch = restOfLine.match(/([A-Z]{2})$/);
            if (stateMatch) {
                stateAbbr = stateMatch[1];
                restOfLine = restOfLine.substring(0, restOfLine.length - stateMatch[1].length).trim();
            }
    
            let fullName = restOfLine;
            const nameParts = fullName.split(',');
            if (nameParts.length > 1) {
                const lastNamePart = nameParts.shift()!.trim();
                const firstNameAndMiddle = nameParts.join(',').trim();
                fullName = `${firstNameAndMiddle} ${lastNamePart}`.trim();
            }
            
            players.push({
                uscfId,
                fullName,
                state: stateAbbr,
                rating: !isNaN(rating as number) ? rating : undefined,
                expirationDate,
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
