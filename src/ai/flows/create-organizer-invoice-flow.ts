
'use server';
/**
 * @fileOverview Creates a general-purpose invoice with the Square API.
 *
 * - createOrganizerInvoice - A function that handles the invoice creation process for organizers.
 * - CreateOrganizerInvoiceInput - The input type for the function.
 * - CreateOrganizerInvoiceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError } from 'square';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';

const LineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  amount: z.number().describe('The cost of the line item in dollars.'),
  note: z.string().optional().describe('Any additional notes for the line item.'),
});

const CreateOrganizerInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the person or entity to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the invoice recipient.'),
    schoolName: z.string().describe('The school associated with this invoice.'),
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
          title: input.invoiceTitle,
          description: `Invoice for ${input.schoolName}. Thank you for your business.`,
        }
      });
      
      const invoice = createInvoiceResponse.result.invoice!;
      console.log("Successfully created DRAFT invoice:", invoice);

      // Publish the invoice to make it active
      console.log(`Publishing invoice ID: ${invoice.id!}`);
      const { result: { invoice: publishedInvoiceStub } } = await invoicesApi.publishInvoice(invoice.id!, {
        version: invoice.version!,
        idempotencyKey: randomUUID(),
      });
      
      console.log(`Published invoice ID: ${publishedInvoiceStub.id!}. Fetching final details...`);

      // Fetch the final invoice to ensure the publicUrl is available
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(publishedInvoiceStub.id!);
      
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
        console.error('Square API Error in createOrganizerInvoiceFlow:', JSON.stringify(error.result, null, 2));
        let errorMessage: string;
        if (error.result.errors && error.result.errors.length > 0) {
            const firstError = error.result.errors[0];
            errorMessage = firstError.detail || `Category: ${firstError.category}, Code: ${firstError.code}`;
        } else {
            errorMessage = JSON.stringify(error.result);
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
