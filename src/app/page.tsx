
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AuthForm = ({ role }: { role: 'sponsor' | 'individual' | 'organizer' }) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    if (!email) {
      // Don't check on empty email, let browser validation handle it if needed
      return;
    }

    const usersRaw = localStorage.getItem('users');
    const users: {email: string; role: string}[] = usersRaw ? JSON.parse(usersRaw) : [];
    
    const existingUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());

    // If a user is found, check their role matches the login tab.
    if (existingUser && existingUser.role !== role) {
      setError(`This email is for an ${existingUser.role}. Please use the correct tab.`);
      return;
    }
    
    // In this prototype, we don't have real authentication.
    // The main goal is to prevent cross-role login attempts.
    
    localStorage.setItem('user_role', role);

    let path = '/dashboard';
    if (role === 'individual') {
      path = '/individual-dashboard';
    } else if (role === 'organizer') {
      path = '/manage-events';
    }
    router.push(path);
  };

  return (
    <>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`email-${role}`}>Email</Label>
          <Input id={`email-${role}`} type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor={`password-${role}`}>Password</Label>
            <Link href="#" className="ml-auto inline-block text-sm text-primary underline-offset-4 hover:underline" prefetch={false}>
              Forgot password?
            </Link>
          </div>
          <Input id={`password-${role}`} type="password" />
        </div>
        {error && <p className="text-sm font-medium text-destructive px-1">{error}</p>}
        <Button type="button" className="w-full" onClick={handleLogin}>
          Sign In
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or sign in with</span></div>
        </div>
        <Button variant="outline" className="w-full">
          <svg aria-hidden="true" className="mr-2 h-4 w-4" width="18" height="18" viewBox="0 0 18 18">
            <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6c1.52-1.4 2.37-3.47 2.37-6.05 0-.59-.05-1.16-.14-1.72Z" fill="#4285F4"></path>
            <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-2.7 1.01c-2.12 0-3.92-1.42-4.57-3.33H1.9v2.05A9 9 0 0 0 8.98 17Z" fill="#34A853"></path>
            <path d="M4.41 10.1c-.2-.58-.2-1.22-.2-1.82s0-1.24.2-1.82V4.41H1.9a9 9 0 0 0 0 8.18l2.5-2.05Z" fill="#FBBC05"></path>
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
    </>
  );
};

export default function LoginPage() {
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
        <Tabs defaultValue="sponsor" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sponsor">Sponsor</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="organizer">Organizer</TabsTrigger>
          </TabsList>
          <TabsContent value="sponsor">
            <AuthForm role="sponsor" />
          </TabsContent>
          <TabsContent value="individual">
            <AuthForm role="individual" />
          </TabsContent>
          <TabsContent value="organizer">
            <AuthForm role="organizer" />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
