
// src/app/signup/page.tsx - Updated with Data Correction for Organizer Account
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import { useToast } from '@/hooks/use-toast';
import { simpleSignUp, simpleSignIn, checkFirebaseConfig } from '@/lib/simple-auth';
import { useMasterDb } from '@/context/master-db-context';

const sponsorFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  district: z.string({ required_error: "Please select a district."}).min(1, "District is required."),
  school: z.string({ required_error: "Please select a school."}).min(1, "School is required."),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  gtCoordinatorEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
  bookkeeperEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
}).refine(data => {
    if (data.district === 'PHARR-SAN JUAN-ALAMO ISD') {
        return data.gtCoordinatorEmail && data.gtCoordinatorEmail.length > 0;
    }
    return true;
}, {
    message: "GT Coordinator Email is required for this district.",
    path: ["gtCoordinatorEmail"],
});

const SponsorSignUpForm = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { dbDistricts, getSchoolsForDistrict, isDbLoaded, schools } = useMasterDb();
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const { updateProfile } = useSponsorProfile();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<z.infer<typeof sponsorFormSchema>>({
    resolver: zodResolver(sponsorFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      district: "Homeschool",
      school: "Homeschool",
      email: "",
      phone: "",
      password: "",
      gtCoordinatorEmail: "",
      bookkeeperEmail: "",
    },
  });

  const selectedDistrict = form.watch('district');

  const handleDistrictChange = (district: string, resetSchool: boolean = true) => {
    form.setValue('district', district);
    const filteredSchools = getSchoolsForDistrict(district);
    setSchoolsForDistrict([...new Set(filteredSchools)]);

    if (resetSchool) {
        if (district === 'Homeschool') {
            form.setValue('school', 'Homeschool');
        } else {
            form.setValue('school', '');
        }
    }
  };

  useEffect(() => {
    if (isDbLoaded) {
      const initialSchools = getSchoolsForDistrict(form.getValues('district'));
      setSchoolsForDistrict(initialSchools);
    }
  }, [isDbLoaded, form, getSchoolsForDistrict]);
  
  async function onSubmit(values: z.infer<typeof sponsorFormSchema>) {
    setIsLoading(true);
    
    try {
      if (!checkFirebaseConfig() || !db) {
        toast({
          variant: 'destructive',
          title: 'Configuration Error',
          description: 'Firebase is not properly configured. Please contact support.',
        });
        setIsLoading(false);
        return;
      }

      const isCoordinator = values.school === 'All Schools' && values.district !== 'Homeschool';
      const role: SponsorProfile['role'] = isCoordinator ? 'district_coordinator' : 'sponsor';

      const { password, email, ...profileValues } = values;
      const schoolInfo = schools.find(s => s.schoolName === profileValues.school);
      
      const profileData: Omit<SponsorProfile, 'uid' | 'email'> = {
        ...profileValues,
        role: role,
        avatarType: 'icon',
        avatarValue: 'KingIcon',
        schoolAddress: schoolInfo?.streetAddress || '',
        schoolPhone: schoolInfo?.phone || '',
        isDistrictCoordinator: isCoordinator,
        forceProfileUpdate: true,
      };
      
      const result = await simpleSignUp(email, password, profileData);
      
      if (result.success) {
        await updateProfile(result.profile as SponsorProfile, result.user);
        
        toast({
            title: "Account Ready!",
            description: `Your ${role} account has been created. Please complete your profile.`,
        });
        
        router.push('/profile');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      toast({
        variant: 'destructive',
        title: "Signup Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} disabled={isLoading} autoComplete="given-name" /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} disabled={isLoading} autoComplete="family-name" /></FormControl><FormMessage /></FormItem> )}/>
          </div>
          <FormField control={form.control} name="district" render={({ field }) => ( <FormItem> <FormLabel>District</FormLabel> <Select onValueChange={(value) => handleDistrictChange(value)} value={field.value} disabled={isLoading}> <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl> <SelectContent>{dbDistricts.map((district) => (<SelectItem key={district} value={district}>{district}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
          <FormField control={form.control} name="school" render={({ field }) => ( <FormItem> <FormLabel>School</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl><SelectContent>{schoolsForDistrict.map((school) => (<SelectItem key={school} value={school}>{school}</SelectItem>))}</SelectContent></Select> <FormMessage /> </FormItem> )}/>
          <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="name@example.com" {...field} disabled={isLoading} autoComplete="email" /></FormControl><FormMessage /></FormItem> )}/>
          <FormField control={form.control} name="bookkeeperEmail" render={({ field }) => ( <FormItem><FormLabel>Bookkeeper/Secretary Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="bookkeeper@example.com" {...field} disabled={isLoading} /></FormControl><FormDescription>This email will receive a copy of all invoices.</FormDescription><FormMessage /></FormItem> )}/>
          {selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (
            <FormField control={form.control} name="gtCoordinatorEmail" render={({ field }) => ( <FormItem><FormLabel>GT Coordinator Email</FormLabel><FormControl><Input type="email" placeholder="gt.coordinator@example.com" {...field} disabled={isLoading} /></FormControl><FormDescription>This email will be CC'd on invoices for this district.</FormDescription><FormMessage /></FormItem> )}/>
          )}
          <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Cell Phone Number</FormLabel><FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} disabled={isLoading} autoComplete="tel" /></FormControl><FormMessage /></FormItem> )}/>
          <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} disabled={isLoading} autoComplete="new-password" /></FormControl><FormMessage /></FormItem> )}/>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline" prefetch={false}>Sign In</Link>
          </div>
        </CardFooter>
      </form>
    </Form>
  );
};

const individualFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  district: z.string({ required_error: "Please select a district."}).min(1, "District is required."),
  school: z.string({ required_error: "Please select a school."}).min(1, "School is required."),
});

