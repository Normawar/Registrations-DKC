
'use client';

import { useState, useTransition } from 'react';
import { AppLayout } from "@/components/app-layout";
import { OrganizerGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { forceDeleteUsersAction } from '@/app/users/actions';

function ForceDeleteUserPage() {
  const { toast } = useToast();
  const [emailsToDelete, setEmailsToDelete] = useState('');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<string[]>([]);

  const handleForceDelete = () => {
    const emails = emailsToDelete.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: 'No Emails Provided', description: 'Please enter at least one email to delete.' });
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${emails.length} user(s)? This will remove their authentication record and Firestore data. This action CANNOT be undone.`)) {
      return;
    }

    startTransition(async () => {
        setResults([]);
        const log = (message: string) => setResults(prev => [...prev, message]);
    
        log(`Starting deletion for ${emails.length} user(s)...`);
    
        const { deleted, failed } = await forceDeleteUsersAction(emails);
    
        deleted.forEach(email => log(`✅ Successfully deleted user: ${email}`));
        failed.forEach(({ email, reason }) => log(`❌ Failed to delete user: ${email}. Reason: ${reason}`));
    
        log(`\n🎉 Deletion process complete.`);
        toast({ title: 'Deletion Complete', description: `Processed ${emails.length} emails. Check log for details.` });
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <Alert variant="destructive">
            <AlertTitle>This tool has been moved!</AlertTitle>
            <AlertDescription>
                The user deletion tool is now integrated directly into the <Link href="/users" className="font-bold underline">User Management</Link> page for easier access. This debug page can be removed.
            </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Force Delete Users (Legacy)</CardTitle>
            <CardDescription>
              Permanently delete user accounts from Firebase Authentication and the Firestore database. Enter a list of emails separated by commas, spaces, or new lines.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="user1@example.com, user2@example.com"
              value={emailsToDelete}
              onChange={(e) => setEmailsToDelete(e.target.value)}
              rows={6}
              disabled={isPending}
            />
            <Button onClick={handleForceDelete} disabled={isPending} variant="destructive">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
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
