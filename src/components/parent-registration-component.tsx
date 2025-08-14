
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEvents } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, School } from 'lucide-react';
import { format } from 'date-fns';

interface ParentRegistrationProps {
  parentProfile: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

type StudentRegistration = {
  player: MasterPlayer;
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
  event: any;
  registrationSource: 'parent' | 'sponsor';
  isAlreadyRegistered: boolean;
};

export function ParentRegistrationComponent({ parentProfile }: ParentRegistrationProps) {
  const { toast } = useToast();
  const { events } = useEvents();
  const { database } = useMasterDb();
  
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [registrations, setRegistrations] = useState<StudentRegistration[]>([]);

  // Get upcoming events only
  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  // Load existing registrations from localStorage
  useEffect(() => {
    const loadRegistrations = () => {
      try {
        const storedConfirmations = localStorage.getItem('confirmations');
        const allConfirmations = storedConfirmations ? JSON.parse(storedConfirmations) : [];
        
        // Build registration tracking
        const registrationMap = new Map<string, StudentRegistration>();
        
        allConfirmations.forEach((confirmation: any) => {
          if (confirmation.selections) {
            Object.entries(confirmation.selections).forEach(([playerId, details]: [string, any]) => {
              const player = database.find(p => p.id === playerId);
              if (player) {
                const key = `${playerId}-${confirmation.eventId}`;
                const isParentRegistration = confirmation.parentEmail === parentProfile.email;
                
                registrationMap.set(key, {
                  player,
                  section: details.section,
                  uscfStatus: details.uscfStatus,
                  event: events.find(e => e.id === confirmation.eventId),
                  registrationSource: isParentRegistration ? 'parent' : 'sponsor',
                  isAlreadyRegistered: true
                });
              }
            });
          }
        });
        
        setRegistrations(Array.from(registrationMap.values()));
      } catch (error) {
        console.error('Failed to load registrations:', error);
      }
    };

    if (database.length > 0 && events.length > 0) {
      loadRegistrations();
    }
  }, [database, events, parentProfile.email]);

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
    const existingReg = registrations.find(r => 
      r.player.id === student.id && r.event?.id === event.id
    );
    
    if (existingReg) {
      return {
        isRegistered: true,
        source: existingReg.registrationSource,
        canRegister: false,
        message: existingReg.registrationSource === 'sponsor' 
          ? 'Registered by school sponsor' 
          : 'Already registered by you'
      };
    }
    
    return {
      isRegistered: false,
      source: null,
      canRegister: true,
      message: 'Available for registration'
    };
  };

  const handleRegisterStudent = (student: MasterPlayer, event: any) => {
    // Check if student has all required information
    const missingFields = [];
    if (!student.dob) missingFields.push('Date of Birth');
    if (!student.grade) missingFields.push('Grade');
    if (!student.section) missingFields.push('Section');
    if (!student.email) missingFields.push('Email');
    if (!student.zipCode) missingFields.push('Zip Code');
    
    if (missingFields.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Incomplete Student Information',
        description: `${student.firstName} ${student.lastName} is missing: ${missingFields.join(', ')}. Please contact support to complete their profile.`
      });
      return;
    }

    // Create registration confirmation
    const confirmationId = `parent-${Date.now()}-${Math.random()}`;
    const confirmation = {
      id: confirmationId,
      invoiceId: confirmationId,
      invoiceNumber: `INV-${confirmationId.slice(-8)}`,
      submissionTimestamp: new Date().toISOString(),
      eventId: event.id,
      parentEmail: parentProfile.email,
      parentName: `${parentProfile.firstName} ${parentProfile.lastName}`,
      schoolName: student.school || 'Individual Registration',
      district: student.district || 'Individual',
      selections: {
        [student.id]: {
          section: student.section,
          uscfStatus: 'current', // Default for individual registrations
          status: 'active'
        }
      }
    };

    // Save to localStorage
    try {
      const existingConfirmations = localStorage.getItem('confirmations');
      const allConfirmations = existingConfirmations ? JSON.parse(existingConfirmations) : [];
      allConfirmations.push(confirmation);
      localStorage.setItem('confirmations', JSON.stringify(allConfirmations));
      
      toast({
        title: "Registration Successful",
        description: `${student.firstName} ${student.lastName} has been registered for ${event.name}.`
      });
      
      // Reload registrations
      window.location.reload();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Registration Failed",
        description: "Failed to save registration. Please try again."
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-headline">Register Students for Events</h2>
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
                <p>No students found. Add a student to your profile to begin registering for events.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {parentStudents.map(student => (
                <div key={student.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{student.firstName} {student.lastName}</h3>
                      <p className="text-sm text-muted-foreground">
                        ID: {student.uscfId} | Rating: {student.regularRating || 'UNR'}
                      </p>
                      {student.school && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <School className="h-3 w-3" />
                          {student.school} - {student.district}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Upcoming Events:</p>
                    {upcomingEvents.map(event => {
                      const status = getStudentRegistrationStatus(student, event);
                      return (
                        <div key={event.id} className="flex items-center justify-between text-sm border rounded p-2">
                          <div>
                            <p className="font-medium">{event.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(event.date), 'PPP')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {status.isRegistered ? (
                              <Badge variant={status.source === 'sponsor' ? 'default' : 'secondary'}>
                                {status.source === 'sponsor' ? (
                                  <>
                                    <School className="h-3 w-3 mr-1" />
                                    School
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Registered
                                  </>
                                )}
                              </Badge>
                            ) : (
                              <Button 
                                size="sm" 
                                onClick={() => handleRegisterStudent(student, event)}
                                disabled={!status.canRegister}
                              >
                                Register
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
