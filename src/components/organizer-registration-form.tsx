
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInHours, isSameDay, isValid, parse } from 'date-fns';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { 
    PlusCircle, 
    Trash2,
    Loader2,
    Search,
    Info,
    CalendarIcon,
    Award
} from "lucide-react";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEvents, type Event } from '@/hooks/use-events';
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { getMasterDatabase, isMasterDatabaseLoaded, type ImportedPlayer } from '@/lib/data/master-player-store';
import { lookupUscfPlayer } from '@/ai/flows/lookup-uscf-player-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- Types and Schemas ---

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  lastName: z.string().min(1, "Last Name is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  uscfExpiration: z.date().optional(),
  regularRating: z.coerce.number().optional(),
  grade: z.string().min(1, "Please select a grade."),
  section: z.string().min(1, "Please select a section."),
  email: z.string().email({ message: "Please enter a valid email." }),
  dob: z.date({ required_error: "Date of birth is required."}),
  zipCode: z.string().min(5, { message: "Please enter a valid 5-digit zip code." }),
}).refine(data => {
    if (data.uscfId.toUpperCase() !== 'NEW') { return data.uscfExpiration !== undefined; }
    return true;
  }, { message: "USCF Expiration is required unless ID is NEW.", path: ["uscfExpiration"] })
  .refine((data) => {
    if (!data.grade || !data.section || data.section === 'Championship') return true;
    const playerGradeLevel = gradeToNumber[data.grade];
    const sectionMaxLevel = sectionMaxGrade[data.section];
    if (playerGradeLevel === undefined || sectionMaxLevel === undefined) return true;
    return playerGradeLevel <= sectionMaxLevel;
  }, { message: "Player's grade is too high for this section.", path: ["section"] });

type PlayerFormValues = z.infer<typeof playerFormSchema>;

type StagedPlayer = PlayerFormValues & {
    uscfStatus: 'current' | 'new' | 'renewing';
    byes: { round1: string; round2: string };
};

const invoiceRecipientSchema = z.object({
    sponsorName: z.string().min(1, 'Sponsor name is required.'),
    sponsorEmail: z.string().email('Please enter a valid email.'),
    schoolName: z.string().min(1, 'School name is required.'),
    teamCode: z.string().min(1, 'Team code is required.'),
});
type InvoiceRecipientValues = z.infer<typeof invoiceRecipientSchema>;

// --- Main Component ---

