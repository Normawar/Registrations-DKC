'use client';

import { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('sponsor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userList, setUserList] = useState<{email: string, role: string}[]>([]);
  
  useEffect(() => {
    updateProfile(null);
    
    // This script will run on the client and display the users for us to see.
    const usersRaw = localStorage.getItem('users');
    if (usersRaw) {
        console.log("Found users in system:", JSON.parse(usersRaw));
        setUserList(JSON.parse(usersRaw));
    } else {
        console.log("No users found in the system.");
    }
  }, [updateProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!password) {
      setError('Password is required');
      return;
    }

    const usersRaw = localStorage.getItem('users');
    const users: {email: string; role: string}[] = usersRaw ? JSON.parse(usersRaw) : [];
    
    const lowercasedEmail = email.toLowerCase();
    const existingUser = users.find(user => user.email.toLowerCase() === lowercasedEmail);

    if (!existingUser) {
        setError('This email is not registered. Please sign up.');
        return;
    }

    if (existingUser.role !== activeTab) {
      setError(`This email is registered as a ${existingUser.role}. Please use the correct tab to sign in.`);
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

  const handleTabClick = (tab: string) => {
    console.log(`Switching to ${tab} tab`);
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setError('');
  };

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
        
        {/* Simple custom tabs */}
        <div className="w-full px-6 mb-4">
          <div className="flex space-x-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => handleTabClick('sponsor')}
              className={`px-4 py-2 text-sm font-medium rounded-md flex-1 transition-colors ${
                activeTab === 'sponsor' 
                  ? 'bg-primary text-primary-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sponsor
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('individual')}
              className={`px-4 py-2 text-sm font-medium rounded-md flex-1 transition-colors ${
                activeTab === 'individual' 
                  ? 'bg-primary text-primary-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('organizer')}
              className={`px-4 py-2 text-sm font-medium rounded-md flex-1 transition-colors ${
                activeTab === 'organizer' 
                  ? 'bg-primary text-primary-foreground shadow' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Organizer
            </button>
          </div>
        </div>

        {/* Single form for all tabs */}
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
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
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive px-1">{error}</p>}
            <Button type="submit" className="w-full">
              Sign In as {activeTab}
            </Button>
          </CardContent>
        </form>
        
        {/* User List for Debugging */}
        <CardFooter className="flex flex-col items-start text-sm">
            <h3 className="font-bold mb-2">Existing Users (for testing):</h3>
            {userList.length > 0 ? (
                <ul className="list-disc pl-5">
                    {userList.map(user => (
                        <li key={user.email}>
                           <span className="font-mono">{user.email}</span> ({user.role})
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground">No users found in localStorage.</p>
            )}
            <div className="w-full text-center mt-4">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline" prefetch={false}>
                  Sign up
                </Link>
              </p>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}