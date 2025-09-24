'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters'; // Import the new global component

function RosterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthGuard>
        <AppLayout>
          <PlayerRosters />
        </AppLayout>
      </AuthGuard>
    </Suspense>
  );
}

export default RosterPage;
