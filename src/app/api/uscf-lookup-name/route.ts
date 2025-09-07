import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.firstName || !body.lastName) {
      return NextResponse.json({ error: 'Both first name and last name are required' }, { status: 400 });
    }

    const response = await fetch('http://localhost:8000/uscf-lookup-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        first_name: body.firstName, 
        last_name: body.lastName 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || 'Failed to lookup players' }, { status: response.status });
    }

    const players = await response.json();
    return NextResponse.json(players);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
