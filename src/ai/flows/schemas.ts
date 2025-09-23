/**
 * @fileOverview Centralized Zod schemas for Genkit flows.
 * This file contains all the Zod schema definitions and their inferred types
 * to be used across different flows. This separation is necessary because
 * files marked with 'use server' can only export async functions.
 */
import { z } from 'genkit';

// === Schemas for create-invoice-flow.ts ===
const PlayerInvoiceInfoSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  uscfId: z.string().describe('The USCF ID of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.number().optional().nullable().describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
  isGtPlayer: z.boolean().optional().describe('Whether the player is in the Gifted & Talented program.'),
  section: z.string().optional().describe('The tournament section for the player.'),
  waiveLateFee: z.boolean().optional().describe('Flag to waive late fee for a player.'),
});

export const CreateInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    sponsorPhone: z.string().optional().describe('The phone number of the sponsor.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The name of the school associated with the sponsor.'),
    schoolAddress: z.string().optional().describe('The street address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    teamCode: z.string().optional().describe('An optional team code. If provided, it will be used. If not, it will be generated.'),
    eventName: z.string().describe('The name of the event.'),
    eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    players: z.array(PlayerInvoiceInfoSchema).describe('An array of players to be invoiced.'),
    invoiceNumber: z.string().optional().describe('A custom invoice number to assign. If not provided, Square will generate one.'),
    substitutionFee: z.number().optional().describe('A fee for substitutions, if applicable.'),
    description: z.string().optional().describe('An optional description or note for the invoice.'),
    revisionMessage: z.string().optional().describe('Revision message to include in invoice description'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

export const CreateInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateInvoiceOutput = z.infer<typeof CreateInvoiceOutputSchema>;


// === Schemas for create-membership-invoice-flow.ts ===
const PlayerInfoSchema = z.object({
  firstName: z.string().describe('The first name of the player.'),
  middleName: z.string().optional().describe('The middle name of the player.'),
  lastName: z.string().describe('The last name of the player.'),
  email: z.string().email().describe('The email of the player.'),
  phone: z.string().optional().describe('The phone number of the player.'),
  dob: z.string().describe("The player's date of birth in ISO 8601 format."),
  zipCode: z.string().describe("The player's zip code."),
});

export const CreateMembershipInvoiceInputSchema = z.object({
    purchaserName: z.string().describe('The name of the person paying for the membership.'),
    purchaserEmail: z.string().email().describe('The email of the person paying for the membership.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The name of the school associated with the purchaser.'),
    schoolAddress: z.string().optional().describe('The address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    membershipType: z.string().describe('The type of USCF membership being purchased.'),
    fee: z.number().describe('The cost of the membership.'),
    players: z.array(PlayerInfoSchema).describe('An array of players receiving the membership.'),
});
export type CreateMembershipInvoiceInput = z.infer<typeof CreateMembershipInvoiceInputSchema>;

export const CreateMembershipInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateMembershipInvoiceOutput = z.infer<typeof CreateMembershipInvoiceOutputSchema>;


// === Schemas for create-organizer-invoice-flow.ts ===
const OrganizerLineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  amount: z.number().describe('The cost of the line item in dollars.'),
  note: z.string().optional().describe('Any additional notes for the line item.'),
});

export const CreateOrganizerInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the person or entity to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the invoice recipient.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The school associated with this invoice.'),
    schoolAddress: z.string().optional().describe('The address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    invoiceTitle: z.string().describe('The main title for the invoice.'),
    lineItems: z.array(OrganizerLineItemSchema).min(1).describe('An array of items to be included in the invoice.'),
    invoiceNumber: z.string().optional(),
});
export type CreateOrganizerInvoiceInput = z.infer<typeof CreateOrganizerInvoiceInputSchema>;

export const CreateOrganizerInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateOrganizerInvoiceOutput = z.infer<typeof CreateOrganizerInvoiceOutputSchema>;


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
    teamCode: z.string().optional(),
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
