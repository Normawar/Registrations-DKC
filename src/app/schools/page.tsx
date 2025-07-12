
'use client';

import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { schoolData as initialSchoolData, type School } from "@/lib/data/school-data";
import { generateTeamCode } from '@/lib/school-utils';
import { PlusCircle, MoreHorizontal, Upload, Trash2, FilePenLine } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';

export type SchoolWithTeamCode = School & { id: string; teamCode: string };

const schoolFormSchema = z.object({
  id: z.string().optional(),
  schoolName: z.string().min(1, "School name is required."),
  district: z.string().min(1, "District is required."),
  streetAddress: z.string().min(1, "Street address is required."),
  city: z.string().min(1, "City is required."),
  zip: z.string().min(5, "A valid ZIP code is required."),
  phone: z.string().min(10, "A valid phone number is required."),
  county: z.string().min(1, "County is required."),
  state: z.string().optional(),
});

type SchoolFormValues = z.infer<typeof schoolFormSchema>;

export default function SchoolsPage() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithTeamCode[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolWithTeamCode | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolWithTeamCode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
        const storedSchools = localStorage.getItem('school_data');
        if (storedSchools) {
            setSchools(JSON.parse(storedSchools));
        } else {
            const initialSchoolsWithIds = initialSchoolData.map((school, index) => ({
                ...school,
                id: `school-${index}-${Date.now()}`,
                teamCode: generateTeamCode(school)
            }));
            setSchools(initialSchoolsWithIds);
        }
    } catch (error) {
        console.error("Failed to load schools from localStorage", error);
        setSchools([]);
    }
    setIsDataLoaded(true);
  }, []);

  useEffect(() => {
    if (isDataLoaded) {
        try {
            localStorage.setItem('school_data', JSON.stringify(schools));
        } catch (error) {
            console.error("Failed to save schools to localStorage", error);
        }
    }
  }, [schools, isDataLoaded]);

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolFormSchema),
    defaultValues: {
      schoolName: '',
      district: '',
      streetAddress: '',
      city: '',
      zip: '',
      phone: '',
      county: '',
      state: 'TX',
    },
  });

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const newSchools: SchoolWithTeamCode[] = [];
            let errors = 0;
            results.data.forEach((row: any) => {
                try {
                    const school: SchoolWithTeamCode = {
                        id: `sch-${Date.now()}-${Math.random()}`,
                        schoolName: row['School Name'] || row['schoolName'],
                        district: row['District'] || row['district'],
                        streetAddress: row['Street Address'] || row['streetAddress'],
                        city: row['City'] || row['city'],
                        zip: row['ZIP'] || row['zip'],
                        phone: row['Phone'] || row['phone'],
                        county: row['County Name'] || row['county'],
                        charter: row['Charter'] || row['charter'] || '',
                        students: row['Students'] || row['students'] || '',
                        state: row['State'] || row['state'] || 'TX',
                        zip4: row['ZIP 4-digit'] || row['zip4'] || '',
                        teamCode: ''
                    };
                    
                    if (!school.schoolName || !school.district) {
                        throw new Error('Missing required school name or district.');
                    }

                    school.teamCode = generateTeamCode({ schoolName: school.schoolName, district: school.district });
                    
                    newSchools.push(school);
                } catch (e) {
                    errors++;
                    console.error("Error parsing school row:", row, e);
                }
            });
            
            if (newSchools.length === 0 && results.data.length > 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Import Failed',
                    description: 'Could not find any valid schools. Please check if your CSV headers match the expected format (e.g., "School Name", "District").'
                });
                return;
            }

            setSchools(prev => [...prev, ...newSchools]);
            
            toast({
                title: "Import Complete",
                description: `Successfully imported ${newSchools.length} schools. ${errors > 0 ? `Skipped ${errors} invalid rows.` : ''}`
            });
        },
        error: (error) => {
            toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: `An error occurred while parsing the CSV file: ${error.message}`
            });
        }
    });

    if (e.target) {
        e.target.value = '';
    }
  };

  const handleAddSchool = () => {
    setEditingSchool(null);
    form.reset({
      schoolName: '',
      district: '',
      streetAddress: '',
      city: '',
      zip: '',
      phone: '',
      county: '',
      state: 'TX',
    });
    setIsDialogOpen(true);
  };

  const handleEditSchool = (school: SchoolWithTeamCode) => {
    setEditingSchool(school);
    form.reset(school);
    setIsDialogOpen(true);
  };

  const handleDeleteSchool = (school: SchoolWithTeamCode) => {
    setSchoolToDelete(school);
    setIsAlertOpen(true);
  };

  const confirmDelete = () => {
    if (schoolToDelete) {
      setSchools(schools.filter(s => s.id !== schoolToDelete.id));
      toast({ title: "School Deleted", description: `${schoolToDelete.schoolName} has been removed.` });
    }
    setIsAlertOpen(false);
    setSchoolToDelete(null);
  };

  function onSubmit(values: SchoolFormValues) {
    const teamCode = generateTeamCode(values);
    if (editingSchool) {
      setSchools(schools.map(s => s.id === editingSchool.id ? { ...s, ...values, teamCode } : s));
      toast({ title: "School Updated", description: `${values.schoolName} has been updated.` });
    } else {
      const newSchool: SchoolWithTeamCode = {
        ...(values as Omit<School, 'charter'|'students'|'zip4'>), // This is a safe cast because zod schema matches
        id: `school-${Date.now()}`,
        teamCode,
        charter: '',
        students: '',
        zip4: '',
      };
      setSchools([...schools, newSchool]);
      toast({ title: "School Added", description: `${values.schoolName} has been added.` });
    }
    setIsDialogOpen(false);
    setEditingSchool(null);
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Schools &amp; Districts</h1>
            <p className="text-muted-foreground">
              Add, edit, or delete school and district information.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileImport}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={handleAddSchool}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New School
            </Button>
          </div>
        </div>

        <Card>
           <CardHeader>
            <CardTitle>School List</CardTitle>
            <CardDescription>
              A complete list of all schools in the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>Team Code</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.schoolName}</TableCell>
                    <TableCell>{school.teamCode}</TableCell>
                    <TableCell>{school.district}</TableCell>
                    <TableCell>{school.city}</TableCell>
                    <TableCell>{school.county}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditSchool(school)}><FilePenLine className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteSchool(school)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSchool ? "Edit School" : "Add New School"}</DialogTitle>
            <DialogDescription>
              Fill out the details for the school below. The Team Code will be generated automatically.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="schoolName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="district" render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="streetAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="zip" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input type="tel" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="county" render={({ field }) => (
                  <FormItem>
                    <FormLabel>County</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">{editingSchool ? "Save Changes" : "Add School"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the school record for {schoolToDelete?.schoolName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
