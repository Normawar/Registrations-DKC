
'use client';

import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DeprecatedDataRepairPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Tool Deprecated</h1>
          <p className="text-muted-foreground mt-2">
            This AI-powered invoice uploader is no longer the primary import tool.
          </p>
        </div>

        <Card className="border-amber-500">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <CardTitle>This tool has been replaced for bulk imports.</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p>
                    For migrating batches of invoices from Square, please use the new, more reliable <Link href="/debug-scripts/import-from-square" className="font-semibold text-primary underline">Direct Square Importer</Link>.
                </p>
                <p className="mt-2">
                    This AI uploader should now only be used for one-off uploads of non-Square invoices (e.g., from an image or a unique PDF format) that cannot be fetched from the API.
                </p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
