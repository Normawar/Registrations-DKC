'use server';

/**
 * @fileOverview A USCF membership type suggestion AI agent.
 *
 * - suggestMembershipType - A function that suggests the appropriate USCF membership type.
 * - SuggestMembershipTypeInput - The input type for the suggestMembershipType function.
 * - SuggestMembershipTypeOutput - The return type for the suggestMembershipType function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestMembershipTypeInputSchema = z.object({
  age: z.number().describe('The age of the user.'),
  tournamentExperience: z
    .string()
    .describe(
      'The tournament experience of the user, including the number of tournaments played and their rating history.'
    ),
});
export type SuggestMembershipTypeInput = z.infer<typeof SuggestMembershipTypeInputSchema>;

const SuggestMembershipTypeOutputSchema = z.object({
  membershipType: z
    .string()
    .describe('The suggested USCF membership type for the user.'),
  justification: z
    .string()
    .describe('The justification for the suggested membership type.'),
});
export type SuggestMembershipTypeOutput = z.infer<typeof SuggestMembershipTypeOutputSchema>;

export async function suggestMembershipType(
  input: SuggestMembershipTypeInput
): Promise<SuggestMembershipTypeOutput> {
  return suggestMembershipTypeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMembershipTypePrompt',
  input: {schema: SuggestMembershipTypeInputSchema},
  output: {schema: SuggestMembershipTypeOutputSchema},
  prompt: `You are an expert USCF membership advisor.

You will use the user's age and tournament experience to suggest the most appropriate USCF membership type for them.

Consider factors such as age restrictions, tournament eligibility, and cost-effectiveness.

Age: {{{age}}}
Tournament Experience: {{{tournamentExperience}}}

Suggest the most appropriate USCF membership type and justify your suggestion.`,
});

const suggestMembershipTypeFlow = ai.defineFlow(
  {
    name: 'suggestMembershipTypeFlow',
    inputSchema: SuggestMembershipTypeInputSchema,
    outputSchema: SuggestMembershipTypeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
