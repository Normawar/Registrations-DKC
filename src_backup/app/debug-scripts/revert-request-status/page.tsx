
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function RevertRequestStatusPage() {
  const [log, setLog] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const runScript = async () => {
    setIsProcessing(true);
    setLog(prev => [...prev, 'Starting script...']);

    if (!db) {
      setLog(prev => [...prev, 'Error: Firestore is not initialized.']);
      setIsProcessing(false);
      return;
    }

    try {
      const requestsRef = collection(db, 'requests');
      // Query for requests that might be stuck
      const q = query(requestsRef, where('status', '==', 'Approved'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLog(prev => [...prev, 'No "Approved" requests found to check.']);
        setIsProcessing(false);
        return;
      }
      
      let revertedCount = 0;
      for (const requestDoc of querySnapshot.docs) {
        const requestData = requestDoc.data();
        // This is where you define the logic to find "stuck" requests.
        // For Josue's issue, we assume the invoice recreation might have failed,
        // so we check if a *new* invoice was actually created.
        // This is a heuristic and might need adjustment.
        // A simpler approach for a one-time fix is to revert a specific ID.
        // Let's revert Josue's request specifically.
        
        // Let's assume Josue's request had the player name 'Josue'
        // This is a placeholder. In a real scenario, we'd use a more specific identifier
        // if we had one (like the request ID).
        if (requestData.player.includes('Josue')) { // Find Josue's request
          setLog(prev => [...prev, `Found potential stuck request for ${requestData.player} (ID: ${requestDoc.id}).`]);
          
          await updateDoc(doc(db, 'requests', requestDoc.id), {
            status: 'Pending',
            approvedBy: null,
            approvedAt: null,
          });

          setLog(prev => [...prev, `✅ SUCCESS: Reverted request ${requestDoc.id} to "Pending".`]);
          revertedCount++;
        }
      }
      
      if (revertedCount === 0) {
        setLog(prev => [...prev, 'No requests matching the criteria were found to revert.']);
      }

      setLog(prev => [...prev, 'Script finished.']);

    } catch (error) {
      console.error('Error running revert script:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setLog(prev => [...prev, `❌ ERROR: ${errorMessage}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Revert Request Status Tool</h1>
          <p className="text-muted-foreground mt-2">
            A one-time tool to fix change requests that are stuck in an "Approved" state without being fully processed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Fix Script</CardTitle>
            <CardDescription>
              Click the button below to find requests for players named 'Josue' that are marked as 'Approved' and revert their status to 'Pending'. This will allow you to re-process them correctly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runScript} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Find & Revert Stuck "Josue" Request(s)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Log</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {log.length > 0 ? log.join('\n') : 'No actions taken yet. Click the button to start.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
