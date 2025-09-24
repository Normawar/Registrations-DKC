'use server';

/**
 * @fileOverview Creates an invoice for a sponsor registration.
 * This server action acts as a safe, non-AI wrapper around the main invoice creation logic.
 * It determines whether to create a standard invoice or a split PSJA invoice based on the input.
 */

import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { createPsjaSplitInvoice } from '@/ai/flows/create-psja-split-invoice-flow';
import type { CreateInvoiceInput, CreateInvoiceOutput, CreatePsjaSplitInvoiceInput, CreatePsjaSplitInvoiceOutput } from '@/ai/flows/schemas';


export async function createSponsorInvoice(input: CreateInvoiceInput): Promise<CreatePsjaSplitInvoiceOutput> {
  const isPsjaDistrict = input.district === 'PHARR-SAN JUAN-ALAMO ISD';
  const hasGt = input.players.some(p => p.isGtPlayer);
  const hasIndependent = input.players.some(p => !p.isGtPlayer);
  
  if (isPsjaDistrict && hasGt && hasIndependent) {
    // This is a PSJA split invoice case
    const psjaInput: CreatePsjaSplitInvoiceInput = {
      ...input,
      district: 'PHARR-SAN JUAN-ALAMO ISD', // Ensure type correctness
    };
    return await createPsjaSplitInvoice(psjaInput);
  } else {
    // This is a standard, single invoice case
    const result: CreateInvoiceOutput = await createInvoice(input);
    // Wrap the single invoice result to match the split invoice output structure
    return {
      independentInvoice: result
    };
  }
}
