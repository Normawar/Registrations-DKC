
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { useEvents, type Event } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { format } from 'date-fns';
import { Download, Users, UserCheck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Papa from 'papaparse';
import { DistrictCoordinatorGuard } from '@/components/auth-guard';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

type RegistrationInfo = {
  player: MasterPlayer;
  details: {
    section: string;
    uscfStatus: 'current' | 'new' | 'renewing';
    status?: 'active' | 'withdrawn';
  };
  invoiceId?: string;
  invoiceNumber?: string;
};

function DistrictRegistrationsContent() {
  const { profile } = useSponsorProfile();
  const { events } = useEvents();
  const { database: allPlayers, isDbLoaded } = useMasterDb();
  
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [upcomingEventsWithRegistrations, setUpcomingEventsWithRegistrations] = useState<any[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const loadData = useCallback(async () => {
    if (!db) return;
    const invoicesCol = collection(db, 'invoices');
    const invoiceSnapshot = await getDocs(invoicesCol);
    const allConfirmations = invoiceSnapshot.docs.map(doc => doc.data());
    setConfirmations(allConfirmations);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  useEffect(() => {
    if (!profile || !isDbLoaded || events.length === 0) return;

    const upcoming = events.filter(event => new Date(event.date) >= new Date());
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));

    const processedEvents = upcoming.map(event => {
      const districtConfirmations = confirmations.filter(c => c.district === profile.district && c.eventId === event.id);
      
      const registrationsMap = new Map<string, RegistrationInfo>();
      
      districtConfirmations.forEach(conf => {
        if (!conf.selections) return;
        Object.entries(conf.selections).forEach(([playerId, details]: [string, any]) => {
          const player = playerMap.get(playerId);
          if (player && details.status !== 'withdrawn') {
            registrationsMap.set(playerId, { player, details, invoiceId: conf.invoiceId, invoiceNumber: conf.invoiceNumber });
          }
        });
      });

      const registrations = Array.from(registrationsMap.values());
      const gtCount = registrations.filter(r => r.player.studentType === 'gt').length;
      const independentCount = registrations.filter(r => r.player.studentType === 'independent').length;

      return {
        ...event,
        registrations,
        registrationCount: registrations.length,
        gtCount,
        independentCount
      };
    });

    setUpcomingEventsWithRegistrations(processedEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  }, [profile, events, confirmations, allPlayers, isDbLoaded]);
  
  const handleDownload = (event: any) => {
    const dataToExport = event.registrations.map((reg: RegistrationInfo) => ({
      'First Name': reg.player.firstName,
      'Last Name': reg.player.lastName,
      'USCF ID': reg.player.uscfId,
      'Rating': reg.player.regularRating || 'UNR',
      'School': reg.player.school,
      'Grade': reg.player.grade,
      'Section': reg.details.section,
      'USCF Status': reg.details.uscfStatus,
      'Player Type': reg.player.studentType || 'Regular',
      'Invoice #': reg.invoiceNumber || 'N/A'
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.name.replace(/\s+/g, "_")}_registrations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const EventRegistrationsTable = ({ event }: { event: any }) => {
    const [playerTypeFilter, setPlayerTypeFilter] = useState('all');

    const schoolsWithRegistrations = useMemo(() => {
        const schoolSet = new Set(event.registrations.map((r: RegistrationInfo) => r.player.school));
        return Array.from(schoolSet).sort();
    }, [event.registrations]);

    const displayedSchools = useMemo(() => {
        if (!showActiveOnly) {
            return schoolsWithRegistrations;
        }
        return schoolsWithRegistrations.filter(school => 
            event.registrations.some((r: RegistrationInfo) => r.player.school === school)
        );
    }, [schoolsWithRegistrations, event.registrations, showActiveOnly]);
    
    const filteredRegistrations = useMemo(() => {
        if (!profile || profile.district !== 'PHARR-SAN JUAN-ALAMO ISD' || playerTypeFilter === 'all') {
            return event.registrations;
        }
        return event.registrations.filter((r: RegistrationInfo) => r.player.studentType === playerTypeFilter);
    }, [event.registrations, playerTypeFilter, profile]);

    return (
      <div className="space-y-4">
        {profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
          <Tabs value={playerTypeFilter} onValueChange={setPlayerTypeFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({event.registrations.length})</TabsTrigger>
              <TabsTrigger value="gt">GT ({event.gtCount})</TabsTrigger>
              <TabsTrigger value="independent">Independent ({event.independentCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {displayedSchools.map(school => {
          const schoolRegistrations = filteredRegistrations.filter((r: RegistrationInfo) => r.player.school === school);
          if (schoolRegistrations.length === 0) return null;
          
          return (
            <div key={school}>
              <h4 className="font-semibold text-md mb-2">{school} ({schoolRegistrations.length} players)</h4>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>USCF Status</TableHead>
                      <TableHead>Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schoolRegistrations.map((reg: RegistrationInfo) => (
                      <TableRow key={reg.player.id}>
                        <TableCell className="font-medium">{reg.player.firstName} {reg.player.lastName}</TableCell>
                        <TableCell>{reg.player.grade}</TableCell>
                        <TableCell>{reg.player.regularRating || 'UNR'}</TableCell>
                        <TableCell>{reg.details.section}</TableCell>
                        <TableCell>
                            <Badge variant={reg.details.uscfStatus === 'current' ? 'default' : 'destructive'} className={reg.details.uscfStatus === 'current' ? `bg-green-600` : ''}>
                                {reg.details.uscfStatus}
                            </Badge>
                        </TableCell>
                        <TableCell>{reg.invoiceNumber || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        })}
      </div>
    );
  };


  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">District Event Registrations</h1>
          <p className="text-muted-foreground">
            View registration counts and details for upcoming events in {profile?.district}.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Upcoming Events</CardTitle>
                    <CardDescription>Click on an event to see detailed registration information.</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="active-schools-filter" checked={showActiveOnly} onCheckedChange={(checked) => setShowActiveOnly(!!checked)} />
                    <Label htmlFor="active-schools-filter" className="text-sm font-medium">Show only schools with registrations</Label>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingEventsWithRegistrations.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {upcomingEventsWithRegistrations.map(event => (
                  <AccordionItem key={event.id} value={event.id}>
                    <div className="flex items-center w-full pr-4 py-4 border-b">
                      <AccordionTrigger className="flex-1 p-0">
                        <div className="flex justify-between items-center w-full">
                          <div className='text-left'>
                            <p className="font-semibold">{event.name}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(event.date), 'PPP')}</p>
                          </div>
                          <div className="flex items-center gap-4 mr-4">
                            {profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
                                  <div className="flex items-center gap-4 text-sm">
                                      <Badge variant="secondary">All: {event.registrationCount}</Badge>
                                      <Badge variant="outline">GT: {event.gtCount}</Badge>
                                      <Badge variant="outline">Ind: {event.independentCount}</Badge>
                                  </div>
                            )}
                            {profile?.district !== 'PHARR-SAN JUAN-ALAMO ISD' && (
                              <Badge variant="secondary" className="text-sm">
                                  <Users className="mr-2 h-4 w-4" />
                                  {event.registrationCount} Registered
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <Button size="sm" variant="outline" onClick={() => handleDownload(event)} disabled={event.registrationCount === 0} className="ml-4">
                          <Download className="h-4 w-4 mr-2" />
                          Download Roster
                      </Button>
                    </div>
                    <AccordionContent className="p-4 bg-muted/50 rounded-b-md">
                        {event.registrationCount > 0 ? (
                            <EventRegistrationsTable event={event} />
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No players from your district are registered for this event yet.</p>
                        )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No Upcoming Events</h3>
                <p>There are no upcoming events with registrations from your district.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function DistrictRegistrationsPage() {
    return (
        <DistrictCoordinatorGuard>
            <DistrictRegistrationsContent />
        </DistrictCoordinatorGuard>
    );
}
