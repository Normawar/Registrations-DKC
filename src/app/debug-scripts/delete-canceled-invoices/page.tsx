
'use client';

import { useState } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

// Invoice tokens extracted from the provided CSV data
const invoiceTokensToDelete = [
  "inv:0-ChBL5kS7M_QOXReaRrBzEhDkEJ8I",
  "inv:0-ChAn7iUtCfPpjCRGA9NEEaE9EJ8I",
  "inv:0-ChBdDmnPzwd4w1bnyDo6_TiqEJ8I",
  "inv:0-ChBNQswPcqy73RC1UKsvtOzjEJ8I",
  "inv:0-ChCWUBF_yvdJJNj1hxBeOQwjEJ8I",
  "inv:0-ChCmSldsxygecLHLDtuGWraXEJ8I",
  "inv:0-ChAFLjzZWmlmp8hjFZN77oS-EJ8I",
  "inv:0-ChBMhCueCIThav0cbt_OhdfvEJ8I",
  "inv:0-ChAx46Cd3v8CDBwV5WipTYoxEJ8I",
  "inv:0-ChBNzNLwVIafEnQHyBW6urc6EJ8I",
  "inv:0-ChDjAuarf29_ABRKzwxUMhNKEJ8I",
  "inv:0-ChDbtFx7XB6uPbljDTsBhPpKEJ8I",
  "inv:0-ChAbAKBTV4k0kR9WFsPCz23zEJ8I",
  "inv:0-ChCLmFIAGn3Q2V-_Pq6Uz7kWEJ8I",
  "inv:0-ChBXyriwnTT2ohfVi9b_f4LTEJ8I",
  "inv:0-ChCEPIUn994obbc2yJ28pAaQEJ8I",
  "inv:0-ChAnua_nrcfoB-yvyboKv0pkEJ8I",
  "inv:0-ChDRrbPymV6OCLjCiMTnORVXEJ8I",
  "inv:0-ChAS3u8nnB79Rl3oZB7guNwHEJ8I",
  "inv:0-ChAcStXD_rvWXuAkEliCK6TxEJ8I",
  "inv:0-ChDyOe3zLqGkk5cSHJ-YvHx-EJ8I",
  "inv:0-ChCgK5Y3mvcu6ayjJ-19nloqEJ8I",
  "inv:0-ChCEklAlu81M0RTH18XuVZaWEJ8I",
  "inv:0-ChABftRP3ANaSAbFxOhFHe1PEJ8I",
  "inv:0-ChDQLHUvzOpAoD3bsGx7FqR9EJ8I"
];


function DeleteCanceledInvoicesPage() {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleDeleteInvoices = async () => {
    setIsDeleting(true);
    setResults([]);
    const log = (message: string) => setResults(prev => [...prev, message]);

    if (!db) {
      log('❌ Error: Firestore is not available.');
      setIsDeleting(false);
      return;
    }

    log(`🚀 Starting deletion of ${invoiceTokensToDelete.length} invoices...`);

    try {
      const invoicesRef = collection(db, 'invoices');
      const batch = writeBatch(db);
      
      invoiceTokensToDelete.forEach(token => {
        const docRef = doc(invoicesRef, token);
        batch.delete(docRef);
        log(`🔥 Queued for deletion: ${token}`);
      });

      await batch.commit();

      log(`\n✅ Successfully deleted ${invoiceTokensToDelete.length} invoice(s) from the database.`);
      toast({
        title: 'Cleanup Complete',
        description: `Permanently deleted ${invoiceTokensToDelete.length} invoice(s).`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      log(`❌ Error during deletion: ${message}`);
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle />
              Delete Specific Canceled Invoices
            </CardTitle>
            <CardDescription>
              This tool will permanently delete a predefined list of {invoiceTokensToDelete.length} canceled invoices from your Firestore database based on the provided CSV file. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isDeleting} variant="destructive">
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Permanently Delete {invoiceTokensToDelete.length} Invoices
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the listed invoices from the database. This action cannot be undone and is irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteInvoices} className="bg-destructive hover:bg-destructive/90">
                    Yes, Delete Invoices
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Invoices to be Deleted</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-64 border rounded-md p-4">
                    <pre className="text-sm">
                        {invoiceTokensToDelete.join('\n')}
                    </pre>
                </ScrollArea>
            </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Deletion Log</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {results.join('\n')}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default function GuardedDeleteCanceledInvoicesPage() {
    return (
        <OrganizerGuard>
            <DeleteCanceledInvoicesPage />
        </OrganizerGuard>
    )
}
