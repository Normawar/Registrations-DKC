'use server';

/**
 * @fileOverview Creates an invoice specifically for an individual/parent registration.
 * This flow is separate from the bulk sponsor invoice creation.
 */

import { db } from '@/lib/services/firestore-service';
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
  // CRITICAL: Check database initialization at the wrapper level
  // This prevents the error from propagating through the server action
  if (!db) {
    console.error('Firestore not initialized at individual invoice wrapper level');
    throw new Error('Database connection not available. Please refresh the page and try again.');
  }

  try {
    // Add validation specific to individual registrations
    if (!input.players || input.players.length === 0) {
      throw new Error('At least one student must be selected for registration.');
    }

    // Log for debugging
    console.log('Creating individual invoice for:', {
      parentEmail: input.sponsorEmail,
      eventName: input.eventName,
      playerCount: input.players.length,
      totalAmount: input.players.reduce((sum, p) => 
        sum + p.baseRegistrationFee + (p.lateFee || 0) + (p.uscfAction ? input.uscfFee : 0), 0
      )
    });

    // Call the main invoice creation flow
    const result = await createInvoice(input);
    
    return result;
  } catch (error) {
    console.error('Error in createIndividualInvoice wrapper:', error);
    
    // Re-throw with more context for individual registrations
    if (error instanceof Error) {
      // Check for specific Firestore error
      if (error.message.includes('Expected first argument to collection()')) {
        throw new Error('Database connection lost during invoice creation. Please refresh the page and try again.');
      }
      throw error;
    }
    
    throw new Error('Failed to create registration invoice. Please try again.');
  }
}
