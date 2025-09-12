
'use client';

// This page's content has been moved to /debug-scripts/data-repair
// to consolidate the data import tools. This file can be removed in the future.

import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from 'next/link';

export default function DeprecatedImportFromSquarePage() {
  return (
    <AppLayout>
        <Card>
            <CardHeader>
                <CardTitle>Page Moved</CardTitle>
            </CardHeader>
            <CardContent>
                <p>This tool has been moved to consolidate data utilities. Please use the <Link href="/debug-scripts/data-repair" className="font-bold underline">Direct Square Invoice Importer</Link> instead.</p>
            </CardContent>
        </Card>
    </AppLayout>
  );
}
