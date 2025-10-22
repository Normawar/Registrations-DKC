'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AppLayout } from "@/components/app-layout";

const UscfPurchaseClient = dynamic(
  () => import('./UscfPurchaseClient'),
  {
    ssr: false,
    loading: () => <AppLayout><div>Loading...</div></AppLayout>
  }
);

export default function UscfPurchasePage() {
  return (
    <Suspense fallback={<AppLayout><div>Loading...</div></AppLayout>}>
      <UscfPurchaseClient />
    </Suspense>
  );
}
