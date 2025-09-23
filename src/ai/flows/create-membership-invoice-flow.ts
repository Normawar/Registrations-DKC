
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
import { ApiError, type InvoiceRecipient, type Address } from 'square';
import { format } from 'date-fns';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';

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
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The name of the school associated with the purchaser.'),
    schoolAddress: z.string().optional().describe('The address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
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

      const companyName = input.district ? `${input.schoolName} / ${input.district}` : input.schoolName;

      let customerId: string;
      if (searchCustomersResponse.result.customers && searchCustomersResponse.result.customers.length > 0) {
        const customer = searchCustomersResponse.result.customers[0];
        customerId = customer.id!;
        console.log(`Found existing customer with ID: ${customerId}`);
        
        const address: Address = {
            addressLine1: input.schoolAddress,
        };

        console.log(`Updating customer ${customerId} with company name: ${companyName}`);
        await customersApi.updateCustomer(customerId, {
            companyName: companyName,
            phoneNumber: input.schoolPhone,
            address: address,
        });

      } else {
        console.log("Customer not found, creating a new one...");
        const [firstName, ...lastNameParts] = input.purchaserName.split(' ');
        
        const address: Address = {
            addressLine1: input.schoolAddress,
        };

        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.purchaserEmail,
          companyName: companyName,
          phoneNumber: input.schoolPhone,
          address: address,
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

      const ccRecipients: InvoiceRecipient[] = [];
      if (input.bookkeeperEmail && input.bookkeeperEmail.trim() !== '') {
          ccRecipients.push({ emailAddress: input.bookkeeperEmail });
      }
      if (input.gtCoordinatorEmail && input.gtCoordinatorEmail.trim() !== '') {
          ccRecipients.push({ emailAddress: input.gtCoordinatorEmail });
      }

      console.log(`Creating invoice for order ID: ${orderId}`);
      const createInvoiceResponse = await invoicesApi.createInvoice({
        idempotencyKey: randomUUID(),
        invoice: {
          orderId: orderId,
          primaryRecipient: {
            customerId: customerId,
          },
          ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
          paymentRequests: [{
            requestType: 'BALANCE',
            dueDate: dueDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
          }],
          deliveryMethod: 'EMAIL',
          acceptedPaymentMethods: {
            card: true,
            squareGiftCard: true,
            bankAccount: true, // For ACH payments
          },
          title: title,
          description: `Invoice for ${input.membershipType} USCF Membership. This purchase does not register any players for events.`,
        }
      });
      
      const draftInvoice = createInvoiceResponse.result.invoice!;
      console.log("Successfully created DRAFT invoice:", draftInvoice);

      // Publish the invoice to make it active
      console.log(`Publishing invoice ID: ${draftInvoice.id!}`);
      await invoicesApi.publishInvoice(draftInvoice.id!, {
        version: draftInvoice.version!,
        idempotencyKey: randomUUID(),
      });
      
      // Fetch the final invoice to ensure the publicUrl is available and stable
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(draftInvoice.id!);
      
      console.log("Successfully retrieved final invoice:", finalInvoice);

      if (!finalInvoice || !finalInvoice.publicUrl) {
          console.error("Final invoice is missing a publicUrl.");
          throw new Error("Failed to retrieve public URL for the invoice after publishing.");
      }

      return {
        invoiceId: finalInvoice.id!,
        invoiceNumber: finalInvoice.invoiceNumber,
        status: finalInvoice.status!,
        invoiceUrl: finalInvoice.publicUrl!,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        const errorResult = error.result || {};
        const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
        console.error('Square API Error in createMembershipInvoiceFlow:', JSON.stringify(errorResult, null, 2));
        let errorMessage: string;
        if (errors.length > 0) {
            errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        } else {
            errorMessage = JSON.stringify(errorResult);
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
