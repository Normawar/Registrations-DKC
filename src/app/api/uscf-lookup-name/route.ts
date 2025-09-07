import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Allow searching by just first name, last name, or both
    const firstName = body.firstName?.trim() || '';
    const lastName = body.lastName?.trim() || '';
    
    if (!firstName && !lastName) {
      return NextResponse.json(
        { error: 'Please enter at least a first name or last name' }, 
        { status: 400 }
      );
    }

    // Mock data with various name formats - always return these for testing
    const mockPlayers = [
      {
        uscf_id: "32052572",
        name: "MORENO, RYAN",
        rating_regular: 602,
        rating_quick: 605,
        state: "TX",
        expiration_date: "2025-09-30"
      },
      {
        uscf_id: "12345678",
        name: "SMITH, JOHN, DAVID",  // This should show as "JOHN DAVID SMITH"
        rating_regular: 1200,
        rating_quick: 1180,
        state: "CA",
        expiration_date: "2025-12-31"
      },
      {
        uscf_id: "87654321",
        name: "JOHNSON, MARY, ELIZABETH",  // This should show as "MARY ELIZABETH JOHNSON"
        rating_regular: 1350,
        rating_quick: 1320,
        state: "FL",
        expiration_date: "2025-11-15"
      },
      {
        uscf_id: "11223344",
        name: `${lastName.toUpperCase() || 'GARCIA'}, ${firstName.toUpperCase() || 'CARLOS'}, ANTONIO`,
        rating_regular: 1450,
        rating_quick: 1425,
        state: "NY",
        expiration_date: "2025-10-20"
      }
    ];

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json(mockPlayers);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
