'use server';
/**
 * @fileOverview Centralized Zod schemas for Genkit flows.
 * This file contains all the Zod schema definitions and their inferred types
 * to be used across different flows. This separation is necessary because
 * files marked with 'use server' can only export async functions.
 */
import { z } from 'genkit';

// === Schemas for process-batched-requests-flow.ts ===
export const BatchedRequestInputSchema = z.object({
  requestIds: z.array(z.string()).describe('An array of request IDs to process.'),
  decision: z.enum(['Approved', 'Denied']).describe('The decision to apply to all requests.'),
  waiveFees: z.boolean().optional().describe('Whether to waive any additional fees for approved requests.'),
  processingUser: z.object({
    uid: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }).describe('The organizer processing the requests.'),
});
export type ProcessBatchInput = z.infer<typeof BatchedRequestInputSchema>;

export const ProcessBatchOutputSchema = z.object({
  processedCount: z.number().describe('The number of requests successfully processed.'),
  failedCount: z.number().describe('The number of requests that failed to process.'),
  errors: z.array(z.string()).optional().describe('A list of error messages for failed requests.'),
});
export type ProcessBatchOutput = z.infer<typeof ProcessBatchOutputSchema>;


// === Schemas for recreate-invoice-from-roster-flow.ts ===
const PlayerToInvoiceSchema = z.object({
    playerName: z.string(),
    uscfId: z.string(),
    baseRegistrationFee: z.number(),
    lateFee: z.number().nullable(),
    uscfAction: z.boolean(),
    isGtPlayer: z.boolean().optional(),
    section: z.string().optional(),
    waiveLateFee: z.boolean().optional(),
});

export const RecreateInvoiceInputSchema = z.object({
    originalInvoiceId: z.string().describe('The ID of the invoice to cancel and replace.'),
    players: z.array(PlayerToInvoiceSchema).describe('The new, updated list of players for the invoice.'),
    uscfFee: z.number(),
    requestingUserRole: z.string().describe('Role of the user initiating the recreation.'),
    // All original sponsor/event details needed to create the new invoice
    sponsorName: z.string(),
    sponsorEmail: z.string().email(),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string(),
    schoolAddress: z.string().optional(),
    schoolPhone: z.string().optional(),
    district: z.string().optional(),
    teamCode: z.string(),
    eventName: z.string(),
    eventDate: z.string(),
    revisionMessage: z.string().optional(),
});
export type RecreateInvoiceInput = z.infer<typeof RecreateInvoiceInputSchema>;

export const RecreateInvoiceOutputSchema = z.object({
  oldInvoiceId: z.string(),
  newInvoiceId: z.string(),
  newInvoiceNumber: z.string().optional(),
  newStatus: z.string(),
  newInvoiceUrl: z.string().url(),
  newTotalAmount: z.number(),
});
export type RecreateInvoiceOutput = z.infer<typeof RecreateInvoiceOutputSchema>;
