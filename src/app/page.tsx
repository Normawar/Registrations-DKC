'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';

export default function EmergencyLoginPage() {
  const { updateProfile } = useSponsorProfile();
  const router = useRouter();
  
  useEffect(() => {
    updateProfile(null);
  }, [updateProfile]);

  const createTestUser = (role: 'sponsor' | 'individual' | 'organizer', email: string) => {
    // Create test user in localStorage
    const usersRaw = localStorage.getItem('users');
    const users: {email: string; role: string}[] = usersRaw ? JSON.parse(usersRaw) : [];
    
    // Check if user already exists
    const existingUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (!existingUser) {
      const newUser = { email: email.toLowerCase(), role: role };
      const updatedUsers = [...users, newUser];
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    }

    // Create test profile
    const profileData: SponsorProfile = {
      email: email.toLowerCase(),
      role: role,
      firstName: 'Test',
      lastName: 'User',
      phone: '5551234567',
      district: 'Test District',
      school: 'Test School',
      avatarType: 'icon',
      avatarValue: role === 'sponsor' ? 'KingIcon' : role === 'organizer' ? 'RookIcon' : 'PawnIcon',
      gtCoordinatorEmail: '',
      bookkeeperEmail: '',
      schoolAddress: '',
      schoolPhone: ''
    };

    updateProfile(profileData);

    // Redirect based on role
    if (role === 'sponsor') {
      router.push('/dashboard');
    } else if (role === 'individual') {
      router.push('/individual-dashboard');
    } else if (role === 'organizer') {
      router.push('/manage-events');
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Emergency Login</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Quick access while tabs are being fixed
          </CardDescription>
        </CardHeader>
        
        <CardContent className="grid gap-4">
          <div className="text-center text-sm text-muted-foreground mb-4">
            Click a button to create a test account and login immediately:
          </div>
          
          <Button 
            onClick={() => createTestUser('sponsor', 'test-sponsor@example.com')}
            className="w-full"
            variant="default"
          >
            Login as Sponsor
          </Button>
          
          <Button 
            onClick={() => createTestUser('individual', 'test-individual@example.com')}
            className="w-full"
            variant="secondary"
          >
            Login as Individual
          </Button>
          
          <Button 
            onClick={() => createTestUser('organizer', 'test-organizer@example.com')}
            className="w-full"
            variant="outline"
          >
            Login as Organizer
          </Button>

          <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <strong>Note:</strong> This creates test accounts automatically. Use "Login as Organizer" to access the data upload features you need.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
