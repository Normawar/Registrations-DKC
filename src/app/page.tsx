'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';

export default function LoginPage() {
  const { updateProfile } = useSponsorProfile();
  const router = useRouter();
  
  useEffect(() => {
    updateProfile(null);
  }, [updateProfile]);

  useEffect(() => {
    // This script will run on the client and print the users to the console for us to see.
    const usersRaw = localStorage.getItem('users');
    if (usersRaw) {
        console.log("Found users in system:", JSON.parse(usersRaw));
    } else {
        console.log("No users found in the system.");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get current active tab
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab') || 'sponsor';
    
    // Get form values
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    // Clear any previous errors
    const errorElement = document.getElementById('error-message');
    if (errorElement) errorElement.textContent = '';
    
    if (!email) {
      if (errorElement) errorElement.textContent = 'Email is required';
      return;
    }
    
    if (!password) {
      if (errorElement) errorElement.textContent = 'Password is required';
      return;
    }

    const usersRaw = localStorage.getItem('users');
    const users: {email: string; role: string}[] = usersRaw ? JSON.parse(usersRaw) : [];
    
    const lowercasedEmail = email.toLowerCase();
    const existingUser = users.find(user => user.email.toLowerCase() === lowercasedEmail);

    if (!existingUser) {
        if (errorElement) errorElement.textContent = 'This email is not registered. Please sign up.';
        return;
    }

    if (existingUser.role !== activeTab) {
      if (errorElement) errorElement.textContent = `This email is registered as a ${existingUser.role}. Please use the correct tab to sign in.`;
      return;
    }
    
    const profilesRaw = localStorage.getItem('sponsor_profile');
    const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
    const userProfile = profiles[lowercasedEmail]; 

    if (userProfile) {
        updateProfile(userProfile);
    } else {
        const minimalProfile: SponsorProfile = { 
            email: lowercasedEmail, 
            role: activeTab as 'sponsor' | 'individual' | 'organizer', 
            firstName: 'User', 
            lastName: '', 
            phone: '', 
            district: '', 
            school: '',
            avatarType: 'icon',
            avatarValue: 'PawnIcon'
        };
        updateProfile(minimalProfile);
    }

    // Role-based redirection logic
    if (userProfile?.role === 'sponsor' && userProfile?.isDistrictCoordinator) {
        router.push('/auth/role-selection');
    } else if (userProfile?.role === 'sponsor') {
        router.push('/dashboard');
    } else if (activeTab === 'individual') {
      router.push('/individual-dashboard');
    } else if (activeTab === 'organizer') {
      router.push('/manage-events');
    } else {
      router.push('/profile');
    }
  };

  useEffect(() => {
    // Set up tab functionality with direct DOM manipulation
    const handleTabClick = (tabName: string) => {
      console.log(`Switching to ${tabName}`);
      
      // Update button states
      const buttons = document.querySelectorAll('.tab-button');
      buttons.forEach(btn => {
        btn.classList.remove('active');
      });
      
      const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
      if (activeButton) {
        activeButton.classList.add('active');
      }
      
      // Update submit button text
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.textContent = `Sign In as ${tabName}`;
      }
      
      // Clear form
      const form = document.querySelector('form') as HTMLFormElement;
      if (form) {
        form.reset();
      }
      
      // Clear errors
      const errorElement = document.getElementById('error-message');
      if (errorElement) errorElement.textContent = '';
    };

    // Add event listeners
    document.getElementById('sponsor-tab')?.addEventListener('click', () => handleTabClick('sponsor'));
    document.getElementById('individual-tab')?.addEventListener('click', () => handleTabClick('individual'));
    document.getElementById('organizer-tab')?.addEventListener('click', () => handleTabClick('organizer'));

    // Set initial state
    handleTabClick('sponsor');

    return () => {
      // Cleanup event listeners
      document.getElementById('sponsor-tab')?.removeEventListener('click', () => handleTabClick('sponsor'));
      document.getElementById('individual-tab')?.removeEventListener('click', () => handleTabClick('individual'));
      document.getElementById('organizer-tab')?.removeEventListener('click', () => handleTabClick('organizer'));
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center flex flex-col items-center">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/DK%20Logo%20SVG.png?alt=media&token=23cd3dee-8099-4453-bbc6-8a729424105d"
            width={80}
            height={80}
            alt="Dark Knight Chess Logo"
            className="mb-4"
           />
          <CardTitle className="text-3xl font-bold font-headline">Dark Knight Chess</CardTitle>
          <CardDescription>
            Choose your tab to login to the correct portal
          </CardDescription>
        </CardHeader>
        
        {/* Tabs with direct DOM manipulation */}
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              id="sponsor-tab"
              type="button"
              className="tab-button"
              data-tab="sponsor"
              style={{
                padding: '12px 16px',
                border: '2px solid #ccc',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                flex: 1,
                fontWeight: 'bold'
              }}
            >
              Sponsor
            </button>
            <button
              id="individual-tab"
              type="button"
              className="tab-button"
              data-tab="individual"
              style={{
                padding: '12px 16px',
                border: '2px solid #ccc',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                flex: 1,
                fontWeight: 'bold'
              }}
            >
              Individual
            </button>
            <button
              id="organizer-tab"
              type="button"
              className="tab-button"
              data-tab="organizer"
              style={{
                padding: '12px 16px',
                border: '2px solid #ccc',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                flex: 1,
                fontWeight: 'bold'
              }}
            >
              Organizer
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                name="email"
                type="email" 
                placeholder="name@example.com" 
                required 
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="ml-auto inline-block text-sm text-primary underline-offset-4 hover:underline" prefetch={false}>
                  Forgot password?
                </Link>
              </div>
              <Input 
                id="password" 
                name="password"
                type="password" 
                required 
              />
            </div>
            <p id="error-message" className="text-sm font-medium text-destructive px-1"></p>
            <Button id="submit-btn" type="submit" className="w-full">
              Sign In as sponsor
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or sign in with</span></div>
            </div>
            <Button type="button" variant="outline" className="w-full">
              <svg aria-hidden="true" className="mr-2 h-4 w-4" width="18" height="18" viewBox="0 0 18 18">
                <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6c1.52-1.4 2.37-3.47 2.37-6.05 0-.59-.05-1.16-.14-1.72Z" fill="#4285F4"></path>
                <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-2.7 1.01c-2.12 0-3.92-1.42-4.57-3.33H1.9v2.05A9 9 0 0 0 8.98 17Z" fill="#34A853"></path>
                <path d="M4.41 10.1c-.2-.58-.0-1.22-.0-1.82s0-1.24.2-1.82V4.41H1.9a9 9 0 0 0 0 8.18l2.5-2.05Z" fill="#FBBC05"></path>
                <path d="M8.98 3.33c1.18 0 2.24.4 3.06 1.2l2.3-2.3A9 9 0 0 0 8.98 1Z" fill="#EA4335"></path>
              </svg>
              Google
            </Button>
          </CardContent>
          <CardFooter className="justify-center text-sm">
            <p className="text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline" prefetch={false}>
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>

        <style jsx>{`
          .tab-button.active {
            background-color: #1e40af !important;
            color: white !important;
          }
        `}</style>
      </Card>
    </div>
  );
}
