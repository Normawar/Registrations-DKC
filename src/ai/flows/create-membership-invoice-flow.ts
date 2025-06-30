'use server';
/**
 * @fileOverview Creates an invoice for a USCF membership with the Square API.
 *
 * - createMembershipInvoice - A function that handles the invoice creation process.
 * - CreateMembershipInvoiceInput - The input type for the function.
 * - CreateMembershipInvoiceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { Client, Environment, ApiError } from 'square';

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // Use Sandbox for testing
});

const { customersApi, ordersApi, invoicesApi } = squareClient;

const PlayerInfoSchema = z.object({
  playerName: z.string().describe('The full name of the player receiving the membership.'),
});

const CreateMembershipInvoiceInputSchema = z.object({
    purchaserName: z.string().describe('The name of the person paying for the membership.'),
    purchaserEmail: z.string().email().describe('The email of the person paying for the membership.'),
    membershipType: z.string().describe('The type of USCF membership being purchased.'),
    fee: z.number().describe('The cost of the membership.'),
    players: z.array(PlayerInfoSchema).describe('An array of players receiving the membership.'),
});
export type CreateMembershipInvoiceInput = z.infer<typeof CreateMembershipInvoiceInputSchema>;

const CreateMembershipInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateMembershipInvoiceOutput = z.infer<typeof CreateMembershipInvoiceOutputSchema>;

export async function createMembershipInvoice(input: CreateMembershipInvoiceInput): Promise<CreateMembershipInvoiceOutput> {
  return createMembershipInvoiceFlow(input);
}

const createMembershipInvoiceFlow = ai.defineFlow(
  {
    name: 'createMembershipInvoiceFlow',
    inputSchema: CreateMembershipInvoiceInputSchema,
    outputSchema: CreateMembershipInvoiceOutputSchema,
  },
  async (input) => {
    
    console.log("Starting Square membership invoice creation with input:", input);

    try {
      // 1. Get location ID from environment variables.
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (!locationId || locationId.startsWith('YOUR_')) {
        throw new Error('Square Location ID is not configured. Please set SQUARE_LOCATION_ID in your .env file.');
      }
      console.log(`Using location ID: ${locationId}`);

      // 2. Find or create a customer
      console.log(`Searching for customer with email: ${input.purchaserEmail}`);
      const searchCustomersResponse = await customersApi.searchCustomers({
        query: {
          filter: {
            emailAddress: {
              exact: input.purchaserEmail,
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
        const [firstName, ...lastNameParts] = input.purchaserName.split(' ');
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.purchaserEmail,
        });
        customerId = createCustomerResponse.result.customer!.id!;
        console.log(`Created new customer with ID: ${customerId}`);
      }
      
      // 3. Create an Order
      const lineItems = input.players.map(player => ({
        name: `USCF Membership (${input.membershipType}) for ${player.playerName}`,
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(input.fee * 100)),
          currency: 'USD',
        },
      }));

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

      const title = input.players.length > 1
        ? `USCF Membership for ${input.players.length} players`
        : `USCF Membership for ${input.players[0].playerName}`;

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
          title: title,
          description: `Invoice for ${input.membershipType} USCF Membership. This purchase does not register any players for events.`,
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
        invoiceNumber: publishedInvoice.invoiceNumber,
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
