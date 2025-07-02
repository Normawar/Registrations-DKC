
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

      // Isolate the form containing the results. This is more robust.
      const formMatch = html.match(/<FORM ACTION='.\/player-search.php'[\s\S]*?<\/FORM>/i);
      if (!formMatch || !formMatch[0]) {
          console.error("USCF Search: Could not find the results form container. The website layout may have changed. Snippet:", html.substring(0, 2000));
          return { players: [], error: "Could not find the results form container. The website layout may have changed." };
      }
      const formHtml = formMatch[0];
      
      const players: PlayerSearchResult[] = [];
      const stripTags = (str: string) => str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

      // Find all table rows within the form.
      const rowMatches = formHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      if (!rowMatches) {
        console.error("USCF Search: Found the form, but could not find any table rows within it. Snippet:", formHtml.substring(0, 1000));
        return { players: [], error: "Found the form, but could not find any table rows within it." };
      }

      for (const rowHtml of rowMatches) {
          // A real player row always contains this link. This is the most reliable check.
          if (!rowHtml.toLowerCase().includes('mbrdtlmain.php')) {
              continue;
          }

          const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          
          if (cells.length !== 10) {
              // This row is not a standard player data row.
              continue; 
          }

          const player: Partial<PlayerSearchResult> = {};

          // Column 0: USCF ID
          player.uscfId = stripTags(cells[0]);

          // Column 1: Rating
          const ratingText = stripTags(cells[1]);
          if (ratingText && ratingText.toLowerCase() !== 'unrated') {
              const numericPartMatch = ratingText.match(/(\d+)/);
              if (numericPartMatch && numericPartMatch[1]) {
                  player.rating = parseInt(numericPartMatch[1], 10);
              }
          }

          // Column 7: State
          player.state = stripTags(cells[7]);
          
          // Column 8: Expiration Date
          player.expirationDate = stripTags(cells[8]);
          
          // Column 9: Name (and link)
          const nameCellContent = cells[9];
          const nameLinkMatch = nameCellContent.match(/<a href=[^>]+?\?(\d+)[^>]*>([\s\S]+?)<\/a>/i);
          
          if (nameLinkMatch && nameLinkMatch[1] && nameLinkMatch[2]) {
              const idFromLink = nameLinkMatch[1];
              // Verify that the ID in the link matches the ID in the first column.
              if (idFromLink.trim() !== player.uscfId?.trim()) {
                  continue;
              }

              const fullNameRaw = stripTags(nameLinkMatch[2]); // Format: LAST, FIRST MIDDLE
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
              // If the name cell doesn't have the expected link, this is not a valid player row.
              continue;
          }
          
          // Final check to ensure we have the essential data before adding.
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
