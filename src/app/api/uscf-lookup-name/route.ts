import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const firstName = body.firstName?.trim().toLowerCase() || '';
    const lastName = body.lastName?.trim().toLowerCase() || '';
    
    if (!firstName && !lastName) {
      return NextResponse.json(
        { error: 'Please enter at least a first name or last name' }, 
        { status: 400 }
      );
    }

    // All possible mock players
    const allMockPlayers = [
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
        name: "SMITH, JOHN, DAVID",
        rating_regular: 1200,
        rating_quick: 1180,
        state: "CA",
        expiration_date: "2025-12-31"
      },
      {
        uscf_id: "87654321",
        name: "JOHNSON, MARY, ELIZABETH",
        rating_regular: 1350,
        rating_quick: 1320,
        state: "FL",
        expiration_date: "2025-11-15"
      },
      {
        uscf_id: "11223344",
        name: "GARCIA, CARLOS, ANTONIO",
        rating_regular: 1450,
        rating_quick: 1425,
        state: "NY",
        expiration_date: "2025-10-20"
      },
      {
        uscf_id: "55667788",
        name: "BROWN, JOHN",
        rating_regular: 1100,
        rating_quick: 1080,
        state: "OH",
        expiration_date: "2025-08-15"
      },
      {
        uscf_id: "99887766",
        name: "WILSON, JOHN, MICHAEL",
        rating_regular: 1600,
        rating_quick: 1580,
        state: "IL",
        expiration_date: "2025-07-30"
      }
    ];

    // Filter players based on search criteria
    const filteredPlayers = allMockPlayers.filter(player => {
      const nameParts = player.name.split(', ');
      const playerLastName = nameParts[0].toLowerCase();
      const playerFirstName = nameParts[1].toLowerCase();
      
      // If both first and last name provided, both must match
      if (firstName && lastName) {
        return playerFirstName.includes(firstName) && playerLastName.includes(lastName);
      }
      
      // If only first name provided
      if (firstName && !lastName) {
        return playerFirstName.includes(firstName);
      }
      
      // If only last name provided
      if (!firstName && lastName) {
        return playerLastName.includes(lastName);
      }
      
      return false;
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json(filteredPlayers);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
