
'use client';

import { MasterDbProvider } from '@/context/master-db-context';
import { AuthProvider } from '@/components/auth-provider';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MasterDbProvider>
        {children}
      </MasterDbProvider>
    </AuthProvider>
  );
}
