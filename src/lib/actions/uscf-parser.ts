
'use server';
/**
 * @fileOverview A utility for parsing USCF player data from HTML.
 */
import { z } from 'zod';

// This matches the output of the lookup flow
const ParsedPlayerDataSchema = z.object({
  uscfId: z.string().describe("The player's USCF ID."),
  firstName: z.string().optional().describe("The player's first name."),
  middleName: z.string().optional().describe("The player's middle name or initial."),
  lastName: z.string().optional().describe("The player's last name."),
  state: z.string().optional().describe("The player's state abbreviation."),
  rating: z.number().optional().describe("The player's regular USCF rating."),
  expirationDate: z.string().optional().describe("The player's USCF membership expiration date in YYYY-MM-DD format."),
  quickRating: z.string().optional().describe("The player's quick rating string."),
  error: z.string().optional().describe("An error message if the lookup failed or the player was not found.")
});
export type ParsedPlayerData = z.infer<typeof ParsedPlayerDataSchema>;

/**
 * Parses player data from the HTML content of a thin3.php page.
 * @param html The HTML content of the page.
 * @param uscfId The USCF ID of the player, as it might not be in the HTML itself if it's a search result.
 * @returns {Promise<ParsedPlayerData>} The parsed player data.
 */
export async function parseThin3Page(html: string, uscfId: string): Promise<ParsedPlayerData> {
  // A simple check to see if the page is what we expect. A valid thin3.php page has this heading.
  if (!html.includes("<h2>USCF Member Lookup</h2>")) {
    return { uscfId, error: "Player not found or invalid page returned from USCF." };
  }
  
  const output: ParsedPlayerData = { uscfId };

  const extractInputValue = (name: string): string | null => {
    const regex = new RegExp(`name=${name}[^>]*value='(.*?)'`, 'is');
    const match = html.match(regex);
    return match ? match[1].trim() : null;
  };

  // Extract Full Name
  const fullName = extractInputValue('memname');
  if (fullName) {
      const nameParts = fullName.split(' ').filter(p => p);
      if (nameParts.length > 0) {
          output.lastName = nameParts.pop() || '';
      }
      if (nameParts.length > 0) {
          output.firstName = nameParts.shift() || '';
      }
      if (nameParts.length > 0) {
         output.middleName = nameParts.join(' ');
      }
  }

  // Extract State
  output.state = extractInputValue('state_country') || undefined;
  
  // Extract Membership Expiration Date from its dedicated field
  output.expirationDate = extractInputValue('memexpdt') || undefined;
  
  // Extract Regular Rating from the combined field
  const ratingString = extractInputValue('rating1');
  if (ratingString && ratingString.toLowerCase() !== 'unrated') {
    // Extract the number at the beginning of the string, ignoring the provisional '*'
    const ratingMatch = ratingString.match(/^(\d+)/);
    if (ratingMatch && ratingMatch[1]) {
      output.rating = parseInt(ratingMatch[1], 10);
    }
  }
  
  // Extract Quick Rating
  output.quickRating = extractInputValue('rating2') || undefined;
  
  if (!output.lastName && !output.firstName) {
    return { uscfId, error: "Could not parse player name from the details page." };
  }
  
  return output;
}
