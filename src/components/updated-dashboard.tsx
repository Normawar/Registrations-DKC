'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEvents } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Award,
  MapPin,
  ExternalLink,
  AlertCircle,
  Trash2
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
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [isPlayerSearchOpen, setIsPlayerSearchOpen] = useState(false);
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<MasterPlayer | null>(null);
  const [isEditStudentDialogOpen, setIsEditStudentDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<MasterPlayer | null>(null);

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

  // Handle removing a student from parent's list
  const handleRemoveStudent = (student: MasterPlayer) => {
    setStudentToRemove(student);
    setIsRemoveStudentDialogOpen(true);
  };

  const confirmRemoveStudent = () => {
    if (studentToRemove && profile) {
      const parentStudentsKey = `parent_students_${profile.email}`;
      const existingStudentIds = JSON.parse(localStorage.getItem(parentStudentsKey) || '[]');
      const updatedStudentIds = existingStudentIds.filter((id: string) => id !== studentToRemove.id);
      localStorage.setItem(parentStudentsKey, JSON.stringify(updatedStudentIds));
      
      // Update local state
      const updatedStudents = database.filter(p => updatedStudentIds.includes(p.id));
      setParentStudents(updatedStudents);
      
      toast({
        title: "Student Removed",
        description: `${studentToRemove.firstName} ${studentToRemove.lastName} has been removed from your student list.`
      });
    }
    setIsRemoveStudentDialogOpen(false);
    setStudentToRemove(null);
  };

  // Handle player selection from search dialog
  const handlePlayerSelected = (player: MasterPlayer) => {
    // Check if player needs completion
    const missingFields = [
      !player.dob && 'DOB',
      !player.grade && 'Grade', 
      !player.section && 'Section',
      !player.email && 'Email',
      !player.zipCode && 'Zip'
    ].filter(Boolean);
    
    const needsCompletion = missingFields.length > 0;
    
    if (needsCompletion) {
      // Open edit dialog for completion
      setStudentToEdit(player);
      setIsEditStudentDialogOpen(true);
    } else {
      // Add directly to parent's student list
      addStudentToParentList(player);
    }
  };

  // Add student to parent's list (used after completion or for complete students)
  const addStudentToParentList = (player: MasterPlayer) => {
    const parentStudentsKey = `parent_students_${profile.email}`;
    const existingStudentIds = JSON.parse(localStorage.getItem(parentStudentsKey) || '[]');
    
    if (!existingStudentIds.includes(player.id)) {
      const updatedStudentIds = [...existingStudentIds, player.id];
      localStorage.setItem(parentStudentsKey, JSON.stringify(updatedStudentIds));
      
      // Reload parent students
      const students = database.filter(p => updatedStudentIds.includes(p.id));
      setParentStudents(students);
      
      toast({
        title: "Student Added",
        description: `${player.firstName} ${player.lastName} has been added to your student list.`
      });
    }
  };

  // Handle student completion from edit dialog
  const handleStudentCompleted = (updatedStudent: MasterPlayer) => {
    // Add the completed student to parent's list
    addStudentToParentList(updatedStudent);
    setIsEditStudentDialogOpen(false);
    setStudentToEdit(null);
  };

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

      {/* Student Management Section for Individual Users - Always show for individual users */}
      {profile.role === 'individual' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Students</CardTitle>
              <CardDescription>
                Manage the students you can register for events
              </CardDescription>
            </div>
            <Button 
              size="sm" 
              onClick={() => setIsPlayerSearchOpen(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </CardHeader>
          <CardContent>
            {parentStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium text-foreground mb-2">No Students Added Yet</h3>
                <p className="text-sm mb-4">
                  Add students to your profile to begin registering for tournaments.
                </p>
                <Button onClick={() => setIsPlayerSearchOpen(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Add Your First Student
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {parentStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {student.firstName} {student.lastName}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>USCF ID: {student.uscfId}</span>
                        <span>Rating: {student.regularRating || 'UNR'}</span>
                        <span>Section: {student.section || 'Not set'}</span>
                        {student.school && (
                          <span>{student.school} - {student.district}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={student.uscfId?.toUpperCase() === 'NEW' ? 'secondary' : 'default'}>
                        {student.uscfId?.toUpperCase() === 'NEW' ? 'New Member' : 'USCF Member'}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setIsPlayerSearchOpen(true)}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRemoveStudent(student)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Important Notices - Only show if no students and not showing the main section */}
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
                <Button size="sm" onClick={() => setIsPlayerSearchOpen(true)}>
                  Add Students
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Player Search Dialog for Individual Users */}
      {profile.role === 'individual' && (
        <>
          <PlayerSearchDialog
            isOpen={isPlayerSearchOpen}
            onOpenChange={setIsPlayerSearchOpen}
            onSelectPlayer={() => {}} // Not used for individual portal
            onPlayerSelected={handlePlayerSelected}
            excludeIds={parentStudents.map(s => s.id)}
            portalType="individual"
          />

          {/* Student Edit/Completion Dialog */}
          <StudentEditDialog
            isOpen={isEditStudentDialogOpen}
            onOpenChange={setIsEditStudentDialogOpen}
            student={studentToEdit}
            onStudentUpdated={handleStudentCompleted}
          />

          <AlertDialog open={isRemoveStudentDialogOpen} onOpenChange={setIsRemoveStudentDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {studentToRemove?.firstName} {studentToRemove?.lastName} from your student list? 
                  This will not delete them from the master database, but you will need to add them again if you want to register them for events.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmRemoveStudent}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove Student
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

// Simple Student Edit Dialog Component
function StudentEditDialog({
  isOpen,
  onOpenChange,
  student,
  onStudentUpdated
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  student: MasterPlayer | null;
  onStudentUpdated: (student: MasterPlayer) => void;
}) {
  const { updatePlayer, database, dbDistricts } = useMasterDb();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    grade: '',
    section: 'High School K-12',
    zipCode: '',
    dob: '',
    district: '',
    school: ''
  });
  const [schoolsData, setSchoolsData] = useState<any[]>([]);

  // Load schools data from localStorage
  useEffect(() => {
    try {
      const storedSchools = localStorage.getItem('school_data');
      if (storedSchools) {
        setSchoolsData(JSON.parse(storedSchools));
      }
    } catch (error) {
      console.error('Failed to load schools data:', error);
    }
  }, []);

  // Get all unique districts from both sources
  const allDistricts = useMemo(() => {
    const schoolDistricts = schoolsData.map(school => school.district);
    const playerDistricts = dbDistricts.filter(d => d !== 'ALL' && d !== 'NO_STATE');
    const combined = [...new Set([
      'Independent',
      'Homeschool',
      ...schoolDistricts,
      ...playerDistricts
    ])].filter(Boolean).sort();
    
    return combined;
  }, [schoolsData, dbDistricts]);

  // Get schools for selected district
  const schoolsForSelectedDistrict = useMemo(() => {
    if (!formData.district) return [];
    
    // Handle special districts
    if (formData.district === 'Independent') {
      return ['Independent', 'Homeschool', 'Private School', 'Charter School'];
    }
    
    if (formData.district === 'Homeschool') {
      return ['Homeschool', 'Co-op', 'Online School'];
    }
    
    // Get schools from schools data (primary source)
    const schoolsFromSchoolsData = schoolsData
      .filter(school => school.district === formData.district)
      .map(school => school.schoolName)
      .filter(Boolean);

    // Get schools from player database (backup source)
    const schoolsFromPlayerData = [...new Set(
      database
        .filter(player => player.district === formData.district)
        .map(player => player.school)
        .filter(Boolean)
    )];

    // Combine both sources and remove duplicates
    const allSchools = [...new Set([...schoolsFromSchoolsData, ...schoolsFromPlayerData])].sort();
    
    return allSchools;
  }, [formData.district, schoolsData, database]);

  useEffect(() => {
    if (student && isOpen) {
      setFormData({
        email: student.email || '',
        grade: student.grade || '',
        section: student.section || 'High School K-12',
        zipCode: student.zipCode || '',
        dob: student.dob ? student.dob.split('T')[0] : '',
        district: student.district || '',
        school: student.school || ''
      });
    }
  }, [student, isOpen]);

  // Handle district change - clear school when district changes
  const handleDistrictChange = (district: string) => {
    setFormData(prev => ({
      ...prev,
      district,
      school: '' // Clear school when district changes
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    const updatedStudent: MasterPlayer = {
      ...student,
      email: formData.email.trim(),
      grade: formData.grade,
      section: formData.section,
      zipCode: formData.zipCode.trim(),
      dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
      district: formData.district.trim(),
      school: formData.school.trim()
    };

    try {
      await updatePlayer(updatedStudent);
      toast({
        title: "Student Updated",
        description: `${student.firstName} ${student.lastName}'s information has been completed.`
      });
      onStudentUpdated(updatedStudent);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Update Failed",
        description: "Failed to update student information."
      });
    }
  };

  if (!student) return null;

  const missingFields = [
    !student.dob && !formData.dob && 'Date of Birth',
    !student.grade && !formData.grade && 'Grade', 
    !student.section && !formData.section && 'Section',
    !student.email && !formData.email && 'Email',
    !student.zipCode && !formData.zipCode && 'Zip Code',
    !student.district && !formData.district && 'District',
    !student.school && !formData.school && 'School'
  ].filter(Boolean);

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Complete Student Information</AlertDialogTitle>
          <AlertDialogDescription>
            Please complete the missing information for {student.firstName} {student.lastName}.
            {missingFields.length > 0 && (
              <span className="block mt-2 text-blue-600">
                Missing: {missingFields.join(', ')}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* District and School */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">District</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                value={formData.district}
                onChange={(e) => handleDistrictChange(e.target.value)}
              >
                <option value="">Select District</option>
                <option value="Independent">Independent</option>
                <option value="Homeschool">Homeschool</option>
                <option disabled>─────────────────</option>
                {allDistricts.filter(d => d !== 'Independent' && d !== 'Homeschool').map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium">School</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                value={formData.school}
                onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                disabled={!formData.district}
              >
                <option value="">
                  {formData.district ? `Select School in ${formData.district}` : "Select District First"}
                </option>
                {formData.district === 'Independent' && (
                  <>
                    <option value="Independent">Independent</option>
                    <option value="Homeschool">Homeschool</option>
                    <option value="Private School">Private School</option>
                    <option value="Charter School">Charter School</option>
                  </>
                )}
                {formData.district === 'Homeschool' && (
                  <>
                    <option value="Homeschool">Homeschool</option>
                    <option value="Co-op">Co-op</option>
                    <option value="Online School">Online School</option>
                  </>
                )}
                {formData.district && !['Independent', 'Homeschool'].includes(formData.district) && (
                  <>
                    {schoolsForSelectedDistrict.length > 0 && schoolsForSelectedDistrict.map(school => (
                      <option key={school} value={school}>{school}</option>
                    ))}
                  </>
                )}
              </select>
              {formData.district && schoolsForSelectedDistrict.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {schoolsForSelectedDistrict.length} {formData.district === 'Independent' || formData.district === 'Homeschool' ? 'options' : 'schools'} available
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="student@email.com"
            />
          </div>

          {/* Grade and Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Grade</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                value={formData.grade}
                onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
              >
                <option value="">Select Grade</option>
                <option value="Kindergarten">Kindergarten</option>
                <option value="1st Grade">1st Grade</option>
                <option value="2nd Grade">2nd Grade</option>
                <option value="3rd Grade">3rd Grade</option>
                <option value="4th Grade">4th Grade</option>
                <option value="5th Grade">5th Grade</option>
                <option value="6th Grade">6th Grade</option>
                <option value="7th Grade">7th Grade</option>
                <option value="8th Grade">8th Grade</option>
                <option value="9th Grade">9th Grade</option>
                <option value="10th Grade">10th Grade</option>
                <option value="11th Grade">11th Grade</option>
                <option value="12th Grade">12th Grade</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Section</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                value={formData.section}
                onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))}
              >
                <option value="Elementary K-5">Elementary K-5</option>
                <option value="Middle School K-8">Middle School K-8</option>
                <option value="High School K-12">High School K-12</option>
              </select>
            </div>
          </div>

          {/* Date of Birth and Zip Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Date of Birth</label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                value={formData.dob}
                onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Zip Code</label>
              <input
                type="text"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                value={formData.zipCode}
                onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                placeholder="12345"
              />
            </div>
          </div>

          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit">Complete & Add Student</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}