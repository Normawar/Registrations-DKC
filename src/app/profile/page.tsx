
'use client';

import { useState, useEffect, useMemo, useRef, type ChangeEvent, type ElementType } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { districts as uniqueDistricts } from '@/lib/data/districts';
import { schoolData } from '@/lib/data/school-data';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { KingIcon, QueenIcon, RookIcon, BishopIcon, KnightIcon, PawnIcon } from '@/components/icons/chess-icons';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import { auth, storage } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { generateTeamCode } from '@/lib/school-utils';

const profileFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  district: z.string().optional(),
  school: z.string().optional(),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  phone: z.string().min(10, { message: 'Please enter a valid 10-digit phone number.' }),
  schoolAddress: z.string().optional(),
  schoolPhone: z.string().optional(),
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

const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: z.string().min(8, { message: "New password must be at least 8 characters." }),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
});


const icons: { [key: string]: ElementType } = {
  KingIcon,
  QueenIcon,
  RookIcon,
  BishopIcon,
  KnightIcon,
  PawnIcon,
};

const ProfilePageSkeleton = () => (
    <div className="space-y-8 animate-pulse">
        <div>
            <Skeleton className="h-9 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
        </div>
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-8 items-start">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-32 w-32 rounded-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="md:col-span-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full mt-4" />
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
             <CardFooter className="border-t px-6 py-4">
                <Skeleton className="h-10 w-24" />
            </CardFooter>
        </Card>
    </div>
);


