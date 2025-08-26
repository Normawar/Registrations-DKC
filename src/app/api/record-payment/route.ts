import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, amount } = await request.json();
    
    // First get current invoice
    const getResponse = await fetch(`https://connect.squareupsandbox.com/v2/invoices/${invoiceId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_SANDBOX_TOKEN}`,
        'Square-Version': '2025-07-16'
      }
    });
    
    const invoiceData = await getResponse.json();
    const invoice = invoiceData.invoice;
    
    // Update payment requests to show completed amount
    const updatedPaymentRequests = invoice.payment_requests.map(pr => ({
      ...pr,
      total_completed_amount_money: {
        amount: Math.round(amount * 100),
        currency: 'USD'
      }
    }));
    
    // Update the invoice
    const updateResponse = await fetch(`https://connect.squareupsandbox.com/v2/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_SANDBOX_TOKEN}`,
        'Square-Version': '2025-07-16',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice: {
          version: invoice.version,
          payment_requests: updatedPaymentRequests
        }
      })
    });
    
    return NextResponse.json(await updateResponse.json());
  } catch (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
