
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
  // The createInvoice function this calls already has this check.
  
  // This is a direct wrapper around the main createInvoice flow,
  // ensuring the data format is correct for an individual registration.
  // The `individual-registration-dialog` now constructs the `players` array,
  // making this fully compatible with the main `createInvoice` function.
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