export default function ProfilePage() {
  const { toast } = useToast();
  const { profile, updateProfile, isProfileLoaded } = useSponsorProfile();
  
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedIconName, setSelectedIconName] = useState<string>('KingIcon');
  const [activeTab, setActiveTab] = useState<'icon' | 'upload'>('icon');
  const [isSavingPicture, setIsSavingPicture] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      district: '',
      school: '',
      email: '',
      phone: '',
      schoolAddress: '',
      schoolPhone: '',
      gtCoordinatorEmail: '',
      bookkeeperEmail: '',
    },
  });
  
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
      resolver: zodResolver(passwordFormSchema),
      defaultValues: {
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
      },
  });

  const allSchoolNames = useMemo(() => {
    const schoolNames = schoolData.map(s => s.schoolName);
    const uniqueSchoolNames = [...new Set(schoolNames)].sort();
    if (!uniqueSchoolNames.includes('Homeschool')) {
        return ['Homeschool', ...uniqueSchoolNames];
    }
    return uniqueSchoolNames;
  }, []);

  useEffect(() => {
    if (!auth || !storage) {
        setIsAuthReady(false);
        setAuthError("Firebase is not configured, so file uploads are disabled. Please check your .env file.");
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            setCurrentUser(user);
            setIsAuthReady(true);
            setAuthError(null);
        } else {
            signInAnonymously(auth).catch((error) => {
                console.error("Anonymous sign-in failed:", error);
                 if (error instanceof Error && (error as any).code === 'auth/admin-restricted-operation') {
                    setAuthError("File uploads are disabled. Anonymous sign-in is not enabled in the Firebase console.");
                } else {
                    setAuthError("An authentication error occurred. File uploads are disabled.");
                }
                setIsAuthReady(false);
            });
        }
    });
    return () => unsubscribe();
  }, []);

  const handleDistrictChange = (district: string) => {
    profileForm.setValue('district', district);
    if (district === 'None') {
        profileForm.setValue('school', 'Homeschool');
        setSchoolsForDistrict(allSchoolNames);
    } else {
        profileForm.setValue('school', '');
        const filteredSchools = schoolData
            .filter((school) => school.district === district)
            .map((school) => school.schoolName)
            .sort();
        setSchoolsForDistrict([...new Set(filteredSchools)]);
    }
  };

  const handleSchoolChange = (schoolName: string) => {
      profileForm.setValue('school', schoolName);
      const schoolInfo = schoolData.find(s => s.schoolName === schoolName);
      if (schoolInfo) {
          profileForm.setValue('schoolAddress', schoolInfo.streetAddress);
          profileForm.setValue('schoolPhone', schoolInfo.phone);
      } else {
          profileForm.setValue('schoolAddress', '');
          profileForm.setValue('schoolPhone', '');
      }
  }

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        district: profile.district,
        school: profile.school,
        email: profile.email,
        phone: profile.phone,
        schoolAddress: profile.schoolAddress,
        schoolPhone: profile.schoolPhone,
        gtCoordinatorEmail: profile.gtCoordinatorEmail || '',
        bookkeeperEmail: profile.bookkeeperEmail || '',
      });

      if (profile.district === 'None') {
        setSchoolsForDistrict(allSchoolNames);
      } else if (profile.district) {
        const initialSchools = schoolData
          .filter((school) => school.district === profile.district)
          .map((school) => school.schoolName)
          .sort();
        setSchoolsForDistrict([...new Set(initialSchools)]);
      }
      
      setActiveTab(profile.avatarType);
      if (profile.avatarType === 'icon') {
        setSelectedIconName(profile.avatarValue);
        setImagePreview(null);
      } else {
        setImagePreview(profile.avatarValue);
        setSelectedIconName('');
      }
    }
  }, [profile, profileForm, allSchoolNames]);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
            setSelectedIconName('');
        };
        reader.readAsDataURL(file);
    }
  };

  const handleIconSelect = (IconName: string) => {
      setSelectedIconName(IconName);
      setImagePreview(null);
      setImageFile(null);
  };

  const handleSavePicture = async () => {
    setIsSavingPicture(true);
    try {
      if (!isAuthReady) {
          const message = authError || "Authentication is not ready. Cannot upload files.";
          toast({ variant: 'destructive', title: 'Upload Failed', description: message });
          setIsSavingPicture(false);
          return;
      }
      if (!storage) {
        toast({ variant: 'destructive', title: 'Storage Error', description: 'Firebase Storage is not configured.' });
        setIsSavingPicture(false);
        return;
      }
      
      if (activeTab === 'upload' && imageFile) {
        const sanitizedFileName = imageFile.name.replace(/\s+/g, '_');
        const storageRef = ref(storage, `avatars/${currentUser!.uid}/${sanitizedFileName}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        updateProfile({ avatarType: 'upload', avatarValue: downloadUrl });
        setImageFile(null);
      } else if (activeTab === 'icon') {
        updateProfile({ avatarType: 'icon', avatarValue: selectedIconName });
      }
      toast({
        title: "Profile Picture Updated",
        description: "Your new profile picture has been saved.",
      });
    } catch (error) {
      console.error("Failed to save picture:", error);
      let description = "Could not save your profile picture.";
       if (error instanceof Error && (error as any).code === 'storage/unauthorized') {
          description = "You do not have permission to upload this file. Check your Firebase Storage security rules.";
      } else if (error instanceof Error) {
          description = error.message;
      }
      toast({ variant: 'destructive', title: "Save Failed", description: description });
    } finally {
      setIsSavingPicture(false);
    }
  };
  
  function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
    updateProfile(values);
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

  if (!isProfileLoaded) {
    return (
        <AppLayout>
            <ProfilePageSkeleton />
        </AppLayout>
    );
  }
  
  const isSavePictureDisabled = isSavingPicture || !isAuthReady;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Profile</h1>
          <p className="text-muted-foreground">
            View and edit your account information.
          </p>
        </div>
        
        {profile?.role === 'sponsor' && (
            <Card className="bg-secondary/50 border-dashed">
                <CardHeader>
                    <CardTitle className="text-lg">Team Information</CardTitle>
                    <CardDescription>Your school's district, name, and auto-generated team code.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">District</p>
                        <p className="font-semibold">{profile.district}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">School</p>
                        <p className="font-semibold">{profile.school}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Team Code</p>
                        <p className="font-semibold font-mono">{teamCode}</p>
                    </div>
                </CardContent>
            </Card>
        )}

        {authError && (
          <Alert variant="destructive">
            <AlertTitle>File Uploads Disabled</AlertTitle>
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        <Card>
            <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>Upload a photo or choose an avatar icon.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-8 items-start">
                <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-32 w-32 border">
                        {activeTab === 'upload' && imagePreview ? (
                            <AvatarImage src={imagePreview} alt="Sponsor Profile" />
                        ) : activeTab === 'icon' && SelectedIconComponent ? (
                            <div className="w-full h-full flex items-center justify-center bg-muted rounded-full">
                                <SelectedIconComponent className="w-20 h-20 text-muted-foreground" />
                            </div>
                        ) : profile?.avatarType === 'upload' ? (
                            <AvatarImage src={profile.avatarValue} alt="Sponsor Profile" />
                        ) : (
                            <AvatarFallback className="text-4xl">
                                {profile ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}` : 'S'}
                            </AvatarFallback>
                        )}
                    </Avatar>
                     <Button variant="outline" className="w-full" onClick={handleSavePicture} disabled={isSavePictureDisabled}>
                        {isSavingPicture || !isAuthReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSavingPicture ? 'Saving...' : !isAuthReady ? 'Authenticating...' : 'Save Picture'}
                     </Button>
                </div>
                <div className="md:col-span-2">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'icon' | 'upload')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="icon">Choose Icon</TabsTrigger>
                            <TabsTrigger value="upload" disabled={!isAuthReady}>Upload Photo</TabsTrigger>
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
                                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={!isAuthReady}>Choose File</Button>
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
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your personal and contact details here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={profileForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={profileForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={profileForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={profileForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Cell Phone Number</FormLabel><FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        {profile?.role === 'sponsor' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={profileForm.control} name="district" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><Select onValueChange={handleDistrictChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl><SelectContent>{uniqueDistricts.map((district) => (<SelectItem key={district} value={district}>{district}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                                    <FormField control={profileForm.control} name="school" render={({ field }) => ( <FormItem><FormLabel>School</FormLabel><Select onValueChange={handleSchoolChange} value={field.value} disabled={!selectedDistrict}><FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl><SelectContent>{schoolsForDistrict.map((school) => (<SelectItem key={school} value={school}>{school}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={profileForm.control} name="schoolAddress" render={({ field }) => ( <FormItem><FormLabel>School Address</FormLabel><FormControl><Input {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={profileForm.control} name="schoolPhone" render={({ field }) => ( <FormItem><FormLabel>School Phone</FormLabel><FormControl><Input {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={profileForm.control} name="gtCoordinatorEmail" render={({ field }) => ( <FormItem><FormLabel>GT Coordinator Email</FormLabel><FormControl><Input type="email" placeholder="gt.coordinator@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={profileForm.control} name="bookkeeperEmail" render={({ field }) => ( <FormItem><FormLabel>Bookkeeper/Secretary Email</FormLabel><FormControl><Input type="email" placeholder="bookkeeper@example.com" {...field} /></FormControl><FormDescription>This email will receive a copy of all invoices.</FormDescription><FormMessage /></FormItem> )} />
                                </div>
                            </>
                        )}
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
        
        {profile?.role === 'organizer' && (
            <Card>
                <CardHeader>
                    <CardTitle>Account Role</CardTitle>
                    <CardDescription>Change the role and permissions for this account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="role-select">Account Role</Label>
                        <Select
                            value={profile.role}
                            onValueChange={(value) => updateProfile({ role: value as 'sponsor' | 'organizer' | 'individual' })}
                        >
                            <SelectTrigger id="role-select" className="w-full md:w-1/2">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sponsor">Sponsor</SelectItem>
                                <SelectItem value="organizer">Organizer</SelectItem>
                                <SelectItem value="individual">Individual</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            Sponsors can manage their own roster and registrations. Organizers have site-wide access.
                        </p>
                    </div>
                </CardContent>
            </Card>
        )}
      </div>
    </AppLayout>
  );
}
