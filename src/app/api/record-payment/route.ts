import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { amount, paymentMethod, note, organizerInitials } = await request.json();
    
    const amountInCents = Math.round(amount * 100);
    const idempotencyKey = `payment_${Date.now()}_${organizerInitials}_${Math.random().toString(36).substr(2, 9)}`;
    
    const paymentData = {
      source_id: 'CASH',
      idempotency_key: idempotencyKey,
      amount_money: {
        amount: amountInCents,
        currency: 'USD'
      },
      location_id: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
      note: `${note} - Recorded by ${organizerInitials}`
    };
    
    const response = await fetch('https://connect.squareupsandbox.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_SANDBOX_TOKEN}`,
        'Square-Version': '2025-07-16',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData }, { status: response.status });
    }
    
    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
