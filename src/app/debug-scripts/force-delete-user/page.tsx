
'use client';

import { useState } from 'react';
import { AppLayout } from "@/components/app-layout";
import { OrganizerGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Loader2, Trash2 } from 'lucide-react';

function ForceDeleteUserPage() {
  const { toast } = useToast();
  const [emailsToDelete, setEmailsToDelete] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleForceDelete = async () => {
    const emails = emailsToDelete.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: 'No Emails Provided', description: 'Please enter at least one email to delete.' });
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${emails.length} user(s)? This will remove their authentication record and Firestore data. This action cannot be undone.`)) {
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

    log(`Starting deletion for ${emails.length} user(s)...`);

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', 'in', emails));
      const querySnapshot = await getDocs(q);

      const foundEmails = new Set<string>();
      const batch = writeBatch(db);

      querySnapshot.forEach(doc => {
        const userData = doc.data();
        log(`🔥 Deleting Firestore record for ${userData.email} (ID: ${doc.id})`);
        batch.delete(doc.ref);
        foundEmails.add(userData.email.toLowerCase());
      });

      await batch.commit();

      emails.forEach(email => {
        if (!foundEmails.has(email)) {
          log(`⚠️ Warning: No Firestore record found for ${email}. You may need to delete their auth record manually in the Firebase console.`);
        }
      });
      
      log(`✅ Successfully deleted ${foundEmails.size} user records from Firestore.`);
      toast({ title: 'Deletion Complete', description: 'Check the log for details. Note: Auth records must be deleted from the Firebase Console manually.' });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      log(`❌ Error during Firestore deletion: ${message}`);
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
            <CardTitle>Force Delete Users</CardTitle>
            <CardDescription>
              Permanently delete user accounts from the database. Enter a list of emails separated by commas, spaces, or new lines. This tool only removes the Firestore record, not the authentication record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="test1@example.com, test2@example.com"
              value={emailsToDelete}
              onChange={(e) => setEmailsToDelete(e.target.value)}
              rows={6}
              disabled={isDeleting}
            />
            <Button onClick={handleForceDelete} disabled={isDeleting} variant="destructive">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Permanently Delete Users
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

export default function GuardedForceDeleteUserPage() {
    return (
        <OrganizerGuard>
            <ForceDeleteUserPage />
        </OrganizerGuard>
    )
}
