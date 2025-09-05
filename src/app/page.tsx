
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';

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
import Link from "next/link";
import Image from "next/image";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/services/firestore-service';

const loginFormSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

const LoginForm = ({ role }: { role: 'sponsor' | 'individual' | 'organizer' }) => {
    const router = useRouter();
    const { toast } = useToast();
    const { updateProfile } = useSponsorProfile();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof loginFormSchema>>({
        resolver: zodResolver(loginFormSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: z.infer<typeof loginFormSchema>) {
        setIsLoading(true);
        
        try {
            // Import the simple auth functions
            const { simpleSignIn, checkFirebaseConfig } = await import('@/lib/simple-auth');
            
            // Check Firebase configuration first
            if (!checkFirebaseConfig()) {
                toast({
                    variant: 'destructive',
                    title: 'Configuration Error',
                    description: 'Firebase is not properly configured. Please contact support.',
                });
                setIsLoading(false);
                return;
            }
    
            // Use the simple signin function
            const result = await simpleSignIn(values.email, values.password);
            
            if (result.success) {
                await updateProfile(result.profile as SponsorProfile);
                toast({
                    title: "Login Successful",
                    description: `Welcome back, ${result.profile.firstName}!`,
                });
                
                setTimeout(() => {
                    switch (result.profile.role) {
                        case 'organizer':
                            router.push('/manage-events');
                            break;
                        case 'district_coordinator':
                            router.push('/district-dashboard');
                            break;
                        case 'sponsor':
                             if (result.profile.isDistrictCoordinator) {
                                router.push('/auth/role-selection');
                            } else {
                                router.push('/dashboard');
                            }
                            break;
                        case 'individual':
                            router.push('/individual-dashboard');
                            break;
                        default:
                            router.push('/dashboard');
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Login error:', error);
            
            form.setError("email", {
                type: "manual",
                message: error instanceof Error ? error.message : "An error occurred during login. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid gap-4">
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="name@example.com" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )}/>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline" prefetch={false}>
                  Sign Up
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
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
                <CardTitle className="text-3xl font-bold font-headline">
                    Welcome Back
                </CardTitle>
                <CardDescription>
                    Enter your credentials to access Registrations for chess tournaments.  If you are a parent or student who is not registering with a school team, please sign up as an Individual.
                </CardDescription>
                </CardHeader>
                <Tabs defaultValue="sponsor" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="sponsor">Sponsor</TabsTrigger>
                        <TabsTrigger value="individual">Individual</TabsTrigger>
                        <TabsTrigger value="organizer">Organizer</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sponsor"><LoginForm role="sponsor" /></TabsContent>
                    <TabsContent value="individual"><LoginForm role="individual" /></TabsContent>
                    <TabsContent value="organizer"><LoginForm role="organizer" /></TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}
