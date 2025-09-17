

'use client';

import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Trophy, ArrowRight, ClipboardCheck, UserCog, BadgeCheck, MapPin, Code, Building, FileText, Binary } from 'lucide-react';
import Link from 'next/link';

function ReportsPageContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Reports Directory</h1>
        <p className="text-muted-foreground">
          Generate and view detailed reports on sponsors, registrations, and data integrity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-sky-100 p-3 rounded-full">
                <Building className="h-6 w-6 text-sky-600" />
              </div>
              <div>
                <CardTitle>District Totals Report</CardTitle>
                <CardDescription>Aggregate summary of players and schools per district.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View a high-level report that shows total player counts, school counts, and GT/Independent breakdowns for each district in the system.
            </p>
            <Button asChild>
              <Link href="/reports/district-totals">
                View District Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full">
                <UserCog className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <CardTitle>USCF ID Verification Report</CardTitle>
                <CardDescription>Identify players with missing or "NEW" USCF IDs.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Find players who need their USCF ID verified or assigned before a tournament. Includes quick links to search the USCF database.
            </p>
            <Button asChild>
              <Link href="/reports/uscf-verification">
                View USCF Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <ClipboardCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle>Missing Player Data Report</CardTitle>
                <CardDescription>Find players with incomplete profiles (missing grade or section).</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Ensure every player can be properly sectioned by fixing records with missing grade or section information.
            </p>
            <Button asChild>
              <Link href="/reports/missing-data">
                View Data Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <BadgeCheck className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>PSJA Student Type Report</CardTitle>
                <CardDescription>Audit PSJA players to ensure they are marked as GT or Independent.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This report lists all players in the PSJA district whose "Student Type" has not been set, which is critical for correct invoicing.
            </p>
            <Button asChild>
              <Link href="/reports/psja-student-type">
                View PSJA Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-gray-100 p-3 rounded-full">
                <MapPin className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <CardTitle>Missing State Report</CardTitle>
                <CardDescription>Find players who do not have a state assigned to their profile.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This report helps ensure all player records have a state, which is important for USCF reporting and general data quality.
            </p>
            <Button asChild>
              <Link href="/reports/missing-state">
                View State Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-teal-100 p-3 rounded-full">
                <Code className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <CardTitle>Team Code Directory</CardTitle>
                <CardDescription>Search for schools and districts to find their official team codes.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              A searchable directory of all schools and their official team codes. Useful for verifying codes or finding codes for schools outside your district.
            </p>
            <Button asChild>
              <Link href="/team-codes">
                View Team Codes <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-pink-100 p-3 rounded-full">
                <Binary className="h-6 w-6 text-pink-600" />
              </div>
              <div>
                <CardTitle>Player ID Range Report</CardTitle>
                <CardDescription>Pull a list of players within a specific USCF ID number range.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generates a report for a specific range of USCF IDs, useful for targeted analysis or data verification.
            </p>
            <Button asChild>
              <Link href="/reports/player-id-range">
                View ID Range Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-teal-100 p-3 rounded-full">
                <Code className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <CardTitle>Specific Team Code Report</CardTitle>
                <CardDescription>View players belonging to a specific list of team codes.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generates a report for a predefined list of team codes, useful for targeted analysis of specific schools or groups.
            </p>
            <Button asChild>
              <Link href="/reports/team-code-report">
                View Team Code Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-full">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <CardTitle>USCF Data Parser</CardTitle>
                <CardDescription>Convert USCF affiliate or tournament data into clean CSV format.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Parse data copied from USCF affiliate reports or upload text files to generate clean CSV exports with player information, ratings, and titles.
            </p>
            <Button asChild>
              <Link href="/reports/uscf-parser">
                Parse USCF Data <ArrowRight className="ml-2 h-4 w-4" />
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
