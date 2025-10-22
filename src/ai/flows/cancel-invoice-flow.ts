'use server';

import { z } from 'genkit';
import { db } from '@/lib/firebase-admin';

// -----------------------------
// 🔷 SCHEMA DEFINITIONS
// -----------------------------
export const CancelInvoiceInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to cancel.'),
  requestingUserRole: z.string().describe('Role of user requesting the cancellation'),
});

export type CancelInvoiceInput = z.infer<typeof CancelInvoiceInputSchema>;

export const CancelInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
});

export type CancelInvoiceOutput = z.infer<typeof CancelInvoiceOutputSchema>;

// -----------------------------
// 🔷 MAIN FUNCTION
// -----------------------------
export async function cancelInvoice(
  input: CancelInvoiceInput
): Promise<CancelInvoiceOutput> {
  if (input.requestingUserRole !== 'organizer') {
    throw new Error('Only organizers can cancel invoices.');
  }

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is not set.');
  }

  // ✅ Corrected dynamic import for Square (ESM-safe)
  const squareModule = (await import('square')) as any;
  const { Client, Environment } =
    squareModule.default || squareModule;

  // ✅ Initialize Square client
  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    environment:
      process.env.NODE_ENV === 'production'
        ? Environment.Production
        : Environment.Sandbox,
  });

  const { invoicesApi } = squareClient;

  try {
    // ✅ Fetch the current invoice
    const { result } = await invoicesApi.getInvoice(input.invoiceId);
    const invoice = result?.invoice;

    if (!invoice || invoice.version === undefined) {
      throw new Error(
        `Invoice not found or missing version for ID: ${input.invoiceId}`
      );
    }

    const cancelableStatuses = ['DRAFT', 'PUBLISHED', 'UNPAID', 'PARTIALLY_PAID'];

    // ✅ If not cancelable on Square, just update Firestore
    if (!invoice.status || !cancelableStatuses.includes(invoice.status)) {
      await db.collection('invoices').doc(input.invoiceId).update({
        status: invoice.status ?? 'UNKNOWN',
        invoiceStatus: invoice.status ?? 'UNKNOWN',
        cancelReason: 'Invoice not cancelable via Square',
        updatedAt: new Date().toISOString(),
      });

      return {
        invoiceId: invoice.id!,
        status: invoice.status ?? 'UNKNOWN',
      };
    }

    // ✅ Cancel the invoice on Square
    const { result: cancelResult } = await invoicesApi.cancelInvoice(
      input.invoiceId,
      { version: invoice.version }
    );

    const canceledInvoice = cancelResult?.invoice;

    // ✅ Update Firestore after successful cancellation
    await db.collection('invoices').doc(input.invoiceId).update({
      status: canceledInvoice?.status ?? 'CANCELED',
      invoiceStatus: canceledInvoice?.status ?? 'CANCELED',
      cancelReason: 'Canceled by organizer',
      updatedAt: new Date().toISOString(),
    });

    return {
      invoiceId: canceledInvoice?.id ?? input.invoiceId,
      status: canceledInvoice?.status ?? 'CANCELED',
    };
  } catch (error: any) {
    const errors = error?.body?.errors ?? [];
    const isNotCancelable = Array.isArray(errors)
      ? errors.some(
          (e: any) =>
            e.code === 'BAD_REQUEST' &&
            e.detail?.toLowerCase().includes('cannot be canceled')
        )
      : false;

    // ✅ Gracefully handle invoices that can't be canceled via API
    if (isNotCancelable) {
      const { result } = await invoicesApi.getInvoice(input.invoiceId);
      const invoice = result?.invoice;

      await db.collection('invoices').doc(input.invoiceId).update({
        status: invoice?.status ?? 'UNKNOWN',
        invoiceStatus: invoice?.status ?? 'UNKNOWN',
        cancelReason: 'Cannot cancel via Square API',
        updatedAt: new Date().toISOString(),
      });

      return {
        invoiceId: input.invoiceId,
        status: invoice?.status ?? 'UNKNOWN',
      };
    }

    console.error('Square API Error in cancelInvoice:', error);
    throw new Error(`Square Error: ${error.message ?? 'Unknown error'}`);
  }
}
