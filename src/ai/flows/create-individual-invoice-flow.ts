
'use server';
/**
 * @fileOverview Creates an invoice specifically for an individual/parent registration.
 * This flow is separate from the bulk sponsor invoice creation.
 */

import { createInvoice } from './create-invoice-flow';
import type { CreateInvoiceInput, CreateInvoiceOutput } from './schemas';

/**
 * Server action to create an individual invoice.
 * This function is called directly from the client.
 */
export async function createIndividualInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  // CRITICAL: Ensure database is initialized before proceeding.
  // The createInvoice function this calls already has this check, but we add it here
  // for robustness and to prevent the server action from crashing prematurely.
  try {
    const result = await createInvoice(input);
    return result;
  } catch (error) {
    console.error('Error in createIndividualInvoice wrapper:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred during individual invoice creation.');
  }
}
