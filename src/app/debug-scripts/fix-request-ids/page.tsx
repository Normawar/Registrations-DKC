
'use client';

import { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FixRequestIdsPage() {
  const { toast } = useToast();
  const [log, setLog] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, checked: 0, fixed: 0, failed: 0 });

  const runFixScript = async () => {
    setIsProcessing(true);
    setLog(['Starting script...']);
    setStats({ total: 0, checked: 0, fixed: 0, failed: 0 });

    if (!db) {
      const errorMsg = 'Error: Firestore is not initialized.';
      setLog(prev => [...prev, errorMsg]);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Fetch all requests and all invoices
      setLog(prev => [...prev, 'Fetching all requests and invoices. This may take a moment...']);
      const requestsRef = collection(db, 'requests');
      const invoicesRef = collection(db, 'invoices');
      const [requestsSnapshot, invoicesSnapshot] = await Promise.all([
        getDocs(requestsRef),
        getDocs(invoicesRef),
      ]);
      
      const allRequests = requestsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const allInvoices = invoicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStats(prev => ({ ...prev, total: allRequests.length }));
      setLog(prev => [...prev, `Found ${allRequests.length} requests and ${allInvoices.length} invoices.`]);

      // 2. Create a map of invoiceNumber -> correct document ID
      const invoiceNumberToIdMap = new Map<string, string>();
      allInvoices.forEach(inv => {
        if (inv.invoiceNumber) {
          invoiceNumberToIdMap.set(inv.invoiceNumber, inv.id);
        }
      });
      setLog(prev => [...prev, 'Created a map of invoice numbers to their correct IDs.']);

      // 3. Identify requests that need fixing and prepare updates
      const batch = writeBatch(db);
      let fixedCount = 0;
      let checkedCount = 0;
      let failedCount = 0;

      for (const request of allRequests) {
        checkedCount++;
        // Check for the invalid format or if the ID doesn't exist in the invoices map
        const isInvalidFormat = request.confirmationId && request.confirmationId.startsWith('inv:0-');
        const idNotInInvoices = request.confirmationId && !allInvoices.some(inv => inv.id === request.confirmationId);

        if (isInvalidFormat || idNotInInvoices) {
          setLog(prev => [...prev, `[Checking] Request ${request.id} has invalid confirmationId: ${request.confirmationId}`]);

          // Attempt to find the correct invoice using the request's invoiceNumber
          const correctInvoiceId = invoiceNumberToIdMap.get(request.invoiceNumber);
          
          if (correctInvoiceId) {
            setLog(prev => [...prev, `  ✅ Found match! Correct ID is ${correctInvoiceId}. Scheduling update.`]);
            const requestRef = doc(db, 'requests', request.id);
            batch.update(requestRef, { confirmationId: correctInvoiceId });
            fixedCount++;
          } else {
            setLog(prev => [...prev, `  ❌ FAILED to find a matching invoice for request ${request.id} (Invoice #: ${request.invoiceNumber}).`]);
            failedCount++;
          }
        }
        setStats(prev => ({ ...prev, checked: checkedCount, fixed: fixedCount, failed: failedCount }));
      }

      // 4. Commit the batch if there are changes
      if (fixedCount > 0) {
        setLog(prev => [...prev, `Committing ${fixedCount} updates to the database...`]);
        await batch.commit();
        setLog(prev => [...prev, 'Database updated successfully.']);
        toast({ title: 'Success', description: `Successfully fixed ${fixedCount} request confirmation IDs.` });
      } else {
        setLog(prev => [...prev, 'No requests needed fixing.']);
        toast({ title: 'No action needed', description: 'All request confirmation IDs appear to be correct.' });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setLog(prev => [...prev, `❌ FATAL ERROR: ${errorMessage}`]);
      toast({ variant: 'destructive', title: 'Script Failed', description: errorMessage });
    } finally {
      setIsProcessing(false);
      setLog(prev => [...prev, 'Script finished.']);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair: Fix Request IDs</h1>
          <p className="text-muted-foreground mt-2">
            A one-time tool to find and correct invalid `confirmationId` values in the change requests collection.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Fix Script</CardTitle>
            <CardDescription>
              Click the button below to scan all change requests. The script will attempt to match them to the correct invoice using the invoice number and then update the record with the proper ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runFixScript} disabled={isProcessing}>
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                'Find & Fix Invalid Request IDs'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repair Log</CardTitle>
            <CardDescription>
                Checked: {stats.checked}/{stats.total} | <span className="text-green-600 font-semibold">Fixed: {stats.fixed}</span> | <span className="text-red-600 font-semibold">Failed to Find: {stats.failed}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full rounded-md border">
                <pre className="p-4 text-xs whitespace-pre-wrap break-words">
                  {log.length > 1 ? log.join('\n') : 'No actions taken yet. Click the button to start.'}
                </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
