
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { schoolData, type School } from "@/lib/data/school-data";
import { generateTeamCode } from '@/lib/school-utils';
import { PlusCircle, MoreHorizontal } from "lucide-react";
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
});

type SchoolFormValues = z.infer<typeof schoolFormSchema>;

export default function SchoolsPage() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithTeamCode[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolWithTeamCode | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolWithTeamCode | null>(null);

  useEffect(() => {
    const initialSchools = schoolData.map((school, index) => ({
      ...school,
      id: `school-${index}`,
      teamCode: generateTeamCode(school)
    }));
    setSchools(initialSchools);
  }, []);

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
    },
  });

  const handleAddSchool = () => {
    setEditingSchool(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEditSchool = (school: SchoolWithTeamCode) => {
    setEditingSchool(school);
    form.reset({
      id: school.id,
      schoolName: school.schoolName,
      district: school.district,
      streetAddress: school.streetAddress,
      city: school.city,
      zip: school.zip,
      phone: school.phone,
      county: school.county,
    });
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
        ...(values as Omit<School, 'charter'|'students'|'state'|'zip4'>), // This is a safe cast because zod schema matches
        id: `school-${Date.now()}`,
        teamCode,
        // Add default/empty values for other School properties if needed
        charter: '',
        students: '',
        state: 'TX',
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
            <h1 className="text-3xl font-bold font-headline">Schools & Districts</h1>
            <p className="text-muted-foreground">
              Add, edit, or delete school and district information.
            </p>
          </div>
          <Button onClick={handleAddSchool}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New School
          </Button>
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditSchool(school)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteSchool(school)} className="text-destructive">
                            Delete
                          </DropdownMenuItem>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
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
