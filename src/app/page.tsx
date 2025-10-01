'use client';

import { useState } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { useRouter } from 'next/navigation';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import { simpleSignIn, resetPassword } from '@/lib/simple-auth';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- START OF CHANGE ---
// This flag controls the Individual and Organizer tabs. Set to false to disable them.
const individualAndOrganizerEnabled = true;
// --- END OF CHANGE ---

const SignInForm = ({ userType }: { userType: 'sponsor' | 'individual' | 'organizer' }) => {
  const { updateProfile } = useSponsorProfile();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { user, profile } = await simpleSignIn(email, password);
      
      if (user && profile) {
        await updateProfile(profile as SponsorProfile, user);
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${profile.firstName}!`,
        });

        const userRole = getUserRole(profile);

        if (userRole === 'organizer') {
          router.push('/manage-events');
        } else if (profile.isDistrictCoordinator) {
          router.push('/auth/role-selection');
        } else if (userRole === 'sponsor') {
          router.push('/dashboard');
        } else if (userRole === 'individual') {
          router.push('/individual-dashboard');
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      console.error("Sign in failed:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your email address to reset your password.',
      });
      return;
    }
    
    try {
      await resetPassword(resetEmail);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Please check your inbox for instructions to reset your password.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send password reset email.',
      });
    }
  };

  const getPlaceholders = () => {
    switch (userType) {
      case 'sponsor':
        return { 
          email: "sponsor@school.edu", 
          description: "Sign in to manage your school's chess program" 
        };
      case 'organizer':
        return { 
          email: "norma@dkchess.com", 
          description: "Sign in to manage events and tournaments" 
        };
      default:
        return { 
          email: "your.email@example.com", 
          description: "Sign in to participate in chess events" 
        };
    }
  };

  const placeholders = getPlaceholders();

  return (
    <form onSubmit={handleSignIn}>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground text-center">
          {placeholders.description}
        </p>
        <div className="grid gap-2">
          <Label htmlFor={`email-${userType}`}>Email</Label>
          <Input
            id={`email-${userType}`}
            type="email"
            placeholder={placeholders.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`password-${userType}`}>Password</Label>
          <Input
            id={`password-${userType}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="text-right text-sm">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="link" className="p-0 h-auto">Forgot Password?</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Your Password</AlertDialogTitle>
                <AlertDialogDescription>
                  Enter your email address below and we'll send you a link to reset your password.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="sr-only">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="name@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePasswordReset}>Send Reset Link</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
        <div className="text-sm text-center text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline" prefetch={false}>
            Sign Up
          </Link>
        </div>
      </CardFooter>
    </form>
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
            priority
          />
          <CardTitle className="text-3xl font-bold font-headline">
            Welcome Back
          </CardTitle>
          <CardDescription>
            Choose your account type to sign in.
          </CardDescription>
        </CardHeader>
        <Tabs defaultValue="sponsor" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sponsor">Sponsor</TabsTrigger>
            {/* --- START OF CHANGE --- */}
            <TabsTrigger value="individual" disabled={!individualAndOrganizerEnabled}>Individual</TabsTrigger>
            <TabsTrigger value="organizer" disabled={!individualAndOrganizerEnabled}>Organizer</TabsTrigger>
            {/* --- END OF CHANGE --- */}
          </TabsList>
          <TabsContent value="sponsor">
            <SignInForm userType="sponsor" />
          </TabsContent>
          <TabsContent value="individual">
            <SignInForm userType="individual" />
          </TabsContent>
          <TabsContent value="organizer">
            <SignInForm userType="organizer" />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
