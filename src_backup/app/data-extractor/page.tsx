'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Types for the actual database structure
interface Event {
  id: string;
  name: string;
  date?: string;
  location?: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  uscfId?: string;
  grade?: string;
  school?: string;
  district?: string;
}

interface Invoice {
  id: string;
  eventId: string;
  playerId: string;
  status: string;
  amount?: number;
  createdAt?: any;
}

interface RegistrationData {
  invoice: Invoice;
  player: Player;
  event: Event;
}

export default function DeZavalaTournamentExtractor() {
  const [registrationData, setRegistrationData] = useState<RegistrationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Specific event ID for the 10/04/2025 De Zavala Tournament
  const EVENT_ID = 'evt-1757125186611-0.05756934987789575';

  // Debug Firebase configuration
  useEffect(() => {
    console.log('Firebase Environment Variables:', {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'MISSING',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'MISSING',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'MISSING',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'MISSING'
    });
    console.log('Firebase db instance:', db);
  }, []);

  useEffect(() => {
    async function fetchTournamentData() {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching data for De Zavala Tournament...');
        
        // 1. Get the event details
        const eventDoc = await getDoc(doc(db, 'events', EVENT_ID));
        if (!eventDoc.exists()) {
          throw new Error('Event not found');
        }
        const eventData = { id: eventDoc.id, ...eventDoc.data() } as Event;
        console.log('Event found:', eventData.name);

        // 2. Get all invoices for this event
        const invoicesSnapshot = await getDocs(
          query(collection(db, 'invoices'), where('eventId', '==', EVENT_ID))
        );
        console.log(`Found ${invoicesSnapshot.docs.length} invoices`);

        // 3. Get player data for each invoice
        const registrations: RegistrationData[] = [];
        
        for (const invoiceDoc of invoicesSnapshot.docs) {
          const invoiceData = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;
          
          try {
            // Get player data
            const playerDoc = await getDoc(doc(db, 'players', invoiceData.playerId));
            if (playerDoc.exists()) {
              const playerData = { id: playerDoc.id, ...playerDoc.data() } as Player;
              
              registrations.push({
                invoice: invoiceData,
                player: playerData,
                event: eventData
              });
            } else {
              console.warn(`Player not found for invoice ${invoiceData.id}`);
            }
          } catch (playerError) {
            console.warn(`Error fetching player for invoice ${invoiceData.id}:`, playerError);
          }
        }

        console.log(`Successfully loaded ${registrations.length} registrations`);
        setRegistrationData(registrations);
        
      } catch (error) {
        console.error('Error fetching tournament data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTournamentData();
  }, []);

  // Export function specifically for De Zavala Tournament
  const exportToCSV = (data: RegistrationData[], filename: string) => {
    if (data.length === 0) {
      alert('No registrations to export');
      return;
    }

    // CSV headers for SwissSys tournament format
    const headers = [
      'Player Name',
      'First Name', 
      'Last Name',
      'USCF ID',
      'Grade',
      'School',
      'District',
      'Invoice Status',
      'Amount',
      'Invoice ID'
    ];

    // Convert data to CSV format
    const csvData = data.map(reg => [
      `${reg.player.firstName} ${reg.player.lastName}`,
      reg.player.firstName || '',
      reg.player.lastName || '',
      reg.player.uscfId || '',
      reg.player.grade || '',
      reg.player.school || '',
      reg.player.district || '',
      reg.invoice.status || '',
      reg.invoice.amount || '',
      reg.invoice.id
    ]);

    // Combine headers and data
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`${data.length} registrations exported to ${filename}.csv`);
  };

  const paidRegistrations = registrationData.filter(reg => 
    reg.invoice.status === 'paid' || reg.invoice.status === 'completed'
  );

  const pendingRegistrations = registrationData.filter(reg => 
    reg.invoice.status === 'pending' || reg.invoice.status === 'created'
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">De Zavala Tournament (10/04/2025) - Registration Report</h1>
      
      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <p className="text-lg">Loading tournament registrations...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && (
        <div>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded">
              <h3 className="font-semibold">Total Registrations</h3>
              <p className="text-2xl font-bold">{registrationData.length}</p>
            </div>
            <div className="bg-green-100 p-4 rounded">
              <h3 className="font-semibold">Paid Registrations</h3>
              <p className="text-2xl font-bold">{paidRegistrations.length}</p>
            </div>
            <div className="bg-yellow-100 p-4 rounded">
              <h3 className="font-semibold">Pending Payment</h3>
              <p className="text-2xl font-bold">{pendingRegistrations.length}</p>
            </div>
          </div>
          
          {/* Export Buttons */}
          <div className="mb-6 space-x-4">
            <button
              onClick={() => exportToCSV(registrationData, 'DeZavala_Tournament_All_Registrations')}
              className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 font-medium"
              disabled={registrationData.length === 0}
            >
              Export All Registrations ({registrationData.length})
            </button>
            
            <button
              onClick={() => exportToCSV(paidRegistrations, 'DeZavala_Tournament_Paid_Only')}
              className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 font-medium"
            >
              Export Paid Only ({paidRegistrations.length})
            </button>

            <button
              onClick={() => exportToCSV(pendingRegistrations, 'DeZavala_Tournament_Pending_Payment')}
              className="bg-yellow-500 text-white px-6 py-3 rounded hover:bg-yellow-600 font-medium"
            >
              Export Pending Payment ({pendingRegistrations.length})
            </button>
          </div>

          {/* Data Preview */}
          <div className="border rounded p-4">
            <h3 className="font-medium mb-4 text-lg">Registration Preview:</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left p-3">Player Name</th>
                    <th className="text-left p-3">USCF ID</th>
                    <th className="text-left p-3">Grade</th>
                    <th className="text-left p-3">School</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationData.slice(0, 20).map(reg => (
                    <tr key={reg.invoice.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">
                        {reg.player.firstName} {reg.player.lastName}
                      </td>
                      <td className="p-3">{reg.player.uscfId || 'N/A'}</td>
                      <td className="p-3">{reg.player.grade || 'N/A'}</td>
                      <td className="p-3">{reg.player.school || 'N/A'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          reg.invoice.status === 'paid' || reg.invoice.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {reg.invoice.status}
                        </span>
                      </td>
                      <td className="p-3">${reg.invoice.amount || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {registrationData.length > 20 && (
                <p className="text-gray-500 p-3 text-center">
                  ... and {registrationData.length - 20} more registrations
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="mt-8 p-4 bg-gray-100 rounded text-sm">
        <h3 className="font-medium mb-2">Debug Info:</h3>
        <p>Event ID: {EVENT_ID}</p>
        <p>Total registrations loaded: {registrationData.length}</p>
        <p>Paid registrations: {paidRegistrations.length}</p>
        <p>Pending registrations: {pendingRegistrations.length}</p>
      </div>
    </div>
  );
}
