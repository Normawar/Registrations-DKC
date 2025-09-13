'use client';

import { useState } from 'react';
import { collection, getDocs, writeBatch, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FixRequestIdsPage() {
  const { toast } = useToast();
  const [log, setLog] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [invalidRequests, setInvalidRequests] = useState<any[]>([]);

  // Mapping from the invalid confirmationId to the correct user-facing invoiceNumber
  const invalidIdToInvoiceNumberMap: Record<string, string> = {
    'inv:0-ChDxVsUuK-JVya_ZzZUpon1gEJ8I': '4301',
    // The rest are for canceled invoices and will be deleted
    'inv:0-ChBMhCueCIThav0cbt_OhdfvEJ8I': 'CANCELED',
    'inv:0-ChBNQswPcqy73RC1UKsvtOzjEJ8I': 'CANCELED',
  };

  const runFixScript = async () => {
    setIsProcessing(true);
    setLog(['Starting targeted data fix...']);

    if (!db) {
      const errorMsg = 'Error: Firestore is not initialized.';
      setLog(prev => [...prev, errorMsg]);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
      setIsProcessing(false);
      return;
    }

    try {
      setLog(prev => [...prev, 'Fetching all requests and invoices...']);
      const requestsRef = collection(db, 'requests');
      const invoicesRef = collection(db, 'invoices');
      const [requestsSnapshot, invoicesSnapshot] = await Promise.all([getDocs(requestsRef), getDocs(invoicesRef)]);
      
      const allRequests = requestsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const invoiceNumberToIdMap = new Map(invoicesSnapshot.docs.map(d => [d.data().invoiceNumber, d.id]));

      setLog(prev => [...prev, `Found ${allRequests.length} requests and ${invoicesSnapshot.size} invoices.`]);

      const batch = writeBatch(db);
      let fixesMade = 0;
      let deletionsMade = 0;

      for (const req of allRequests) {
        if (req.confirmationId && req.confirmationId.startsWith('inv:0-')) {
          const targetInvoiceNumber = invalidIdToInvoiceNumberMap[req.confirmationId];

          if (targetInvoiceNumber && targetInvoiceNumber !== 'CANCELED') {
            const correctInvoiceId = invoiceNumberToIdMap.get(targetInvoiceNumber);
            if (correctInvoiceId) {
              const requestRef = doc(db, 'requests', req.id);
              batch.update(requestRef, { confirmationId: correctInvoiceId });
              fixesMade++;
              setLog(prev => [...prev, `✅ [FIXED] Request ${req.id} confirmationId updated to ${correctInvoiceId} (for Invoice #${targetInvoiceNumber})`]);
            } else {
              setLog(prev => [...prev, `❌ [ERROR] Request ${req.id} targets Invoice #${targetInvoiceNumber}, but that invoice was not found.`]);
            }
          } else {
            // This is an invalid request for a canceled invoice, so we delete it.
            const requestRef = doc(db, 'requests', req.id);
            batch.delete(requestRef);
            deletionsMade++;
            setLog(prev => [...prev, `🗑️ [DELETED] Invalid request ${req.id} for a canceled invoice.`]);
          }
        }
      }

      if (fixesMade > 0 || deletionsMade > 0) {
        await batch.commit();
        setLog(prev => [...prev, `\n🚀 Batch committed. ${fixesMade} request(s) fixed and ${deletionsMade} request(s) deleted.`]);
        toast({ title: 'Success', description: `Data fix complete. ${fixesMade} fixed, ${deletionsMade} deleted.` });
      } else {
        setLog(prev => [...prev, '✅ No invalid requests found that match the repair map. Your data is clean!']);
        toast({ title: 'Scan Complete', description: 'No matching invalid requests were found.' });
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setLog(prev => [...prev, `❌ FATAL ERROR: ${errorMessage}`]);
        toast({ variant: 'destructive', title: 'Script Failed', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair: Targeted Request Fix</h1>
          <p className="text-muted-foreground mt-2">
            A one-time tool to fix specific change requests with corrupted `confirmationId` values.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Targeted Fix</CardTitle>
            <CardDescription>
              This script will attempt to repair one specific request by mapping it to Invoice #4301 and delete other known invalid requests. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Button onClick={runFixScript} disabled={isProcessing}>
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><Wrench className="mr-2 h-4 w-4" /> Run Fix Script</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repair Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full rounded-md border">
                <pre className="p-4 text-xs whitespace-pre-wrap break-words">
                  {log.length > 0 ? log.join('\n') : 'No actions taken yet. Click the button to start.'}
                </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
