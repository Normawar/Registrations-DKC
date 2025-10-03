'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard } from '@/app/auth-guard';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Edit, UserPlus, History, Building2 } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12 };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional().transform(val => val === '' ? undefined : val),
  lastName: z.string().min(1, "Last Name is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  uscfExpiration: z.date().optional(),
  regularRating: z.preprocess((val) => { if (!val || String(val).toUpperCase() === 'UNR' || val === '') { return undefined; } return val; }, z.coerce.number({ invalid_type_error: "Rating must be a number or UNR." }).optional()),
  grade: z.string().optional().transform(val => val === '' ? undefined : val),
  section: z.string().optional().transform(val => val === '' ? undefined : val),
  email: z.string().email("Invalid email.").min(1, "Email is required."),
  zipCode: z.string().min(1, "Zip Code is required."),
  phone: z.string().optional().transform(val => val === '' ? undefined : val),
  dob: z.date().optional(),
  studentType: z.string().optional().transform(val => val === '' ? undefined : val),
  state: z.string().optional().transform(val => val === '' ? undefined : val),
  school: z.string().min(1, "School is required."),
  district: z.string().min(1, "District is required."),
}).refine(data => data.uscfId.toUpperCase() !== 'NEW' ? data.uscfExpiration !== undefined : true, { message: "USCF Expiration is required unless ID is NEW.", path: ["uscfExpiration"] }).refine(data => { if (!data.grade || !data.section || data.section === 'Championship') return true; const playerGrade = gradeToNumber[data.grade]; const sectionMax = sectionMaxGrade[data.section]; if (playerGrade === undefined || sectionMax === undefined) return true; return playerGrade <= sectionMax; }, { message: "Player's grade is too high for this section.", path: ["section"] });

type PlayerFormValues = z.infer<typeof playerFormSchema>;

const DateInput = React.forwardRef<HTMLInputElement, { value?: Date; onChange?: (date: Date | undefined) => void; placeholder?: string; }>(({ value, onChange, placeholder }, ref) => {
  const [textValue, setTextValue] = useState('');
  useEffect(() => { setTextValue(value instanceof Date && isValid(value) ? format(value, 'MM/dd/yyyy') : ''); }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const str = e.target.value; setTextValue(str); if (!str) { onChange?.(undefined); return; } if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) { const [month, day, year] = str.split('/').map(Number); const date = new Date(year, month - 1, day); if (isValid(date)) { onChange?.(date); } } };
  return <Input ref={ref} type="text" value={textValue} onChange={handleChange} placeholder={placeholder || 'MM/DD/YYYY'} />;
});
DateInput.displayName = 'DateInput';

const ChangeHistorySection = ({ player }: { player: MasterPlayer | null }) => {
  if (!player) return <div className="space-y-4"><h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" />Record Information</h3><div className="p-6 text-center text-muted-foreground border rounded-md bg-muted/30">Record information will be available after the player is created.</div></div>;
  return <div className="space-y-4"><h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" />Record Information</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/30"><div><h4 className="font-medium text-sm text-muted-foreground mb-2">RECORD CREATED</h4><p className="text-sm font-semibold">{player.dateCreated ? format(new Date(player.dateCreated), 'PPP p') : 'Unknown Date'}</p><p className="text-xs text-muted-foreground">Created by: {player.createdBy || 'Unknown User'}</p></div><div><h4 className="font-medium text-sm text-muted-foreground mb-2">LAST UPDATED</h4><p className="text-sm font-semibold">{player.dateUpdated ? format(new Date(player.dateUpdated), 'PPP p') : (player.dateCreated ? format(new Date(player.dateCreated), 'PPP p') : 'Unknown Date')}</p><p className="text-xs text-muted-foreground">Updated by: {player.updatedBy || player.createdBy || 'Unknown User'}</p></div></div>{player.changeHistory && player.changeHistory.length > 0 ? <div><h4 className="font-medium text-sm text-muted-foreground mb-3">CHANGE HISTORY</h4><div className="space-y-3 border rounded-md p-4 max-h-64 overflow-y-auto bg-background">{player.changeHistory.slice().reverse().map((entry, index) => <div key={entry.timestamp || index} className="text-sm border-l-2 border-muted-foreground pl-4 pb-3 last:pb-0"><p className="font-medium text-foreground">{format(new Date(entry.timestamp), 'PPP p')} by {entry.userName}</p><ul className="list-disc pl-5 mt-2 space-y-1">{entry.changes.map((change, changeIndex) => <li key={changeIndex} className="text-xs text-muted-foreground">Field <span className="font-semibold text-foreground">{change.field}</span> changed from <span className="italic text-red-600 mx-1">'{String(change.oldValue)}'</span> to <span className="italic text-green-600 mx-1">'{String(change.newValue)}'</span></li>)}</ul></div>)}</div></div> : <div><h4 className="font-medium text-sm text-muted-foreground mb-3">CHANGE HISTORY</h4><div className="p-4 text-center text-xs text-muted-foreground border rounded-md bg-muted/20">No changes recorded for this player.</div></div>}</div>;
};

