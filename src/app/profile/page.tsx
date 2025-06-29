
'use client';

import { useState, useEffect, useRef, type ChangeEvent, type ElementType } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { schoolData } from '@/lib/data/school-data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { KingIcon, QueenIcon, RookIcon, BishopIcon, KnightIcon, PawnIcon } from '@/components/icons/chess-icons';

const uniqueDistricts = [...new Set(schoolData.map((school) => school.district))].sort();

const profileFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  district: z.string({ required_error: 'Please select a district.' }).min(1, 'District is required.'),
  school: z.string({ required_error: 'Please select a school.' }).min(1, 'School is required.'),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  phone: z.string().min(10, { message: 'Please enter a valid 10-digit phone number.' }),
});

const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: z.string().min(8, { message: "New password must be at least 8 characters." }),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
});


// Placeholder data for the current sponsor
const currentSponsorData = {
  firstName: 'Sponsor',
  lastName: 'Name',
  district: 'SHARYLAND ISD',
  school: 'SHARYLAND PIONEER H S',
  email: 'sponsor@chessmate.com',
  phone: '(555) 555-5555',
  avatarType: 'icon',
  avatarUrl: 'KingIcon', 
};

const icons: { [key: string]: ElementType } = {
  KingIcon,
  QueenIcon,
  RookIcon,
  BishopIcon,
  KnightIcon,
  PawnIcon,
};


export default function ProfilePage() {
  const { toast } = useToast();
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  
  const [profileImage, setProfileImage] = useState<string | null>(
    currentSponsorData.avatarType === 'upload' ? currentSponsorData.avatarUrl : null
  );
  const [selectedIconName, setSelectedIconName] = useState<string>(
     currentSponsorData.avatarType === 'icon' ? currentSponsorData.avatarUrl : 'KingIcon'
  );
  const [activeTab, setActiveTab] = useState<'icon' | 'upload'>(currentSponsorData.avatarType as 'icon' | 'upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: currentSponsorData,
  });
  
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
      resolver: zodResolver(passwordFormSchema),
      defaultValues: {
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
      },
  });

  useEffect(() => {
    // Pre-populate schools for the default district
    const initialSchools = schoolData
      .filter((school) => school.district === currentSponsorData.district)
      .map((school) => school.schoolName)
      .sort();
    setSchoolsForDistrict(initialSchools);
  }, []);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setProfileImage(reader.result as string);
            setSelectedIconName('');
        };
        reader.readAsDataURL(file);
    }
  };

  const handleIconSelect = (IconName: string) => {
      setSelectedIconName(IconName);
      setProfileImage(null);
  };

  const handleSavePicture = () => {
    console.log("Saving picture:", { activeTab, profileImage, selectedIconName });
    toast({
        title: "Profile Picture Updated",
        description: "Your new profile picture has been saved.",
    });
  }

  const handleDistrictChange = (district: string) => {
    profileForm.setValue('district', district);
    profileForm.setValue('school', ''); 
    const filteredSchools = schoolData
      .filter((school) => school.district === district)
      .map((school) => school.schoolName)
      .sort();
    setSchoolsForDistrict(filteredSchools);
  };
  
  function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
    console.log("Profile updated:", values);
    toast({
      title: 'Profile Updated',
      description: 'Your information has been successfully saved.',
    });
  }
  
  function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
      console.log("Password change requested:", values);
      toast({
          title: "Password Changed",
          description: "Your password has been successfully updated.",
      });
      passwordForm.reset();
  }

  const selectedDistrict = profileForm.watch('district');
  const SelectedIconComponent = selectedIconName ? icons[selectedIconName] : null;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Sponsor Profile</h1>
          <p className="text-muted-foreground">
            View and edit your account information.
          </p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>Upload a photo or choose an avatar icon.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-8 items-start">
                <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-32 w-32 border">
                        {activeTab === 'upload' && profileImage ? (
                            <AvatarImage src={profileImage} alt="Sponsor Profile" />
                        ) : activeTab === 'icon' && SelectedIconComponent ? (
                            <div className="w-full h-full flex items-center justify-center bg-muted rounded-full">
                                <SelectedIconComponent className="w-20 h-20 text-muted-foreground" />
                            </div>
                        ) : (
                            <AvatarFallback className="text-4xl">
                                {currentSponsorData.firstName.charAt(0)}{currentSponsorData.lastName.charAt(0)}
                            </AvatarFallback>
                        )}
                    </Avatar>
                     <Button variant="outline" className="w-full" onClick={handleSavePicture}>Save Picture</Button>
                </div>
                <div className="md:col-span-2">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'icon' | 'upload')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="icon">Choose Icon</TabsTrigger>
                            <TabsTrigger value="upload">Upload Photo</TabsTrigger>
                        </TabsList>
                        <TabsContent value="icon" className="pt-4">
                            <p className="text-sm text-muted-foreground mb-4">Select a chess piece as your avatar.</p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                                {Object.entries(icons).map(([name, IconComponent]) => (
                                    <Button 
                                        key={name} 
                                        variant="outline" 
                                        size="icon" 
                                        className={`h-16 w-16 ${selectedIconName === name && activeTab === 'icon' ? 'ring-2 ring-primary' : ''}`} 
                                        onClick={() => handleIconSelect(name)}
                                    >
                                        <IconComponent className="h-8 w-8" />
                                    </Button>
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="upload" className="pt-4">
                            <p className="text-sm text-muted-foreground mb-4">For best results, upload a square image.</p>
                            <div className="flex gap-2">
                                <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </CardContent>
        </Card>

        <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Sponsor Information</CardTitle>
                        <CardDescription>Update your personal, contact, and sponsorship details here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                            control={profileForm.control}
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
                            control={profileForm.control}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={profileForm.control}
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
                                control={profileForm.control}
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
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={profileForm.control}
                                name="district"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>District</FormLabel>
                                    <Select onValueChange={handleDistrictChange} defaultValue={field.value}>
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
                                control={profileForm.control}
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
                        </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button type="submit">Save Changes</Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
        
        <Card>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Enter your current password and a new password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit">Update Password</Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </AppLayout>
  );
}
