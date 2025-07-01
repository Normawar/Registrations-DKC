
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
    
    // Use the simpler, more stable text-based endpoint.
    const baseUrl = 'https://www.uschess.org/msa/thin.php';
    const params = new URLSearchParams();
    params.append('LNM', lastName);
    if (firstName) params.append('FNM', firstName);
    if (state && state !== 'ALL') params.append('ST', state);
    
    const url = `${baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const text = await response.text();
      
      if (text.includes("0 members found")) {
        return { players: [] };
      }

      const preContentMatch = text.match(/<pre>([\s\S]*?)<\/pre>/i);
      if (!preContentMatch || !preContentMatch[1]) {
        return { players: [], error: "Could not find player data block in the response from USCF." };
      }

      const lines = preContentMatch[1].trim().split('\n');
      const players: PlayerSearchResult[] = [];

      // Regex to parse a line like: "12345678  LAST, FIRST M            Reg: 1234 Exp:2025-12-31 TX"
      const playerRegex = /(\d{8})\s+(.*?)\s+Reg:\s*(\d+|Unrated)\s+Exp:(\d{4}-\d{2}-\d{2})\s+([A-Z]{2})/;
      
      for (const line of lines) {
        const match = line.match(playerRegex);
        if (match) {
            const [, uscfId, fullNameRaw, ratingStr, expirationDate, stateAbbr] = match;

            const nameParts = fullNameRaw.trim().split(',');
            let parsedFirstName, parsedMiddleName, parsedLastName;

            if (nameParts.length > 1) {
                parsedLastName = nameParts.shift()!.trim();
                const firstAndMiddleParts = nameParts.join(',').trim().split(/\s+/);
                parsedFirstName = firstAndMiddleParts.shift() || '';
                parsedMiddleName = firstAndMiddleParts.join(' ');
            } else {
                parsedLastName = fullNameRaw.trim();
            }

            const rating = ratingStr.trim().toLowerCase() === 'unrated' ? undefined : parseInt(ratingStr.trim(), 10);
            
            players.push({
                uscfId,
                firstName: parsedFirstName,
                lastName: parsedLastName,
                middleName: parsedMiddleName,
                state: stateAbbr,
                rating: !isNaN(rating as number) ? rating : undefined,
                expirationDate,
            });
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
