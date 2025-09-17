

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, getDocs, doc, deleteDoc, setDoc, query, where, writeBatch } from 'firebase/firestore';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { schoolData } from '@/lib/data/school-data';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/services/firestore-service';
import { createUserByOrganizer } from '@/app/users/actions';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useMasterDb } from '@/context/master-db-context';


type User = {
    email: string;
    role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
    firstName?: string;
    lastName?: string;
    school?: string;
    district?: string;
    isDistrictCoordinator?: boolean;
    isOrganizer?: boolean;
    phone?: string;
    bookkeeperEmail?: string;
    gtCoordinatorEmail?: string;
};

type SortableColumn = 'email' | 'lastName' | 'role' | 'school';

const baseUserFormSchema = z.object({
  email: z.string().email(),
  isSponsor: z.boolean().default(false),
  isDistrictCoordinator: z.boolean().default(false),
  isOrganizer: z.boolean().default(false),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  school: z.string().optional(),
  district: z.string().optional(),
  phone: z.string().optional(),
  bookkeeperEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
  gtCoordinatorEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
});

const refinedUserSchema = baseUserFormSchema.refine(data => data.isSponsor || data.isDistrictCoordinator || data.isOrganizer, {
    message: "A user must have at least one role.",
    path: ["isSponsor"],
});

const createUserFormSchema = baseUserFormSchema.extend({
    password: z.string().min(6, 'Temporary password must be at least 6 characters.'),
}).refine(data => data.isSponsor || data.isDistrictCoordinator || data.isOrganizer, {
    message: "A user must have at least one role.",
    path: ["isSponsor"],
});


