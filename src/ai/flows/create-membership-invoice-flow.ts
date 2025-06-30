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
import { ApiError } from 'square';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';
import { format } from 'date-fns';

const PlayerInfoSchema = z.object({
  firstName: z.string().describe('The first name of the player.'),
  middleName: z.string().optional().describe('The middle name of the player.'),
  lastName: z.string().describe('The last name of the player.'),
  email: z.string().email().describe('The email of the player.'),
  phone: z.string().optional().describe('The phone number of the player.'),
  dob: z.string().describe("The player's date of birth in ISO 8601 format."),
  zipCode: z.string().describe("The player's zip code."),
});

const CreateMembershipInvoiceInputSchema = z.object({
    purchaserName: z.string().describe('The name of the person paying for the membership.'),
    purchaserEmail: z.string().email().describe('The email of the person paying for the membership.'),
    schoolName: z.string().describe('The name of the school associated with the purchaser.'),
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
    if (input.membershipType.toLowerCase().includes('error') || input.membershipType.toLowerCase().includes('invalid')) {
        throw new Error(`Invalid membership type provided: "${input.membershipType}". Please return to the previous page and get a valid membership suggestion.`);
    }

    const squareClient = await getSquareClient();
    const locationId = await getSquareLocationId();
    const { customersApi, ordersApi, invoicesApi } = squareClient;

    console.log("Starting Square membership invoice creation with input:", input);

    try {
      // Find or create a customer
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
        const [firstName, ...lastNameParts] = input.purchaserName.split(' ');
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.purchaserEmail,
          companyName: input.schoolName,
        });
        customerId = createCustomerResponse.result.customer!.id!;
        console.log(`Created new customer with ID: ${customerId}`);
      }
      
      // Create an Order
      const lineItems = input.players.map(player => {
        const playerName = `${player.firstName} ${player.middleName || ''} ${player.lastName}`.replace(/\s+/g, ' ').trim();
        
        const noteParts = [
            `Email: ${player.email}`,
            `DOB: ${format(new Date(player.dob), 'MM/dd/yyyy')}`,
            `ZIP: ${player.zipCode}`,
        ];
        if (player.phone) {
            noteParts.push(`Phone: ${player.phone}`);
        }

        return {
          name: `USCF Membership (${input.membershipType}) for ${playerName}`,
          quantity: '1',
          basePriceMoney: {
            amount: BigInt(Math.round(input.fee * 100)),
            currency: 'USD',
          },
          note: noteParts.join(' | '),
        };
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

      const firstPlayerName = `${input.players[0].firstName} ${input.players[0].middleName || ''} ${input.players[0].lastName}`.replace(/\s+/g, ' ').trim();
      const title = input.players.length > 1
        ? `USCF Membership for ${input.players.length} players`
        : `USCF Membership for ${firstPlayerName}`;

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
        console.error('Square API Error in createMembershipInvoiceFlow:', JSON.stringify(error.result, null, 2));
        let errorMessage: string;
        if (error.result.errors && error.result.errors.length > 0) {
            const firstError = error.result.errors[0];
            errorMessage = firstError.detail || `Category: ${firstError.category}, Code: ${firstError.code}`;
        } else {
            errorMessage = JSON.stringify(error.result);
        }
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during membership invoice creation:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during membership invoice creation.');
      }
    }
  }
);
