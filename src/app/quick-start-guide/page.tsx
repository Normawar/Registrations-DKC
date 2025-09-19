
'use client';

import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Users, Calendar, Receipt, FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function QuickStartGuidePage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Sponsor Quick Start Guide</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to ChessMate! This guide will walk you through the essential steps to get started.
          </p>
        </div>

        <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>First Things First: Your Roster</AlertTitle>
            <AlertDescription>
                The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <Link href="/roster" className="font-semibold underline">Roster</Link> page to get started.
            </AlertDescription>
        </Alert>

        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-lg font-semibold">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full"><Users className="h-5 w-5 text-primary" /></div>
                Step 1: Managing Your Roster
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-12 pt-2 space-y-4">
              <p>Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Adding a Player to Your Roster</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">1. Navigate to the <Link href="/roster" className="font-medium underline">Roster</Link> page from the sidebar. You will see your team information and an empty roster list.</p>
                   <div className="border rounded-lg p-4 bg-muted/50">
                     <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2Froster.png?alt=media&token=e9188591-6280-4590-b183-a7f45c8b7405" alt="A screenshot of the Team Roster page showing the Add from Database and Create New Player buttons." width={600} height={400} className="rounded-md" data-ai-hint="team roster page" priority />
                  </div>
                  <p className="text-sm">2. Click the <strong>Add from Database</strong> button to search for existing players or <strong>Create New Player</strong> to add a student who is not in the system.</p>
                  <p className="text-sm">3. When searching, use the filters to find players by name, USCF ID, school, or district.</p>
                  <p className="text-sm">4. Once you find your student, click <strong>Select</strong>. You will be prompted to fill in any missing required information (like Grade or Section). The player will then be added to your school's roster.</p>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger className="text-lg font-semibold">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full"><Calendar className="h-5 w-5 text-primary" /></div>
                Step 2: Registering for an Event
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-12 pt-2 space-y-4">
              <p>Once your roster is set, you can register your selected players for any open tournament.</p>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Event Registration Process</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">1. Go to the <Link href="/dashboard" className="font-medium underline">Dashboard</Link> or <Link href="/events" className="font-medium underline">Register for Event</Link> page.</p>
                  <p className="text-sm">2. Find an upcoming event and click the <strong>Register Students</strong> button.</p>
                  <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
                     <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2Fevent-registration.png?alt=media&token=c19a9a14-432d-45a4-8451-872f9b8c381c" alt="A screenshot showing the event list with the register button highlighted." width={600} height={350} className="rounded-md" data-ai-hint="event registration" priority />
                     <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2Fregistration-dialog.png?alt=media&token=d1d234a9-6e9f-4b08-8f55-7d5a5dd0e6f2" alt="A screenshot of the registration dialog where players from a roster can be selected." width={600} height={450} className="rounded-md" data-ai-hint="registration dialog" priority />
                  </div>
                  <p className="text-sm">3. A dialog will appear listing all players on your roster. Select the players you wish to register for this event.</p>
                  <p className="text-sm">4. For each selected player, confirm their <strong>Section</strong> and <strong>USCF Status</strong> (e.g., if they need a new membership or a renewal).</p>
                  <p className="text-sm">5. Click <strong>Review Charges</strong> to see a full breakdown of fees.</p>
                   <p className="text-sm">6. Finally, click <strong>Create Invoice</strong>. This will generate an official invoice and complete the registration.</p>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger className="text-lg font-semibold">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full"><Receipt className="h-5 w-5 text-primary" /></div>
                Step 3: Handling Invoices
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-12 pt-2 space-y-4">
              <p>After registering, you can view and manage all your invoices from one place.</p>
               <Card>
                <CardHeader>
                  <CardTitle className="text-base">Viewing and Paying Invoices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">1. Navigate to the <Link href="/invoices" className="font-medium underline">Invoices & Payments</Link> page from the sidebar.</p>
                  <p className="text-sm">2. Here you will see a list of all your invoices and their current status (e.g., Paid, Unpaid, Canceled).</p>
                  <p className="text-sm">3. Click <strong>Details</strong> to view a specific invoice. From here, you can see the registered players and submit payment information.</p>
                  <p className="text-sm">4. For payment, you can either click the <strong>View Invoice on Square</strong> button to pay directly with a credit card, or use an offline method like PO, Check, CashApp, or Zelle.</p>
                  <p className="text-sm">5. If paying offline, select the payment method, fill in the details (like PO or check number), upload proof of payment, and click <strong>Submit Payment Information</strong> for an organizer to review.</p>
                   <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
                    <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2Finvoice-details.png?alt=media&token=d1d6a6a2-6366-4e5c-a574-0f2f3d6118b7" alt="A screenshot of the invoice details view, showing player and fee breakdown." width={600} height={400} className="rounded-md" data-ai-hint="invoice details" priority />
                    <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2Finvoice-payment.png?alt=media&token=8e9b6a1e-8b1b-4171-8b0b-999335a9630c" alt="A screenshot of the invoice details view showing payment options like PO and Check." width={600} height={300} className="rounded-md" data-ai-hint="invoice payment" priority />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger className="text-lg font-semibold">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full"><FileQuestion className="h-5 w-5 text-primary" /></div>
                Need More Help?
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-12 pt-2 space-y-4">
                <p>For more detailed instructions on every feature, please visit our new <Link href="/help" className="font-semibold underline">Help Center</Link>.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}
