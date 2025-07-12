
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

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
import { schoolData } from "@/lib/data/school-data";
import { districts as uniqueDistricts } from "@/lib/data/districts";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';

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
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const { updateProfile } = useSponsorProfile();

  const allSchoolNames = useMemo(() => {
    const schoolNames = schoolData.map(s => s.schoolName);
    const uniqueSchoolNames = [...new Set(schoolNames)].sort();
    if (!uniqueSchoolNames.includes('Homeschool')) {
        return ['Homeschool', ...uniqueSchoolNames];
    }
    return uniqueSchoolNames;
  }, []);
  
  const form = useForm<z.infer<typeof sponsorFormSchema>>({
    resolver: zodResolver(sponsorFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      district: "None",
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
    let filteredSchools: string[];
    if (district === 'None') {
      filteredSchools = allSchoolNames;
    } else {
        filteredSchools = schoolData
            .filter((school) => school.district === district)
            .map((school) => school.schoolName)
            .sort();
    }
    setSchoolsForDistrict([...new Set(filteredSchools)]);

    if (resetSchool) {
        if (district === 'None') {
            form.setValue('school', 'Homeschool');
        } else {
            form.setValue('school', '');
        }
    }
  };

  useEffect(() => {
    // This is the critical fix: ensure the school list is populated on initial form load.
    const initialDistrict = form.getValues('district');
    handleDistrictChange(initialDistrict, false); 
  }, []);
  
  function onSubmit(values: z.infer<typeof sponsorFormSchema>) {
    const lowercasedEmail = values.email.toLowerCase();
    const usersRaw = localStorage.getItem('users');
    const users: {email: string; role: 'sponsor' | 'individual' | 'organizer'}[] = usersRaw ? JSON.parse(usersRaw) : [];
    
    const existingUser = users.find(user => user.email.toLowerCase() === lowercasedEmail);

    if (existingUser) {
        form.setError('email', {
            type: 'manual',
            message: `This email is already registered as a ${existingUser.role}. Please sign in.`,
        });
        return;
    }

    const newUser = { email: lowercasedEmail, role: 'sponsor' as const };
    const updatedUsers = [...users, newUser];
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    const { password, ...profileValues } = values;
    const schoolInfo = schoolData.find(s => s.schoolName === profileValues.school);

    const profileData: SponsorProfile = {
      ...profileValues,
      email: lowercasedEmail,
      role: 'sponsor',
      avatarType: 'icon',
      avatarValue: 'KingIcon',
      schoolAddress: schoolInfo?.streetAddress || '',
      schoolPhone: schoolInfo?.phone || '',
    };
    
    updateProfile(profileData);
    
    router.push('/profile');
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="district"
            render={({ field }) => (
              <FormItem>
                <FormLabel>District</FormLabel>
                <Select onValueChange={(value) => handleDistrictChange(value)} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a district" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {uniqueDistricts.map((district) => (
                      <SelectItem key={district} value={district}>
                        {district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="school"
            render={({ field }) => (
              <FormItem>
                <FormLabel>School</FormLabel>
                 <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a school" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {schoolsForDistrict.map((school) => (
                      <SelectItem key={school} value={school}>
                        {school}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="bookkeeperEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bookkeeper/Secretary Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="bookkeeper@example.com" {...field} />
                </FormControl>
                <FormDescription>This email will receive a copy of all invoices.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (
              <FormField
                  control={form.control}
                  name="gtCoordinatorEmail"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>GT Coordinator Email</FormLabel>
                      <FormControl>
                      <Input type="email" placeholder="gt.coordinator@example.com" {...field} />
                      </FormControl>
                      <FormDescription>This email will be CC'd on invoices for this district.</FormDescription>
                      <FormMessage />
                  </FormItem>
                  )}
              />
          )}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cell Phone Number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="(555) 555-5555" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
            Create Account
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
              prefetch={false}
            >
              Sign In
            </Link>
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
});

const IndividualSignUpForm = ({ role }: { role: 'individual' | 'organizer' }) => {
  const router = useRouter();
  const { updateProfile } = useSponsorProfile();
  
  const form = useForm<z.infer<typeof individualFormSchema>>({
    resolver: zodResolver(individualFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof individualFormSchema>) {
    const lowercasedEmail = values.email.toLowerCase();
    const usersRaw = localStorage.getItem('users');
    const users: {email: string; role: 'sponsor' | 'individual' | 'organizer'}[] = usersRaw ? JSON.parse(usersRaw) : [];

    const existingUser = users.find(user => user.email.toLowerCase() === lowercasedEmail);

    if (existingUser) {
        form.setError('email', {
            type: 'manual',
            message: `This email is already registered as a ${existingUser.role}. Please sign in.`,
        });
        return;
    }

    const newUser = { email: lowercasedEmail, role: role };
    const updatedUsers = [...users, newUser];
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    const { password, ...profileValues } = values;

    const profileData: SponsorProfile = {
        ...profileValues,
        email: lowercasedEmail,
        phone: '',
        district: 'None',
        school: 'Homeschool',
        gtCoordinatorEmail: '',
        bookkeeperEmail: '',
        schoolAddress: '',
        schoolPhone: '',
        role: role,
        avatarType: 'icon',
        avatarValue: 'PawnIcon',
    };
    
    updateProfile(profileData);

    let path = '/dashboard';
    if (role === 'individual') {
      path = '/individual-dashboard';
    } else if (role === 'organizer') {
      path = '/manage-events';
    }
    router.push(path);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Max" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Robinson" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
            Create Account
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
              prefetch={false}
            >
              Sign In
            </Link>
          </div>
        </CardFooter>
      </form>
    </Form>
  )
};

export default function SignUpPage() {
  const { updateProfile } = useSponsorProfile();

  useEffect(() => {
    updateProfile(null);
  }, [updateProfile]);

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