function RosterPageContent() {
  const { profile, isProfileLoaded, updateProfile } = useSponsorProfile();
  const { database, dbDistricts, getSchoolsForDistrict, addPlayer, updatePlayer, deletePlayer } = useMasterDb();
  const { toast } = useToast();
  const [roster, setRoster] = useState<MasterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [schoolsForFilterDistrict, setSchoolsForFilterDistrict] = useState<string[]>([]);
  const [showOnlySchoolsWithRosters, setShowOnlySchoolsWithRosters] = useState(false);
  const [selectedSchoolForView, setSelectedSchoolForView] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const [schoolsForEditDistrict, setSchoolsForEditDistrict] = useState<string[]>([]);
  const form = useForm<PlayerFormValues>({ resolver: zodResolver(playerFormSchema) });
  const editDistrict = form.watch('district');

  const fetchRoster = useCallback(async () => {
    if (!isProfileLoaded || !profile) return;
    setIsLoading(true); setError(null);
    const userRole = getUserRole(profile);
    if (userRole === 'organizer') { setRoster(database); setIsLoading(false); return; }
    let url = '/api/roster'; let params = new URLSearchParams();
    if (userRole === 'district_coordinator') { if (profile.district) params.append('district', profile.district); }
    else if (userRole === 'sponsor') { if (profile.district) params.append('district', profile.district); if (profile.school) params.append('school', profile.school); }
    else if (userRole === 'individual' && profile.studentIds) { if (profile.studentIds.length > 0) { params.append('playerIds', profile.studentIds.join(',')); } else { setRoster([]); setIsLoading(false); return; } }
    try { const response = await fetch(`${url}?${params.toString()}`); if (!response.ok) throw new Error('Failed to fetch roster data.'); const data = await response.json(); setRoster(data); } catch (e: any) { setError(e.message); toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setIsLoading(false); }
  }, [profile, isProfileLoaded, toast, database]);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);
  useEffect(() => { if (selectedDistrict && selectedDistrict !== 'all') { setSchoolsForFilterDistrict(getSchoolsForDistrict(selectedDistrict)); setSelectedSchool('all'); } else { setSchoolsForFilterDistrict([]); } }, [selectedDistrict, getSchoolsForDistrict]);

  const filteredRoster = useMemo(() => {
    const userRole = getUserRole(profile);
    if (userRole !== 'organizer' && userRole !== 'district_coordinator') return roster;
    let filtered = [...roster];
    if (userRole === 'organizer' && selectedDistrict !== 'all') filtered = filtered.filter(p => p.district === selectedDistrict);
    if (selectedSchool !== 'all') filtered = filtered.filter(p => p.school === selectedSchool);
    return filtered;
  }, [roster, selectedDistrict, selectedSchool, profile]);

  const schoolsWithRosters = useMemo(() => {
    const schoolMap = new Map<string, number>();
    filteredRoster.forEach(player => {
      if (player.school) {
        schoolMap.set(player.school, (schoolMap.get(player.school) || 0) + 1);
      }
    });
    return Array.from(schoolMap.entries()).map(([school, count]) => ({ school, count })).sort((a, b) => a.school.localeCompare(b.school));
  }, [filteredRoster]);

  const availableSchools = useMemo(() => {
    if (showOnlySchoolsWithRosters) {
      return schoolsWithRosters.map(s => s.school);
    }
    const userRole = getUserRole(profile);
    if (userRole === 'organizer') {
      return selectedDistrict === 'all' ? [] : schoolsForFilterDistrict;
    } else if (userRole === 'district_coordinator') {
      return getSchoolsForDistrict(profile.district || '');
    }
    return [];
  }, [showOnlySchoolsWithRosters, schoolsWithRosters, schoolsForFilterDistrict, selectedDistrict, profile, getSchoolsForDistrict]);

  const selectedSchoolRoster = useMemo(() => {
    if (!selectedSchoolForView) return [];
    return filteredRoster.filter(p => p.school === selectedSchoolForView);
  }, [selectedSchoolForView, filteredRoster]);

  useEffect(() => { if (editDistrict) { setSchoolsForEditDistrict(getSchoolsForDistrict(editDistrict)); } }, [editDistrict, getSchoolsForDistrict]);
  useEffect(() => { if (playerToEdit) { form.reset({ ...playerToEdit, dob: playerToEdit.dob ? new Date(playerToEdit.dob) : undefined, uscfExpiration: playerToEdit.uscfExpiration ? new Date(playerToEdit.uscfExpiration) : undefined }); if (playerToEdit.district) { setSchoolsForEditDistrict(getSchoolsForDistrict(playerToEdit.district)); } } else if (profile) { form.reset({ id: `temp_${Date.now()}`, uscfId: 'NEW', district: profile.district, school: profile.school, email: profile.email, zipCode: profile.zip }); } }, [playerToEdit, form, profile, getSchoolsForDistrict]);

  const handleEditPlayer = (player: MasterPlayer) => { setPlayerToEdit(player); setIsEditOpen(true); };
  const handleCreateNewPlayer = () => { setPlayerToEdit(null); setIsEditOpen(true); };
  const handlePlayerSelectedFromSearch = (player: MasterPlayer) => { if (getUserRole(profile) === 'individual') { const isAlreadyInRoster = profile?.studentIds?.includes(player.id); if (isAlreadyInRoster) { toast({ title: "Player Already in Roster" }); handleEditPlayer(player); } else { const updatedStudentIds = [...(profile?.studentIds || []), player.id]; updateProfile({ studentIds: updatedStudentIds }).then(() => { toast({ title: "Player Added", description: `${player.firstName} has been added to your roster.` }); fetchRoster(); }); } } else { handleEditPlayer(player); } setIsSearchOpen(false); };
  const onEditSubmit = async (values: PlayerFormValues) => { if (!profile) return; try { if (playerToEdit) { const updatedPlayer: MasterPlayer = { ...playerToEdit, ...values }; await updatePlayer(updatedPlayer, profile); toast({ title: "Player Updated" }); } else { const newPlayer: MasterPlayer = { ...values, id: values.id || `temp_${Date.now()}`, events: 0, eventIds: [] } as MasterPlayer; await addPlayer(newPlayer, profile); toast({ title: "Player Created" }); } fetchRoster(); setIsEditOpen(false); setPlayerToEdit(null); } catch(e: any) { toast({ title: "Save Failed", description: e.message, variant: "destructive" }); } };
  const handleDeletePlayer = async (player: MasterPlayer) => { if (window.confirm(`Are you sure you want to remove ${player.firstName} from your roster?`)) { if (getUserRole(profile) === 'individual') { const updatedStudentIds = profile.studentIds?.filter(id => id !== player.id); await updateProfile({ studentIds: updatedStudentIds }); toast({ title: 'Student Removed' }); fetchRoster(); } else { toast({ title: 'Not Supported', description: 'Sponsors cannot remove players. Please contact an organizer.' }); } } };

  if (isLoading) return <div>Loading your roster...</div>;
  if (error) return <div className='text-red-500'>Error: {error}</div>;
  if (!profile) return <div>Could not load user profile.</div>

  const userRole = getUserRole(profile);
  const isOrganizerOrCoordinator = userRole === 'organizer' || userRole === 'district_coordinator';

  return <div className="space-y-6"><div className="flex justify-between items-center"><div><h1 className="text-3xl font-bold font-headline">My Roster</h1><p className="text-muted-foreground">Manage your players and students.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setIsSearchOpen(true)}><UserPlus className="mr-2 h-4 w-4"/> Find & Add Player</Button><Button onClick={handleCreateNewPlayer}><PlusCircle className="mr-2 h-4 w-4"/> Create New Player</Button></div></div>{isOrganizerOrCoordinator && <Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent><div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{userRole === 'organizer' && <div className="space-y-2"><Label>District</Label><Select value={selectedDistrict} onValueChange={setSelectedDistrict}><SelectTrigger><SelectValue placeholder="All Districts" /></SelectTrigger><SelectContent><SelectItem value="all">All Districts</SelectItem>{dbDistricts.map(district => <SelectItem key={district} value={district}>{district}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-2"><Label>School (Filter)</Label><Select value={selectedSchool} onValueChange={setSelectedSchool} disabled={userRole === 'organizer' && selectedDistrict === 'all'}><SelectTrigger><SelectValue placeholder="All Schools" /></SelectTrigger><SelectContent><SelectItem value="all">All Schools</SelectItem>{(userRole === 'organizer' ? schoolsForFilterDistrict : getSchoolsForDistrict(profile.district || '')).map(school => <SelectItem key={school} value={school}>{school}</SelectItem>)}</SelectContent></Select></div></div><div className="flex items-center space-x-2 mt-4"><Checkbox id="showOnlyWithRosters" checked={showOnlySchoolsWithRosters} onCheckedChange={(checked) => setShowOnlySchoolsWithRosters(checked as boolean)} /><Label htmlFor="showOnlyWithRosters" className="cursor-pointer">Show only schools with rosters</Label></div></div></CardContent></Card>}{isOrganizerOrCoordinator && <Card><CardHeader><CardTitle>Schools ({availableSchools.length})</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{availableSchools.length === 0 ? <p className="text-muted-foreground col-span-full text-center py-8">No schools found. {userRole === 'organizer' && selectedDistrict === 'all' && 'Please select a district.'}</p> : availableSchools.map(school => { const schoolData = schoolsWithRosters.find(s => s.school === school); const count = schoolData?.count || 0; return <Card key={school} className={`cursor-pointer hover:bg-accent transition-colors ${selectedSchoolForView === school ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedSchoolForView(school)}><CardHeader className="p-4"><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" /><CardTitle className="text-sm font-medium leading-tight">{school}</CardTitle></div>{count > 0 && <Badge variant="secondary">{count}</Badge>}</div></CardHeader></Card>; })}</div></CardContent></Card>}{selectedSchoolForView && <Card><CardHeader><CardTitle>{selectedSchoolForView} - Roster ({selectedSchoolRoster.length})</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>USCF ID</TableHead><TableHead>Grade</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{selectedSchoolRoster.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24">No players in this school's roster.</TableCell></TableRow> : selectedSchoolRoster.map(player => <TableRow key={player.id}><TableCell>{player.firstName} {player.lastName}</TableCell><TableCell>{player.uscfId}</TableCell><TableCell>{player.grade}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => handleEditPlayer(player)}><Edit className="h-4 w-4" /></Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}{!isOrganizerOrCoordinator && <Card><CardHeader><CardTitle>{userRole === 'individual' ? 'My Students' : 'School Roster'}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>USCF ID</TableHead><TableHead>Grade</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{roster.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24">No players on this roster yet.</TableCell></TableRow> : roster.map(player => <TableRow key={player.id}><TableCell>{player.firstName} {player.lastName}</TableCell><TableCell>{player.uscfId}</TableCell><TableCell>{player.grade}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => handleEditPlayer(player)}><Edit className="h-4 w-4" /></Button>{userRole === 'individual' && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeletePlayer(player)}><Trash2 className="h-4 w-4" /></Button>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}<EnhancedPlayerSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} onPlayerSelected={handlePlayerSelectedFromSearch} userProfile={profile} preFilterByUserProfile={userRole !== 'organizer'} /></div>;
}

export default function RosterPage() {
  const { profile, isProfileLoaded } = useSponsorProfile();
  if (!isProfileLoaded) return <AppLayout><div>Loading...</div></AppLayout>;
  return <AuthGuard><AppLayout><RosterPageContent /></AppLayout></AuthGuard>;
}