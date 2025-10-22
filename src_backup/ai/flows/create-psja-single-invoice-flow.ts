/**
 * PSJA Single Invoice Flow
 * 
 * This flow handles PSJA invoices where all players are the same type
 * (either all GT or all Independent).
 * 
 * ISOLATED: This flow is completely separate from the standard invoice flow
 * to allow independent modifications to PSJA-specific calculations and logic.
 */

'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, Environment } from 'square';
import { randomUUID } from 'crypto';

const CreatePsjaSingleInvoiceInputSchema = z.object({
  sponsorName: z.string(),
  sponsorEmail: z.string().email(),
  schoolName: z.string(),
  district: z.string(),
  eventName: z.string(),
  eventDate: z.string(),
  uscfFee: z.number(),
  players: z.array(z.object({
    playerName: z.string(),
    uscfId: z.string(),
    baseRegistrationFee: z.number(),
    lateFee: z.number().default(0),
    uscfAction: z.boolean().default(false),
    isGtPlayer: z.boolean().default(false),
    section: z.string().optional(),
  })),
  description: z.string().optional(),
});

const CreatePsjaSingleInvoiceOutputSchema = z.object({
  success: z.boolean(),
  invoiceId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  publicUrl: z.string().optional(),
  totalAmount: z.number().optional(),
  message: z.string(),
  playerType: z.enum(['gt', 'independent']),
});

export type CreatePsjaSingleInvoiceInput = z.infer<typeof CreatePsjaSingleInvoiceInputSchema>;
export type CreatePsjaSingleInvoiceOutput = z.infer<typeof CreatePsjaSingleInvoiceOutputSchema>;

const createPsjaSingleInvoiceFlow = ai.defineFlow(
  {
    name: 'createPsjaSingleInvoice',
    inputSchema: CreatePsjaSingleInvoiceInputSchema,
    outputSchema: CreatePsjaSingleInvoiceOutputSchema,
  },
  async (input): Promise<CreatePsjaSingleInvoiceOutput> => {
    console.log('=== PSJA Single Invoice Flow Started ===');
    console.log('District:', input.district);
    console.log('School:', input.schoolName);
    console.log('Players:', input.players.length);
    
    // Determine player type (all should be same)
    const isGtInvoice = input.players.every(p => p.isGtPlayer);
    const playerType = isGtInvoice ? 'gt' : 'independent';
    
    console.log('Invoice Type:', playerType.toUpperCase());

    try {
      // Initialize Square client
      const squareClient = new Client({
        accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
        environment: Environment.Production,
      });

      const { customersApi, invoicesApi } = squareClient;

      // Prepare customer info
      const [firstName, ...lastNameParts] = input.sponsorName.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      const companyName = `${input.schoolName} - ${input.district}`;

      // Create or retrieve customer
      console.log('Creating/retrieving Square customer...');
      const createCustomerResponse = await customersApi.createCustomer({
        idempotencyKey: randomUUID(),
        givenName: firstName,
        familyName: lastName,
        emailAddress: input.sponsorEmail,
        companyName,
        note: `PSJA ${playerType.toUpperCase()} - ${input.eventName}`,
      });

      if (!createCustomerResponse.result.customer) {
        throw new Error('Failed to create customer in Square');
      }

      const customerId = createCustomerResponse.result.customer.id;
      console.log('Customer created:', customerId);

      // Calculate invoice totals
      let subtotal = 0;
      const lineItems: any[] = [];

      for (const player of input.players) {
        // Base registration fee
        const regFeeAmount = Math.round(player.baseRegistrationFee * 100);
        subtotal += regFeeAmount;
        
        lineItems.push({
          name: `${player.playerName} - Registration`,
          quantity: '1',
          basePriceMoney: {
            amount: BigInt(regFeeAmount),
            currency: 'USD',
          },
        });

        // Late fee if applicable
        if (player.lateFee > 0) {
          const lateFeeAmount = Math.round(player.lateFee * 100);
          subtotal += lateFeeAmount;
          
          lineItems.push({
            name: `${player.playerName} - Late Fee`,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(lateFeeAmount),
              currency: 'USD',
            },
          });
        }

        // USCF Fee - Only for Independent players who need it
        if (!isGtInvoice && player.uscfAction) {
          const uscfAmount = Math.round(input.uscfFee * 100);
          subtotal += uscfAmount;
          
          lineItems.push({
            name: `${player.playerName} - USCF Membership`,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(uscfAmount),
              currency: 'USD',
            },
          });
        }
      }

      console.log('Total line items:', lineItems.length);
      console.log('Subtotal:', subtotal / 100);

      // Determine recipient email based on player type
      const recipientEmail = isGtInvoice 
        ? input.sponsorEmail // GT invoices go to GT Coordinator
        : input.sponsorEmail; // Independent invoices go to school sponsor

      // Create invoice description
      const invoiceDescription = input.description || 
        `PSJA ${playerType.toUpperCase()} Registration for ${input.eventName} on ${input.eventDate}`;

      // Create Square invoice
      console.log('Creating Square invoice...');
      const invoicePayload = {
        invoice: {
          locationId: "CTED7GVSVH5H8",
          orderId: randomUUID(),
          primaryRecipient: {
            customerId: customerId,
            emailAddress: recipientEmail,
          },
          paymentRequests: [{
            requestType: 'BALANCE',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            automaticPaymentSource: 'NONE',
          }],
          deliveryMethod: 'EMAIL',
          invoiceNumber: `PSJA-${playerType.toUpperCase()}-${Date.now()}`,
          title: `${input.schoolName} - ${input.eventName}`,
          description: invoiceDescription,
          acceptedPaymentMethods: {
            card: true,
            squareGiftCard: false,
            bankAccount: false,
            buyNowPayLater: false,
            cashAppPay: false,
          },
        },
        idempotencyKey: randomUUID(),
      };

      // Add line items to order
      if (lineItems.length > 0) {
        invoicePayload.invoice.order = {
          locationId: "CTED7GVSVH5H8",
          lineItems: lineItems,
        };
      }

      const createInvoiceResponse = await invoicesApi.createInvoice(invoicePayload);

      if (!createInvoiceResponse.result.invoice) {
        throw new Error('Failed to create invoice in Square');
      }

      const invoice = createInvoiceResponse.result.invoice;
      console.log('Invoice created:', invoice.id);
      console.log('Invoice number:', invoice.invoiceNumber);

      // Publish the invoice
      console.log('Publishing invoice...');
      const publishResponse = await invoicesApi.publishInvoice(invoice.id!, {
        version: invoice.version!,
        idempotencyKey: randomUUID(),
      });

      const publishedInvoice = publishResponse.result.invoice;
      console.log('Invoice published successfully');

      return {
        success: true,
        invoiceId: publishedInvoice?.id,
        invoiceNumber: publishedInvoice?.invoiceNumber,
        publicUrl: publishedInvoice?.publicUrl,
        totalAmount: subtotal / 100,
        message: `PSJA ${playerType.toUpperCase()} invoice created successfully`,
        playerType: playerType,
      };

    } catch (error: any) {
      console.error('Error in PSJA single invoice flow:', error);
      
      return {
        success: false,
        message: `Failed to create PSJA ${playerType} invoice: ${error.message || 'Unknown error'}`,
        playerType: playerType,
      };
    }
  }
);

export async function createPsjaSingleInvoice(
  input: CreatePsjaSingleInvoiceInput
): Promise<CreatePsjaSingleInvoiceOutput> {
  return createPsjaSingleInvoiceFlow(input);
}