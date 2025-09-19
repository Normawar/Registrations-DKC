

'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import { OrganizerGuard } from '@/components/auth-guard';

// This tool is now deprecated and its more powerful replacement is at /debug-scripts/force-delete-user
function DeprecatedCleanupPlayersPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Tool Deprecated</CardTitle>
            <CardDescription>
              This cleanup tool is no longer in use. Please use the "User Management" page for a more reliable way to delete users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>This tool is deprecated.</AlertTitle>
              <AlertDescription>
                A more reliable tool for deleting users is now available on the "User Management" page. This page can be removed.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function GuardedCleanupPage() {
    return (
        <OrganizerGuard>
            <DeprecatedCleanupPlayersPage />
        </OrganizerGuard>
    )
}
