
'use client';

import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { schoolData } from "@/lib/data/school-data";

const uniqueDistricts = [...new Set(schoolData.map((school) => school.district))].sort();

const SponsorSignUpForm = () => {
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');

  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    setSelectedSchool(''); 
    const filteredSchools = schoolData
      .filter((school) => school.district === district)
      .map((school) => school.schoolName)
      .sort();
    setSchoolsForDistrict(filteredSchools);
  };
  
  const handleSchoolChange = (school: string) => {
    setSelectedSchool(school);
  }

  return (
    <>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="first-name">First Name</Label>
            <Input id="first-name" placeholder="John" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last-name">Last Name</Label>
            <Input id="last-name" placeholder="Doe" required />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="district">District</Label>
          <Select onValueChange={handleDistrictChange} required>
            <SelectTrigger id="district">
              <SelectValue placeholder="Select a district" />
            </SelectTrigger>
            <SelectContent>
              {uniqueDistricts.map((district) => (
                <SelectItem key={district} value={district}>
                  {district}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="school">School</Label>
          <Select onValueChange={handleSchoolChange} value={selectedSchool} disabled={!selectedDistrict} required>
            <SelectTrigger id="school">
              <SelectValue placeholder="Select a school" />
            </SelectTrigger>
            <SelectContent>
              {schoolsForDistrict.map((school) => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full" asChild>
          <Link href="/dashboard">Create Account</Link>
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
    </>
  );
};

const IndividualSignUpForm = () => (
  <>
    <CardContent className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="first-name">First Name</Label>
          <Input id="first-name" placeholder="Max" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="last-name">Last Name</Label>
          <Input id="last-name" placeholder="Robinson" required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="name@example.com" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required />
      </div>
    </CardContent>
    <CardFooter className="flex flex-col gap-4">
      <Button type="submit" className="w-full" asChild>
        <Link href="/dashboard">Create Account</Link>
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
  </>
);

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
            <IndividualSignUpForm />
          </TabsContent>
          <TabsContent value="organizer">
            <IndividualSignUpForm />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
