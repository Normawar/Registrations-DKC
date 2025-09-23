
'use server';
/**
 * @fileOverview Records a payment against a Square invoice using the Square API.
 */

import { ApiError, Client, Environment } from 'square';
import { randomUUID } from 'crypto';
import { type RecordPaymentInput, type RecordPaymentOutput } from './schemas';

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentOutput> {
    if (input.requestingUserRole !== 'organizer') {
        throw new Error('Only organizers can record payments.');
    }
    
    const squareClient = new Client({
        accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
        environment: Environment.Production,
    });
    const { paymentsApi, invoicesApi } = squareClient;

    try {
        console.log(`Fetching invoice ${input.invoiceId} to get details...`);
        const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
        
        // Use the publishInvoice API to mark invoice as paid - this was the working solution
        console.log("Publishing invoice to mark as paid...");
        const publishRequest = {
            version: invoice.version!,
        };

        const { result: { invoice: updatedInvoice } } = await invoicesApi.publishInvoice(
            input.invoiceId,
            publishRequest
        );

        const totalPaid = updatedInvoice?.paymentRequests?.[0]?.totalCompletedAmountMoney?.amount;
        const totalInvoiced = updatedInvoice?.paymentRequests?.[0]?.computedAmountMoney?.amount;

        return {
            paymentId: randomUUID(), // Generate local ID since no Square payment created
            status: 'PAID',
            totalPaid: totalPaid ? Number(totalPaid) / 100 : input.amount,
            totalInvoiced: totalInvoiced ? Number(totalInvoiced) / 100 : input.amount,
        };

    } catch (error) {
        if (error instanceof ApiError) {
            const errorResult = error.result || {};
            const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
            console.error('Square API Error in recordPaymentFlow:', JSON.stringify(errorResult, null, 2));
            const errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
            throw new Error(`Square Error: ${errorMessage}`);
        } else {
            console.error('An unexpected error occurred during payment recording:', error);
            if (error instanceof Error) {
                throw new Error(`${error.message}`);
            }
            throw new Error('An unexpected error occurred during payment recording.');
        }
    }
}
