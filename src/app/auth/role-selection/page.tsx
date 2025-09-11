
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Building, User, Crown } from 'lucide-react';
import Image from 'next/image';

export default function RoleSelectionPage() {
  const router = useRouter();
  const { profile, updateProfile, isProfileLoaded } = useSponsorProfile();

  useEffect(() => {
    // Only redirect if the profile is loaded and it's confirmed to be null
    if (isProfileLoaded && !profile) {
      router.push('/');
    }
  }, [isProfileLoaded, profile, router]);

  if (!isProfileLoaded || !profile) {
    // Render a loading state or nothing while waiting for profile
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
  
  const isOrganizer = profile.uid === 'norma@dkchess.com'; // A simple way to identify the main organizer

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/DK%20Logo%20SVG.png?alt=media&token=23cd3dee-8099-4453-bbc6-8a729424105d"
            width={80}
            height={80}
            alt="Dark Knight Chess Logo"
            className="mx-auto mb-4"
           />
          <h1 className="text-3xl font-bold font-headline">Welcome, {profile.firstName}!</h1>
          <p className="text-muted-foreground mt-2">
            You have multiple roles. Please select which dashboard you would like to access.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            onClick={() => handleRoleSelection(isOrganizer ? '/manage-events' : '/district-dashboard', isOrganizer ? 'organizer' : 'district_coordinator')}
            className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200"
          >
            <CardHeader className="flex flex-row items-center gap-4">
              {isOrganizer ? <Crown className="h-10 w-10 text-primary" /> : <Building className="h-10 w-10 text-primary" />}
              <div>
                <CardTitle>{isOrganizer ? 'Organizer' : 'District Coordinator'}</CardTitle>
                <CardDescription>Access the dashboard for {isOrganizer ? 'All Events' : profile.district}.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {isOrganizer 
                    ? 'Manage events, users, payments, and system-wide settings.'
                    : 'View and manage rosters, registrations, and invoices for all schools within your district.'
                }
              </p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => handleRoleSelection('/dashboard', 'sponsor')}
            className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200"
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <User className="h-10 w-10 text-primary" />
              <div>
                <CardTitle>Sponsor</CardTitle>
                <CardDescription>Access the dashboard for {profile.school}.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Manage your specific school's roster and handle event registrations.
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center">
            <Button variant="link" onClick={() => router.push('/')}>Log out</Button>
        </div>
      </div>
    </div>
  );
}
