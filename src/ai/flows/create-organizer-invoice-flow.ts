
'use server';
/**
 * @fileOverview Creates a general-purpose invoice with the Square API.
 *
 * - createOrganizerInvoice - A function that handles the invoice creation process for organizers.
 * - CreateOrganizerInvoiceInput - The input type for the function.
 * - CreateOrganizerInvoiceInvoiceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError, type InvoiceRecipient, type Address } from 'square';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const LineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  amount: z.number().describe('The cost of the line item in dollars.'),
  note: z.string().optional().describe('Any additional notes for the line item.'),
});

const CreateOrganizerInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the person or entity to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the invoice recipient.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The school associated with this invoice.'),
    schoolAddress: z.string().optional().describe('The address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    invoiceTitle: z.string().describe('The main title for the invoice.'),
    lineItems: z.array(LineItemSchema).min(1).describe('An array of items to be included in the invoice.'),
});
export type CreateOrganizerInvoiceInput = z.infer<typeof CreateOrganizerInvoiceInputSchema>;

const CreateOrganizerInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateOrganizerInvoiceOutput = z.infer<typeof CreateOrganizerInvoiceOutputSchema>;

export async function createOrganizerInvoice(input: CreateOrganizerInvoiceInput): Promise<CreateOrganizerInvoiceOutput> {
  return createOrganizerInvoiceFlow(input);
}

const createOrganizerInvoiceFlow = ai.defineFlow(
  {
    name: 'createOrganizerInvoiceFlow',
    inputSchema: CreateOrganizerInvoiceInputSchema,
    outputSchema: CreateOrganizerInvoiceOutputSchema,
  },
  async (input) => {
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
        console.log("Square not configured. Returning mock invoice for createOrganizerInvoiceFlow.");
        const mockInvoiceId = `MOCK_ORGANIZER_${randomUUID()}`;
        return {
            invoiceId: mockInvoiceId,
            invoiceNumber: mockInvoiceId.substring(0, 8),
            status: 'DRAFT',
            invoiceUrl: `https://mock-invoice.local/#mock-invoice/${mockInvoiceId}`,
        };
    }
    
    const squareClient = await getSquareClient();
    const locationId = await getSquareLocationId();
    const { customersApi, ordersApi, invoicesApi } = squareClient;
    
    console.log("Starting Square organizer invoice creation with input:", input);

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
        const [firstName, ...lastNameParts] = input.sponsorName.split(' ');
        
        const address: Address = {
            addressLine1: input.schoolAddress,
        };
        
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.sponsorEmail,
          companyName: companyName,
          phoneNumber: input.schoolPhone,
          address: address,
          note: `School: ${input.schoolName}`,
        });
        customerId = createCustomerResponse.result.customer!.id!;
        console.log(`Created new customer with ID: ${customerId}`);
      }
      
      // Create an Order from the line items
      const orderLineItems = input.lineItems.map(item => ({
          name: item.name,
          quantity: '1',
          basePriceMoney: {
            amount: BigInt(Math.round(item.amount * 100)),
            currency: 'USD',
          },
          note: item.note,
      }));

      console.log("Creating order with line items:", JSON.stringify(orderLineItems, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
      const createOrderResponse = await ordersApi.createOrder({
        idempotencyKey: randomUUID(),
        order: {
          locationId: locationId,
          customerId: customerId,
          lineItems: orderLineItems,
        },
      });

      const orderId = createOrderResponse.result.order!.id!;
      console.log(`Created order with ID: ${orderId}`);

      // Create an Invoice from the Order
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // Invoice due in 14 days

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
          title: input.invoiceTitle,
          description: `Invoice for ${input.schoolName}. Thank you for your business.`,
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
        console.error('Square API Error in createOrganizerInvoiceFlow:', JSON.stringify(errorResult, null, 2));
        let errorMessage: string;
        if (errors.length > 0) {
            errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        } else {
            errorMessage = JSON.stringify(errorResult);
        }
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during organizer invoice creation:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during organizer invoice creation.');
      }
    }
  }
);

    