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
  dob: z.string().describe('The date of birth of the user in ISO 8601 format.'),
  hasPlayedBefore: z.boolean().describe('Whether the user has played in a USCF tournament before.'),
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

const SuggestMembershipTypePromptSchema = z.object({
    age: z.number(),
    hasPlayedBefore: z.boolean(),
});

const prompt = ai.definePrompt({
  name: 'suggestMembershipTypePrompt',
  input: {schema: SuggestMembershipTypePromptSchema},
  output: {schema: SuggestMembershipTypeOutputSchema},
  prompt: `You are an expert USCF membership advisor.

You will use the user's age and whether they have played before to suggest the most appropriate USCF membership type.

If they have played before, they will need to renew their membership. If not, they will need a new one.
Consider factors such as age restrictions (e.g., Youth, Young Adult, Adult), tournament eligibility, and cost-effectiveness.

Age: {{{age}}}
Has played in a USCF tournament before: {{{hasPlayedBefore}}}

Suggest the most appropriate USCF membership type (e.g., 'Adult Membership Renewal', 'Youth Membership - New') and justify your suggestion.`,
});

const suggestMembershipTypeFlow = ai.defineFlow(
  {
    name: 'suggestMembershipTypeFlow',
    inputSchema: SuggestMembershipTypeInputSchema,
    outputSchema: SuggestMembershipTypeOutputSchema,
  },
  async (input) => {
    const today = new Date();
    const birthDate = new Date(input.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    const {output} = await prompt({
        age: age,
        hasPlayedBefore: input.hasPlayedBefore,
    });
    return output!;
  }
);
