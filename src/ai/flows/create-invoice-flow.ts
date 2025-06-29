'use server';
/**
 * @fileOverview Creates an invoice with the Square API.
 *
 * - createInvoice - A function that handles the invoice creation process.
 * - CreateInvoiceInput - The input type for the createInvoice function.
 * - CreateInvoiceOutput - The return type for the createInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { randomUUID } from 'crypto';
import { Client, Environment, ApiError } from 'square';

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // Use Sandbox for testing
});

const { customersApi, ordersApi, invoicesApi } = squareClient;

// Add some diagnostic logging to verify configuration
console.log(`Square client configured for: Sandbox Environment`);
if (process.env.SQUARE_ACCESS_TOKEN) {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    console.log(`Using Square Access Token: Provided (starts with ${token.substring(0, 8)}..., ends with ${token.substring(token.length - 4)})`);
} else {
    console.log('Square Access Token: Not Provided. Please check your .env file.');
}
if (process.env.SQUARE_LOCATION_ID) {
    console.log(`Using Square Location ID: ${process.env.SQUARE_LOCATION_ID}`);
} else {
    console.log('Square Location ID: Not Provided. Please check your .env file.');
}


const CreateInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    eventName: z.string().describe('The name of the event.'),
    registrationFee: z.number().describe('The per-player registration fee.'),
    registrationCount: z.number().int().describe('The number of players being registered.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    uscfCount: z.number().int().describe('The number of new or renewing USCF memberships.'),
    totalAmount: z.number().describe('The total amount to be invoiced.'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

const CreateInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateInvoiceOutput = z.infer<typeof CreateInvoiceOutputSchema>;

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  return createInvoiceFlow(input);
}

const createInvoiceFlow = ai.defineFlow(
  {
    name: 'createInvoiceFlow',
    inputSchema: CreateInvoiceInputSchema,
    outputSchema: CreateInvoiceOutputSchema,
  },
  async (input) => {
    
    console.log("Starting Square invoice creation with input:", input);

    try {
      // 1. Get location ID from environment variables.
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (!locationId) {
        throw new Error('Square Location ID is not configured. Please set SQUARE_LOCATION_ID in your .env file.');
      }
      console.log(`Using location ID: ${locationId}`);

      // 2. Find or create a customer
      console.log(`Searching for customer with email: ${input.sponsorEmail}`);
      const searchCustomersResponse = await customersApi.searchCustomers({
        query: {
          filter: {
            emailAddress: {
              exact: input.sponsorEmail,
            },
          },
        },
      });

      let customerId: string;
      if (searchCustomersResponse.result.customers && searchCustomersResponse.result.customers.length > 0) {
        customerId = searchCustomersResponse.result.customers[0].id!;
        console.log(`Found existing customer with ID: ${customerId}`);
      } else {
        console.log("Customer not found, creating a new one...");
        const [firstName, ...lastNameParts] = input.sponsorName.split(' ');
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.sponsorEmail,
        });
        customerId = createCustomerResponse.result.customer!.id!;
        console.log(`Created new customer with ID: ${customerId}`);
      }
      
      // 3. Create an Order
      const lineItems = [];

      if (input.registrationCount > 0) {
        lineItems.push({
          name: `Event Registration: ${input.eventName}`,
          quantity: String(input.registrationCount),
          basePriceMoney: {
            amount: BigInt(Math.round(input.registrationFee * 100)),
            currency: 'USD',
          },
        });
      }

      if (input.uscfCount > 0) {
        lineItems.push({
          name: 'USCF Membership (New/Renewal)',
          quantity: String(input.uscfCount),
          basePriceMoney: {
            amount: BigInt(Math.round(input.uscfFee * 100)),
            currency: 'USD',
          },
        });
      }

      console.log("Creating order with line items:", JSON.stringify(lineItems, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
      const createOrderResponse = await ordersApi.createOrder({
        idempotencyKey: randomUUID(),
        order: {
          locationId: locationId,
          customerId: customerId,
          lineItems: lineItems,
        },
      });

      const orderId = createOrderResponse.result.order!.id!;
      console.log(`Created order with ID: ${orderId}`);

      // 4. Create an Invoice from the Order
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Invoice due in 7 days

      console.log(`Creating invoice for order ID: ${orderId}`);
      const createInvoiceResponse = await invoicesApi.createInvoice({
        idempotencyKey: randomUUID(),
        invoice: {
          orderId: orderId,
          primaryRecipient: {
            customerId: customerId,
          },
          paymentRequests: [{
            requestType: 'BALANCE',
            dueDate: dueDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
          }],
          deliveryMethod: 'SHARE_MANUALLY',
          acceptedPaymentMethods: {
            card: true,
            squareGiftCard: true,
            bankAccount: true, // For ACH payments
          },
          title: `Invoice for ${input.eventName}`,
          description: `Thank you for your registration.`,
        }
      });
      
      const invoice = createInvoiceResponse.result.invoice!;
      console.log("Successfully created DRAFT invoice:", invoice);

      // 5. Publish the invoice to make it active and get a public URL
      console.log(`Publishing invoice ID: ${invoice.id!}`);
      const { result: { invoice: publishedInvoice } } = await invoicesApi.publishInvoice(invoice.id!, {
        version: invoice.version!,
        idempotencyKey: randomUUID(),
      });
      console.log("Successfully published invoice:", publishedInvoice);

      if (!publishedInvoice.publicUrl) {
          console.error("Published invoice is missing a publicUrl.");
          throw new Error("Failed to retrieve public URL for the published invoice.");
      }

      return {
        invoiceId: publishedInvoice.id!,
        status: publishedInvoice.status!,
        invoiceUrl: publishedInvoice.publicUrl!,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Square API Error:', JSON.stringify(error.result, null, 2));
        const firstError = error.result.errors?.[0];
        const errorMessage = firstError?.detail ?? JSON.stringify(error.result.errors);
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice creation:', error);
        if (error instanceof Error) {
            throw new Error(`An unexpected error occurred: ${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice creation.');
      }
    }
  }
);
