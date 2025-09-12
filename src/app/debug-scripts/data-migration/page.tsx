
'use client';

// This page has been deprecated and its functionality is replaced by
// the new AI-powered invoice uploader at `/debug-scripts/data-repair`.
// This file can be safely deleted in the future.

import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DeprecatedDataMigrationPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Tool Deprecated</h1>
          <p className="text-muted-foreground mt-2">
            This manual data migration tool is no longer in use.
          </p>
        </div>

        <Card className="border-amber-500">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <CardTitle>This tool has been replaced.</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p>
                    This page was used for a one-time data migration. It has been superseded by the new <Link href="/debug-scripts/data-repair" className="font-semibold text-primary underline">Automated Invoice Uploader</Link>.
                </p>
                <p className="mt-2">
                    Please use the new tool to upload and process invoices from images or PDFs automatically.
                </p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
