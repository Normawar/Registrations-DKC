'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Trash2, FilePenLine } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { schoolData } from '@/lib/data/school-data';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/services/firestore-service';

type User = {
    email: string;
    role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
    firstName?: string;
    lastName?: string;
    school?: string;
    district?: string;
    isDistrictCoordinator?: boolean;
    phone?: string;
    bookkeeperEmail?: string;
    gtCoordinatorEmail?: string;
};

const userFormSchema = z.object({
  email: z.string().email(),
  role: z.enum(['sponsor', 'organizer', 'individual', 'district_coordinator']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  school: z.string().optional(),
  district: z.string().optional(),
  isDistrictCoordinator: z.boolean().optional(),
  phone: z.string().optional(),
  bookkeeperEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
  gtCoordinatorEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
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
    const [searchTerm, setSearchTerm] = useState('');
    
    const uniqueDistricts = useMemo(() => {
        const districts = new Set(schoolData.map(s => s.district));
        return ['None', ...Array.from(districts)].sort();
    }, []);

    const allSchoolNames = useMemo(() => {
        const schoolNames = schoolData.map(s => s.schoolName);
        const uniqueSchoolNames = [...new Set(schoolNames)].sort();
        if (!uniqueSchoolNames.includes('Homeschool')) {
            return ['Homeschool', ...uniqueSchoolNames];
        }
        return uniqueSchoolNames;
    }, []);


    const loadUsers = async () => {
        if (!db) return;
        const usersCol = collection(db, 'users');
        const userSnapshot = await getDocs(usersCol);
        const userList = userSnapshot.docs.map(doc => doc.data() as User);
        setUsers(userList);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) {
            return users;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return users.filter(user =>
            (user.firstName?.toLowerCase() || '').includes(lowercasedTerm) ||
            (user.lastName?.toLowerCase() || '').includes(lowercasedTerm) ||
            (user.email?.toLowerCase() || '').includes(lowercasedTerm) ||
            (user.school?.toLowerCase() || '').includes(lowercasedTerm)
        );
    }, [searchTerm, users]);

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
            isDistrictCoordinator: editingUser.isDistrictCoordinator || false,
            phone: editingUser.phone || '',
            bookkeeperEmail: editingUser.bookkeeperEmail || '',
            gtCoordinatorEmail: editingUser.gtCoordinatorEmail || '',
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

    const confirmDelete = async () => {
        if (!userToDelete || !db) return;

        try {
            await deleteDoc(doc(db, "users", userToDelete.email));
            loadUsers(); 
            toast({ title: "User Deleted", description: `${userToDelete.email} has been removed.` });
        } catch (error) {
            console.error("Error deleting user:", error);
            toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove user from the database." });
        }
        
        setIsAlertOpen(false);
    };

    const onSubmit = async (values: UserFormValues) => {
        if (!editingUser || !db) return;

        try {
            const userRef = doc(db, "users", values.email);
            await setDoc(userRef, values, { merge: true });
            
            loadUsers();
            toast({ title: "User Updated", description: `${values.email}'s information has been updated.` });
            setIsDialogOpen(false);
            setEditingUser(null);
        } catch (error) {
            console.error("Error updating user:", error);
            toast({ variant: 'destructive', title: "Update Failed", description: "Could not update user in the database." });
        }
    };

    const selectedDistrict = form.watch('district');
    const selectedRole = form.watch('role');

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
                        <div className="pt-4">
                            <Input
                                placeholder="Search by name, email, or school..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm"
                            />
                        </div>
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
                                {filteredUsers.map((user, index) => (
                                    <TableRow key={`${user.email}-${index}`}>
                                        <TableCell className="font-mono">{user.email}</TableCell>
                                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                                        <TableCell className='capitalize'>
                                            {user.role}
                                            {user.isDistrictCoordinator && <span className="text-xs text-primary font-semibold ml-2">(Coordinator)</span>}
                                        </TableCell>
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
                                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Role</FormLabel>
                                        <Select onValueChange={(value) => form.setValue('role', value as User['role'])} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="sponsor">Sponsor</SelectItem>
                                                <SelectItem value="organizer">Organizer</SelectItem>
                                                <SelectItem value="individual">Individual</SelectItem>
                                                <SelectItem value="district_coordinator">District Coordinator</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage />
                                        </FormItem>
                                    )} />
                                    {selectedRole === 'sponsor' && (
                                        <FormField
                                            control={form.control}
                                            name="isDistrictCoordinator"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                                <FormControl>
                                                    <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                    Approve as District Coordinator
                                                    </FormLabel>
                                                    <FormDescription>
                                                        Grants this sponsor view access to all schools and registrations in their district.
                                                    </FormDescription>
                                                </div>
                                                </FormItem>
                                            )}
                                        />
                                    )}
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
                                    <FormField control={form.control} name="bookkeeperEmail" render={({ field }) => ( <FormItem><FormLabel>Bookkeeper Email</FormLabel><FormControl><Input type="email" placeholder="bookkeeper@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="gtCoordinatorEmail" render={({ field }) => ( <FormItem><FormLabel>GT Coordinator Email</FormLabel><FormControl><Input type="email" placeholder="gt.coordinator@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
