
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
  name: z.string().describe('The name of the player to search for.'),
  state: z.string().optional().describe("The player's two-letter state abbreviation. e.g., TX"),
});
export type SearchUscfPlayersInput = z.infer<typeof SearchUscfPlayersInputSchema>;

const PlayerSearchResultSchema = z.object({
  uscfId: z.string().describe("The player's 8-digit USCF ID."),
  fullName: z.string().describe("The player's full name in LAST, FIRST format."),
  rating: z.number().optional().describe("The player's regular USCF rating. Should be a number, not 'Unrated'."),
  state: z.string().optional().describe("The player's state abbreviation."),
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
  async ({ name, state }) => {
    if (!name) {
      return { players: [], error: 'Player name cannot be empty.' };
    }
    
    const nameParts = name.trim().split(/\s+/);
    const lastName = nameParts.pop() || '';
    const firstName = nameParts.join(' ');

    const url = 'http://www.uschess.org/msa/MbrLst.php';
    const searchParams = new URLSearchParams({
        Last: lastName,
        First: firstName,
        State: state === 'ALL' ? '' : state || '',
        Action: 'Search',
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: searchParams.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      if (html.includes("Too many members found")) {
          return { players: [], error: "Search was too broad and returned too many results. Please be more specific." };
      }
      if (html.includes("0 members found")) {
        return { players: [] };
      }

      const preMatch = html.match(/<pre>([\s\S]*?)<\/pre>/i);
      if (!preMatch || !preMatch[1]) {
        return { players: [], error: "Could not find player data block in the search results." };
      }

      const lines = preMatch[1].split('\n');
      const dataStartIndex = lines.findIndex(line => line.includes('------------------------------------------------------'));
      
      if (dataStartIndex === -1) {
          // If no header is found, it might be that no players were found.
          return { players: [] };
      }

      const dataLines = lines.slice(dataStartIndex + 1);
      const players: PlayerSearchResult[] = [];

      for (const line of dataLines) {
        if (line.includes("member(s) found.") || line.trim().length === 0) {
          break;
        }

        const uscfId = line.substring(0, 8).trim();
        const fullNameRaw = line.substring(10, 37).trim();
        const stateAbbr = line.substring(37, 39).trim();
        const ratingStr = line.substring(41, 48).trim();

        if (uscfId && fullNameRaw && stateAbbr) {
            const nameParts = fullNameRaw.split(',').map((p: string) => p.trim());
            const reformattedName = nameParts.length >= 2 
                ? `${nameParts.slice(1).join(' ')} ${nameParts[0]}`.trim()
                : fullNameRaw;

            players.push({
                uscfId,
                fullName: reformattedName,
                state: stateAbbr,
                rating: /^\d+$/.test(ratingStr) ? parseInt(ratingStr, 10) : undefined,
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
