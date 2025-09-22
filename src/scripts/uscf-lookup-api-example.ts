
// This file is an example of what the Next.js API route might look like.
// It was converted from a Python script and shows the intended structure.
// The actual, functional API routes are located in `src/app/api/`.

import { NextRequest, NextResponse } from 'next/server';

// You'll need to implement the Python USCF lookup as a service or convert to Node.js
// For now, this shows the API structure

interface USCFLookupRequest {
  uscfId: string;
}

interface USCFPlayer {
  uscf_id: string;
  name: string;
  rating_regular: number | null;
  rating_quick: number | null;
  state: string | null;
  expiration_date: string | null;
}

// This would call your Python USCF lookup service
async function lookupUSCFPlayerById(uscfId: string): Promise<USCFPlayer | null> {
  try {
    // Option 1: Call Python microservice
    const response = await fetch('http://localhost:8000/uscf-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uscf_id: uscfId }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();

    // Option 2: Direct Python execution (if you have python-shell or similar)
    // const { PythonShell } = require('python-shell');
    // const result = await PythonShell.run('uscf_lookup.py', {
    //   args: [uscfId]
    // });
    // return JSON.parse(result[0]);

  } catch (error) {
    console.error('USCF lookup failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: USCFLookupRequest = await request.json();
    
    if (!body.uscfId) {
      return NextResponse.json(
        { error: 'USCF ID is required' }, 
        { status: 400 }
      );
    }

    // Validate USCF ID format (7-8 digits)
    if (!/^\d{7,8}$/.test(body.uscfId.trim())) {
      return NextResponse.json(
        { error: 'Invalid USCF ID format' }, 
        { status: 400 }
      );
    }

    const player = await lookupUSCFPlayerById(body.uscfId.trim());
    
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(player);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// api/uscf-lookup-name/route.ts - USCF name lookup endpoint
interface USCFNameLookupRequest {
  firstName: string;
  lastName: string;
}

async function lookupUSCFPlayersByName(firstName: string, lastName: string): Promise<USCFPlayer[]> {
  try {
    // Call your Python USCF lookup service
    const response = await fetch('http://localhost:8000/uscf-lookup-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        first_name: firstName, 
        last_name: lastName 
      }),
    });

    if (!response.ok) {
      return [];
    }

    return await response.json();

  } catch (error) {
    console.error('USCF name lookup failed:', error);
    return [];
  }
}

export async function POST_NAME(request: NextRequest) {
  try {
    const body: USCFNameLookupRequest = await request.json();
    
    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: 'Both first name and last name are required' }, 
        { status: 400 }
      );
    }

    const players = await lookupUSCFPlayersByName(
      body.firstName.trim(), 
      body.lastName.trim()
    );

    return NextResponse.json(players);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
