'use server';

import { createOrganizerInvoice as createOrganizerInvoiceFlow, type CreateOrganizerInvoiceInput, type CreateOrganizerInvoiceOutput } from '@/ai/flows/create-organizer-invoice-flow';
import { recreateOrganizerInvoice as recreateOrganizerInvoiceFlow, type RecreateOrganizerInvoiceInput, type RecreateOrganizerInvoiceOutput } from '@/ai/flows/recreate-organizer-invoice-flow';
import { recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow, type RecreateInvoiceInput, type RecreateInvoiceOutput } from '@/ai/flows/recreate-invoice-from-roster-flow';

/**
 * Server action to create an organizer invoice.
 * This acts as a safe wrapper around the Genkit flow.
 */
export async function createOrganizerInvoice(input: CreateOrganizerInvoiceInput): Promise<CreateOrganizerInvoiceOutput> {
  return await createOrganizerInvoiceFlow(input);
}

/**
 * Server action to recreate an organizer invoice.
 * This acts as a safe wrapper around the Genkit flow.
 */
export async function recreateOrganizerInvoice(input: RecreateOrganizerInvoiceInput): Promise<RecreateOrganizerInvoiceOutput> {
  return await recreateOrganizerInvoiceFlow(input);
}

/**
 * Server action to recreate an invoice from a roster.
 * This acts as a safe wrapper around the Genkit flow.
 */
export async function recreateInvoiceFromRoster(input: RecreateInvoiceInput): Promise<RecreateInvoiceOutput> {
  return await recreateInvoiceFromRosterFlow(input);
}
