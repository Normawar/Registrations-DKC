'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
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
    RefreshCw
} from 'lucide-react';


const playerInfoSchema = z.object({
    playerName: z.string().min(1, { message: 'Player name is required.' }),
    playerEmail: z.string().email({ message: 'A valid player email is required.' }),
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

function UscfPurchaseComponent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { profile: sponsorProfile } = useSponsorProfile();

    const membershipType = searchParams.get('type') || 'Unknown Membership';
    const justification = searchParams.get('justification') || 'No justification provided.';
    const price = parseFloat(searchParams.get('price') || '0');
    
    const [invoice, setInvoice] = useState<(CreateMembershipInvoiceOutput & { playerName: string }) | null>(null);
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
            playerName: '',
            playerEmail: '',
        },
    });

    useEffect(() => {
        if (!auth) {
            setIsAuthReady(false);
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
        try {
            const result = await createMembershipInvoice({
                purchaserName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
                purchaserEmail: sponsorProfile.email,
                playerName: values.playerName,
                membershipType: membershipType,
                fee: price
            });
            setInvoice({...result, playerName: values.playerName });
            setInvoiceStatus(result.status);
            toast({ title: 'Invoice Created', description: `Invoice ${result.invoiceNumber} for ${values.playerName} has been created.` });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Invoice Creation Failed', description: errorMessage });
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
            
            let newTitle = `USCF Membership for ${invoice.playerName}`;
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
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Update Failed", description: errorMessage });
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

                <Alert variant="default" className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-primary">Membership Only</AlertTitle>
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
                            <Label className="text-sm text-muted-foreground">Price</Label>
                            <p className="text-lg font-bold">${price.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>

                {!invoice ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Player Information</CardTitle>
                            <CardDescription>Enter the name and email of the player this membership is for.</CardDescription>
                        </CardHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleCreateInvoice)}>
                                <CardContent className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="playerName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Player Full Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., Alex Ray" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="playerEmail"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Player Email</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="player@example.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" disabled={isCreatingInvoice}>
                                        {isCreatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Invoice
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
                                <AlertTitle>Uploads Disabled</AlertTitle>
                                <AlertDescription>{authError}</AlertDescription>
                              </Alert>
                            )}

                             <RadioGroup value={selectedMethod} onValueChange={(value) => handleInputChange('paymentMethod', value as PaymentMethod)} className="grid grid-cols-2 md:grid-cols-4 gap-4" disabled={isLoading}>
                                <div><RadioGroupItem value="po" id={`po-${invoice.id}`} className="peer sr-only" />
                                    <Label htmlFor={`po-${invoice.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Purchase Order</Label></div>
                                <div><RadioGroupItem value="check" id={`check-${invoice.id}`} className="peer sr-only" />
                                    <Label htmlFor={`check-${invoice.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Pay with Check</Label></div>
                                <div><RadioGroupItem value="cashapp" id={`cashapp-${invoice.id}`} className="peer sr-only" />
                                    <Label htmlFor={`cashapp-${invoice.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Cash App</Label></div>
                                <div><RadioGroupItem value="zelle" id={`zelle-${invoice.id}`} className="peer sr-only" />
                                    <Label htmlFor={`zelle-${invoice.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Zelle</Label></div>
                             </RadioGroup>
                             
                             {selectedMethod === 'po' && (
                                <div className="grid md:grid-cols-2 gap-4 items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor={`po-number-${invoice.id}`}>PO Number</Label>
                                        <Input id={`po-number-${invoice.id}`} placeholder="Enter PO Number" value={paymentInputs.poNumber || ''} onChange={(e) => handleInputChange('poNumber', e.target.value)} disabled={isLoading} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`po-file-${invoice.id}`}>Upload PO Document</Label>
                                        <Input id={`po-file-${invoice.id}`} type="file" onChange={handleFileChange} disabled={isLoading} />
                                        {paymentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {paymentInputs.file.name}</span></div>
                                        ) : paymentInputs.paymentFileUrl && paymentInputs.paymentMethod === 'po' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={paymentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {paymentInputs.paymentFileName}</a></Button></div>
                                        ) : null }
                                    </div>
                                </div>
                            )}

                            {selectedMethod === 'check' && (
                                <div className="grid md:grid-cols-3 gap-4 items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor={`check-number-${invoice.id}`}>Check Number</Label>
                                        <Input id={`check-number-${invoice.id}`} placeholder="Enter Check Number" value={paymentInputs.checkNumber || ''} onChange={(e) => handleInputChange('checkNumber', e.target.value)} disabled={isLoading} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`check-amount-${invoice.id}`}>Check Amount</Label>
                                        <Input id={`check-amount-${invoice.id}`} type="number" placeholder={price.toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} />
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
                                            <Label htmlFor={`cashapp-amount-${invoice.id}`}>Amount Paid</Label>
                                            <Input id={`cashapp-amount-${invoice.id}`} type="number" placeholder={price.toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`cashapp-file-${invoice.id}`}>Upload Confirmation Screenshot</Label>
                                            <Input id={`cashapp-file-${invoice.id}`} type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
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
                                            <Label htmlFor={`zelle-amount-${invoice.id}`}>Amount Paid</Label>
                                            <Input id={`zelle-amount-${invoice.id}`} type="number" placeholder={price.toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`zelle-file-${invoice.id}`}>Upload Confirmation Screenshot</Label>
                                            <Input id={`zelle-file-${invoice.id}`} type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
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
