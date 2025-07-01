
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

const searchPrompt = ai.definePrompt({
    name: 'searchUscfPlayersPrompt',
    model: 'googleai/gemini-1.5-pro-latest',
    input: { schema: z.string() },
    output: { schema: SearchUscfPlayersOutputSchema },
    prompt: `You are an expert at parsing fixed-width text from an HTML \`<pre>\` tag.
I will provide the HTML source from the USCF player search results page at \`http://www.uschess.org/msa/MbrLst.php\`.

Your task is to find the \`<pre>\` tag and extract the details for each player listed.

**RULES:**
1.  Ignore the header lines. The player data starts after the line of dashes (\`------------------------------------------------------\`).
2.  Each player is on a new line.
3.  The data is in fixed-width columns. The columns are: USCF ID, Name, St, Rating, Exp. Date.
4.  For each player line, extract the following data:
    - \`uscfId\`: The 8-digit ID from the start of the line.
    - \`fullName\`: The player's name. It can be long and take up all the space before the State column.
    - \`rating\`: The player's rating. This MUST be a number. If it is blank or not a number, omit the field.
    - \`state\`: The two-letter state abbreviation.
5.  Stop parsing when you reach a line that says "X member(s) found." or the end of the \`<pre>\` tag.
6.  If the page contains the text "0 members found", or if there are no player data lines, you must return an empty array for the "players" field, like this: \`{"players": []}\`.

**EXAMPLE INPUT HTML:**
\`\`\`html
<HTML>
<HEAD>
<TITLE>USCF Member Search</TITLE>
</HEAD>
<BODY>
<PRE>

Searching for: Last Name = "smith"

                                     Reg   Exp.
USCF ID   Name                       St  Rating  Date
------------------------------------------------------
12345678  SMITH, JOHN A              TX    1500  2025-12-31
87654321  SMITH, JANE B              CA         2024-08-15
11112222  SMITH, ROBERT              NY  Unrated 2023-01-01

3 members found.
</PRE>
</BODY>
</HTML>
\`\`\`

**EXAMPLE OUTPUT JSON for the above HTML:**
\`\`\`json
{
  "players": [
    {
      "uscfId": "12345678",
      "fullName": "SMITH, JOHN A",
      "rating": 1500,
      "state": "TX"
    },
    {
      "uscfId": "87654321",
      "fullName": "SMITH, JANE B",
      "state": "CA"
    },
    {
      "uscfId": "11112222",
      "fullName": "SMITH, ROBERT",
      "state": "NY"
    }
  ]
}
\`\`\`

Now, parse the following HTML and provide the JSON output.

**ACTUAL INPUT HTML:**
\`\`\`html
{{{_input}}}
\`\`\`
`
});


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
      
      const { output } = await searchPrompt(html);

      if (!output) {
          return { players: [], error: "AI model failed to parse the player data." };
      }
      
      if (output.error) {
          return { players: [], error: output.error };
      }
      
      if (output.players.length === 0) {
        return { players: [] };
      }
      
      // Re-format name from "LAST, FIRST" to "FIRST LAST" for display
      const players: PlayerSearchResult[] = output.players.map(player => {
        const nameParts = player.fullName.split(',').map((p: string) => p.trim());
        if (nameParts.length < 2) {
            return player; // Return as is if format is unexpected
        }
        const lastName = nameParts[0];
        const firstNameParts = nameParts.slice(1);

        const reformattedName = `${firstNameParts.join(' ')} ${lastName}`;
        
        return {
          ...player,
          fullName: reformattedName,
        };
      });
      
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
