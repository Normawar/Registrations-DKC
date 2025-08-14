'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEvents } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Award,
  MapPin,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import Link from 'next/link';

interface DashboardProps {
  profile: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: 'individual' | 'sponsor' | 'organizer';
    school?: string;
    district?: string;
  };
}

export function UpdatedDashboard({ profile }: DashboardProps) {
  const { events } = useEvents();
  const { database } = useMasterDb();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);

  // Load data
  useEffect(() => {
    const loadData = () => {
      try {
        // Load registrations
        const storedConfirmations = localStorage.getItem('confirmations');
        setRegistrations(storedConfirmations ? JSON.parse(storedConfirmations) : []);

        // Load parent's students for individual users
        if (profile.role === 'individual') {
          const storedParentStudents = localStorage.getItem(`parent_students_${profile.email}`);
          if (storedParentStudents) {
            const studentIds = JSON.parse(storedParentStudents);
            const students = database.filter(p => studentIds.includes(p.id));
            setParentStudents(students);
          }
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    loadData();
    
    // Listen for storage changes
    const handleStorageChange = () => loadData();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [profile, database]);

  // Get user's registrations
  const userRegistrations = useMemo(() => {
    return registrations.filter(reg => {
      if (profile.role === 'individual') {
        return reg.parentEmail === profile.email;
      } else if (profile.role === 'sponsor') {
        return reg.schoolName === profile.school && reg.district === profile.district;
      }
      return false;
    });
  }, [registrations, profile]);

  // Get upcoming events with user's registration status
  const upcomingEventsWithStatus = useMemo(() => {
    const now = new Date();
    const upcomingEvents = events
      .filter(event => isAfter(new Date(event.date), now))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5); // Show next 5 events

    return upcomingEvents.map(event => {
      const eventRegs = userRegistrations.filter(reg => reg.eventId === event.id);
      const studentCount = eventRegs.reduce((sum, reg) => {
        return sum + (reg.selections ? Object.keys(reg.selections).length : 0);
      }, 0);

      return {
        ...event,
        isRegistered: eventRegs.length > 0,
        studentCount,
        registrations: eventRegs
      };
    });
  }, [events, userRegistrations]);

  // Get recent registrations
  const recentRegistrations = useMemo(() => {
    return userRegistrations
      .sort((a, b) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime())
      .slice(0, 3);
  }, [userRegistrations]);

  // Get dashboard statistics
  const stats = useMemo(() => {
    const totalRegistrations = userRegistrations.length;
    const totalStudentsRegistered = userRegistrations.reduce((sum, reg) => {
      return sum + (reg.selections ? Object.keys(reg.selections).length : 0);
    }, 0);
    
    const upcomingEventsCount = upcomingEventsWithStatus.filter(e => e.isRegistered).length;
    const availableEventsCount = upcomingEventsWithStatus.filter(e => !e.isRegistered).length;

    return {
      totalRegistrations,
      totalStudentsRegistered,
      upcomingEventsCount,
      availableEventsCount
    };
  }, [userRegistrations, upcomingEventsWithStatus]);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold">Welcome back, {profile.firstName}!</h1>
        <p className="text-muted-foreground mt-2">
          {profile.role === 'individual' 
            ? "Here's an overview of your tournament registrations and upcoming events."
            : `Managing registrations for ${profile.school} - ${profile.district}`
          }
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.totalRegistrations}</p>
                <p className="text-sm text-muted-foreground">Total Registrations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.totalStudentsRegistered}</p>
                <p className="text-sm text-muted-foreground">Students Registered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats.upcomingEventsCount}</p>
                <p className="text-sm text-muted-foreground">Upcoming Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats.availableEventsCount}</p>
                <p className="text-sm text-muted-foreground">Available Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to manage your registrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/events">
                <Calendar className="h-4 w-4 mr-2" />
                Register for Events
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/confirmations">
                <CheckCircle className="h-4 w-4 mr-2" />
                View Confirmations
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/invoices">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Invoices
              </Link>
            </Button>
            {profile.role === 'individual' && (
              <Button variant="outline" asChild>
                <Link href="/profile">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Students
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>
                Your next tournaments and registration status
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/events">
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingEventsWithStatus.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming events found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingEventsWithStatus.map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{event.name}</h4>
                        {event.isRegistered ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Registered ({event.studentCount})
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Available
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.date), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      </div>
                    </div>
                    {!event.isRegistered && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/events">Register</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
            <CardDescription>
              Your latest tournament registrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentRegistrations.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No registrations yet</p>
                <Button size="sm" className="mt-2" asChild>
                  <Link href="/events">Register for an Event</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRegistrations.map(registration => (
                  <div key={registration.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{registration.eventName}</h4>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Registered {format(new Date(registration.submissionTimestamp), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {registration.selections ? Object.keys(registration.selections).length : 0} student(s)
                        </span>
                      </div>
                    </div>
                    <Badge variant={registration.invoiceStatus === 'PAID' ? 'secondary' : 'destructive'}>
                      {registration.invoiceStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Important Notices */}
      {profile.role === 'individual' && parentStudents.length === 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-orange-800">Add Students to Get Started</h3>
                <p className="text-sm text-orange-700 mt-1">
                  You need to add students to your profile before you can register for events.
                </p>
                <Button size="sm" className="mt-2" asChild>
                  <Link href="/profile">Add Students</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}