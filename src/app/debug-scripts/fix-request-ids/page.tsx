
'use client';

import { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from 'lucide-react';
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

  const findInvalidRequests = async () => {
    setIsProcessing(true);
    setLog(['Starting scan for invalid requests...']);
    setInvalidRequests([]);

    if (!db) {
      const errorMsg = 'Error: Firestore is not initialized.';
      setLog(prev => [...prev, errorMsg]);
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
      setIsProcessing(false);
      return;
    }

    try {
      setLog(prev => [...prev, 'Fetching all requests...']);
      const requestsRef = collection(db, 'requests');
      const requestsSnapshot = await getDocs(requestsRef);
      
      const allRequests = requestsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLog(prev => [...prev, `Found ${allRequests.length} total requests.`]);

      const invalid = allRequests.filter(req => 
        !req.confirmationId || req.confirmationId.startsWith('inv:0-')
      );
      
      setInvalidRequests(invalid);

      if (invalid.length > 0) {
        setLog(prev => [...prev, `[FOUND] ${invalid.length} invalid requests that should be deleted.`]);
        invalid.forEach(req => {
            setLog(prev => [...prev, `  - Request ID: ${req.id}, Invalid confirmationId: ${req.confirmationId}`]);
        });
        toast({ title: `${invalid.length} invalid requests found`, description: 'Proceed to delete them.' });
      } else {
        setLog(prev => [...prev, '✅ No invalid requests found. Your data is clean!']);
        toast({ title: 'Scan Complete', description: 'No invalid requests were found.' });
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setLog(prev => [...prev, `❌ FATAL ERROR: ${errorMessage}`]);
        toast({ variant: 'destructive', title: 'Script Failed', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    setIsAlertOpen(false);
    if (invalidRequests.length === 0) {
        toast({ title: 'No action taken', description: 'No invalid requests to delete.' });
        return;
    }

    setIsProcessing(true);
    setLog(prev => [...prev, 'Deleting invalid requests...']);

    try {
        const batch = writeBatch(db);
        invalidRequests.forEach(req => {
            const requestRef = doc(db, 'requests', req.id);
            batch.delete(requestRef);
            setLog(prev => [...prev, `  - Marked ${req.id} for deletion.`]);
        });

        await batch.commit();

        setLog(prev => [...prev, `✅ Successfully deleted ${invalidRequests.length} requests.`]);
        toast({ title: 'Success', description: `${invalidRequests.length} invalid requests have been deleted.` });
        setInvalidRequests([]); // Clear the list after deletion
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setLog(prev => [...prev, `❌ DELETION FAILED: ${errorMessage}`]);
        toast({ variant: 'destructive', title: 'Deletion Failed', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair: Clean Invalid Requests</h1>
          <p className="text-muted-foreground mt-2">
            A one-time tool to find and permanently delete change requests with corrupted `confirmationId` values.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scan & Delete Invalid Requests</CardTitle>
            <CardDescription>
              First, scan the database to identify corrupted requests. If any are found, you will have the option to delete them. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Button onClick={findInvalidRequests} disabled={isProcessing}>
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</>
              ) : (
                '1. Scan for Invalid Requests'
              )}
            </Button>
            {invalidRequests.length > 0 && (
                <Button variant="destructive" onClick={() => setIsAlertOpen(true)} disabled={isProcessing}>
                    <Trash2 className="mr-2 h-4 w-4"/>
                    2. Delete {invalidRequests.length} Invalid Request(s)
                </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repair Log</CardTitle>
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
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete {invalidRequests.length} change request(s) from the database. This action cannot be undone. These requests will need to be re-submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Them</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