// Organizer login logic is now part of this component.
async function handleOrganizerLogin(email: string, password: string) {
  try {
    const signInResult = await simpleSignIn(email, password);
    if (signInResult.success && signInResult.user) {
      const userDocRef = doc(db, 'users', signInResult.user.uid);
      await updateDoc(userDocRef, {
        role: 'organizer',
        isDistrictCoordinator: false,
        district: 'All Districts',
        school: 'Dark Knight Chess',
        updatedAt: new Date().toISOString(),
      });
      const correctedProfile = {
        ...signInResult.profile,
        role: 'organizer',
        district: 'All Districts',
        school: 'Dark Knight Chess',
      } as SponsorProfile;

      return {
        success: true,
        user: signInResult.user,
        profile: correctedProfile,
      };
    }
  } catch (error) {
    console.warn("Organizer login check failed, proceeding to signup.", error);
  }
  return { success: false };
}

const IndividualSignUpForm = ({ role }: { role: 'individual' | 'organizer' }) => {
  const router = useRouter();
  const { toast } = useToast();
  const { updateProfile } = useSponsorProfile();
  const [isLoading, setIsLoading] = useState(false);
  const { dbDistricts, getSchoolsForDistrict, isDbLoaded } = useMasterDb();
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  
  const form = useForm<z.infer<typeof individualFormSchema>>({
    resolver: zodResolver(individualFormSchema),
    defaultValues: { 
        firstName: "", 
        lastName: "", 
        email: "", 
        password: "",
        district: "Homeschool",
        school: "Homeschool",
    },
  });

  const selectedDistrict = form.watch('district');

  const handleDistrictChange = (district: string) => {
    form.setValue('district', district);
    const filteredSchools = getSchoolsForDistrict(district);
    setSchoolsForDistrict(filteredSchools);
    if (district === 'Homeschool') {
        form.setValue('school', 'Homeschool');
    } else {
        form.setValue('school', '');
    }
  };

  useEffect(() => {
    if (isDbLoaded) {
      setSchoolsForDistrict(getSchoolsForDistrict(form.getValues('district')));
    }
  }, [isDbLoaded, form, getSchoolsForDistrict]);

  async function onSubmit(values: z.infer<typeof individualFormSchema>) {
    setIsLoading(true);
    
    try {
      if (!checkFirebaseConfig()) {
        toast({ variant: 'destructive', title: 'Config Error', description: 'Firebase not configured.' });
        setIsLoading(false);
        return;
      }
      
      const isMainOrganizer = values.email.toLowerCase() === 'norma@dkchess.com';

      if (role === 'organizer') {
        if (!isMainOrganizer) {
          form.setError('email', { type: 'manual', message: 'Only the primary organizer can sign up here.' });
          setIsLoading(false);
          return;
        }

        const loginResult = await handleOrganizerLogin(values.email, values.password);
        if (loginResult.success) {
            await updateProfile(loginResult.profile as SponsorProfile, loginResult.user);
            toast({ title: "Welcome Back, Norma!", description: "Your organizer account has been logged in and verified." });
            router.push('/manage-events');
            setIsLoading(false);
            return;
        }
      }

      const userRole: SponsorProfile['role'] = isMainOrganizer ? 'organizer' : 'individual';
      const { password, email, ...profileValues } = values;
      
      const profileData: Omit<SponsorProfile, 'uid' | 'email'> = {
          ...profileValues,
          phone: '',
          district: userRole === 'organizer' ? 'All Districts' : values.district,
          school: userRole === 'organizer' ? 'Dark Knight Chess' : values.school,
          gtCoordinatorEmail: '',
          bookkeeperEmail: '',
          schoolAddress: '',
          schoolPhone: '',
          role: userRole,
          avatarType: 'icon',
          avatarValue: userRole === 'organizer' ? 'KingIcon' : 'PawnIcon',
          isDistrictCoordinator: userRole === 'organizer',
          forceProfileUpdate: true,
      };
      
      const result = await simpleSignUp(email, password, profileData);
      
      if (result.success) {
        await updateProfile(result.profile as SponsorProfile, result.user);
        toast({ title: "Account Ready!", description: `Your new ${userRole} account created. Please complete your profile.` });
        router.push('/profile');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Signup Failed", description: error.message || "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="Max" {...field} disabled={isLoading} autoComplete="given-name" /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Robinson" {...field} disabled={isLoading} autoComplete="family-name" /></FormControl><FormMessage /></FormItem> )}/>
          </div>
          {role === 'individual' && (
            <>
              <FormField control={form.control} name="district" render={({ field }) => ( <FormItem> <FormLabel>District</FormLabel> <Select onValueChange={handleDistrictChange} value={field.value} disabled={isLoading}> <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl> <SelectContent>{dbDistricts.map((district) => (<SelectItem key={district} value={district}>{district}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="school" render={({ field }) => ( <FormItem> <FormLabel>School</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl><SelectContent>{schoolsForDistrict.map((school) => (<SelectItem key={school} value={school}>{school}</SelectItem>))}</SelectContent></Select> <FormMessage /> </FormItem> )}/>
            </>
          )}
          <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="name@example.com" {...field} disabled={isLoading} autoComplete="email" /></FormControl><FormMessage /></FormItem> )}/>
          <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} disabled={isLoading} autoComplete="new-password" /></FormControl><FormMessage /></FormItem> )}/>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline" prefetch={false}>Sign In</Link>
          </div>
        </CardFooter>
      </form>
    </Form>
  )
};

export default function SignUpPage() {
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
            Create an Account
          </CardTitle>
          <CardDescription>
            Choose your account type to get started.
          </CardDescription>
        </CardHeader>
        <Tabs defaultValue="sponsor" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sponsor">Sponsor</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="organizer">Organizer</TabsTrigger>
          </TabsList>
          <TabsContent value="sponsor">
            <SponsorSignUpForm />
          </TabsContent>
          <TabsContent value="individual">
            <IndividualSignUpForm role="individual" />
          </TabsContent>
          <TabsContent value="organizer">
            <IndividualSignUpForm role="organizer" />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
