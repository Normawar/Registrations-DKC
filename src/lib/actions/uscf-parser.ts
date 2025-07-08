
'use server';
/**
 * @fileOverview This action has been deprecated.
 * Player data is now managed within the local Master Player Database.
 */
import { z } from 'zod';

const ParsedPlayerDataSchema = z.object({
  error: z.string().optional()
});
export type ParsedPlayerData = z.infer<typeof ParsedPlayerDataSchema>;

export async function parseThin3Page(html: string, uscfId: string): Promise<ParsedPlayerData> {
    return { error: "This functionality has been disabled." };
}
