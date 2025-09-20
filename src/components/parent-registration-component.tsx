

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndividualRegistrationDialog } from '@/components/individual-registration-dialog';
import { useEvents } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, School, User } from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

interface ParentRegistrationProps {
  parentProfile: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export function ParentRegistrationComponent({ parentProfile }: ParentRegistrationProps) {
  const { toast } = useToast();
  const { events } = useEvents();
  const { database } = useMasterDb();
  
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);

  // Get upcoming events and filter out test events
  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => {
        const isUpcoming = new Date(event.date) >= new Date();
        const isTestEvent = event.name.toLowerCase().startsWith('test');
        return isUpcoming && !event.isClosed && !isTestEvent;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  // Load existing registrations from Firestore
  useEffect(() => {
    const loadRegistrations = async () => {
      if (!db || !parentProfile?.email) return;
      try {
        const q = query(collection(db, 'invoices'), where('parentEmail', '==', parentProfile.email));
        const querySnapshot = await getDocs(q);
        const userRegistrations = querySnapshot.docs.map(doc => doc.data());
        setRegistrations(userRegistrations);
      } catch (error) {
        console.error('Failed to load registrations:', error);
      }
    };

    loadRegistrations();
  }, [parentProfile?.email]);

  // Load parent's students
  useEffect(() => {
    const loadParentStudents = () => {
      try {
        const storedParentStudents = localStorage.getItem(`parent_students_${parentProfile.email}`);
        if (storedParentStudents) {
          const studentIds = JSON.parse(storedParentStudents);
          const students = database.filter(p => studentIds.includes(p.id));
          setParentStudents(students);
        }
      } catch (error) {
        console.error('Failed to load parent students:', error);
      }
    };

    if (database.length > 0) {
      loadParentStudents();
    }
  }, [database, parentProfile.email]);

  const getStudentRegistrationStatus = (student: MasterPlayer, event: any) => {
    if (!event?.id) {
      return {
        isRegistered: false,
        source: null,
        message: 'Available for registration'
      };
    }
    
    const existingReg = registrations.find(r => 
      r.eventId === event.id && 
      r.selections && 
      r.selections[student.id]
    );
    
    if (existingReg) {
      const isParentReg = existingReg.parentEmail === parentProfile.email;
      return {
        isRegistered: true,
        source: isParentReg ? 'parent' : 'sponsor',
        message: isParentReg ? 'Registered by you' : 'Registered by school sponsor'
      };
    }
    
    return {
      isRegistered: false,
      source: null,
      message: 'Available for registration'
    };
  };

  const handleRegisterForEvent = (event: any) => {
    setSelectedEvent(event);
    setIsRegistrationDialogOpen(true);
  };

  const getEventRegistrationSummary = (event: any) => {
    const studentStatuses = parentStudents.map(student => 
      getStudentRegistrationStatus(student, event)
    );
    
    const registeredCount = studentStatuses.filter(s => s.isRegistered).length;
    const availableCount = studentStatuses.filter(s => !s.isRegistered).length;
    
    return { registeredCount, availableCount, total: parentStudents.length };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Register Students for Events</h2>
        <p className="text-muted-foreground">
          Register your students for tournaments, even if they're already on a school roster.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Registrations</CardTitle>
          <CardDescription>
            Register your students for upcoming tournaments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parentStudents.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Students Found</p>
              <p>Add students to your profile to begin registering for events.</p>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              <p>No upcoming events available for registration.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingEvents.map(event => {
                const summary = getEventRegistrationSummary(event);
                
                return (
                  <div key={event.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{event.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.date), 'PPP')} • {event.location}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Registration Fee: ${event.regularFee}
                        </p>
                        {summary.registeredCount > 0 && (
                          <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                            <CheckCircle className="h-4 w-4" />
                            {summary.registeredCount} student{summary.registeredCount > 1 ? 's' : ''} already registered
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <Button 
                          onClick={() => handleRegisterForEvent(event)}
                          disabled={summary.availableCount === 0}
                          size="sm"
                        >
                          {summary.availableCount > 0 
                            ? `Register Students (${summary.availableCount} available)`
                            : 'All Students Registered'
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <IndividualRegistrationDialog
        isOpen={isRegistrationDialogOpen}
        onOpenChange={setIsRegistrationDialogOpen}
        event={selectedEvent}
        parentProfile={parentProfile}
      />
    </div>
  );
}
