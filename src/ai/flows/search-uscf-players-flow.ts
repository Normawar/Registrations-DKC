
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
  expirationDate: z.string().optional().describe("The player's USCF membership expiration date in MM/DD/YYYY format."),
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
    
    // Using the more modern and reliable player search page.
    const url = 'http://www.uschess.org/datapage/player-lookup.php';
    const searchName = `${lastName}, ${firstName || ''}`.trim();
    const searchParams = new URLSearchParams({
        p_name: searchName,
        p_state: state === 'ALL' ? '' : state || '',
        submit: 'Submit', // This is required by the form
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: searchParams.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        return { players: [], error: `Failed to fetch from USCF website. Status: ${response.status}` };
      }
      
      const html = await response.text();
      
      if (html.includes("No players that match your search criteria were found.")) {
        return { players: [] };
      }
      
      const tableMatch = html.match(/<table.*?>(.*?)<\/table>/is);
      if (!tableMatch || !tableMatch[1]) {
        console.error("USCF Search Response (No <table> found):", html.substring(0, 500));
        return { players: [], error: "Could not find player data table in the search results. The USCF website may have changed its format." };
      }
      
      const tableHtml = tableMatch[1];
      const rows = tableHtml.split(/<\/tr>/i).slice(1); // Skip header row and split by closing tr tag
      const players: PlayerSearchResult[] = [];

      for (const row of rows) {
          if (!row.trim()) continue;

          const cells = row.match(/<td.*?>(.*?)<\/td>/gis);
          if (!cells || cells.length < 5) continue;

          const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim().replace(/&nbsp;/g, '');

          const uscfId = stripTags(cells[0]);
          const fullNameRaw = stripTags(cells[1]);
          const stateAbbr = stripTags(cells[2]);
          const ratingStr = stripTags(cells[3]);
          const expDate = stripTags(cells[4]);
          
          if (!uscfId || !fullNameRaw) continue;

          // Convert "LAST, FIRST MI" to "First MI Last"
          let fullName = fullNameRaw;
          if (fullNameRaw.includes(',')) {
              const nameParts = fullNameRaw.split(',').map(p => p.trim());
              const lastNamePart = nameParts[0];
              const firstNameAndMiddle = nameParts.slice(1).join(' ');
              fullName = `${firstNameAndMiddle} ${lastNamePart}`.trim();
          }

          players.push({
              uscfId,
              fullName: fullName,
              state: stateAbbr,
              rating: /^\d+$/.test(ratingStr) ? parseInt(ratingStr, 10) : undefined,
              expirationDate: expDate
          });
      }
      
      if (players.length === 0 && !html.includes("No players")) {
        console.error("USCF Search Response (Parsing failed to produce players):", html.substring(0, 1000));
        return { players: [], error: "Failed to parse player data from the USCF website. The format may have changed." };
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
