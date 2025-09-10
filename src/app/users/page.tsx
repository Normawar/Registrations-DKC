
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import Papa from 'papaparse';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Trash2, FilePenLine, ArrowUpDown, ArrowUp, ArrowDown, Download, UserPlus } from 'lucide-react';
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
import { createUserByOrganizer } from '@/lib/simple-auth';
import { Loader2 } from 'lucide-react';


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

type SortableColumn = 'email' | 'lastName' | 'role' | 'school';

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

const createUserFormSchema = userFormSchema.extend({
    password: z.string().min(6, 'Temporary password must be at least 6 characters.'),
});

type UserFormValues = z.infer<typeof userFormSchema>;
type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export default function UsersPage() {
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumn; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    
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

    const sortedUsers = useMemo(() => {
        let sortableUsers = [...filteredUsers];
        if (sortConfig !== null) {
            sortableUsers.sort((a, b) => {
                const aValue = (a[sortConfig.key as keyof User] as string | undefined)?.toLowerCase() || '';
                const bValue = (b[sortConfig.key as keyof User] as string | undefined)?.toLowerCase() || '';
                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableUsers;
    }, [filteredUsers, sortConfig]);

    const requestSort = (key: SortableColumn) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name: SortableColumn) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ArrowUpDown className="h-4 w-4" />;
        }
        return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userFormSchema),
    });
    
    const createForm = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserFormSchema),
        defaultValues: {
            email: '',
            role: 'sponsor',
            firstName: '',
            lastName: '',
            school: '',
            district: 'None',
            isDistrictCoordinator: false,
            phone: '',
            bookkeeperEmail: '',
            gtCoordinatorEmail: '',
            password: '',
        }
    });

    const handleDistrictChange = (district: string, formInstance: any, resetSchool: boolean = true) => {
        formInstance.setValue('district', district);
        if (resetSchool) {
            formInstance.setValue('school', '');
        }
        if (district === 'None') {
            setSchoolsForDistrict(allSchoolNames);
            if (resetSchool) {
              formInstance.setValue('school', 'Homeschool');
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
        handleDistrictChange(initialDistrict, form, false);
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
    
    const handleCreateUser = async (values: CreateUserFormValues) => {
        setIsCreatingUser(true);
        try {
            const { password, ...profileData } = values;
            await createUserByOrganizer(values.email, password, profileData);
            toast({
                title: "User Created Successfully",
                description: `${values.email} has been created and can now log in with their temporary password.`,
            });
            loadUsers();
            setIsCreateDialogOpen(false);
            createForm.reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({
                variant: 'destructive',
                title: 'User Creation Failed',
                description: message,
            });
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleExportPsjaUsers = () => {
        const psjaUsers = users.filter(user => user.email.toLowerCase().endsWith('@psjaisd.us'));
        if (psjaUsers.length === 0) {
            toast({
                title: 'No Users Found',
                description: 'There are no users with a @psjaisd.us email address to export.',
            });
            return;
        }

        const dataToExport = psjaUsers.map(user => ({
            'First Name': user.firstName,
            'Last Name': user.lastName,
            'Email': user.email,
            'Phone': user.phone,
            'Role': user.role,
            'School': user.school,
            'District': user.district,
            'Is District Coordinator': user.isDistrictCoordinator ? 'Yes' : 'No',
            'Bookkeeper Email': user.bookkeeperEmail,
            'GT Coordinator Email': user.gtCoordinatorEmail,
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'psja_users_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: 'Export Successful',
            description: `${psjaUsers.length} PSJA users have been exported.`,
        });
    };

    const selectedDistrict = form.watch('district');
    const selectedRole = form.watch('role');

    return (
        <AppLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">User Management</h1>
                        <p className="text-muted-foreground">View, edit, and manage all system users.</p>
                    </div>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Create New User
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All System Users</CardTitle>
                        <CardDescription>A list of all registered users in the system.</CardDescription>
                        <div className="pt-4 flex gap-2">
                            <Input
                                placeholder="Search by name, email, or school..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm"
                            />
                            <Button onClick={handleExportPsjaUsers} variant="outline">
                                <Download className="h-4 w-4 mr-2" />
                                Export PSJA Users
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => requestSort('email')} className="px-0">
                                            Email {getSortIcon('email')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => requestSort('lastName')} className="px-0">
                                            Name {getSortIcon('lastName')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => requestSort('role')} className="px-0">
                                            Role {getSortIcon('role')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => requestSort('school')} className="px-0">
                                            School / District {getSortIcon('school')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedUsers.map((user, index) => (
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
                                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
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
                                            <Select onValueChange={(value) => handleDistrictChange(value, form)} value={field.value}>
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
                                    <FormField control={form.control} name="bookkeeperEmail" render={({ field }) => ( <FormItem><FormLabel>Bookkeeper Email</FormLabel><FormControl><Input type="email" placeholder="bookkeeper@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="gtCoordinatorEmail" render={({ field }) => ( <FormItem><FormLabel>GT Coordinator Email</FormLabel><FormControl><Input type="email" placeholder="gt.coordinator@example.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
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

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>Enter the new user's details and a temporary password.</DialogDescription>
                    </DialogHeader>
                     <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-6">
                            <Form {...createForm}>
                                <form id="user-create-form" onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
                                    <FormField control={createForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="role" render={({ field }) => (
                                        <FormItem><FormLabel>Role</FormLabel>
                                        <Select onValueChange={(value) => createForm.setValue('role', value as User['role'])} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="sponsor">Sponsor</SelectItem>
                                                <SelectItem value="organizer">Organizer</SelectItem>
                                                <SelectItem value="individual">Individual</SelectItem>
                                                <SelectItem value="district_coordinator">District Coordinator</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage />
                                        </FormItem>
                                    )} />
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-4 border-t shrink-0">
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" form="user-create-form" disabled={isCreatingUser}>
                            {isCreatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create User
                        </Button>
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
