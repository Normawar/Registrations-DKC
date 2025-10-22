'use server';

import { randomUUID } from 'crypto';
import { Client, Environment, ApiError } from 'square';
import { format } from 'date-fns';
import type { CreateMembershipInvoiceInput, CreateMembershipInvoiceOutput } from './schemas';

interface InvoiceRecipient {
  customerId?: string;
  emailAddress?: string;
}

// ✅ Validation helpers
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() ?? '');
const isValidAmount = (amount: number): boolean => typeof amount === 'number' && amount > 0 && isFinite(amount);

export async function createMembershipInvoice(
  input: CreateMembershipInvoiceInput
): Promise<CreateMembershipInvoiceOutput> {
  // Defensive input validation
  if (!isValidEmail(input.purchaserEmail)) throw new Error('Valid purchaser email is required');
  if (!isValidAmount(input.fee)) throw new Error('Membership fee must be a valid positive number');

  if (input.membershipType.toLowerCase().includes('error') || input.membershipType.toLowerCase().includes('invalid')) {
    throw new Error(`Invalid membership type: "${input.membershipType}"`);
  }

  // Instantiate Square client inside server action
  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
    environment: Environment.Production,
  });
  const { customersApi, ordersApi, invoicesApi } = squareClient;
  const locationId = 'CTED7GVSVH5H8';

  try {
    // Search or create customer (no phone number sent)
    const companyName = input.district ? `${input.schoolName} / ${input.district}` : input.schoolName;
    let customerId: string;

    const searchRes = await customersApi.searchCustomers({
      query: { filter: { emailAddress: { exact: input.purchaserEmail } } }
    });

    if (searchRes.result.customers?.length) {
      customerId = searchRes.result.customers[0].id!;
      await customersApi.updateCustomer(customerId, {
        companyName,
        address: { addressLine1: input.schoolAddress }
      });
    } else {
      const [firstName, ...lastNameParts] = input.purchaserName.split(' ');
      const createRes = await customersApi.createCustomer({
        idempotencyKey: randomUUID(),
        givenName: firstName,
        familyName: lastNameParts.join(' '),
        emailAddress: input.purchaserEmail,
        companyName,
        address: { addressLine1: input.schoolAddress }
      });
      customerId = createRes.result.customer!.id!;
    }

    // Create order
    const lineItems = input.players.map(player => {
      const name = `${player.firstName} ${player.middleName || ''} ${player.lastName}`.replace(/\s+/g, ' ').trim();
      const noteParts = [
        `Email: ${player.email}`,
        `DOB: ${format(new Date(player.dob), 'MM/dd/yyyy')}`,
        `ZIP: ${player.zipCode}`
      ];
      return {
        name: `USCF Membership (${input.membershipType}) for ${name}`,
        quantity: '1',
        basePriceMoney: { amount: BigInt(Math.round(input.fee * 100)), currency: 'USD' },
        note: noteParts.join(' | ')
      };
    });

    const orderRes = await ordersApi.createOrder({
      idempotencyKey: randomUUID(),
      order: { locationId, customerId, lineItems }
    });
    const orderId = orderRes.result.order!.id!;

    // Create invoice
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const title = input.players.length > 1
      ? `USCF Membership for ${input.players.length} players`
      : `USCF Membership for ${input.players[0].firstName} ${input.players[0].lastName}`;

    const ccRecipients: InvoiceRecipient[] = [];
    if (input.bookkeeperEmail?.trim()) ccRecipients.push({ emailAddress: input.bookkeeperEmail });
    if (input.gtCoordinatorEmail?.trim()) ccRecipients.push({ emailAddress: input.gtCoordinatorEmail });

    const invoiceRes = await invoicesApi.createInvoice({
      idempotencyKey: randomUUID(),
      invoice: {
        orderId,
        primaryRecipient: { customerId },
        ccRecipients: ccRecipients.length ? ccRecipients : undefined,
        paymentRequests: [{ requestType: 'BALANCE', dueDate: format(dueDate, 'yyyy-MM-dd') }],
        deliveryMethod: 'EMAIL',
        acceptedPaymentMethods: { card: true, squareGiftCard: true, bankAccount: true },
        title,
        description: `Invoice for ${input.membershipType} USCF Membership. Players are not registered for events.`
      }
    });

    const draftInvoice = invoiceRes.result.invoice!;
    await invoicesApi.publishInvoice(draftInvoice.id!, { version: draftInvoice.version!, idempotencyKey: randomUUID() });

    // Wait and fetch final invoice URL
    await new Promise(res => setTimeout(res, 2000));
    const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(draftInvoice.id!);

    if (!finalInvoice?.publicUrl) throw new Error('Failed to retrieve public URL for the invoice.');

    return {
      invoiceId: finalInvoice.id!,
      invoiceNumber: finalInvoice.invoiceNumber,
      status: finalInvoice.status!,
      invoiceUrl: finalInvoice.publicUrl!
    };
  } catch (error: any) {
    if (error instanceof ApiError && error.result?.errors?.length) {
      const msg = error.result.errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
      throw new Error(`Square API Error: ${msg}`);
    }
    throw new Error(error?.message ?? 'Unexpected error during membership invoice creation.');
  }
}
