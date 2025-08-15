'use client';

import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { ParentRegistrationComponent } from '@/components/parent-registration-component';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEvents } from '@/hooks/use-events';
import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, MapPin, DollarSign, Users, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EventsPage() {
  const { profile } = useSponsorProfile();
  const { events } = useEvents();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<any[]>([]);

  // Load registrations
  useEffect(() => {
    const loadRegistrations = () => {
      try {
        const storedConfirmations = localStorage.getItem('confirmations');
        setRegistrations(storedConfirmations ? JSON.parse(storedConfirmations) : []);
      } catch (error) {
        console.error('Failed to load registrations:', error);
      }
    };

    loadRegistrations();
    
    // Listen for storage changes
    const handleStorageChange = () => loadRegistrations();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Get upcoming events
  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  // Get registration status for an event
  const getEventRegistrationStatus = (event: any) => {
    if (!profile) return { isRegistered: false, studentCount: 0 };

    const eventRegistrations = registrations.filter(reg => {
      if (reg.eventId !== event.id) return false;
      
      if (profile.role === 'individual') {
        return reg.parentEmail === profile.email;
      } else if (profile.role === 'sponsor') {
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

  const handleEventRegistration = (eventId: string) => {
    // For now, navigate to a registration page or show a placeholder
    // You can replace this with your actual registration logic
    router.push(`/organizer-registration?eventId=${eventId}`);
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <div className="text-muted-foreground">Please wait while we load your profile.</div>
        </div>
      </div>
    );
  }

  // For individual users, show the parent registration component
  if (profile.role === 'individual') {
    return (
      <div className="space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold">Register for Events</h1>
          <div className="text-muted-foreground mt-2">
            Register your students for upcoming chess tournaments.
          </div>
        </div>
        
        <ParentRegistrationComponent parentProfile={profile} />
      </div>
    );
  }

  // For sponsors, show event list with registration capabilities
  return (
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
            <div className="text-muted-foreground text-center">
              There are currently no events available for registration.
              Check back later for new tournaments.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {upcomingEvents.map(event => {
            const status = getEventRegistrationStatus(event);
            
            return (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">{event.name}</CardTitle>
                      <div className="text-muted-foreground text-base">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(event.date), 'PPP')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span>${event.regularFee}</span>
                          </div>
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
                      
                      <Button 
                        size="sm"
                        onClick={() => handleEventRegistration(event.id)}
                      >
                        {status.isRegistered ? 'Manage Registration' : 'Register Students'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {event.description && (
                      <div className="text-sm text-muted-foreground">{event.description}</div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Registration Deadline: {format(new Date(event.registrationDeadline || event.date), 'PPP')}</span>
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
                        <div className="text-sm text-green-700">
                          You have {status.studentCount} student{status.studentCount !== 1 ? 's' : ''} registered for this event.
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
