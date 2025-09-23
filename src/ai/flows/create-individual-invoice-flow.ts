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
 * 
 * Note: Even though this is for "individual" registration, it uses the same
 * bulk invoice schema because a parent can register multiple children at once.
 */
export async function createIndividualInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  try {
    // Add validation specific to individual registrations
    if (!input.players || input.players.length === 0) {
      throw new Error('At least one student must be selected for registration.');
    }
    
    // Call the main invoice creation flow
    const result = await createInvoice(input);
    
    return result;
  } catch (error) {
    console.error('Error in createIndividualInvoice wrapper:', error);
    
    // Re-throw with more context for individual registrations
    if (error instanceof Error) {
      if (error.message.includes('Expected first argument to collection()') || error.message.includes('Firestore')) {
        throw new Error('Database connection lost during invoice creation. Please refresh the page and try again.');
      }
      throw error;
    }
    
    throw new Error('Failed to create registration invoice. Please try again.');
  }
}
