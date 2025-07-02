
'use client';

import { MasterDbProvider } from '@/context/master-db-context';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MasterDbProvider>
      {children}
    </MasterDbProvider>
  );
}
