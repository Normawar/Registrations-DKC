// src/lib/services/invoice-service.ts
'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceInput,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';

export async function recreateInvoiceFromRoster(input: RecreateInvoiceInput): Promise<RecreateInvoiceOutput> {
    return recreateInvoiceFromRosterFlow(input);
}
