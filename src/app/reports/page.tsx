
'use client';

import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function ReportsPageContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Reports Directory</h1>
        <p className="text-muted-foreground">
          Generate and view detailed reports on sponsors and tournament registrations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Sponsors Report</CardTitle>
                <CardDescription>View, search, and export a complete directory of all sponsors.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This report provides a comprehensive list of all sponsors, their schools, and contact information. Use this to maintain your contact lists and track school participation.
            </p>
            <Button asChild>
              <Link href="/reports/sponsors">
                View Sponsor Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-full">
                <Trophy className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <CardTitle>Tournament Registrations Report</CardTitle>
                <CardDescription>Get a detailed breakdown of registrations for each tournament.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This report offers an event-by-event summary, showing which schools participated and how many players were registered from each.
            </p>
            <Button asChild>
              <Link href="/reports/tournaments">
                View Tournament Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReportsPage() {
    return (
        <OrganizerGuard>
            <AppLayout>
                <ReportsPageContent />
            </AppLayout>
        </OrganizerGuard>
    )
}
