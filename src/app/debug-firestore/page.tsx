'use client';

import { useEffect } from 'react';
import { db } from '@/lib/services/firestore-service';
import { collection, doc, getDocs } from 'firebase/firestore';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function DebugFirestorePage() {

  useEffect(() => {
    if (!db) {
      console.log("Firestore not initialized, skipping debug script.");
      return;
    }

    console.log("--- Running Firestore Subcollection Debug Script ---");

    // Test one specific event
    (async () => {
      const eventId = 'evt-1757125186611-0.05756934987789575'; // Use any event ID from your list
      console.log(`🔍 Checking subcollections for event ID: ${eventId}`);
      const eventRef = doc(db, 'events', eventId);
      
      const subCollections = ['confirmations', 'registrations', 'invoices', 'sponsors', 'players'];
      
      for (const subName of subCollections) {
        try {
          const subCol = collection(eventRef, subName);
          const snapshot = await getDocs(subCol);
          
          if (!snapshot.empty) {
            console.log(`✅ Found ${subName}:`, snapshot.size, 'documents');
            console.log('Sample document:', snapshot.docs[0]?.data());
          } else {
            console.log(`❌ No ${subName} subcollection found for this event.`);
          }
        } catch (e: any) {
          console.log(`❌ Error accessing ${subName}:`, e.message);
        }
      }
       console.log("--- Debug Script Finished ---");
    })();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Firestore Debug Page</h1>
          <p className="text-muted-foreground">
            This page runs a script to check your database structure.
          </p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Check Your Console</CardTitle>
                <CardDescription>
                    The debug script runs automatically when this page loads. Open your browser's developer console (usually with F12) to see the output.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p>The script is checking for subcollections under the event with ID: <strong>evt-1757125186611-0.05756934987789575</strong></p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
