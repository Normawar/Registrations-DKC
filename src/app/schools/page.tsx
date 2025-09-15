
'use client';

import { useState, useEffect, useMemo, useRef, type ChangeEvent, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, getDocs, doc, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

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
import { schoolData as initialSchoolData, type School, type SchoolNote } from "@/lib/data/school-data";
import { generateTeamCode } from '@/lib/school-utils';
import { PlusCircle, MoreHorizontal, Upload, Trash2, FilePenLine, Edit, Download, Paperclip } from "lucide-react";
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

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
  teamCode: z.string().optional(),
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

  const [selectedDistrictToEdit, setSelectedDistrictToEdit] = useState<string | null>(null);
  const [newDistrictName, setNewDistrictName] = useState('');
  
  // Note states
  const [noteType, setNoteType] = useState<'lesson' | 'general'>('general');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [poFile, setPoFile] = useState<File | null>(null);
  const [editingNote, setEditingNote] = useState<SchoolNote | null>(null);


  const loadSchools = useCallback(async () => {
    if (!db) return;
    setIsDataLoaded(false);
    const schoolsCol = collection(db, 'schools');
    const schoolSnapshot = await getDocs(schoolsCol);

    if (schoolSnapshot.empty) {
        console.log("No schools in Firestore, seeding from initial data.");
        const batch = writeBatch(db);
        initialSchoolData.forEach((school, index) => {
            const id = `school-${index}-${Date.now()}`;
            const schoolWithId = { ...school, id, teamCode: generateTeamCode(school), notes: [] };
            const docRef = doc(db, 'schools', id);
            batch.set(docRef, schoolWithId);
        });
        await batch.commit();
        setSchools(initialSchoolData.map((s, i) => ({ ...s, id: `school-${i}-${Date.now()}`, teamCode: generateTeamCode(s), notes: [] })));
    } else {
        const schoolList = schoolSnapshot.docs.map(doc => doc.data() as SchoolWithTeamCode);
        setSchools(schoolList);
    }
    setIsDataLoaded(true);
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  useEffect(() => {
    if (!isDialogOpen) {
      setEditingNote(null);
      setNoteTitle('');
      setNoteContent('');
      setPoFile(null);
    }
  }, [isDialogOpen]);


  const uniqueDistricts = useMemo(() => {
    const districts = new Set(schools.map(s => s.district));
    return Array.from(districts).sort();
  }, [schools]);

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolFormSchema),
    defaultValues: { schoolName: '', district: '', streetAddress: '', city: '', zip: '', phone: '', county: '', state: 'TX', teamCode: '' },
  });

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const newSchools: SchoolWithTeamCode[] = [];
            let errors = 0;
            results.data.forEach((row: any) => {
                try {
                    const id = `sch-${Date.now()}-${Math.random()}`;
                    const school: SchoolWithTeamCode = {
                        id,
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
                        teamCode: '',
                        notes: [],
                    };
                    if (!school.schoolName || !school.district) throw new Error('Missing required school name or district.');
                    school.teamCode = generateTeamCode({ schoolName: school.schoolName, district: school.district });
                    newSchools.push(school);
                } catch (e) {
                    errors++;
                }
            });
            
            if (newSchools.length > 0) {
                const batch = writeBatch(db);
                newSchools.forEach(school => {
                    const docRef = doc(db, 'schools', school.id);
                    batch.set(docRef, school);
                });
                await batch.commit();
                await loadSchools(); // Refresh from Firestore
            }

            toast({
                title: "Import Complete",
                description: `Successfully imported ${newSchools.length} schools. ${errors > 0 ? `Skipped ${errors} invalid rows.` : ''}`
            });
        },
    });
    if (e.target) e.target.value = '';
  };
  
  const handleExportSchools = () => {
    if (schools.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Schools to Export',
            description: 'There are no schools in the database to export.',
        });
        return;
    }

    const dataToExport = schools.map(s => ({
        'School Name': s.schoolName,
        'Team Code': s.teamCode,
        'District': s.district,
        'City': s.city,
        'County': s.county,
        'Phone': s.phone,
    }));
    
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'school_team_codes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
        title: 'Export Successful',
        description: `Downloaded a list of ${schools.length} schools and their team codes.`,
    });
  };

  const handleAddSchool = () => {
    setEditingSchool(null);
    form.reset({ schoolName: '', district: '', streetAddress: '', city: '', zip: '', phone: '', county: '', state: 'TX', teamCode: '' });
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

  const confirmDelete = async () => {
    if (schoolToDelete && db) {
      await deleteDoc(doc(db, "schools", schoolToDelete.id));
      await loadSchools();
      toast({ title: "School Deleted", description: `${schoolToDelete.schoolName} has been removed.` });
    }
    setIsAlertOpen(false);
    setSchoolToDelete(null);
  };

  async function onSubmit(values: SchoolFormValues) {
    if (!db) return;
    const teamCode = values.teamCode || generateTeamCode(values);
    let schoolToSave: SchoolWithTeamCode;

    if (editingSchool) {
        schoolToSave = { ...editingSchool, ...values, teamCode };
    } else {
        schoolToSave = {
            ...(values as Omit<School, 'charter'|'students'|'zip4'|'notes'>),
            id: `school-${Date.now()}`,
            teamCode,
            charter: '', students: '', zip4: '', notes: [],
        };
    }
    
    await setDoc(doc(db, "schools", schoolToSave.id), schoolToSave, { merge: true });
    await loadSchools();
    toast({ title: editingSchool ? "School Updated" : "School Added" });
    setIsDialogOpen(false);
    setEditingSchool(null);
  }

  const handleNoteSave = async () => {
    if (!editingSchool || !noteTitle.trim() || !noteContent.trim() || !db) return;

    let poFileUrl = editingNote?.poFileUrl;
    let poFileName = editingNote?.poFileName;

    if (noteType === 'lesson' && poFile) {
        const storageRef = ref(storage, `school_pos/${editingSchool.id}/${poFile.name}`);
        await uploadBytes(storageRef, poFile);
        poFileUrl = await getDownloadURL(storageRef);
        poFileName = poFile.name;
    }
    
    const newNote: SchoolNote = {
      id: editingNote?.id || `note-${Date.now()}`,
      type: noteType,
      title: noteTitle,
      content: noteContent,
      timestamp: new Date().toISOString(),
      ...(noteType === 'lesson' && { poFileUrl, poFileName }),
    };

    const updatedNotes = editingNote
      ? editingSchool.notes?.map(n => n.id === editingNote.id ? newNote : n) || [newNote]
      : [...(editingSchool.notes || []), newNote];
      
    const updatedSchool = { ...editingSchool, notes: updatedNotes };

    await setDoc(doc(db, "schools", updatedSchool.id), updatedSchool, { merge: true });
    setEditingSchool(updatedSchool);

    toast({ title: editingNote ? 'Note Updated' : 'Note Added' });
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setPoFile(null);
  };
  
  const handleEditNote = (note: SchoolNote) => {
    setEditingNote(note);
    setNoteType(note.type);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setPoFile(null);
  };
  
  const handleCancelEditNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setPoFile(null);
  };
  
  const handleDeleteNote = async (noteId: string) => {
    if (!editingSchool || !db) return;
    
    const updatedNotes = editingSchool.notes?.filter(n => n.id !== noteId) || [];
    const updatedSchool = { ...editingSchool, notes: updatedNotes };

    await setDoc(doc(db, "schools", updatedSchool.id), updatedSchool, { merge: true });
    setEditingSchool(updatedSchool);
    toast({ title: 'Note Deleted' });
  };
  
  const handleRenameDistrict = async () => {
    if (!selectedDistrictToEdit || !newDistrictName.trim() || !db) return;
    
    const batch = writeBatch(db);
    schools.forEach(school => {
      if (school.district === selectedDistrictToEdit) {
        const schoolRef = doc(db, "schools", school.id);
        const newTeamCode = generateTeamCode({ schoolName: school.schoolName, district: newDistrictName.trim() });
        batch.update(schoolRef, { district: newDistrictName.trim(), teamCode: newTeamCode });
      }
    });

    await batch.commit();
    await loadSchools();
    toast({
      title: 'District Renamed',
      description: `All schools under "${selectedDistrictToEdit}" have been moved to "${newDistrictName.trim()}".`,
    });
    setSelectedDistrictToEdit(null);
    setNewDistrictName('');
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Schools &amp; Districts</h1>
            <p className="text-muted-foreground">Add, edit, or delete school and district information.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportSchools}>
              <Download className="mr-2 h-4 w-4" /> Export All Schools
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Import CSV</Button>
            <Button onClick={handleAddSchool}><PlusCircle className="mr-2 h-4 w-4" /> Add New School</Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Edit District Name</CardTitle>
            <CardDescription>Select a district to rename. This will update all schools associated with it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid gap-1.5 flex-1">
              <Label htmlFor="district-to-edit">District to Rename</Label>
              <Select onValueChange={setSelectedDistrictToEdit} value={selectedDistrictToEdit || ''}>
                <SelectTrigger id="district-to-edit"><SelectValue placeholder="Select a district..." /></SelectTrigger>
                <SelectContent>{uniqueDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 flex-1">
              <Label htmlFor="new-district-name">New District Name</Label>
              <Input id="new-district-name" value={newDistrictName} onChange={(e) => setNewDistrictName(e.target.value)} disabled={!selectedDistrictToEdit} placeholder='Enter new name...' />
            </div>
            <Button onClick={handleRenameDistrict} disabled={!selectedDistrictToEdit || !newDistrictName.trim()}><Edit className="mr-2 h-4 w-4" /> Rename District</Button>
          </CardContent>
        </Card>

        <Card>
           <CardHeader>
            <CardTitle>School List</CardTitle>
            <CardDescription>A complete list of all schools in the system.</CardDescription>
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
                  <TableHead><span className="sr-only">Actions</span></TableHead>
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
                        <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingSchool ? "Edit School & Notes" : "Add New School"}</DialogTitle>
            <DialogDescription>
              {editingSchool ? 'Update school details or manage notes below.' : 'Fill out the details for the school.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-y-auto pr-2">
            {/* Left side: School Details Form */}
            <div className="space-y-4">
              <Form {...form}>
                <form id="school-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <FormField control={form.control} name="schoolName" render={({ field }) => ( <FormItem><FormLabel>School Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="teamCode" render={({ field }) => ( <FormItem><FormLabel>Team Code (Optional)</FormLabel><FormControl><Input {...field} placeholder="Auto-generated if blank" /></FormControl><FormDescription>Manually override the team code. If left blank, one will be generated.</FormDescription><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="district" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="streetAddress" render={({ field }) => ( <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>ZIP Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="county" render={({ field }) => ( <FormItem><FormLabel>County</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <Button type="submit" className="w-full">{editingSchool ? "Save School Changes" : "Add School"}</Button>
                </form>
              </Form>
            </div>
            {/* Right side: Notes section - ONLY SHOWN ON EDIT */}
            {editingSchool && (
              <div className="space-y-4 border-l pl-6">
                  <h3 className="text-lg font-semibold">Organizer Notes</h3>
                  <Card className="bg-muted/50">
                      <CardHeader>
                          <CardTitle className="text-base">{editingNote ? 'Edit Note' : 'Add New Note'}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                          <Select value={noteType} onValueChange={(v) => setNoteType(v as 'lesson' | 'general')} disabled={!!editingNote}>
                              <SelectTrigger><SelectValue placeholder="Select note type..." /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="general">General Note</SelectItem>
                                  <SelectItem value="lesson">Lesson/Training Note</SelectItem>
                              </SelectContent>
                          </Select>
                          <Input placeholder="Note Title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
                          <Textarea placeholder="Note content..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
                          {noteType === 'lesson' && (
                              <div>
                                  <Label htmlFor="po-file">PO Document (PDF)</Label>
                                  <Input id="po-file" type="file" accept=".pdf" onChange={(e) => setPoFile(e.target.files?.[0] || null)} />
                              </div>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleNoteSave} disabled={!noteTitle || !noteContent}>{editingNote ? 'Update Note' : 'Save Note'}</Button>
                            {editingNote && <Button size="sm" variant="ghost" onClick={handleCancelEditNote}>Cancel Edit</Button>}
                          </div>
                      </CardContent>
                  </Card>

                  <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Previous Notes</h4>
                      <ScrollArea className="h-64 border rounded-md p-2">
                          {(editingSchool?.notes || []).length > 0 ? (
                            [...(editingSchool?.notes || [])].reverse().map(note => (
                                  <div key={note.id} className="p-2 border-b last:border-b-0">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <p className="font-medium">{note.title} <Badge variant="secondary" className="ml-2">{note.type}</Badge></p>
                                              <p className="text-xs text-muted-foreground">{format(new Date(note.timestamp), 'PPP')}</p>
                                              <p className="text-sm mt-1">{note.content}</p>
                                          </div>
                                          <div className="flex gap-1">
                                              <Button variant="ghost" size="sm" onClick={() => handleEditNote(note)}>Edit</Button>
                                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteNote(note.id)}>Delete</Button>
                                          </div>
                                      </div>
                                      {note.poFileUrl && (
                                          <Button asChild variant="link" size="sm" className="p-0 h-auto">
                                              <a href={note.poFileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-1 h-3 w-3" />{note.poFileName}</a>
                                          </Button>
                                      )}
                                  </div>
                              ))
                          ) : (
                              <p className="text-sm text-center text-muted-foreground py-4">No notes for this school yet.</p>
                          )}
                      </ScrollArea>
                  </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the school record for {schoolToDelete?.schoolName}.</AlertDialogDescription>
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
