'use client';

// This page has been deprecated and is no longer in use.
// Its functionality has been replaced by the new comprehensive
// Invoice & Registration Management page located at `/invoices`.
// This file can be safely deleted.

import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function DeprecatedConfirmationsPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Page Deprecated</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This page is no longer in use. Please use the new <Link href="/invoices" className="font-bold underline">Invoice & Registration Management</Link> page to view and manage all registrations.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
