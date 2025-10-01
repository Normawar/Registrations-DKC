

'use client';

import { AppLayout } from '@/components/app-layout';
import { getUserRole } from '@/lib/role-utils';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { ParentRegistrationComponent } from '@/components/parent-registration-component';
import { SponsorRegistrationDialog } from '@/components/sponsor-registration-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEvents } from '@/hooks/use-events';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar, MapPin, DollarSign, Users, CheckCircle, Clock, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { schoolData } from '@/lib/data/school-data';

// Helper function to determine the district for a given location.
const getDistrictForLocation = (location: string): string => {
    const lowerLocation = location.toLowerCase();
    let foundSchool = schoolData.find(s => lowerLocation.includes(s.schoolName.toLowerCase()));

    if (!foundSchool) {
      foundSchool = schoolData.find(s => {
        const schoolNameParts = s.schoolName.toLowerCase().split(' ').filter(p => p.length > 2 && !['el', 'ms', 'hs'].includes(p));
        return schoolNameParts.some(part => lowerLocation.includes(part));
      });
    }
    
    return foundSchool?.district || 'Unknown';
};


export default function EventsPage() {
  const { profile } = useSponsorProfile();
  const { events } = useEvents();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);

  // Load registrations from Firestore
  const loadRegistrations = useCallback(async () => {
    if (!db || !profile) {
      console.error("Cannot load registrations: Firestore not initialized or profile not loaded.");
      return;
    }
    try {
      const invoicesCol = collection(db, 'invoices');
      let invoicesQuery;
      
      if (getUserRole(profile) === 'individual') {
        invoicesQuery = query(invoicesCol, where('parentEmail', '==', profile.email));
      } else if (getUserRole(profile) === 'sponsor' || getUserRole(profile) === 'district_coordinator') {
        invoicesQuery = query(invoicesCol, where('schoolName', '==', profile.school), where('district', '==', profile.district));
      } else {
        invoicesQuery = query(invoicesCol); // Fallback for organizer or other roles
      }
      
      const invoiceSnapshot = await getDocs(invoicesQuery);
      const allConfirmations = invoiceSnapshot.docs.map(doc => doc.data());
      setRegistrations(allConfirmations);
    } catch (error) {
      console.error('Failed to load registrations from Firestore:', error);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadRegistrations();
    }
  }, [loadRegistrations, profile]);

  // Get upcoming events and filter based on user type (test/real)
  const upcomingEvents = useMemo(() => {
    const isTestUser = profile?.email?.toLowerCase().includes('test');

    return events
      .filter(event => {
        const isUpcoming = new Date(event.date) >= new Date();
        if (!isUpcoming || event.isClosed) return false;

        const isTestEvent = event.name.toLowerCase().startsWith('test') || getDistrictForLocation(event.location).toLowerCase().startsWith("test");
        
        if (getUserRole(profile) === 'individual') {
          return !isTestEvent;
        }

        if (isTestUser) {
            return isTestEvent;
        } else {
            return !isTestEvent;
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, profile]);

  // Get registration status for an event
  const getEventRegistrationStatus = (event: any) => {
    if (!profile) return { isRegistered: false, studentCount: 0 };

    const eventRegistrations = registrations.filter(reg => {
      if (reg.eventId !== event.id) return false;
      
      if (getUserRole(profile) === 'individual') {
        return reg.parentEmail === profile.email;
      } else if (getUserRole(profile) === 'sponsor' || getUserRole(profile) === 'district_coordinator') {
        return reg.schoolName === profile.school && reg.district === profile.district;
      }
      
      return false;
    });

    const totalStudents = eventRegistrations.reduce((sum, reg) => {
      return sum + (reg.selections ? Object.keys(reg.selections).length : 0);
    }, 0);

    return {
      isRegistered: eventRegistrations.length > 0,
      studentCount: totalStudents,
      registrations: eventRegistrations
    };
  };

  const handleRegisterClick = (event: any) => {
    setSelectedEvent(event);
    setIsRegistrationDialogOpen(true);
  };

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">Please wait while we load your profile.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // For individual users, show the parent registration component
  if (getUserRole(profile) === 'individual') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="border-b pb-6">
            <h1 className="text-3xl font-bold">Register for Events</h1>
            <p className="text-muted-foreground mt-2">
              Register your students for upcoming chess tournaments.
            </p>
          </div>
          
          <ParentRegistrationComponent parentProfile={profile} />
        </div>
      </AppLayout>
    );
  }

  // For sponsors, show event list with registration capabilities
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold">Register for Events</h1>
          <p className="text-muted-foreground mt-2">
            Register students from {profile.school} for upcoming tournaments.
          </p>
        </div>

        {upcomingEvents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Upcoming Events</h3>
              <p className="text-muted-foreground text-center">
                There are currently no events available for registration.
                Check back later for new tournaments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {upcomingEvents.map(event => {
              const status = getEventRegistrationStatus(event);
              const isPsjaRestricted = event.isPsjaOnly && profile?.district !== 'PHARR-SAN JUAN-ALAMO ISD';
              
              return (
                <Card key={event.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-xl">{event.name}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(event.date), 'PPP')}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.location}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ${event.regularFee}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {status.isRegistered && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {status.studentCount} student{status.studentCount !== 1 ? 's' : ''} registered
                          </Badge>
                        )}
                        {(event.isClosed || isPsjaRestricted) && (
                            <Badge variant="destructive">
                                <Lock className="h-3 w-3 mr-1.5" />
                                {isPsjaRestricted ? 'PSJA Only' : 'Registration Closed'}
                            </Badge>
                        )}
                        
                        <Button size="sm" onClick={() => handleRegisterClick(event)} disabled={event.isClosed || isPsjaRestricted}>
                          {status.isRegistered ? 'Manage Registration' : 'Register Students'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>Registration Deadline: {format(new Date(event.regularDeadline || event.date), 'PPP')}</span>
                          </div>
                          {event.maxParticipants && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>Max {event.maxParticipants} participants</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {status.isRegistered && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="font-medium text-green-800 mb-1">Registration Status</h4>
                          <p className="text-sm text-green-700">
                            You have {status.studentCount} student{status.studentCount !== 1 ? 's' : ''} registered for this event.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <SponsorRegistrationDialog
          isOpen={isRegistrationDialogOpen}
          onOpenChange={setIsRegistrationDialogOpen}
          event={selectedEvent}
        />
      </div>
    </AppLayout>
  );
}
