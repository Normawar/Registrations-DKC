
'use client';

import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Users, Calendar, Receipt } from 'lucide-react';

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
                The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <a href="/roster" className="font-semibold underline">Roster</a> page to get started.
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
                  <p className="text-sm">1. Navigate to the <a href="/roster" className="font-medium underline">Roster</a> page from the sidebar.</p>
                  <p className="text-sm">2. Click the <strong>Add Player from Database</strong> button. This will open a search dialog.</p>
                  <p className="text-sm">3. Search for your student by name or USCF ID. The master database contains thousands of players.</p>
                  <div className="border rounded-lg p-4 bg-muted/50">
                     <Image src="https://drive.google.com/uc?export=view&id=1YYVXkLkDI2aGd2aCBGA9H8_bIEp_KUqV" alt="A screenshot of the player search dialog." width={600} height={350} className="rounded-md" data-ai-hint="player search dialog" />
                  </div>
                  <p className="text-sm">4. Once you find your student, click <strong>Select</strong> or <strong>Add & Complete</strong>. If their profile is missing information (like Grade, Section, DOB), you will be prompted to fill it in. The player will then be added to your school's roster.</p>
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
                  <p className="text-sm">1. Go to the <a href="/dashboard" className="font-medium underline">Dashboard</a> or <a href="/events" className="font-medium underline">Register for Event</a> page.</p>
                  <p className="text-sm">2. Find an upcoming event and click the <strong>Register for event</strong> button.</p>
                  <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
                     <Image src="https://drive.google.com/uc?export=view&id=1M1fuDS6gpQEiUfu_AjPSUgzObNmUZMd5" alt="A screenshot showing the event list with the register button highlighted." width={600} height={400} className="rounded-md" data-ai-hint="event registration list" />
                     <Image src="https://drive.google.com/uc?export=view&id=1L5jZas7XBqEz8RzUaTgFiqz2GeOJnUi2" alt="A screenshot of the registration dialog." width={600} height={400} className="rounded-md" data-ai-hint="registration dialog" />
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
                  <p className="text-sm">1. Navigate to the <a href="/invoices" className="font-medium underline">Invoices & Payments</a> page from the sidebar.</p>
                  <p className="text-sm">2. Here you will see a list of all your invoices and their current status (e.g., Paid, Unpaid, Canceled).</p>
                  <p className="text-sm">3. Click on an invoice to view its full details, see the list of registered players, and access the secure Square payment link.</p>
                   <div className="border rounded-lg p-4 bg-muted/50">
                     <Image src="https://picsum.photos/600/300" alt="A screenshot of the invoice details view." width={600} height={300} className="rounded-md" data-ai-hint="invoice details modal" />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}
