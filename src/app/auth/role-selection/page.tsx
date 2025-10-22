
'use client';

import { useEffect, useState } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Building, User, Crown, Settings, Search, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

// Mock data - replace with actual Firestore queries
const mockUsers = [
  { id: '1', firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com', role: 'sponsor', school: 'Lincoln Elementary', district: 'Austin ISD' },
  { id: '2', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@example.com', role: 'sponsor', school: 'Washington Middle', district: 'Dallas ISD' },
  { id: '3', firstName: 'Mike', lastName: 'Davis', email: 'mike.davis@example.com', role: 'district_coordinator', school: 'All Schools', district: 'Houston ISD' },
  { id: '4', firstName: 'Lisa', lastName: 'Wilson', email: 'lisa.w@example.com', role: 'sponsor', school: 'Roosevelt High', district: 'San Antonio ISD' },
  { id: '5', firstName: 'Tom', lastName: 'Brown', email: 'tom.brown@example.com', role: 'district_coordinator', school: 'All Schools', district: 'Austin ISD' },
];

export default function RoleSelectionPage() {
  const router = useRouter();
  const { profile, updateProfile, isProfileLoaded } = useSponsorProfile();
  const [view, setView] = useState<'role-select' | 'user-impersonate'>('role-select');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<'sponsor' | 'district_coordinator' | 'all'>('all');
  const [users, setUsers] = useState(mockUsers); // Replace with actual data loading
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // This effect now only handles initial redirection if the user doesn't belong on this page.
    // It no longer causes a loop after a role is selected.
    if (isProfileLoaded) {
        if (!profile) {
            // Not logged in, send to home.
            router.push('/');
        } else if (getUserRole(profile) !== 'organizer' && !profile.isDistrictCoordinator) {
            // User has a single, non-selectable role, send them to their dashboard.
            const dashboardPath = getUserRole(profile) === 'sponsor' ? '/dashboard' : '/individual-dashboard';
            router.push(dashboardPath);
        }
        // If the user is an organizer or a district coordinator, they are allowed to be on this page.
    }
  }, [isProfileLoaded, profile, router]);


  // Load users from Firestore (replace mock data)
  useEffect(() => {
    const loadUsers = async () => {
      if (!db) {
        console.error("Firestore not initialized, cannot load users.");
        return;
      };
      
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const loadedUsers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(user => 
          getUserRole(user) === 'sponsor' || getUserRole(user) === 'district_coordinator'
        );
        setUsers(loadedUsers as any);
      } catch (error) {
        console.error('Error loading users:', error);
        // Keep mock data as fallback
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  if (!isProfileLoaded || !profile) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <p>Loading your profile...</p>
        </div>
    );
  }

  const handleRoleSelection = (path: string, role: 'sponsor' | 'district_coordinator' | 'organizer') => {
    if (profile) {
      updateProfile({ ...profile, role });
    }
    router.push(path);
  };

  const handleUserImpersonation = (targetUser: any) => {
    if (profile) {
      // Create an impersonation profile that combines organizer permissions with target user's context
      const impersonationProfile = {
        ...profile,
        // Keep organizer privileges
        originalRole: 'organizer',
        isImpersonating: true,
        impersonatedUser: targetUser.id,
        // Adopt target user's context
        role: targetUser.role,
        school: targetUser.school,
        district: targetUser.district,
        // Add visual indicator
        firstName: `${profile.firstName} (as ${targetUser.firstName})`,
      };
      updateProfile(impersonationProfile);
    }
    
    const path = targetUser.role === 'sponsor' ? '/dashboard' : '/district-dashboard';
    router.push(path);
  };

  const stopImpersonation = () => {
    if (profile) {
      updateProfile({
        ...profile,
        role: 'organizer',
        firstName: profile.firstName.replace(/ \(as .*\)/, ''), // Remove impersonation indicator
        isImpersonating: false,
        impersonatedUser: undefined,
        originalRole: undefined,
      });
    }
    setView('role-select');
  };

  const isOrganizer = getUserRole(profile) === 'organizer';
  const isImpersonating = profile.isImpersonating;
  const isDistrictCoordinator = profile.isDistrictCoordinator;

  // Filter users based on search and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = `${user.firstName} ${user.lastName} ${user.email} ${user.school} ${user.district}`
      .toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  if (view === 'user-impersonate') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setView('role-select')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Role Selection
            </Button>
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold">Choose User to Impersonate</h1>
              <p className="text-muted-foreground">View the system exactly as this user would see it</p>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, school, or district..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="sponsor">Sponsors Only</SelectItem>
                <SelectItem value="district_coordinator">District Coordinators Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => (
              <Card 
                key={user.id}
                onClick={() => handleUserImpersonation(user)}
                className={`cursor-pointer hover:shadow-md hover:border-primary transition-all duration-200 ${
                  (user as any).isTestAccount ? 'border-orange-200 bg-orange-50' : ''
                }`}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {getUserRole(user) === 'sponsor' ? 
                      <User className="h-8 w-8 text-blue-500" /> : 
                      <Building className="h-8 w-8 text-green-500" />
                    }
                    <div>
                      <h3 className="font-semibold">
                        {user.firstName} {user.lastName}
                        {(user as any).isTestAccount && <Badge className="ml-2" variant="outline">Test Account</Badge>}
                      </h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-sm">{user.school} • {user.district}</p>
                    </div>
                  </div>
                  <Badge variant={getUserRole(user) === 'sponsor' ? 'default' : 'secondary'}>
                    {getUserRole(user) === 'sponsor' ? 'Sponsor' : 'District Coordinator'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your criteria
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main role selection view
  const availableRoles = [];
  
  if (isDistrictCoordinator && !isOrganizer) {
    availableRoles.push(
      {
        key: 'district_coordinator',
        path: '/district-dashboard',
        icon: <Building className="h-10 w-10 text-green-500" />,
        title: 'District Coordinator',
        description: 'Manage all schools in your district',
        details: 'View district-wide registrations, generate reports, and manage all sponsored activities for your district.'
      },
      {
        key: 'sponsor',
        path: '/dashboard',
        icon: <User className="h-10 w-10 text-blue-500" />,
        title: 'Sponsor',
        description: 'Manage your individual school',
        details: 'Access your specific school roster, register students for events, and manage invoices for your school.'
      }
    );
  }

  if (isOrganizer) {
    availableRoles.push(
      {
        key: 'organizer',
        path: '/manage-events',
        icon: <Crown className="h-10 w-10 text-primary" />,
        title: 'Organizer Dashboard',
        description: 'Full administrative access',
        details: 'Access all organizer features, manage events, users, and system settings.'
      },
      {
        key: 'impersonate',
        action: () => setView('user-impersonate'),
        icon: <Settings className="h-10 w-10 text-orange-500" />,
        title: 'Impersonate User',
        description: 'View as a specific user',
        details: 'See exactly what a specific sponsor or district coordinator sees.'
      }
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/DK%20Logo%20SVG.png?alt=media&token=23cd3dee-8099-4453-bbc6-8a729424105d"
            width={80}
            height={80}
            alt="Dark Knight Chess Logo"
            className="mx-auto mb-4"
            priority
           />
          <h1 className="text-3xl font-bold font-headline">
            Welcome, {profile.firstName}!
            {isImpersonating && <Badge className="ml-2" variant="destructive">Impersonating</Badge>}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isImpersonating 
              ? "You are currently viewing the system as another user."
              : isOrganizer 
                ? "Choose how you'd like to access the system."
                : "You have multiple roles. Please select which dashboard you would like to access."
            }
          </p>
        </div>

        {isImpersonating && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-orange-800 font-medium">
              Currently impersonating: {profile.impersonatedUser}
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={stopImpersonation}>
              Stop Impersonation
            </Button>
          </div>
        )}
        
        <div className="grid gap-6 md:grid-cols-2">
          {availableRoles.map((role) => (
            <Card 
              key={role.key}
              onClick={() => role.action ? role.action() : handleRoleSelection(role.path!, role.key as any)}
              className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-center gap-4">
                {role.icon}
                <div>
                  <CardTitle>{role.title}</CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {role.details}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="text-center space-y-2">
          <Button variant="link" onClick={() => router.push('/')}>Log out</Button>
        </div>
      </div>
    </div>
  );
}
