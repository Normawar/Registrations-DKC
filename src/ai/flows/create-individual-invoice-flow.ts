
'use server';
/**
 * @fileOverview Creates an invoice specifically for an individual/parent registration.
 * This flow is separate from the bulk sponsor invoice creation.
 */

import { createInvoice } from './create-invoice-flow';
import type { CreateInvoiceInput, CreateInvoiceOutput } from './schemas';
import { db } from '@/lib/firebase-admin';

/**
 * Server action to create an individual invoice.
 * This function is called directly from the client.
 */
export async function createIndividualInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  // CRITICAL: Ensure database is initialized before proceeding.
  if (!db) {
    console.error('CRITICAL: Firestore Admin SDK is not initialized in createIndividualInvoice flow. Halting execution.');
    throw new Error('Server configuration error: Database not available.');
  }
  
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
