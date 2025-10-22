import { randomUUID } from 'crypto';
import { Client, Environment } from 'square/legacy';
import { format } from 'date-fns';
import type { CreateMembershipInvoiceInput, CreateMembershipInvoiceOutput } from './schemas';

// Define minimal types for compatibility with legacy Square SDK
interface Address {
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  administrativeDistrictLevel1?: string;
  postalCode?: string;
  country?: string;
}

interface InvoiceRecipient {
  customerId?: string;
  emailAddress?: string;
}

export async function createMembershipInvoice(
  input: CreateMembershipInvoiceInput
): Promise<CreateMembershipInvoiceOutput> {
  if (
    input.membershipType.toLowerCase().includes('error') ||
    input.membershipType.toLowerCase().includes('invalid')
  ) {
    throw new Error(
      `Invalid membership type provided: "${input.membershipType}". Please return to the previous page and get a valid membership suggestion.`
    );
  }

  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
    environment: Environment.Production,
  });
  const locationId = "CTED7GVSVH5H8";
  const { customersApi, ordersApi, invoicesApi } = squareClient;

  try {
    // Search or create customer
    const searchRes = await customersApi.searchCustomers({
      query: { filter: { emailAddress: { exact: input.purchaserEmail } } }
    });

    const companyName = input.district ? `${input.schoolName} / ${input.district}` : input.schoolName;
    let customerId: string;

    if (searchRes.result.customers?.length) {
      const customer = searchRes.result.customers[0];
      customerId = customer.id!;
      await customersApi.updateCustomer(customerId, {
        companyName,
        phoneNumber: input.schoolPhone,
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
        phoneNumber: input.schoolPhone,
        address: { addressLine1: input.schoolAddress }
      });
      customerId = createRes.result.customer!.id!;
    }

    // Create order
    const lineItems = input.players.map(player => {
      const name = `${player.firstName} ${player.middleName || ''} ${player.lastName}`.replace(/\s+/g, ' ').trim();
      const noteParts = [`Email: ${player.email}`, `DOB: ${format(new Date(player.dob), 'MM/dd/yyyy')}`, `ZIP: ${player.zipCode}`];
      if (player.phone) noteParts.push(`Phone: ${player.phone}`);

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
        paymentRequests: [{ requestType: 'BALANCE', dueDate: dueDate.toISOString().split('T')[0] }],
        deliveryMethod: 'EMAIL',
        acceptedPaymentMethods: { card: true, squareGiftCard: true, bankAccount: true },
        title,
        description: `Invoice for ${input.membershipType} USCF Membership. This purchase does not register any players for events.`
      }
    });

    const draftInvoice = invoiceRes.result.invoice!;
    await invoicesApi.publishInvoice(draftInvoice.id!, { version: draftInvoice.version!, idempotencyKey: randomUUID() });

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
    const errors = error?.result?.errors ?? [];
    if (errors.length) {
      const msg = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
      throw new Error(`Square API Error: ${msg}`);
    } else {
      throw new Error(error?.message ?? 'Unexpected error during membership invoice creation.');
    }
  }
}
