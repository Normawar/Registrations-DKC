
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import Papa from 'papaparse';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Trash2, FilePenLine, ArrowUpDown, ArrowUp, ArrowDown, Download, UserPlus, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { schoolData } from '@/lib/data/school-data';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { useMasterDb } from '@/context/master-db-context';
import { Textarea } from '@/components/ui/textarea';
import { forceDeleteUsersAction } from './actions';


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
  isIndividual: z.boolean().default(false), // Added Individual role
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  school: z.string().optional(),
  district: z.string().optional(),
  phone: z.string().optional(),
  bookkeeperEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
  gtCoordinatorEmail: z.string().email({ message: 'Please enter a valid email.' }).optional().or(z.literal('')),
});

const refinedUserSchema = baseUserFormSchema.refine(data => data.isSponsor || data.isDistrictCoordinator || data.isOrganizer || data.isIndividual, {
    message: "A user must have at least one role.",
    path: ["isSponsor"], // This path can stay, error shows under first checkbox
});

type UserFormValues = z.infer<typeof refinedUserSchema>;

export default function UsersPage() {
    const { toast } = useToast();
    const { dbDistricts, getSchoolsForDistrict, allSchoolNames } = useMasterDb();
    const [users, setUsers] = useState<User[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumn; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });
    
    // State for force delete with useTransition
    const [isPending, startTransition] = useTransition();
    const [emailsToDelete, setEmailsToDelete] = useState('');
    const [deleteResults, setDeleteResults] = useState<string[]>([]);
    
    const uniqueDistricts = useMemo(() => {
        return ['None', ...dbDistricts].sort();
    }, [dbDistricts]);

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

    const handleDistrictChange = (district: string) => {
        form.setValue('district', district);
        const schools = getSchoolsForDistrict(district);
        setSchoolsForDistrict(schools);
        form.setValue('school', schools.length > 0 ? '' : 'Homeschool');
    };
    
    useEffect(() => {
      if (isDialogOpen && editingUser) {
        const initialDistrict = editingUser.district || 'None';
        form.reset({
            email: editingUser.email || '',
            isSponsor: editingUser.role === 'sponsor',
            isDistrictCoordinator: editingUser.role === 'district_coordinator' || editingUser.isDistrictCoordinator === true,
            isOrganizer: editingUser.role === 'organizer',
            isIndividual: editingUser.role === 'individual',
            firstName: editingUser.firstName || '',
            lastName: editingUser.lastName || '',
            school: editingUser.school || '',
            district: initialDistrict,
            phone: editingUser.phone || '',
            bookkeeperEmail: editingUser.bookkeeperEmail || '',
            gtCoordinatorEmail: editingUser.gtCoordinatorEmail || '',
        });
        handleDistrictChange(initialDistrict);
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

            const dataToSave: any = { 
                ...values, 
                role: finalRole,
                isDistrictCoordinator: finalRole === 'district_coordinator' || values.isDistrictCoordinator,
                updatedAt: new Date().toISOString()
            };

            delete dataToSave.isSponsor;
            delete dataToSave.isOrganizer;
            delete dataToSave.isIndividual;

            console.log('Updating user with data:', dataToSave);

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
    
    const handleForceDelete = () => {
        const emails = emailsToDelete.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
        if (emails.length === 0) {
            toast({ variant: 'destructive', title: 'No Emails Provided', description: 'Please enter at least one email to delete.' });
            return;
        }
    
        if (!confirm(`Are you sure you want to permanently delete ${emails.length} user(s)? This will remove their authentication record AND Firestore data. This action CANNOT be undone.`)) {
            return;
        }
        
        startTransition(async () => {
            setDeleteResults([]);
            const log = (message: string) => setDeleteResults(prev => [...prev, message]);
        
            log(`Starting deletion for ${emails.length} user(s)...`);
        
            const { deleted, failed } = await forceDeleteUsersAction(emails);
        
            deleted.forEach(email => log(`✅ Successfully deleted user: ${email}`));
            failed.forEach(({ email, reason }) => log(`❌ Failed to delete user: ${email}. Reason: ${reason}`));
        
            log(`\n🎉 Deletion process complete.`);
            toast({ title: 'Deletion Complete', description: `Processed ${emails.length} emails. Check log for details.` });
            
            await loadUsers(); // Refresh user list
        });
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
                
                <Card>
                    <CardHeader>
                        <CardTitle>Force Delete Users</CardTitle>
                        <CardDescription>
                            Permanently delete user accounts from Firebase Authentication and the Firestore database. Enter a list of emails separated by commas, spaces, or new lines. This action cannot be undone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="user1@example.com, user2@example.com"
                            value={emailsToDelete}
                            onChange={(e) => setEmailsToDelete(e.target.value)}
                            rows={4}
                            disabled={isPending}
                        />
                        <Button onClick={handleForceDelete} disabled={isPending} variant="destructive">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Permanently Delete Users
                        </Button>
                    </CardContent>
                    {deleteResults.length > 0 && (
                        <CardContent>
                            <h4 className="font-medium mb-2">Deletion Log</h4>
                            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-48 whitespace-pre-wrap">
                                {deleteResults.join('\n')}
                            </pre>
                        </CardContent>
                    )}
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
                                            <FormField control={form.control} name="isIndividual" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Individual</FormLabel></FormItem>
                                            )} />
                                        </div>
                                        <FormMessage />
                                    </FormItem>

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
        </AppLayout>
    );
}
