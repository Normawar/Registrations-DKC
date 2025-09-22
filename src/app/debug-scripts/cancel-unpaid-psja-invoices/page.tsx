
'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from 'lucide-react';
import { OrganizerGuard } from '@/components/auth-guard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelInvoice } from '@/ai/flows/cancel-invoice-flow';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';

function CancelUnpaidPsjaInvoicesPage() {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [summary, setSummary] = useState({ found: 0, toCancel: 0, canceled: 0, failed: 0 });

  const handleCancelation = async () => {
    setIsProcessing(true);
    setResults([]);
    const log = (message: string) => setResults(prev => [...prev, message]);

    if (!db) {
      log('❌ Error: Firestore is not available.');
      setIsProcessing(false);
      return;
    }
    if (profile?.role !== 'organizer') {
        log('❌ Error: Only organizers can perform this action.');
        setIsProcessing(false);
        return;
    }

    log('🚀 Starting process to cancel all unpaid PSJA invoices...');

    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('district', '==', 'PHARR-SAN JUAN-ALAMO ISD'));
      const querySnapshot = await getDocs(q);

      const psjaInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      log(`🔎 Found ${psjaInvoices.length} total invoices for PSJA district.`);
      
      const unpaidStatuses = ['UNPAID', 'DRAFT', 'PARTIALLY_PAID'];
      const invoicesToCancel = psjaInvoices.filter(inv => unpaidStatuses.includes(inv.status?.toUpperCase()));
      log(`- Found ${invoicesToCancel.length} invoices with an unpaid status.`);
      
      setSummary({ found: psjaInvoices.length, toCancel: invoicesToCancel.length, canceled: 0, failed: 0 });
      
      if (invoicesToCancel.length === 0) {
        log('✅ No unpaid PSJA invoices found to cancel.');
        setIsProcessing(false);
        return;
      }
      
      let canceledCount = 0;
      let failedCount = 0;
      
      for (const invoice of invoicesToCancel) {
        if (!invoice.invoiceId) {
          log(`⚠️ Skipping invoice ${invoice.id} (School: ${invoice.schoolName}) because it has no Square Invoice ID.`);
          // Still mark it as canceled locally
           try {
              const invoiceRef = doc(db, 'invoices', invoice.id);
              await setDoc(invoiceRef, { status: 'CANCELED', invoiceStatus: 'CANCELED' }, { merge: true });
              log(`- Marked local invoice ${invoice.id} as CANCELED.`);
           } catch(e) {
             failedCount++;
             log(`❌ Failed to mark local invoice ${invoice.id} as CANCELED.`);
           }
          continue;
        }

        log(`- Attempting to cancel invoice #${invoice.invoiceNumber} (ID: ${invoice.invoiceId})...`);
        try {
          const result = await cancelInvoice({ invoiceId: invoice.invoiceId, requestingUserRole: 'organizer' });
          
          if (result.status === 'CANCELED' || result.status === 'PAID') { // Treat already paid as a "success" for this purpose
            const invoiceRef = doc(db, 'invoices', invoice.id);
            await setDoc(invoiceRef, { status: result.status, invoiceStatus: result.status }, { merge: true });
            log(`  ✅ Success: Invoice #${invoice.invoiceNumber} status is now ${result.status}.`);
            canceledCount++;
          } else {
             failedCount++;
             log(`  ❌ Failed: Invoice #${invoice.invoiceNumber} could not be canceled. Final status: ${result.status}`);
          }
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
          log(`  ❌ Error canceling invoice #${invoice.invoiceNumber}: ${errorMessage}`);
          if (errorMessage.includes("cannot be canceled")) {
             log(`  -> This invoice might already be paid. Fetching status...`);
             const { result: { invoice: currentInvoice } } = await getDocs(query(invoicesRef, where('invoiceId', '==', invoice.invoiceId)));
             if (currentInvoice) {
                const invoiceRef = doc(db, 'invoices', invoice.id);
                await setDoc(invoiceRef, { status: currentInvoice.status, invoiceStatus: currentInvoice.status }, { merge: true });
                log(`  -> Status updated to ${currentInvoice.status} from Square.`);
             }
          }
        }
        setSummary(prev => ({ ...prev, canceled: canceledCount, failed: failedCount }));
      }

      log(`\n🎉 Process Complete: ${canceledCount} invoices updated, ${failedCount} failures.`);
      toast({ title: 'Process Complete', description: `Canceled ${canceledCount} unpaid invoices.` });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      log(`❌ An unexpected error occurred: ${message}`);
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Cancel All Unpaid PSJA Invoices</CardTitle>
            <CardDescription>
              This tool will find all unpaid invoices for the "PHARR-SAN JUAN-ALAMO ISD" district and cancel them. This action is permanent and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isProcessing} variant="destructive">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Begin Cancellation Process
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel all unpaid PSJA district invoices in both Square and the local database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancelation} className="bg-destructive hover:bg-destructive/90">
                    Yes, Cancel Unpaid Invoices
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Log</CardTitle>
              <CardDescription>
                Found: {summary.found} | To Cancel: {summary.toCancel} | Succeeded: {summary.canceled} | Failed: {summary.failed}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[40vh] whitespace-pre-wrap">
                {results.join('\n')}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default function GuardedCancelPsjaInvoicesPage() {
    return (
        <OrganizerGuard>
            <CancelUnpaidPsjaInvoicesPage />
        </OrganizerGuard>
    )
}
