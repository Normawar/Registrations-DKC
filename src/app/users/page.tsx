

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Trash2, FilePenLine } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { schoolData } from '@/lib/data/school-data';
import { districts as uniqueDistricts } from '@/lib/data/districts';

type User = {
    email: string;
    role: 'sponsor' | 'organizer' | 'individual';
    firstName?: string;
    lastName?: string;
    school?: string;
    district?: string;
};

const userFormSchema = z.object({
  email: z.string().email(),
  role: z.enum(['sponsor', 'organizer', 'individual']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  school: z.string().optional(),
  district: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function UsersPage() {
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
    const allSchoolNames = useMemo(() => {
        const schoolNames = schoolData.map(s => s.schoolName);
        const uniqueSchoolNames = [...new Set(schoolNames)].sort();
        if (!uniqueSchoolNames.includes('Homeschool')) {
            return ['Homeschool', ...uniqueSchoolNames];
        }
        return uniqueSchoolNames;
    }, []);


    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = () => {
        const usersRaw = localStorage.getItem('users');
        const profilesRaw = localStorage.getItem('sponsor_profile');
        const allUsers: User[] = usersRaw ? JSON.parse(usersRaw) : [];
        const profiles: Record<string, any> = profilesRaw ? JSON.parse(profilesRaw) : {};

        const enrichedUsers = allUsers.map(user => {
            const profile = profiles[user.email];
            return {
                ...user,
                ...(profile || {}),
            };
        });
        
        setUsers(enrichedUsers);
    };

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userFormSchema),
    });

    const handleDistrictChange = (district: string, resetSchool: boolean = true) => {
        form.setValue('district', district);
        if (resetSchool) {
            form.setValue('school', '');
        }
        if (district === 'None') {
            setSchoolsForDistrict(allSchoolNames);
            if (resetSchool) {
              form.setValue('school', 'Homeschool');
            }
        } else {
            const filteredSchools = schoolData
                .filter((school) => school.district === district)
                .map((school) => school.schoolName)
                .sort();
            setSchoolsForDistrict([...new Set(filteredSchools)]);
        }
    };
    
    useEffect(() => {
      if (isDialogOpen && editingUser) {
        const initialDistrict = editingUser.district || 'None';
        form.reset({
            email: editingUser.email,
            role: editingUser.role,
            firstName: editingUser.firstName || '',
            lastName: editingUser.lastName || '',
            school: editingUser.school || '',
            district: initialDistrict,
        });
        handleDistrictChange(initialDistrict, false);
      }
    }, [isDialogOpen, editingUser, form]);

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsDialogOpen(true);
    };

    const handleDeleteUser = (user: User) => {
        setUserToDelete(user);
        setIsAlertOpen(true);
    };

    const confirmDelete = () => {
        if (!userToDelete) return;

        const usersRaw = localStorage.getItem('users');
        let allUsers: User[] = usersRaw ? JSON.parse(usersRaw) : [];
        allUsers = allUsers.filter(u => u.email !== userToDelete.email);
        localStorage.setItem('users', JSON.stringify(allUsers));
        
        const profilesRaw = localStorage.getItem('sponsor_profile');
        let profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
        delete profiles[userToDelete.email];
        localStorage.setItem('sponsor_profile', JSON.stringify(profiles));

        loadUsers(); 
        toast({ title: "User Deleted", description: `${userToDelete.email} has been removed.` });
        setIsAlertOpen(false);
    };

    const onSubmit = (values: UserFormValues) => {
        if (!editingUser) return;

        const usersRaw = localStorage.getItem('users');
        let allUsers: User[] = usersRaw ? JSON.parse(usersRaw) : [];
        allUsers = allUsers.map(u => 
            u.email === editingUser.email ? { ...u, role: values.role } : u
        );
        localStorage.setItem('users', JSON.stringify(allUsers));

        const profilesRaw = localStorage.getItem('sponsor_profile');
        const profiles: Record<string, any> = profilesRaw ? JSON.parse(profilesRaw) : {};
        
        const existingProfile = profiles[values.email] || {};
        profiles[values.email] = { ...existingProfile, ...values };
        
        localStorage.setItem('sponsor_profile', JSON.stringify(profiles));

        loadUsers();

        toast({ title: "User Updated", description: `${values.email}'s information has been updated.` });
        setIsDialogOpen(false);
        setEditingUser(null);
    };

    const selectedDistrict = form.watch('district');

    return (
        <AppLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">User Management</h1>
                    <p className="text-muted-foreground">View, edit, and manage all system users.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All System Users</CardTitle>
                        <CardDescription>A list of all registered users in the system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>School / District</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.email}>
                                        <TableCell className="font-mono">{user.email}</TableCell>
                                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                                        <TableCell className='capitalize'>{user.role}</TableCell>
                                        <TableCell>{user.school || 'N/A'}{user.district ? ` / ${user.district}`: ''}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleEditUser(user)}><FilePenLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>Modify the user's details below.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-6">
                            <Form {...form}>
                                <form id="user-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input disabled {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Role</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="sponsor">Sponsor</SelectItem>
                                                <SelectItem value="organizer">Organizer</SelectItem>
                                                <SelectItem value="individual">Individual</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="district" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>District</FormLabel>
                                            <Select onValueChange={(value) => handleDistrictChange(value)} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {uniqueDistricts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="school" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>School</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {schoolsForDistrict.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-4 border-t shrink-0">
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" form="user-edit-form">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the user account for {userToDelete?.email}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
