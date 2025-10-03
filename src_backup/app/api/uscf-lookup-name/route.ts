// app/api/uscf-lookup-name/route.ts
import { NextRequest, NextResponse } from 'next/server';

const USCF_SERVICE_URL = process.env.USCF_SERVICE_URL;

export async function POST(request: NextRequest) {
  if (!USCF_SERVICE_URL) {
    console.error('USCF_SERVICE_URL is not defined in environment variables.');
    return NextResponse.json({ error: 'Service is not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    
    const firstName = body.firstName?.trim() || '';
    const lastName = body.lastName?.trim() || '';
    
    if (!firstName && !lastName) {
      return NextResponse.json(
        { error: 'Please enter at least a first name or last name' }, 
        { status: 400 }
      );
    }

    const response = await fetch(`${USCF_SERVICE_URL}/uscf-lookup-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        first_name: firstName, 
        last_name: lastName 
      }),
    });

    if (!response.ok) {
      // It's better to return the error from the service if possible
      const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const players = await response.json();
    return NextResponse.json(players);

  } catch (error) {
    console.error('USCF name lookup error:', error);
    return NextResponse.json(
      { error: 'Service unavailable' }, 
      { status: 503 }
    );
  }
}