export function OrganizerRegistrationForm() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { events } = useEvents();
    
    const eventId = searchParams.get('eventId');
    const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);

    const [stagedPlayers, setStagedPlayers] = useState<StagedPlayer[]>([]);
    const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<StagedPlayer | null>(null);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Player search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ImportedPlayer[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const playerForm = useForm<PlayerFormValues>({
        resolver: zodResolver(playerFormSchema),
        defaultValues: { grade: '', section: '', uscfId: '', firstName: '', lastName: '', email: '', zipCode: ''}
    });

    const invoiceForm = useForm<InvoiceRecipientValues>({
        resolver: zodResolver(invoiceRecipientSchema),
    });

    // Debounced search effect
    useEffect(() => {
        if (searchQuery.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const handler = setTimeout(() => {
            const masterDb = getMasterDatabase();
            const results = masterDb.filter(p => 
                p.uscfId.includes(searchQuery) || 
                `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
            ).slice(0, 10);
            setSearchResults(results);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(handler);
    }, [searchQuery]);

    if (!event) {
        return <Card><CardContent className='pt-6'>Event not found. Please go back to Manage Events and select an event.</CardContent></Card>;
    }
    
    const handleSelectSearchedPlayer = (player: ImportedPlayer) => {
        setSearchQuery('');
        setSearchResults([]);
        playerForm.reset({
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            uscfId: player.uscfId,
            regularRating: player.regularRating,
            uscfExpiration: player.expirationDate ? parse(player.expirationDate, 'MM/dd/yyyy', new Date()) : undefined,
        });
        setIsPlayerDialogOpen(true);
    };

    const handlePlayerFormSubmit = (values: PlayerFormValues) => {
        const eventDate = new Date(event.date);
        const isExpired = !values.uscfExpiration || values.uscfExpiration < eventDate;
        const uscfStatus = values.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current';

        const playerToStage: StagedPlayer = {
            ...values,
            id: values.id || `temp-${Date.now()}`,
            uscfStatus,
            byes: { round1: 'none', round2: 'none' }
        };

        if (editingPlayer) {
            setStagedPlayers(stagedPlayers.map(p => p.id === editingPlayer.id ? playerToStage : p));
        } else {
            setStagedPlayers([...stagedPlayers, playerToStage]);
        }
        setIsPlayerDialogOpen(false);
    };

    const handleEditPlayer = (player: StagedPlayer) => {
        setEditingPlayer(player);
        playerForm.reset(player);
        setIsPlayerDialogOpen(true);
    };
    
    const handleAddPlayerClick = () => {
        setEditingPlayer(null);
        playerForm.reset();
        setIsPlayerDialogOpen(true);
    };
    
    const handleRemovePlayer = (id: string) => {
        setStagedPlayers(stagedPlayers.filter(p => p.id !== id));
    };

    const handleGenerateInvoice = async (recipient: InvoiceRecipientValues) => {
        setIsSubmitting(true);
        let registrationFeePerPlayer = event.regularFee;
        const eventDate = new Date(event.date);
        const now = new Date();
        if (isSameDay(eventDate, now)) { registrationFeePerPlayer = event.dayOfFee; } 
        else { const hoursUntilEvent = differenceInHours(eventDate, now); if (hoursUntilEvent <= 24) { registrationFeePerPlayer = event.veryLateFee; } else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = event.lateFee; } }

        const playersToInvoice = stagedPlayers.map(p => {
            const lateFeeAmount = registrationFeePerPlayer - event.regularFee;
            return {
                playerName: `${p.firstName} ${p.lastName}`,
                uscfId: p.uscfId,
                baseRegistrationFee: event.regularFee,
                lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                uscfAction: p.uscfStatus !== 'current',
            };
        });

        const uscfFee = 24;
        let totalInvoiced = 0;
        stagedPlayers.forEach(p => {
            totalInvoiced += registrationFeePerPlayer;
            if (p.uscfStatus !== 'current') {
                totalInvoiced += uscfFee;
            }
        });

        try {
            const result = await createInvoice({
                ...recipient,
                eventName: event.name,
                eventDate: event.date,
                uscfFee,
                players: playersToInvoice
            });

            const newConfirmation = {
                id: result.invoiceId, invoiceId: result.invoiceId, eventName: event.name, eventDate: event.date, 
                submissionTimestamp: new Date().toISOString(), 
                selections: stagedPlayers.reduce((acc, p) => ({ ...acc, [p.id!]: { byes: p.byes, section: p.section, uscfStatus: p.uscfStatus } }), {}),
                totalInvoiced, invoiceUrl: result.invoiceUrl, invoiceNumber: result.invoiceNumber, teamCode: recipient.teamCode, invoiceStatus: result.status,
                purchaserName: recipient.sponsorName, schoolName: recipient.schoolName,
            };

            const existingConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
            localStorage.setItem('confirmations', JSON.stringify([...existingConfirmations, newConfirmation]));
            const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
            localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, newConfirmation]));
            
            toast({ title: "Invoice Generated Successfully!", description: `Invoice ${result.invoiceNumber || result.invoiceId} for ${stagedPlayers.length} players has been created.` });
            
            // Reset state
            setStagedPlayers([]);
            setIsInvoiceDialogOpen(false);
            
        } catch (error) {
            console.error("Failed to create invoice:", error);
            const description = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Submission Error", description });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCompRegistration = async (recipient: InvoiceRecipientValues) => {
        setIsSubmitting(true);
        try {
            const confirmationId = `COMP_${Date.now()}`;

            const newConfirmation = {
                id: confirmationId,
                eventName: event.name,
                eventDate: event.date,
                submissionTimestamp: new Date().toISOString(),
                selections: stagedPlayers.reduce((acc, p) => ({ ...acc, [p.id!]: { byes: p.byes, section: p.section, uscfStatus: p.uscfStatus } }), {}),
                totalInvoiced: 0,
                teamCode: recipient.teamCode,
                invoiceStatus: 'COMPED',
                purchaserName: recipient.sponsorName,
                schoolName: recipient.schoolName,
            };

            const existingConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
            localStorage.setItem('confirmations', JSON.stringify([...existingConfirmations, newConfirmation]));
            window.dispatchEvent(new Event('storage'));

            toast({
                title: "Registration Comped",
                description: `${stagedPlayers.length} players have been registered for ${event.name} at no charge.`
            });

            setStagedPlayers([]);
            setIsInvoiceDialogOpen(false);

        } catch (error) {
            console.error("Failed to comp registration:", error);
            const description = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Submission Error", description });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Register Players for an Event</h1>
                <p className="text-muted-foreground">Organizer mode: Manually add and register players for an upcoming event.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Selected Event</CardTitle>
                </CardHeader>
                <CardContent>
                    <h2 className="text-xl font-semibold">{event.name}</h2>
                    <p className="text-muted-foreground">{format(new Date(event.date), 'PPP')} &bull; {event.location}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Staged Players ({stagedPlayers.length})</CardTitle>
                    <CardDescription>
                        Search the master database for players or add them manually. Once added, they will appear in the table below, ready for registration.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by USCF ID or Name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-10"
                            disabled={!isMasterDatabaseLoaded()}
                        />
                         {!isMasterDatabaseLoaded() && (
                            <p className="text-xs text-muted-foreground mt-1">Player database not loaded. Please <Link href="/players" className='underline'>upload it</Link> to enable search.</p>
                        )}
                        {searchQuery.length > 2 && (
                            <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                                <CardContent className="p-2">
                                    {isSearching ? (<div className="p-2 text-center text-sm text-muted-foreground">Searching...</div>)
                                    : searchResults.length === 0 ? (<div className="p-2 text-center text-sm text-muted-foreground">No results found.</div>)
                                    : (
                                        searchResults.map(player => (
                                            <button
                                                key={player.id}
                                                type="button"
                                                className="w-full text-left p-2 hover:bg-accent rounded-md"
                                                onClick={() => handleSelectSearchedPlayer(player)}
                                            >
                                                <p className="font-medium">{player.firstName} {player.lastName} ({player.state})</p>
                                                <p className="text-sm text-muted-foreground">ID: {player.uscfId} | Rating: {player.regularRating || 'N/A'}</p>
                                            </button>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <Button variant="outline" onClick={handleAddPlayerClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Player Manually</Button>
                    
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Player</TableHead>
                                    <TableHead>USCF ID</TableHead>
                                    <TableHead>Grade</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stagedPlayers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No players staged for registration.</TableCell>
                                    </TableRow>
                                )}
                                {stagedPlayers.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                                        <TableCell>{p.uscfId}</TableCell>
                                        <TableCell>{p.grade}</TableCell>
                                        <TableCell>{p.section}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditPlayer(p)}>Edit</Button>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemovePlayer(p.id!)}>Remove</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={() => setIsInvoiceDialogOpen(true)} disabled={stagedPlayers.length === 0}>
                        Proceed to Register ({stagedPlayers.length} Players)
                    </Button>
                </CardFooter>
            </Card>

            {/* Player Add/Edit Dialog */}
            <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add Player'}</DialogTitle>
                        <DialogDescription>Fill in the required details for this player to register them.</DialogDescription>
                    </DialogHeader>
                    <Form {...playerForm}>
                        <form onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input placeholder="12345678 or NEW" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="dob" render={({ field }) => ( <FormItem className='flex flex-col'><FormLabel>Date of Birth</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem className='flex flex-col'><FormLabel>USCF Expiration</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             </div>
                             <DialogFooter><Button type="submit">{editingPlayer ? 'Update Player' : 'Add Player to List'}</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            
            {/* Invoice Recipient Dialog */}
            <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Finalize Registration</DialogTitle>
                        <DialogDescription>Provide recipient details for the invoice, or comp the registration.</DialogDescription>
                    </DialogHeader>
                    <Form {...invoiceForm}>
                        <form className="space-y-4 pt-4">
                            <FormField control={invoiceForm.control} name="sponsorName" render={({ field }) => ( <FormItem><FormLabel>Recipient/Sponsor Name</FormLabel><FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={invoiceForm.control} name="sponsorEmail" render={({ field }) => ( <FormItem><FormLabel>Recipient Email</FormLabel><FormControl><Input type="email" placeholder="sponsor@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={invoiceForm.control} name="schoolName" render={({ field }) => ( <FormItem><FormLabel>School/Organization Name</FormLabel><FormControl><Input placeholder="e.g., Lincoln High School" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={invoiceForm.control} name="teamCode" render={({ field }) => ( <FormItem><FormLabel>Team Code</FormLabel><FormControl><Input placeholder="e.g., LIHS" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            
                            <DialogFooter className="flex-col sm:flex-col sm:items-stretch gap-2 pt-4">
                               <Button type="button" onClick={invoiceForm.handleSubmit(handleGenerateInvoice)} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Generate Invoice
                                </Button>
                                
                                <div className="relative">
                                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                                </div>
                                
                                <Button type="button" variant="secondary" onClick={invoiceForm.handleSubmit(handleCompRegistration)} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
                                    Comp Registration (No Invoice)
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                 </DialogContent>
            </Dialog>

        </div>
    );
}
