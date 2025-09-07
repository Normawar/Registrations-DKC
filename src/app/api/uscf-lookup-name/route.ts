import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: 'Both first name and last name are required' }, 
        { status: 400 }
      );
    }

    // Mock data with various name formats
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
        name: "SMITH, JOHN, DAVID",  // Example with middle name
        rating_regular: 1200,
        rating_quick: 1180,
        state: "CA",
        expiration_date: "2025-12-31"
      },
      {
        uscf_id: "87654321",
        name: `${body.lastName.toUpperCase()}, ${body.firstName.toUpperCase()}, MICHAEL`,  // User's search + middle name
        rating_regular: 1350,
        rating_quick: 1320,
        state: "FL",
        expiration_date: "2025-11-15"
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