type UserFormValues = z.infer<typeof refinedUserSchema>;
type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export default function UsersPage() {
    const { toast } = useToast();
    const { dbDistricts, getSchoolsForDistrict } = useMasterDb();
    const [users, setUsers] = useState<User[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumn; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    
    // State for force delete
    const [emailsToDelete, setEmailsToDelete] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteResults, setDeleteResults] = useState<string[]>([]);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    
    const uniqueDistricts = useMemo(() => {
        return ['None', ...dbDistricts].sort();
    }, [dbDistricts]);

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
        resolver: zodResolver(refinedUserSchema),
    });
    
    const createForm = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserFormSchema),
        defaultValues: {
            email: '',
            isSponsor: true,
            isDistrictCoordinator: false,
            isOrganizer: false,
            firstName: '',
            lastName: '',
            school: '',
            district: 'None',
            phone: '',
            bookkeeperEmail: '',
            gtCoordinatorEmail: '',
            password: '',
        }
    });

    const handleDistrictChange = (district: string, formInstance: any, resetSchool: boolean = true) => {
        formInstance.setValue('district', district);
        const schools = getSchoolsForDistrict(district);
        setSchoolsForDistrict(schools);
        if (resetSchool) {
            formInstance.setValue('school', schools.length > 0 ? '' : 'Homeschool');
        }
    };
    
    useEffect(() => {
      if (isDialogOpen && editingUser) {
        const initialDistrict = editingUser.district || 'None';
        form.reset({
            email: editingUser.email || '',
            isSponsor: editingUser.role === 'sponsor' || editingUser.role === 'district_coordinator',
            isDistrictCoordinator: editingUser.isDistrictCoordinator || editingUser.role === 'district_coordinator',
            isOrganizer: editingUser.role === 'organizer',
            firstName: editingUser.firstName || '',
            lastName: editingUser.lastName || '',
            school: editingUser.school || '',
            district: initialDistrict,
            phone: editingUser.phone || '',
            bookkeeperEmail: editingUser.bookkeeperEmail || '',
            gtCoordinatorEmail: editingUser.gtCoordinatorEmail || '',
        });
        handleDistrictChange(initialDistrict, form, false);
      }
    }, [isDialogOpen, editingUser, form, allSchoolNames, getSchoolsForDistrict]);

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsDialogOpen(true);
    };

    const onSubmit = async (values: UserFormValues) => {
        if (!editingUser || !db) return;
    
        const userSnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', editingUser.email)));
        if (userSnapshot.empty) {
            toast({ variant: 'destructive', title: "Update Failed", description: "Could not find the user to update." });
            return;
        }
        const userDocId = userSnapshot.docs[0].id;
    
        try {
            const userRef = doc(db, "users", userDocId);
    
            let finalRole: User['role'];
            if (values.isOrganizer) {
                finalRole = 'organizer';
            } else if (values.isDistrictCoordinator) {
                finalRole = 'district_coordinator';
            } else if (values.isSponsor) {
                finalRole = 'sponsor';
            } else {
                finalRole = 'individual'; 
            }
    
            // Create a new object for saving to avoid mutating the form state directly
            const dataToSave: any = { ...values, role: finalRole };
    
            // Delete the temporary role flags before saving
            delete dataToSave.isSponsor;
            delete dataToSave.isOrganizer;
            // Note: `isDistrictCoordinator` is a valid field we want to keep
    
            await setDoc(userRef, dataToSave, { merge: true });
    
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
            const { password, isSponsor, isOrganizer, ...profileData } = values;

            let finalRole: User['role'];
            if (isOrganizer) {
              finalRole = 'organizer';
            } else if (values.isDistrictCoordinator) {
              finalRole = 'district_coordinator';
            } else if (isSponsor) {
              finalRole = 'sponsor';
            } else {
              finalRole = 'individual';
            }

            await createUserByOrganizer(values.email, password, { ...profileData, role: finalRole });
            
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
    
    const handleForceDelete = async () => {
        const emails = emailsToDelete.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
        if (emails.length === 0) {
          toast({ variant: 'destructive', title: 'No Emails Provided', description: 'Please enter at least one email to delete.' });
          return;
        }

        setIsDeleting(true);
        setDeleteResults([]);
        const log = (message: string) => setDeleteResults(prev => [...prev, message]);

        if (!db) {
            log('❌ Error: Firestore is not available.');
            setIsDeleting(false);
            return;
        }

        log(`Starting deletion for ${emails.length} user(s)...`);

        try {
            const usersRef = collection(db, 'users');
            // Firestore 'in' queries are limited to 30 items. We need to batch this.
            const BATCH_SIZE = 30;
            let successfullyDeletedCount = 0;
            const allFoundEmails = new Set<string>();

            for (let i = 0; i < emails.length; i += BATCH_SIZE) {
                const emailBatch = emails.slice(i, i + BATCH_SIZE);
                log(`Processing batch ${i / BATCH_SIZE + 1}...`);
                
                const q = query(usersRef, where('email', 'in', emailBatch));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    emailBatch.forEach(email => log(`⚠️ Warning: No Firestore record found for ${email}.`));
                    continue;
                }

                const firestoreBatch = writeBatch(db);
                querySnapshot.forEach(doc => {
                    const userData = doc.data();
                    log(`🔥 Deleting Firestore record for ${userData.email} (ID: ${doc.id})`);
                    firestoreBatch.delete(doc.ref);
                    allFoundEmails.add(userData.email.toLowerCase());
                    successfullyDeletedCount++;
                });
                await firestoreBatch.commit();
            }

            emails.forEach(email => {
                if (!allFoundEmails.has(email)) {
                    log(`⚠️ Warning: No Firestore record found for ${email}. You may need to delete their auth record manually in the Firebase console.`);
                }
            });
          
            log(`✅ Successfully deleted ${successfullyDeletedCount} user records from Firestore.`);
            toast({ title: 'Deletion Complete', description: 'Check the log for details. Note: Auth records must be deleted from the Firebase Console manually.' });
            loadUsers(); // Refresh user list
            setEmailsToDelete('');

        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            log(`❌ Error during Firestore deletion: ${message}`);
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsDeleting(false);
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
                    <CardTitle>Force Delete Users</CardTitle>
                    <CardDescription>
                      Permanently delete user accounts from the database. Enter a list of emails separated by commas, spaces, or new lines. This tool only removes Firestore records, not authentication records.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="test1@example.com, test2@example.com"
                      value={emailsToDelete}
                      onChange={(e) => setEmailsToDelete(e.target.value)}
                      rows={4}
                      disabled={isDeleting}
                    />
                    <Button onClick={() => setIsDeleteAlertOpen(true)} disabled={isDeleting || !emailsToDelete} variant="destructive">
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Permanently Delete {emailsToDelete.split(/[\n,;]+/).filter(Boolean).length} User(s)
                    </Button>
                    {deleteResults.length > 0 && (
                        <div className="pt-4">
                            <h4 className="font-semibold text-sm">Deletion Log:</h4>
                            <pre className="bg-muted mt-2 p-4 rounded-md text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                                {deleteResults.join('\n')}
                            </pre>
                        </div>
                    )}
                  </CardContent>
                </Card>

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
                                            {user.isDistrictCoordinator && user.role === 'sponsor' && <span className="text-xs text-primary font-semibold ml-2">(Coordinator)</span>}
                                        </TableCell>
                                        <TableCell>{user.school || 'N/A'}{user.district ? ` / ${user.district}`: ''}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleEditUser(user)}><FilePenLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
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
                                    <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input disabled {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    
                                    <FormItem>
                                        <FormLabel>Roles</FormLabel>
                                        <div className="space-y-2">
                                            <FormField control={form.control} name="isSponsor" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Sponsor</FormLabel></FormItem>
                                            )} />
                                            <FormField control={form.control} name="isDistrictCoordinator" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>District Coordinator</FormLabel></FormItem>
                                            )} />
                                            <FormField control={form.control} name="isOrganizer" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Organizer</FormLabel></FormItem>
                                            )} />
                                        </div>
                                        <FormMessage />
                                    </FormItem>

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
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch('district')}>
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
                                    <FormField control={createForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={createForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                    
                                    <FormItem>
                                        <FormLabel>Roles</FormLabel>
                                        <div className="space-y-2">
                                            <FormField control={createForm.control} name="isSponsor" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Sponsor</FormLabel></FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="isDistrictCoordinator" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>District Coordinator</FormLabel></FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="isOrganizer" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Organizer</FormLabel></FormItem>
                                            )} />
                                        </div>
                                        <FormMessage />
                                    </FormItem>

                                    {(createForm.watch('isSponsor') || createForm.watch('isDistrictCoordinator')) && (
                                        <>
                                            <FormField
                                                control={createForm.control}
                                                name="district"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>District</FormLabel>
                                                        <Select onValueChange={(value) => handleDistrictChange(value, createForm)} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {uniqueDistricts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {createForm.watch('isSponsor') && (
                                                <FormField
                                                    control={createForm.control}
                                                    name="school"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>School</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={!createForm.watch('district')}>
                                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    {schoolsForDistrict.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </>
                                    )}
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
            
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will attempt to permanently delete all users with the entered emails. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleForceDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Users</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
