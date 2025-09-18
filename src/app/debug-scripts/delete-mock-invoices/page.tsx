
'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from 'lucide-react';
import { OrganizerGuard } from '@/components/auth-guard';

function DeleteMockInvoicesPage() {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleDeleteMocks = async () => {
    if (!confirm('Are you sure you want to permanently delete all mock invoices? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setResults([]);
    const log = (message: string) => setResults(prev => [...prev, message]);

    if (!db) {
      log('❌ Error: Firestore is not available.');
      setIsDeleting(false);
      return;
    }

    log('Starting deletion of mock invoices...');

    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, where('invoiceNumber', '==', 'MOCK_INV'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        log('✅ No mock invoices found to delete.');
        toast({ title: 'All Clean!', description: 'No mock invoices were found in the database.' });
        setIsDeleting(false);
        return;
      }

      const batch = writeBatch(db);
      querySnapshot.forEach(doc => {
        log(`🔥 Deleting mock invoice with ID: ${doc.id}`);
        batch.delete(doc.ref);
      });

      await batch.commit();

      const deleteCount = querySnapshot.size;
      log(`✅ Successfully deleted ${deleteCount} mock invoice(s).`);
      toast({
        title: 'Cleanup Complete',
        description: `Permanently deleted ${deleteCount} mock invoice(s).`,
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
      <div className="space-y-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Delete Mock Invoices</CardTitle>
            <CardDescription>
              This tool will find and permanently delete all invoice records where the `invoiceNumber` is "MOCK_INV".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDeleteMocks} disabled={isDeleting} variant="destructive">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete All Mock Invoices
            </Button>
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

export default function GuardedDeleteMockInvoicesPage() {
    return (
        <OrganizerGuard>
            <DeleteMockInvoicesPage />
        </OrganizerGuard>
    )
}
