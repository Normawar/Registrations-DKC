
'use server';
/**
 * @fileOverview This flow has been deprecated.
 * All player searches are now performed against the local Master Player Database.
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
  quickRating: z.string().optional().describe("The player's quick rating string.")
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
  async (input) => {
    return { players: [], error: 'This functionality has been disabled. Please search the local Master Player Database.' };
  }
);
