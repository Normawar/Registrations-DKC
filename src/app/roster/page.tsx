
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search, Edit, Check, UserPlus, BadgeInfo, Download, Link as LinkIcon, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { generateTeamCode } from '@/lib/school-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { schoolData } from '@/lib/data/school-data';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';
type DistrictSortableColumnKey = SortableColumnKey | 'gt';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, Championship: 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, { message: "First Name is required." }),
  middleName: z.string().optional().transform(val => val === '' ? undefined : val),
  lastName: z.string().min(1, { message: "Last Name is required." }),
  uscfId: z.string().min(1, { message: "USCF ID is required." }),
  uscfExpiration: z.date().optional(),
  regularRating: z.preprocess(
    (val) => {
      if (!val || String(val).toUpperCase() === 'UNR' || val === '') {
        return undefined;
      }
      return val;
    },
    z.coerce.number({
      invalid_type_error: "Rating must be a number or UNR."
    }).optional()
  ),
  grade: z.string().optional().transform(val => val === '' ? undefined : val),
  section: z.string().optional().transform(val => val === '' ? undefined : val),
  email: z.string().min(1, { message: "Email is required for roster players." }).email({ message: "Please enter a valid email." }),
  zipCode: z.string().min(1, { message: "Zip Code is required for roster players." }),
  phone: z.string().optional().transform(val => val === '' ? undefined : val),
  dob: z.date().optional(),
  studentType: z.string().optional().transform(val => val === '' ? undefined : val),
  state: z.string().optional().transform(val => val === '' ? undefined : val),
  school: z.string().min(1, { message: "School name is required."}),
  district: z.string().min(1, { message: "District name is required."}),
}).refine(data => {
  if (data.uscfId.toUpperCase() !== 'NEW') { 
    return data.uscfExpiration !== undefined; 
  }
  return true;
}, { 
  message: "USCF Expiration is required unless ID is NEW.", 
  path: ["uscfExpiration"] 
}).refine((data) => {
  if (!data.grade || !data.section || data.section === 'Championship') return true;
  const playerGradeLevel = gradeToNumber[data.grade];
  const sectionMaxLevel = sectionMaxGrade[data.section];
  if (playerGradeLevel === undefined || sectionMaxLevel === undefined) return true;
  return playerGradeLevel <= sectionMaxLevel;
}, { 
  message: "Player's grade is too high for this section.", 
  path: ["section"] 
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

const createUserFormSchema = z.object({
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
  password: z.string().min(6, 'Temporary password must be at least 6 characters.'),
});

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

function SponsorRosterView() {
  const { toast } = useToast();
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [isCreatePlayerDialogOpen, setIsCreatePlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });
  const [pendingPlayer, setPendingPlayer] = useState<MasterPlayer | null>(null);

  const { profile, isProfileLoaded } = useSponsorProfile();
  const { database, addPlayer, updatePlayer, isDbLoaded, generatePlayerId, dbDistricts, dbSchools } = useMasterDb();
  
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  const playerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
  });
  
  const [editFormSchoolsForDistrict, setEditFormSchoolsForDistrict] = useState<string[]>([]);
  const selectedEditDistrict = playerForm.watch('district');

  useEffect(() => {
    if (selectedEditDistrict) {
      if (selectedEditDistrict === 'all' || selectedEditDistrict === 'None') {
        setEditFormSchoolsForDistrict(dbSchools);
      } else {
        const filteredSchools = schoolData
          .filter((school) => school.district === selectedEditDistrict)
          .map((school) => school.schoolName)
          .sort();
        setEditFormSchoolsForDistrict([...new Set(filteredSchools)]);
      }
    }
  }, [selectedEditDistrict, dbSchools]);

  const createPlayerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
        uscfId: '',
    }
  });
  
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>(dbSchools);
  
  const handleDistrictChange = (district: string, formInstance: any, resetSchool: boolean = true) => {
    formInstance.setValue('district', district);
    if (resetSchool) {
        formInstance.setValue('school', '');
    }
    if (district === 'all' || district === 'None') {
        setSchoolsForDistrict(dbSchools);
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


  const selectedDistrictInCreate = createPlayerForm.watch('district');

  useEffect(() => {
      if (selectedDistrictInCreate) {
        handleDistrictChange(selectedDistrictInCreate, createPlayerForm, true);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictInCreate, dbSchools]);

  // Update form defaults when profile loads
  useEffect(() => {
    if (profile) {
      createPlayerForm.reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        school: profile.school || '',
        district: profile.district || 'all',
        grade: '',
        section: '',
        state: 'TX',
        studentType: profile.district === 'PHARR-SAN JUAN-ALAMO ISD' ? 'independent' : '',
        uscfId: '',
      });
      // Trigger initial school list update
      if (profile.district) {
          const initialSchools = dbSchools.filter(school => schoolData.find(s => s.schoolName === school)?.district === profile.district);
          setSchoolsForDistrict(initialSchools.length > 0 ? initialSchools : [profile.school || '']);
      } else {
          setSchoolsForDistrict([...dbSchools]);
      }
    }
  }, [profile, createPlayerForm, dbSchools]);

  const rosterPlayers = useMemo(() => {
    if (!isProfileLoaded || !isDbLoaded || !profile) return [];
    return database.filter(player => player.district === profile.district && player.school === profile.school);
  }, [database, profile, isProfileLoaded, isDbLoaded]);

  const rosterPlayerIds = useMemo(() => rosterPlayers.map(p => p.id), [rosterPlayers]);

  const sortedPlayers = useMemo(() => {
    let sortablePlayers = [...rosterPlayers];
    if (sortConfig) {
      sortablePlayers.sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key as keyof MasterPlayer] ?? '';
        let bVal: any = b[key as keyof MasterPlayer] ?? '';
        
        if (key === 'teamCode' && profile) {
          aVal = generateTeamCode({ schoolName: a.school, district: a.district, studentType: a.studentType });
          bVal = generateTeamCode({ schoolName: b.school, district: b.district, studentType: b.studentType });
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'ascending' ? result : -result;
      });
    }
    return sortablePlayers;
  }, [rosterPlayers, sortConfig, profile]);

  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleEditPlayer = (player: MasterPlayer) => {
    setEditingPlayer(player);
    playerForm.reset({
        ...player,
        dob: player.dob ? new Date(player.dob) : undefined,
        uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
        studentType: player.studentType || 'independent',
    });
    
    // Initialize schools for the player's district
    if (player.district) {
      if (player.district === 'all' || player.district === 'None') {
        setEditFormSchoolsForDistrict(dbSchools);
      } else {
        const filteredSchools = schoolData
          .filter((school) => school.district === player.district)
          .map((school) => school.schoolName)
          .sort();
        setEditFormSchoolsForDistrict([...new Set(filteredSchools)]);
      }
    } else {
      setEditFormSchoolsForDistrict(dbSchools);
    }
    
    setIsEditPlayerDialogOpen(true);
  };
  
  const handlePlayerSelectedForEdit = (player: any) => {
    const isMasterPlayer = 'uscfId' in player;
    const playerToEdit: MasterPlayer = isMasterPlayer ? player : {
      id: player.uscf_id,
      uscfId: player.uscf_id,
      firstName: player.name.split(', ')[1] || '',
      lastName: player.name.split(', ')[0] || '',
      middleName: player.name.split(', ').length > 2 ? player.name.split(', ')[2] : '',
      regularRating: player.rating_regular || undefined,
      uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
      state: player.state || 'TX',
      school: profile?.school || '',
      district: profile?.district || '',
      grade: '',
      section: '',
      email: '',
      zipCode: '',
      events: 0,
      eventIds: [],
    };
    
    setPendingPlayer(playerToEdit);
    setEditingPlayer(playerToEdit);
    
    // Initialize schools for the player's district
    const playerDistrict = playerToEdit.district;
    if (playerDistrict) {
      if (playerDistrict === 'all' || playerDistrict === 'None') {
        setEditFormSchoolsForDistrict(dbSchools);
      } else {
        const filteredSchools = schoolData
          .filter((school) => school.district === playerDistrict)
          .map((school) => school.schoolName)
          .sort();
        setEditFormSchoolsForDistrict([...new Set(filteredSchools)]);
      }
    } else {
      setEditFormSchoolsForDistrict(dbSchools);
    }
    
    playerForm.reset({
      ...playerToEdit,
      dob: playerToEdit.dob ? new Date(playerToEdit.dob) : undefined,
      uscfExpiration: playerToEdit.uscfExpiration ? new Date(playerToEdit.uscfExpiration) : undefined,
      studentType: playerToEdit.studentType || 'independent',
    });
    setIsEditPlayerDialogOpen(true);
  };
  
  const handleRemoveFromRoster = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };
  
  const confirmRemoveFromRoster = () => {
    if (playerToDelete && profile) {
      updatePlayer({ ...playerToDelete, school: '', district: '' }, profile);
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from your roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
    if (!editingPlayer || !profile) return;
  
    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const updatedPlayerRecord: MasterPlayer = {
      ...editingPlayer,
      ...restOfValues,
      dob: dob ? dob.toISOString() : undefined,
      uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
    };
    
    if (pendingPlayer) {
      await addPlayer(updatedPlayerRecord);
      toast({ 
        title: "Player Added to Roster", 
        description: `${values.firstName} ${values.lastName} has been successfully added to your roster.`
      });
      setPendingPlayer(null);
    } else {
      await updatePlayer(updatedPlayerRecord, profile);
      toast({ 
        title: "Player Updated", 
        description: `${values.firstName} ${values.lastName}'s information has been updated.`
      });
    }
    
    setIsEditPlayerDialogOpen(false);
    setEditingPlayer(null);
  };

  const handleCancelEdit = () => {
      if (pendingPlayer) {
          setPendingPlayer(null);
      }
      setIsEditPlayerDialogOpen(false);
      setEditingPlayer(null);
  };

  const handleCreateNewPlayer = () => {
    if (!profile) return;
    
    createPlayerForm.reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        school: profile.school || '',
        district: profile.district || 'None',
        grade: '',
        section: '',
        state: 'TX',
        studentType: profile.district === 'PHARR-SAN JUAN-ALAMO ISD' ? 'independent' : '',
        uscfId: '',
    });
    // Trigger initial school list update
    if (profile.district) {
        const initialSchools = dbSchools.filter(school => schoolData.find(s => s.schoolName === school)?.district === profile.district);
        setSchoolsForDistrict(initialSchools.length > 0 ? initialSchools : [profile.school || '']);
    } else {
        setSchoolsForDistrict([...dbSchools]);
    }
    setIsCreatePlayerDialogOpen(true);
  };

  const handleCreatePlayerSubmit = async (values: any) => {
    if (!profile) return;

    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const newPlayerId = generatePlayerId(values.uscfId);
    
    const newPlayerRecord: MasterPlayer = {
        ...restOfValues,
        id: newPlayerId,
        school: profile.school,
        district: profile.district,
        dob: dob ? dob.toISOString() : undefined,
        uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: 0,
        eventIds: [],
    };
    
    await addPlayer(newPlayerRecord);
    toast({ 
        title: "Player Created", 
        description: `${values.firstName} ${values.lastName} has been created and added to your roster.`
    });
    
    setIsCreatePlayerDialogOpen(false);
    createPlayerForm.reset();
  };

  const handleCancelCreate = () => {
    setIsCreatePlayerDialogOpen(false);
    createPlayerForm.reset();
  };

  const PotentialMatchesReview = () => {
    const flaggedPlayers = rosterPlayers.filter(p => 
      p.potentialUscfMatch?.reviewStatus === 'pending'
    );
  
    const confirmMatch = async (player: MasterPlayer) => {
      if (!player.potentialUscfMatch || !profile) return;
  
      const updatedPlayer = {
        ...player,
        uscfId: player.potentialUscfMatch.uscfId,
        potentialUscfMatch: {
          ...player.potentialUscfMatch,
          reviewStatus: 'confirmed' as const,
          reviewedBy: profile?.email
        }
      };
  
      await updatePlayer(updatedPlayer, profile);
      toast({ 
        title: "Match Confirmed", 
        description: `${player.firstName} ${player.lastName} updated with USCF ID ${player.potentialUscfMatch.uscfId}`
      });
    };
  
    const rejectMatch = async (player: MasterPlayer) => {
      if (!player.potentialUscfMatch || !profile) return;
  
      const updatedPlayer = {
        ...player,
        potentialUscfMatch: {
          ...player.potentialUscfMatch,
          reviewStatus: 'rejected' as const,
          reviewedBy: profile?.email
        }
      };
  
      await updatePlayer(updatedPlayer, profile);
      toast({ 
        title: "Match Rejected", 
        description: `Potential match for ${player.firstName} ${player.lastName} has been rejected`
      });
    };
  
    if (flaggedPlayers.length === 0) return null;
  
    return (
      <Card className="mb-8 border-amber-500">
        <CardHeader>
            <div className="flex items-center gap-2">
                <BadgeInfo className="h-6 w-6 text-amber-600" />
                <div>
                    <CardTitle className="text-amber-700">Potential USCF Matches Found</CardTitle>
                    <CardDescription>
                    Review these potential matches from the latest USCF upload to assign official USCF IDs to your manually created players.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flaggedPlayers.map(player => (
              <div key={player.id} className="border rounded p-4 bg-amber-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">
                      {player.firstName} {player.lastName}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Current: Temp ID | Potential USCF ID: {player.potentialUscfMatch?.uscfId}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={
                        player.potentialUscfMatch?.confidence === 'high' ? 'default' : 'secondary'
                      } className={player.potentialUscfMatch?.confidence === 'high' ? 'bg-green-600' : ''}>
                        {player.potentialUscfMatch?.confidence} confidence
                      </Badge>
                      {player.potentialUscfMatch?.uscfHistoryUrl && (
                        <a href={player.potentialUscfMatch.uscfHistoryUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Verify on USCF
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="space-x-2">
                    <Button size="sm" onClick={() => confirmMatch(player)}>
                      Confirm Match
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectMatch(player)}>
                      Not a Match
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const ChangeHistoryTab = ({ player }: { player: MasterPlayer | null }) => {
    if (!player?.changeHistory || player.changeHistory.length === 0) {
        return <div className="p-6 text-center text-muted-foreground">No change history available for this player.</div>;
    }

    return (
        <div className="p-6 space-y-4">
            {player.changeHistory.slice().reverse().map(entry => (
                <div key={entry.timestamp} className="text-sm border-l-2 pl-4">
                    <p className="font-medium">
                        {format(new Date(entry.timestamp), 'PPP p')} by {entry.userName}
                    </p>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground text-xs">
                        {entry.changes.map((change, index) => (
                            <li key={index}>
                                Field <span className="font-semibold text-foreground">{change.field}</span> changed from <span className="italic">'{String(change.oldValue)}'</span> to <span className="italic">'{String(change.newValue)}'</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Team Roster</h1>
          <p className="text-muted-foreground">
            Manage your team players and their information. ({rosterPlayers.length} players)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsSearchDialogOpen(true)} variant="outline" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Add from Database
          </Button>
          <Button onClick={handleCreateNewPlayer} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Create New Player
          </Button>
        </div>
      </div>

      {profile && teamCode && (
        <Alert>
          <AlertTitle>Team Information</AlertTitle>
          <AlertDescription>
            <strong>School:</strong> {profile.school}<br/>
            <strong>District:</strong> {profile.district}<br/>
            <strong>Team Code:</strong> {teamCode}
          </AlertDescription>
        </Alert>
      )}

      <PotentialMatchesReview />

      <Card>
        <CardHeader><CardTitle>Current Roster</CardTitle><CardDescription>Players registered under your school and district</CardDescription></CardHeader>
        <CardContent>
          {rosterPlayers.length === 0 ? (
            <div className="text-center py-8"><p className="text-muted-foreground">No players in your roster yet.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('lastName')}>Player Name {getSortIcon('lastName')}</Button></TableHead>
                  <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('teamCode')}>Team Code {getSortIcon('teamCode')}</Button></TableHead>
                  <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('uscfId')}>USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                  <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('regularRating')}>Rating {getSortIcon('regularRating')}</Button></TableHead>
                  <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('grade')}>Grade {getSortIcon('grade')}</Button></TableHead>
                  <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('section')}>Section {getSortIcon('section')}</Button></TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8"><AvatarImage src={`https://placehold.co/40x40.png`} alt={`${player.firstName} ${player.lastName}`} data-ai-hint="person face" /><AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {`${player.firstName} ${player.middleName || ''} ${player.lastName}`.replace(/\s+/g, ' ').trim()}
                              {player.studentType === 'gt' && <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">GT</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground">{player.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{generateTeamCode({ schoolName: player.school, district: player.district, studentType: player.studentType })}</TableCell>
                      <TableCell>{player.uscfId}</TableCell>
                      <TableCell>{player.regularRating || 'UNR'}</TableCell>
                      <TableCell>{player.grade}</TableCell>
                      <TableCell>{player.section}</TableCell>
                       <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditPlayer(player)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRemoveFromRoster(player)} className="text-destructive">Remove from Roster</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EnhancedPlayerSearchDialog
        isOpen={isSearchDialogOpen}
        onOpenChange={setIsSearchDialogOpen}
        onPlayerSelected={handlePlayerSelectedForEdit}
        excludeIds={rosterPlayerIds}
        title="Add Player to Roster"
        userProfile={profile}
        preFilterByUserProfile={true}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Player from Roster</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster, but they will remain in the master database. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveFromRoster} className="bg-destructive text-destructive-foreground">Remove Player</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Player Dialog */}
      <Dialog open={isEditPlayerDialogOpen} onOpenChange={setIsEditPlayerDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
            <Tabs defaultValue="details" className="w-full h-full flex flex-col">
                <DialogHeader className="p-6 pb-0 border-b shrink-0">
                    <DialogTitle>{editingPlayer && database.some(p => p.id === editingPlayer.id) ? 'Edit Player' : 'Add New Player'}</DialogTitle>
                    <DialogDescription>
                        Complete the player's information. This will add them to or update their record in the master database.
                    </DialogDescription>
                    <TabsList className="grid w-full grid-cols-2 mt-4">
                        <TabsTrigger value="details">Player Details</TabsTrigger>
                        <TabsTrigger value="history">Change History</TabsTrigger>
                    </TabsList>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <TabsContent value="details" className="h-full m-0">
                        <ScrollArea className="h-full">
                            <div className="p-6">
                                <Form {...playerForm}>
                                    <form id="edit-player-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={playerForm.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={playerForm.control} name="district" render={({ field }) => (
                                                <FormItem><FormLabel>District</FormLabel>
                                                <Select onValueChange={(value) => { field.onChange(value); playerForm.setValue('school', ''); }} value={field.value || ''}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                                                    <SelectContent>{dbDistricts.map(district => ( <SelectItem key={district} value={district}>{district}</SelectItem> ))}</SelectContent>
                                                </Select><FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={playerForm.control} name="school" render={({ field }) => (
                                                <FormItem><FormLabel>School</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedEditDistrict || editFormSchoolsForDistrict.length === 0}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl>
                                                    <SelectContent>{editFormSchoolsForDistrict.map(school => ( <SelectItem key={school} value={school}>{school}</SelectItem> ))}</SelectContent>
                                                </Select><FormMessage />
                                                {selectedEditDistrict && editFormSchoolsForDistrict.length === 0 && (
                                                    <FormDescription className="text-amber-600">No schools found for this district. You may need to add schools to this district first.</FormDescription>
                                                )}
                                                </FormItem>
                                            )} />
                                        </div>
                                        {editingPlayer?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
                                            <FormField control={playerForm.control} name="studentType" render={({ field }) => (
                                                <FormItem className="space-y-3"><FormLabel>Student Type</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value || 'independent'} className="flex items-center space-x-4">
                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="independent" /></FormControl><FormLabel className="font-normal">Independent</FormLabel></FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="gt" /></FormControl><FormLabel className="font-normal">GT (Gifted & Talented)</FormLabel></FormItem>
                                                    </RadioGroup>
                                                </FormControl><FormMessage />
                                                </FormItem>
                                            )} />
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" value={field.value?.toString() || ''} onChange={(e) => { const value = e.target.value; if (value === '' || value.toUpperCase() === 'UNR') { field.onChange(undefined); } else { field.onChange(value); } }} /></FormControl><FormMessage /></FormItem> )} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={playerForm.control} name="dob" render={({ field }) => ( <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const dateValue = e.target.value; if (dateValue) { const parsedDate = new Date(dateValue + 'T00:00:00'); if (!isNaN(parsedDate.getTime())) { field.onChange(parsedDate); } } else { field.onChange(undefined); } }} placeholder="Select date of birth" max={format(new Date(), 'yyyy-MM-dd')} min="1900-01-01" /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const dateValue = e.target.value; if (dateValue) { const parsedDate = new Date(dateValue + 'T00:00:00'); if (!isNaN(parsedDate.getTime())) { field.onChange(parsedDate); } } else { field.onChange(undefined); } }} placeholder="Select expiration date" /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={playerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent position="item-aligned">{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                            <FormField control={playerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent position="item-aligned">{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={playerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} value={field.value || ''} placeholder="Enter email address" /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code *</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="Enter zip code" /></FormControl><FormMessage /></FormItem> )} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={playerForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" {...field} value={field.value || ''} placeholder="Enter phone number" /></FormControl><FormMessage /></FormItem> )} />
                                        </div>
                                    </form>
                                </Form>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="history" className="h-full m-0">
                        <ScrollArea className="h-full"><ChangeHistoryTab player={editingPlayer} /></ScrollArea>
                    </TabsContent>
                </div>
                <DialogFooter className="p-6 pt-4 border-t shrink-0">
                    <Button type="button" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                    <Button type="submit" form="edit-player-form">Save Changes</Button>
                </DialogFooter>
            </Tabs>
        </DialogContent>
      </Dialog>


      {/* Create New Player Dialog */}
      <Dialog open={isCreatePlayerDialogOpen} onOpenChange={setIsCreatePlayerDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle>Create New Player</DialogTitle>
                <DialogDescription>Add a new player to the database and your roster. This player will be added to the master database and assigned to your school.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1">
              <div className="p-6">
                  <Form {...createPlayerForm}>
                      <form id="create-player-form" onSubmit={createPlayerForm.handleSubmit(handleCreatePlayerSubmit)} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <FormField control={createPlayerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={createPlayerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={createPlayerForm.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={createPlayerForm.control} name="district" render={({ field }) => (
                                  <FormItem><FormLabel>District</FormLabel>
                                  <Select onValueChange={(value) => handleDistrictChange(value, createPlayerForm)} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                                      <SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                  </Select><FormMessage />
                                  </FormItem>
                              )} />
                              <FormField control={createPlayerForm.control} name="school" render={({ field }) => (
                                  <FormItem><FormLabel>School</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl>
                                      <SelectContent>{schoolsForDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                  </Select><FormMessage />
                                  </FormItem>
                              )} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={createPlayerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} placeholder="Enter USCF ID or 'NEW'" /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={createPlayerForm.control} name="regularRating" render={({ field }) => (
                                <FormItem><FormLabel>Rating</FormLabel>
                                  <FormControl><Input type="text" placeholder="e.g., 599 or UNR" value={field.value || ''} onChange={(e) => { const value = e.target.value; if (value.toUpperCase() === 'UNR' || value.toUpperCase() === 'NEW') { field.onChange(value.toUpperCase()); } else { field.onChange(value); } }} /></FormControl>
                                  <FormDescription className="flex items-center gap-2">
                                      Or use a quick select option:
                                      <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => createPlayerForm.setValue('regularRating', 'UNR' as any)}>UNR</Button>
                                      <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => createPlayerForm.setValue('uscfId', 'NEW')}>NEW</Button>
                                  </FormDescription><FormMessage />
                                </FormItem>
                              )} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={createPlayerForm.control} name="dob" render={({ field }) => ( <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const date = e.target.valueAsDate; field.onChange(date ? new Date(date.getTime() + date.getTimezoneOffset() * 60000) : undefined); }} max={format(new Date(), 'yyyy-MM-dd')} min="1900-01-01" /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={createPlayerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const date = e.target.valueAsDate; field.onChange(date ? new Date(date.getTime() + date.getTimezoneOffset() * 60000) : undefined); }} min={format(new Date(), 'yyyy-MM-dd')} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={createPlayerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                              <FormField control={createPlayerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                          </div>
                          {createPlayerForm.watch('district') === 'PHARR-SAN JUAN-ALAMO ISD' && (
                              <FormField control={createPlayerForm.control} name="studentType" render={({ field }) => (
                                  <FormItem className="space-y-3"><FormLabel>Student Type</FormLabel>
                                  <FormControl>
                                      <RadioGroup onValueChange={field.onChange} value={field.value || 'independent'} className="flex items-center space-x-4">
                                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="independent" /></FormControl><FormLabel className="font-normal">Independent</FormLabel></FormItem>
                                      <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="gt" /></FormControl><FormLabel className="font-normal">GT (Gifted & Talented)</FormLabel></FormItem>
                                      </RadioGroup>
                                  </FormControl><FormMessage />
                                  </FormItem>
                              )} />
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={createPlayerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} placeholder="Enter email address" /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={createPlayerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code *</FormLabel><FormControl><Input {...field} placeholder="Enter zip code" /></FormControl><FormMessage /></FormItem> )} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField control={createPlayerForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" {...field} placeholder="Enter phone number" /></FormControl><FormMessage /></FormItem> )} />
                          </div>
                      </form>
                  </Form>
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="button" variant="ghost" onClick={handleCancelCreate}>Cancel</Button>
                <Button type="submit" form="create-player-form">Create Player</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DistrictRosterView() {
    const { profile } = useSponsorProfile();
    const { database: allPlayers, isDbLoaded, dbDistricts, toast, updatePlayer, deletePlayer } = useMasterDb();
    const [selectedSchool, setSelectedSchool] = useState('all');
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [sortConfig, setSortConfig] = useState<{ key: DistrictSortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });
    const [playerTypeFilter, setPlayerTypeFilter] = useState('all');
    const [showActiveOnly, setShowActiveOnly] = useState(false);
    const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
    const [editFormSchoolsForDistrict, setEditFormSchoolsForDistrict] = useState<string[]>([]);

    const playerForm = useForm<PlayerFormValues>({
        resolver: zodResolver(playerFormSchema),
    });
    
    const selectedEditDistrict = playerForm.watch('district');
    const dbSchools = useMemo(() => [...new Set(allPlayers.map(p => p.school).filter(Boolean))].sort(), [allPlayers]);

    useEffect(() => {
        if (selectedEditDistrict) {
            if (selectedEditDistrict === 'all' || selectedEditDistrict === 'None') {
                setEditFormSchoolsForDistrict(dbSchools);
            } else {
                const filteredSchools = schoolData
                  .filter((school) => school.district === selectedEditDistrict)
                  .map((school) => school.schoolName)
                  .sort();
                setEditFormSchoolsForDistrict([...new Set(filteredSchools)]);
            }
        }
    }, [selectedEditDistrict, dbSchools]);

    useEffect(() => {
        if (profile?.role === 'district_coordinator' && profile.district) {
            setSelectedDistrict(profile.district);
        }
    }, [profile]);
    
    const districtPlayers = useMemo(() => {
        if (!isDbLoaded || !profile) return [];
        if (selectedDistrict === 'all') {
            return allPlayers;
        }
        return allPlayers.filter(p => p.district === selectedDistrict);
    }, [allPlayers, isDbLoaded, profile, selectedDistrict]);

    const districtSchools = useMemo(() => {
        if (selectedDistrict === 'all') {
             return [...new Set(allPlayers.map(p => p.school).filter(Boolean))].sort();
        }
        return schoolData
            .filter(school => school.district === selectedDistrict)
            .map(school => school.schoolName)
            .sort();
    }, [allPlayers, selectedDistrict]);
    
    const displayedSchools = useMemo(() => {
        let schoolsToDisplay = districtSchools;
        if (selectedSchool !== 'all') {
            schoolsToDisplay = schoolsToDisplay.filter(school => school === selectedSchool);
        }
        if (showActiveOnly) {
            const activeSchools = new Set(districtPlayers.map(p => p.school));
            schoolsToDisplay = schoolsToDisplay.filter(school => activeSchools.has(school));
        }
        return schoolsToDisplay;
    }, [selectedSchool, districtSchools, showActiveOnly, districtPlayers]);

    const requestSort = (key: DistrictSortableColumnKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnKey: DistrictSortableColumnKey) => {
        if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4" />;
        return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
    const sortedPlayersForSchool = (schoolRoster: MasterPlayer[]) => {
      let filteredRoster = schoolRoster;
      if (profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' || selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD') {
        if (playerTypeFilter === 'gt') {
            filteredRoster = schoolRoster.filter(p => p.studentType === 'gt');
        } else if (playerTypeFilter === 'independent') {
            filteredRoster = schoolRoster.filter(p => p.studentType === 'independent');
        }
      }
      
      let sortablePlayers = [...filteredRoster];
      if (sortConfig) {
        sortablePlayers.sort((a, b) => {
          const key = sortConfig.key;
          let aVal: any = a[key as keyof MasterPlayer] ?? '';
          let bVal: any = b[key as keyof MasterPlayer] ?? '';

          if (key === 'teamCode') {
            aVal = generateTeamCode({ schoolName: a.school, district: a.district, studentType: a.studentType });
            bVal = generateTeamCode({ schoolName: b.school, district: b.district, studentType: b.studentType });
          } else if (key === 'gt') {
             aVal = a.studentType === 'gt' ? 1 : 0;
             bVal = b.studentType === 'gt' ? 1 : 0;
          } else if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          }
          
          const result = aVal < bVal ? -1 : aVal > bVal ? 1 : -1;
          return sortConfig.direction === 'ascending' ? result : -result;
        });
      }
      return sortablePlayers;
    };
    
    const showGtColumn = useMemo(() => {
        if (profile?.role === 'organizer' && selectedDistrict === 'all') return true;
        return selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD' || profile?.district === 'PHARR-SAN JUAN-ALAMO ISD';
    }, [profile, selectedDistrict]);

    const handleExportGTRoster = useCallback(() => {
        const psjaPlayers = allPlayers.filter(p => p.district === 'PHARR-SAN JUAN-ALAMO ISD');
        const gtPlayers = psjaPlayers.filter(p => p.studentType === 'gt');

        if (gtPlayers.length === 0) {
            toast({
                title: "No GT Players Found",
                description: "There are no players marked as GT in the PHARR-SAN JUAN-ALAMO ISD district.",
            });
            return;
        }

        const dataToExport = gtPlayers.map(player => ({
            'First Name': player.firstName,
            'Last Name': player.lastName,
            'USCF ID': player.uscfId,
            'School': player.school,
            'Grade': player.grade,
            'Rating': player.regularRating || 'UNR',
            'Email': player.email,
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `psja_gt_roster_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "Export Successful",
            description: `${gtPlayers.length} GT players have been exported.`,
        });
    }, [allPlayers, toast]);
    
    const handleExportIndependentRoster = useCallback(() => {
        const psjaPlayers = allPlayers.filter(p => p.district === 'PHARR-SAN JUAN-ALAMO ISD');
        const independentPlayers = psjaPlayers.filter(p => p.studentType === 'independent');

        if (independentPlayers.length === 0) {
            toast({
                title: "No Independent Players Found",
                description: "There are no players marked as Independent in the PHARR-SAN JUAN-ALAMO ISD district.",
            });
            return;
        }

        const dataToExport = independentPlayers.map(player => ({
            'First Name': player.firstName,
            'Last Name': player.lastName,
            'USCF ID': player.uscfId,
            'School': player.school,
            'Grade': player.grade,
            'Rating': player.regularRating || 'UNR',
            'Email': player.email,
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `psja_independent_roster_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "Export Successful",
            description: `${independentPlayers.length} Independent players have been exported.`,
        });
    }, [allPlayers, toast]);

    const playerCounts = useMemo(() => {
        const filteredBySchool = selectedSchool === 'all'
            ? districtPlayers
            : districtPlayers.filter(p => p.school === selectedSchool);
        
        return {
            all: filteredBySchool.length,
            gt: filteredBySchool.filter(p => p.studentType === 'gt').length,
            independent: filteredBySchool.filter(p => p.studentType === 'independent').length,
        };
    }, [districtPlayers, selectedSchool]);

    const filteredPlayersForExport = useMemo(() => {
        return districtPlayers.filter(player => {
            const schoolMatch = selectedSchool === 'all' || player.school === selectedSchool;
            if (!schoolMatch) return false;
            
            if (showGtColumn) {
                const playerTypeMatch = playerTypeFilter === 'all' || player.studentType === playerTypeFilter;
                return playerTypeMatch;
            }
            return true;
        });
    }, [districtPlayers, selectedSchool, playerTypeFilter, showGtColumn]);

    const handleExportAllRosters = useCallback(() => {
        if (filteredPlayersForExport.length === 0) {
            toast({
                title: "No Players to Export",
                description: "There are no players matching the current filter criteria.",
            });
            return;
        }
    
        const dataToExport = filteredPlayersForExport.map(player => ({
            'Team Code': generateTeamCode({ schoolName: player.school, district: player.district, studentType: player.studentType }),
            'StudentType': player.studentType || 'regular',
            'Last Name': player.lastName,
            'First Name': player.firstName,
            'Middle Name': player.middleName || '',
            'USCF ID': player.uscfId,
            'Grade': player.grade,
            'Section': player.section,
            'Rating': player.regularRating || 'UNR',
        }));
    
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `roster_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    
        toast({
            title: "Export Successful",
            description: `${filteredPlayersForExport.length} players have been exported.`,
        });
    }, [filteredPlayersForExport, toast]);

    const handleEditPlayer = (player: MasterPlayer) => {
        setEditingPlayer(player);
        playerForm.reset({
            ...player,
            dob: player.dob ? new Date(player.dob) : undefined,
            uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
        });
        
        if (player.district) {
          if (player.district === 'all' || player.district === 'None') {
            setEditFormSchoolsForDistrict(dbSchools);
          } else {
            const filteredSchools = schoolData
              .filter((school) => school.district === player.district)
              .map((school) => school.schoolName)
              .sort();
            setEditFormSchoolsForDistrict([...new Set(filteredSchools)]);
          }
        } else {
          setEditFormSchoolsForDistrict(dbSchools);
        }

        setIsEditPlayerDialogOpen(true);
    };

    const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
        if (!editingPlayer || !profile) return;
    
        const { uscfExpiration, dob, ...restOfValues } = values;
        
        const updatedPlayerRecord: MasterPlayer = {
            ...editingPlayer,
            ...restOfValues,
            dob: dob ? dob.toISOString() : undefined,
            uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
        };

        await updatePlayer(updatedPlayerRecord, profile);
        toast({ 
            title: "Player Updated", 
            description: `${values.firstName} ${values.lastName}'s information has been updated.`
        });
        
        setIsEditPlayerDialogOpen(false);
        setEditingPlayer(null);
    };

    const handleDeletePlayer = (player: MasterPlayer) => {
        setPlayerToDelete(player);
        setIsAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (playerToDelete) {
            await deletePlayer(playerToDelete.id);
            toast({
                title: "Player Deleted",
                description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the database.`,
            });
        }
        setIsAlertOpen(false);
        setPlayerToDelete(null);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">District Rosters</h1>
                <p className="text-muted-foreground">
                    An overview of all player rosters for each school in {profile?.role === 'organizer' ? 'all districts' : `your district: ${profile?.district}`}
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                {profile?.role === 'organizer' && (
                    <div className="w-full sm:w-64">
                        <Label htmlFor="district-filter">Filter by District</Label>
                        <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                            <SelectTrigger id="district-filter"><SelectValue placeholder="Select a district" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Districts</SelectItem>
                                {dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="w-full sm:w-64">
                    <Label htmlFor="school-filter">Filter by School</Label>
                    <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                        <SelectTrigger id="school-filter"><SelectValue placeholder="Select a school" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Schools</SelectItem>
                            {districtSchools.map(school => (
                                <SelectItem key={school} value={school}>{school}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 {(profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' || selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD') && (
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-end gap-4">
                        <div>
                            <Label>Filter by Player Type</Label>
                            <RadioGroup value={playerTypeFilter} onValueChange={setPlayerTypeFilter} className="flex items-center space-x-4 pt-2">
                               <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="all" /><Label htmlFor="all" className="cursor-pointer">All ({playerCounts.all})</Label></div>
                               <div className="flex items-center space-x-2"><RadioGroupItem value="gt" id="gt" /><Label htmlFor="gt" className="cursor-pointer">GT ({playerCounts.gt})</Label></div>
                               <div className="flex items-center space-x-2"><RadioGroupItem value="independent" id="independent" /><Label htmlFor="independent" className="cursor-pointer">Independent ({playerCounts.independent})</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={handleExportGTRoster} variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                Export GT Roster
                            </Button>
                            <Button onClick={handleExportIndependentRoster} variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                Export Independent Roster
                            </Button>
                        </div>
                    </div>
                 )}
                 <div className="flex-grow flex items-end justify-between w-full">
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="active-schools" checked={showActiveOnly} onCheckedChange={(checked) => setShowActiveOnly(!!checked)} />
                        <Label htmlFor="active-schools" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Show only schools with players
                        </Label>
                    </div>
                    <Button onClick={handleExportAllRosters} variant="default" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export All Rosters ({filteredPlayersForExport.length})
                    </Button>
                </div>
            </div>

            {displayedSchools.map(school => {
                const schoolRoster = districtPlayers.filter(p => p.school === school);
                const sortedSchoolRoster = sortedPlayersForSchool(schoolRoster);

                if (sortedSchoolRoster.length === 0 && showActiveOnly) return null;
                
                return (
                    <Card key={school}>
                        <CardHeader>
                            <CardTitle className="text-lg">{school}</CardTitle>
                            <CardDescription>{sortedSchoolRoster.length} player(s) found {playerTypeFilter !== 'all' ? `matching '${playerTypeFilter}'` : ''}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {sortedSchoolRoster.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No players found.</div>
                          ) : (
                            <ScrollArea className="h-72">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('lastName')}>Player Name {getSortIcon('lastName')}</Button></TableHead>
                                            <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('teamCode')}>Team Code {getSortIcon('teamCode')}</Button></TableHead>
                                            <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('uscfId')}>USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                                            <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('regularRating')}>Rating {getSortIcon('regularRating')}</Button></TableHead>
                                            <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('grade')}>Grade {getSortIcon('grade')}</Button></TableHead>
                                            <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('section')}>Section {getSortIcon('section')}</Button></TableHead>
                                            {showGtColumn && (
                                                <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('gt')}>GT {getSortIcon('gt')}</Button></TableHead>
                                            )}
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedSchoolRoster.map((player) => {
                                            const displayName = (player.firstName && player.lastName) ? `${player.lastName}, ${player.firstName}` : 'Invalid Player Record';
                                            return (
                                                <TableRow key={player.id}>
                                                    <TableCell>
                                                      <div className="font-medium">{displayName}</div>
                                                    </TableCell>
                                                    <TableCell>{generateTeamCode({ schoolName: player.school, district: player.district, studentType: player.studentType })}</TableCell>
                                                    <TableCell>{player.uscfId}</TableCell>
                                                    <TableCell className="text-right">{player.regularRating || 'N/A'}</TableCell>
                                                    <TableCell>{player.grade}</TableCell>
                                                    <TableCell>{player.section}</TableCell>
                                                    {showGtColumn && (
                                                        <TableCell>
                                                            {player.studentType === 'gt' && <Check className="h-5 w-5 text-green-600" />}
                                                        </TableCell>
                                                    )}
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
                                                                <DropdownMenuItem onSelect={() => handleEditPlayer(player)}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit Player
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => handleDeletePlayer(player)} className="text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete Player
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                          )}
                        </CardContent>
                    </Card>
                )
            })}
             <Dialog open={isEditPlayerDialogOpen} onOpenChange={setIsEditPlayerDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                    {/* The same edit player dialog as in SponsorRosterView will be used */}
                    <DialogHeader className="p-6 pb-0 border-b shrink-0"><DialogTitle>Edit Player</DialogTitle></DialogHeader>
                    <div className='flex-1 overflow-y-auto p-6'>
                    <Form {...playerForm}>
                        <form id="edit-player-form-district" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-6">
                            {/* Form fields here, same as sponsor view */}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField 
                                    control={playerForm.control} 
                                    name="district" 
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>District</FormLabel>
                                        <Select 
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            playerForm.setValue('school', '');
                                        }} 
                                        value={field.value || ''}
                                        >
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Select a district" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {dbDistricts.map(district => (
                                            <SelectItem key={district} value={district}>
                                                {district}
                                            </SelectItem>
                                            ))}
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )} 
                                />
                                
                                <FormField 
                                    control={playerForm.control} 
                                    name="school" 
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>School</FormLabel>
                                        <Select 
                                        onValueChange={field.onChange} 
                                        value={field.value || ''}
                                        disabled={!selectedEditDistrict || editFormSchoolsForDistrict.length === 0}
                                        >
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Select a school" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {editFormSchoolsForDistrict.map(school => (
                                            <SelectItem key={school} value={school}>
                                                {school}
                                            </SelectItem>
                                            ))}
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        {selectedEditDistrict && editFormSchoolsForDistrict.length === 0 && (
                                        <FormDescription className="text-amber-600">
                                            No schools found for this district. You may need to add schools to this district first.
                                        </FormDescription>
                                        )}
                                    </FormItem>
                                    )} 
                                />
                            </div>
                            <FormField control={playerForm.control} name="studentType" render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Student Type</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={field.value || 'independent'} className="flex items-center space-x-4">
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="independent" /></FormControl><FormLabel className="font-normal">Independent</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="gt" /></FormControl><FormLabel className="font-normal">GT</FormLabel></FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )} />
                        </form>
                    </Form>
                    </div>
                    <DialogFooter className="p-6 pt-4 border-t shrink-0">
                        <Button variant="ghost" onClick={() => setIsEditPlayerDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" form="edit-player-form-district">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the player record for {playerToDelete?.firstName} {playerToDelete?.lastName} from the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Player</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function RosterPage() {
  const { profile, isProfileLoaded } = useSponsorProfile();
  const { isDbLoaded } = useMasterDb();
  
  if (!isProfileLoaded || !isDbLoaded) {
      return <AppLayout><Skeleton className="h-[60vh] w-full" /></AppLayout>;
  }
  
  if (profile?.role === 'district_coordinator' || profile?.role === 'organizer') {
      return <AppLayout><DistrictRosterView /></AppLayout>;
  }

  return <AppLayout><SponsorRosterView /></AppLayout>;
}

    