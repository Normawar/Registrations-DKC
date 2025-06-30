'use server';
/**
 * @fileOverview Creates an invoice with the Square API.
 *
 * - createInvoice - A function that handles the invoice creation process.
 * - CreateInvoiceInput - The input type for the createInvoice function.
 * - CreateInvoiceOutput - The return type for the createInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError } from 'square';
import { format } from 'date-fns';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';

const PlayerInvoiceInfoSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.number().describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
});

const CreateInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    schoolName: z.string().describe('The name of the school associated with the sponsor.'),
    teamCode: z.string().describe('The team code of the sponsor.'),
    eventName: z.string().describe('The name of the event.'),
    eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    players: z.array(PlayerInvoiceInfoSchema).describe('An array of players to be invoiced.'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

const CreateInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
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
    const squareClient = await getSquareClient();
    const locationId = await getSquareLocationId();
    const { customersApi, ordersApi, invoicesApi } = squareClient;
    
    console.log("Starting Square invoice creation with input:", input);

    try {
      // Find or create a customer
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
        const customer = searchCustomersResponse.result.customers[0];
        customerId = customer.id!;
        console.log(`Found existing customer with ID: ${customerId}`);
        // If the customer exists but doesn't have the school name, update them.
        if (customer.companyName !== input.schoolName) {
            console.log(`Updating customer ${customerId} with company name: ${input.schoolName}`);
            await customersApi.updateCustomer(customerId, {
                companyName: input.schoolName,
            });
        }
      } else {
        console.log("Customer not found, creating a new one...");
        const [firstName, ...lastNameParts] = input.sponsorName.split(' ');
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.sponsorEmail,
          companyName: input.schoolName,
          note: `Team Code: ${input.teamCode}`,
        });
        customerId = createCustomerResponse.result.customer!.id!;
        console.log(`Created new customer with ID: ${customerId}`);
      }
      
      // Create an Order
      const lineItems = [];

      input.players.forEach(player => {
        // Line item for registration
        lineItems.push({
          name: `Registration: ${player.playerName}`,
          quantity: '1',
          basePriceMoney: {
            amount: BigInt(Math.round(player.baseRegistrationFee * 100)),
            currency: 'USD',
          },
        });

        // Line item for late fee if applicable
        if (player.lateFee > 0) {
            lineItems.push({
                name: `Late Fee: ${player.playerName}`,
                quantity: '1',
                basePriceMoney: {
                    amount: BigInt(Math.round(player.lateFee * 100)),
                    currency: 'USD',
                },
            });
        }

        // Line item for USCF membership if applicable
        if (player.uscfAction) {
            lineItems.push({
                name: `USCF Membership: ${player.playerName}`,
                quantity: '1',
                basePriceMoney: {
                    amount: BigInt(Math.round(input.uscfFee * 100)),
                    currency: 'USD',
                },
            });
        }
      });

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

      // Create an Invoice from the Order
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Invoice due in 7 days
      const formattedEventDate = format(new Date(input.eventDate), 'MM/dd/yyyy');

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
          title: `${input.teamCode} @ ${formattedEventDate} ${input.eventName}`,
          description: `Thank you for your registration.`,
        }
      });
      
      const invoice = createInvoiceResponse.result.invoice!;
      console.log("Successfully created DRAFT invoice:", invoice);

      // Publish the invoice to make it active and get a public URL
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
        console.error('Square API Error in createInvoiceFlow:', JSON.stringify(error.result, null, 2));
        let errorMessage: string;
        if (error.result.errors && error.result.errors.length > 0) {
            const firstError = error.result.errors[0];
            errorMessage = firstError.detail || `Category: ${firstError.category}, Code: ${firstError.code}`;
        } else {
            errorMessage = JSON.stringify(error.result);
        }
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice creation:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice creation.');
      }
    }
  }
);
