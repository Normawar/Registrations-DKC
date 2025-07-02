
'use client';

import { useState, useEffect, Suspense, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { auth, storage } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { createMembershipInvoice, type CreateMembershipInvoiceOutput } from '@/ai/flows/create-membership-invoice-flow';
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
import { Badge } from '@/components/ui/badge';
import {
    Info,
    Loader2,
    UploadCloud,
    File as FileIcon,
    Download,
    CalendarIcon,
    ExternalLink,
    RefreshCw,
    Trash2,
    PlusCircle
} from 'lucide-react';
import { useMasterDb } from '@/context/master-db-context';

const playerSchema = z.object({
    firstName: z.string().min(1, { message: 'First name is required.' }),
    middleName: z.string().optional(),
    lastName: z.string().min(1, { message: 'Last name is required.' }),
    email: z.string().email({ message: 'A valid email is required.' }),
    phone: z.string().optional(),
    dob: z.date({ required_error: "Date of birth is required."}),
    zipCode: z.string().min(5, { message: "A valid 5-digit zip code is required." }),
});

const playerInfoSchema = z.object({
    players: z.array(playerSchema).min(1, 'At least one player is required.'),
});

type PaymentMethod = 'po' | 'check' | 'cashapp' | 'zelle';

type PaymentInputs = {
  paymentMethod: PaymentMethod;
  poNumber: string;
  checkNumber: string;
  checkDate?: Date;
  amountPaid: string;
  file: File | null;
  paymentFileName?: string;
  paymentFileUrl?: string;
};

type InvoiceState = CreateMembershipInvoiceOutput & { 
    id: string; // Add id field
    playerCount: number;
    membershipType: string;
    submissionTimestamp: string;
    totalInvoiced: number;
    purchaserName: string;
    purchaserEmail: string;
    schoolName: string;
    district: string;
    invoiceStatus: string; // Use invoiceStatus instead of status
};


function UscfPurchaseComponent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { profile: sponsorProfile } = useSponsorProfile();
    const { database: rosterPlayers } = useMasterDb();

    const membershipType = searchParams.get('type') || 'Unknown Membership';
    const justification = searchParams.get('justification') || 'No justification provided.';
    const price = parseFloat(searchParams.get('price') || '0');
    
    const [invoice, setInvoice] = useState<InvoiceState | null>(null);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

    const [paymentInputs, setPaymentInputs] = useState<Partial<PaymentInputs>>({
        paymentMethod: 'po',
        poNumber: '',
        checkNumber: '',
        amountPaid: '',
        checkDate: undefined,
        file: null,
    });
    const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
    const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

    const form = useForm<z.infer<typeof playerInfoSchema>>({
        resolver: zodResolver(playerInfoSchema),
        defaultValues: {
            players: [{ 
                firstName: '',
                middleName: '',
                lastName: '',
                email: '',
                phone: '',
                dob: undefined,
                zipCode: '',
            }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "players"
    });

    useEffect(() => {
        if (!auth || !storage) {
            setIsAuthReady(false);
            setAuthError("Firebase is not configured, so file uploads are disabled. Please check your .env file.");
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsAuthReady(true);
                setAuthError(null);
            } else {
                signInAnonymously(auth).catch((error) => {
                    console.error("Anonymous sign-in failed:", error);
                    if (error instanceof Error && (error as any).code === 'auth/admin-restricted-operation') {
                        setAuthError("File uploads are disabled. Anonymous sign-in is not enabled in the Firebase console. Please contact your administrator.");
                    }
                    setIsAuthReady(false);
                });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleCreateInvoice = async (values: z.infer<typeof playerInfoSchema>) => {
        setIsCreatingInvoice(true);
        if (!sponsorProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Sponsor profile not loaded.' });
            setIsCreatingInvoice(false);
            return;
        }
        
        let hasError = false;
        const emailsInForm = values.players.map(p => p.email.toLowerCase());
        const emailCounts = emailsInForm.reduce((acc, email) => {
            acc[email] = (acc[email] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        values.players.forEach((player, index) => {
            const email = player.email.toLowerCase();
            if (emailCounts[email] > 1) {
                form.setError(`players.${index}.email`, { type: 'manual', message: 'This email is used more than once in this form.' });
                hasError = true;
            }
            const existingPlayer = rosterPlayers.find(rp => rp.email && rp.email.toLowerCase() === email);
            if (existingPlayer) {
                form.setError(`players.${index}.email`, { type: 'manual', message: `Email is already assigned to ${existingPlayer.firstName} ${existingPlayer.lastName}.` });
                hasError = true;
            }
        });

        if (hasError) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the errors before proceeding.' });
            setIsCreatingInvoice(false);
            return;
        }

        try {
            const playersToInvoice = values.players.map(p => ({
                ...p,
                dob: p.dob.toISOString(),
            }));
            const result = await createMembershipInvoice({
                purchaserName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
                purchaserEmail: sponsorProfile.email,
                schoolName: sponsorProfile.school,
                membershipType: membershipType,
                fee: price,
                players: playersToInvoice
            });

            const newMembershipInvoice: InvoiceState = {
                ...result,
                id: result.invoiceId,
                invoiceStatus: result.status,
                playerCount: values.players.length,
                membershipType: membershipType,
                submissionTimestamp: new Date().toISOString(),
                totalInvoiced: price * values.players.length,
                purchaserName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
                purchaserEmail: sponsorProfile.email,
                schoolName: sponsorProfile.school,
                district: sponsorProfile.district,
            };

            setInvoice(newMembershipInvoice);
            setInvoiceStatus(result.status);
            
            const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
            localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, newMembershipInvoice]));
            window.dispatchEvent(new Event('all_invoices_updated'));

            toast({ title: 'Invoice Created', description: `Invoice ${result.invoiceNumber} for ${values.players.length} player(s) has been created.` });
        } catch (error) {
            const description = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Invoice Creation Failed', description });
        } finally {
            setIsCreatingInvoice(false);
        }
    };

    const handleInputChange = (field: keyof PaymentInputs, value: any) => {
        setPaymentInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        handleInputChange('file', file);
    };

    const fetchInvoiceStatus = async () => {
        if (!invoice?.invoiceId) return;
        setIsRefreshingStatus(true);
        try {
            const { status } = await getInvoiceStatus({ invoiceId: invoice.invoiceId });
            setInvoiceStatus(status);
        } catch (error) {
            console.error(`Failed to fetch status for invoice ${invoice.invoiceId}:`, error);
            toast({ variant: "destructive", title: "Could not refresh status" });
        } finally {
            setIsRefreshingStatus(false);
        }
    };

    const handleSavePayment = async () => {
        if (!invoice) return;
        setIsUpdatingPayment(true);
        const { paymentMethod = 'po', file } = paymentInputs;

        try {
            let paymentFileName = paymentInputs.paymentFileName;
            let paymentFileUrl = paymentInputs.paymentFileUrl;

            if (file) {
                if (!isAuthReady) {
                    const message = authError || "Authentication is not ready. Cannot upload files.";
                    toast({ variant: 'destructive', title: 'Upload Failed', description: message });
                    setIsUpdatingPayment(false);
                    return;
                }
                if (!storage) {
                    toast({ variant: 'destructive', title: 'Upload Failed', description: 'Firebase Storage is not configured.' });
                    setIsUpdatingPayment(false);
                    return;
                }
                
                const storageRef = ref(storage, `uscf-payments/${invoice.invoiceId}/${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                paymentFileUrl = await getDownloadURL(snapshot.ref);
                paymentFileName = file.name;
            }
            
            let newTitle = invoice.playerCount > 1 ? `USCF Membership for ${invoice.playerCount} players` : `USCF Membership (${invoice.membershipType})`;
            let toastMessage = "Payment information has been saved.";

            switch (paymentMethod) {
                case 'po':
                    if (paymentInputs.poNumber) newTitle += ` PO: ${paymentInputs.poNumber}`;
                    break;
                case 'check':
                    if (paymentInputs.checkNumber) newTitle += ` via Check #${paymentInputs.checkNumber}`;
                    if (paymentInputs.checkDate) newTitle += ` dated ${format(paymentInputs.checkDate, 'MM/dd/yy')}`;
                    break;
                case 'cashapp':
                    newTitle += ` via CashApp`;
                    break;
                case 'zelle':
                    newTitle += ` via Zelle`;
                    break;
            }

            await updateInvoiceTitle({ invoiceId: invoice.invoiceId, title: newTitle });
            toastMessage = "Payment information has been saved and the invoice has been updated.";
            fetchInvoiceStatus();

            setPaymentInputs(prev => ({
                ...prev,
                file: null,
                paymentFileName: paymentFileName,
                paymentFileUrl: paymentFileUrl,
            }));
            
            toast({ title: "Success", description: toastMessage });

        } catch (error) {
            console.error("Failed to update payment information:", error);
            const description = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Update Failed", description });
        } finally {
            setIsUpdatingPayment(false);
        }
    };
    
    const getStatusBadgeVariant = (status?: string | null): string => {
        if (!status) return 'bg-gray-400';
        switch (status.toUpperCase()) {
            case 'PAID': return 'bg-green-600 text-white';
            case 'DRAFT': return 'bg-gray-500';
            case 'PUBLISHED': return 'bg-blue-500 text-white';
            case 'UNPAID': case 'PARTIALLY_PAID': return 'bg-yellow-500 text-black';
            case 'CANCELED': case 'VOIDED': case 'FAILED': return 'bg-red-600 text-white';
            case 'PAYMENT_PENDING': return 'bg-purple-500 text-white';
            case 'REFUNDED': case 'PARTIALLY_REFUNDED': return 'bg-indigo-500 text-white';
            default: return 'bg-muted text-muted-foreground';
        }
    };
    
    const selectedMethod = paymentInputs.paymentMethod || 'po';
    const isLoading = isUpdatingPayment || !isAuthReady;


    return (
        <AppLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Purchase USCF Membership</h1>
                    <p className="text-muted-foreground">
                        Complete the form below to generate an invoice for a USCF membership.
                    </p>
                </div>

                <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Membership Only</AlertTitle>
                    <AlertDescription>
                        Please note: This purchase is for a USCF membership only and does not register the player for any events.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardHeader>
                        <CardTitle>Membership Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Suggested Membership</Label>
                            <p className="text-lg font-bold">{membershipType}</p>
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Justification</Label>
                            <p>{justification}</p>
                        </div>
                         <div>
                            <Label className="text-sm text-muted-foreground">Price per Player</Label>
                            <p className="text-lg font-bold">${price.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>

                {!invoice ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Player Information</CardTitle>
                            <CardDescription>Enter the details for each player this membership is for.</CardDescription>
                        </CardHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleCreateInvoice)}>
                                <CardContent className="space-y-6">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="border rounded-lg p-4 space-y-4 relative">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-semibold text-lg pt-1">Player {index + 1}</h3>
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => remove(index)}
                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField control={form.control} name={`players.${index}.firstName`} render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                                <FormField control={form.control} name={`players.${index}.middleName`} render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input placeholder="Michael" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                                <FormField control={form.control} name={`players.${index}.lastName`} render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            </div>
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`players.${index}.email`} render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="player@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                                <FormField control={form.control} name={`players.${index}.phone`} render={({ field }) => ( <FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                             </div>
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`players.${index}.dob`} render={({ field }) => {
                                                    const [inputValue, setInputValue] = useState<string>( field.value ? format(field.value, "MM/dd/yyyy") : "" );
                                                    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
                                                    useEffect(() => { field.value ? setInputValue(format(field.value, "MM/dd/yyyy")) : setInputValue(""); }, [field.value]);
                                                    const handleBlur = () => {
                                                        const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
                                                        if (isValid(parsedDate)) {
                                                            if (parsedDate <= new Date() && parsedDate >= new Date("1900-01-01")) { field.onChange(parsedDate); } 
                                                            else { setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : ""); }
                                                        } else {
                                                            if (inputValue === "") { field.onChange(undefined); } 
                                                            else { setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : ""); }
                                                        }
                                                    };
                                                    return (
                                                        <FormItem><FormLabel>Date of Birth</FormLabel>
                                                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                                            <div className="relative">
                                                            <FormControl><Input placeholder="MM/DD/YYYY" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onBlur={handleBlur} /></FormControl>
                                                            <PopoverTrigger asChild><Button variant={"ghost"} className="absolute right-0 top-0 h-full w-10 p-0 font-normal" aria-label="Open calendar"><CalendarIcon className="h-4 w-4 text-muted-foreground" /></Button></PopoverTrigger>
                                                            </div>
                                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsCalendarOpen(false); }} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent>
                                                        </Popover><FormMessage /></FormItem>
                                                    );
                                                }} />
                                                <FormField control={form.control} name={`players.${index}.zipCode`} render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="78501" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                             </div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ firstName: '', middleName: '', lastName: '', email: '', phone: '', dob: undefined, zipCode: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Another Membership
                                    </Button>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" disabled={isCreatingInvoice}>
                                        {isCreatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Invoice for {fields.length} Player(s)
                                    </Button>
                                </CardFooter>
                            </form>
                        </Form>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <div>
                                    <CardTitle>Payment Information</CardTitle>
                                    <CardDescription>The invoice has been created. Please provide payment details.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="default" className={cn('capitalize', getStatusBadgeVariant(invoiceStatus))}>
                                        {invoiceStatus?.replace(/_/g, ' ').toLowerCase() || 'Unknown'}
                                    </Badge>
                                    <Button variant="ghost" size="sm" onClick={fetchInvoiceStatus} disabled={isRefreshingStatus}>
                                        <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshingStatus && "animate-spin")} />
                                        Refresh
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={invoice.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" /> View Invoice
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {authError && (
                              <Alert variant="destructive">
                                <AlertTitle>File Uploads Disabled</AlertTitle>
                                <AlertDescription>{authError}</AlertDescription>
                              </Alert>
                            )}

                             <RadioGroup value={selectedMethod} onValueChange={(value) => handleInputChange('paymentMethod', value as PaymentMethod)} className="grid grid-cols-2 md:grid-cols-4 gap-4" disabled={isLoading}>
                                <div><RadioGroupItem value="po" id={`po-${invoice.invoiceId}`} className="peer sr-only" />
                                    <Label htmlFor={`po-${invoice.invoiceId}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Purchase Order</Label></div>
                                <div><RadioGroupItem value="check" id={`check-${invoice.invoiceId}`} className="peer sr-only" />
                                    <Label htmlFor={`check-${invoice.invoiceId}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Pay with Check</Label></div>
                                <div><RadioGroupItem value="cashapp" id={`cashapp-${invoice.invoiceId}`} className="peer sr-only" />
                                    <Label htmlFor={`cashapp-${invoice.invoiceId}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Cash App</Label></div>
                                <div><RadioGroupItem value="zelle" id={`zelle-${invoice.invoiceId}`} className="peer sr-only" />
                                    <Label htmlFor={`zelle-${invoice.invoiceId}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Zelle</Label></div>
                             </RadioGroup>
                             
                             {selectedMethod === 'po' && (
                                <div className="grid md:grid-cols-2 gap-4 items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor={`po-number-${invoice.invoiceId}`}>PO Number</Label>
                                        <Input id={`po-number-${invoice.invoiceId}`} placeholder="Enter PO Number" value={paymentInputs.poNumber || ''} onChange={(e) => handleInputChange('poNumber', e.target.value)} disabled={isLoading} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`po-file-${invoice.invoiceId}`}>Upload PO Document</Label>
                                        <Input id={`po-file-${invoice.invoiceId}`} type="file" onChange={handleFileChange} disabled={isLoading} />
                                        {paymentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {paymentInputs.file.name}</span></div>
                                        ) : paymentInputs.paymentFileUrl && paymentInputs.paymentMethod === 'po' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={paymentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {paymentInputs.paymentFileName}</a></Button></div>
                                        ) : null }
                                    </div>
                                </div>
                            )}

                            {selectedMethod === 'check' && (
                                <div className="grid md:grid-cols-3 gap-4 items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor={`check-number-${invoice.invoiceId}`}>Check Number</Label>
                                        <Input id={`check-number-${invoice.invoiceId}`} placeholder="Enter Check Number" value={paymentInputs.checkNumber || ''} onChange={(e) => handleInputChange('checkNumber', e.target.value)} disabled={isLoading} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`check-amount-${invoice.invoiceId}`}>Check Amount</Label>
                                        <Input id={`check-amount-${invoice.invoiceId}`} type="number" placeholder={(price * invoice.playerCount).toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Check Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !paymentInputs.checkDate && "text-muted-foreground")}
                                                disabled={isLoading}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {paymentInputs.checkDate ? format(paymentInputs.checkDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={paymentInputs.checkDate} onSelect={(date) => handleInputChange('checkDate', date)} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            )}

                            {selectedMethod === 'cashapp' && (
                                <div className="p-4 rounded-md border bg-muted/50 space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-center">
                                        <div>
                                            <p className="font-semibold">Pay via Cash App</p>
                                            <p className="text-sm text-muted-foreground">Scan the QR code and enter the total amount due. Upload a screenshot of the confirmation.</p>
                                            <p className="font-bold text-lg mt-1">$DKChess</p>
                                        </div>
                                        <a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" target="_blank" rel="noopener noreferrer">
                                            <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" alt="CashApp QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" />
                                        </a>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4 items-start">
                                        <div className="space-y-2">
                                            <Label htmlFor={`cashapp-amount-${invoice.invoiceId}`}>Amount Paid</Label>
                                            <Input id={`cashapp-amount-${invoice.invoiceId}`} type="number" placeholder={(price * invoice.playerCount).toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`cashapp-file-${invoice.invoiceId}`}>Upload Confirmation Screenshot</Label>
                                            <Input id={`cashapp-file-${invoice.invoiceId}`} type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
                                            {paymentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {paymentInputs.file.name}</span></div>
                                            ) : paymentInputs.paymentFileUrl && paymentInputs.paymentMethod === 'cashapp' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={paymentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {paymentInputs.paymentFileName}</a></Button></div>
                                            ) : null }
                                        </div>
                                </div>
                                </div>
                            )}
                            
                            {selectedMethod === 'zelle' && (
                                <div className="p-4 rounded-md border bg-muted/50 space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-center">
                                        <div>
                                            <p className="font-semibold">Pay via Zelle</p>
                                            <p className="text-sm text-muted-foreground">Scan the QR code or use the phone number to send the total amount due. Upload a screenshot of the confirmation.</p>
                                            <p className="font-bold text-lg mt-1">956-289-3418</p>
                                        </div>
                                        <a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" target="_blank" rel="noopener noreferrer">
                                            <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" alt="Zelle QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" />
                                        </a>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4 items-start">
                                        <div className="space-y-2">
                                            <Label htmlFor={`zelle-amount-${invoice.invoiceId}`}>Amount Paid</Label>
                                            <Input id={`zelle-amount-${invoice.invoiceId}`} type="number" placeholder={(price * invoice.playerCount).toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`zelle-file-${invoice.invoiceId}`}>Upload Confirmation Screenshot</Label>
                                            <Input id={`zelle-file-${invoice.invoiceId}`} type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
                                            {paymentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {paymentInputs.file.name}</span></div>
                                            ) : paymentInputs.paymentFileUrl && paymentInputs.paymentMethod === 'zelle' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={paymentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {paymentInputs.paymentFileName}</a></Button></div>
                                            ) : null }
                                        </div>
                                </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                           <Button onClick={handleSavePayment} disabled={isLoading}>
                                {isUpdatingPayment || !isAuthReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                {isUpdatingPayment ? 'Saving...' : !isAuthReady ? 'Authenticating...' : 'Save Payment & Update Invoice'}
                            </Button>
                        </CardFooter>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}


export default function UscfPurchasePage() {
    return (
        <Suspense fallback={<AppLayout><div>Loading...</div></AppLayout>}>
            <UscfPurchaseComponent />
        </Suspense>
    )
}
