'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { signInAnonymously } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

import { AppLayout } from "@/components/app-layout";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ClipboardCheck, ExternalLink, UploadCloud, File as FileIcon, Loader2, Download, CalendarIcon } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { generateTeamCode } from '@/lib/school-utils';
import { auth, storage } from '@/lib/firebase';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


// NOTE: These types and data are duplicated from the events page for this prototype.
// In a real application, this would likely come from a shared library or API.
type Player = {
  id: string;
  firstName: string;
  lastName: string;
  uscfId: string;
  uscfExpiration?: Date;
  rating?: number;
  grade: string;
  section: string;
};

const rosterPlayers: Player[] = [
    { id: "1", firstName: "Alex", lastName: "Ray", uscfId: "12345678", uscfExpiration: new Date('2025-12-31'), rating: 1850, grade: "10th Grade", section: 'High School K-12' },
    { id: "2", firstName: "Jordan", lastName: "Lee", uscfId: "87654321", uscfExpiration: new Date('2023-01-15'), rating: 2100, grade: "11th Grade", section: 'Championship' },
    { id: "3", firstName: "Casey", lastName: "Becker", uscfId: "11223344", uscfExpiration: new Date('2025-06-01'), rating: 1500, grade: "9th Grade", section: 'High School K-12' },
    { id: "4", firstName: "Morgan", lastName: "Taylor", uscfId: "NEW", rating: 1000, grade: "5th Grade", section: 'Elementary K-5' },
    { id: "5", firstName: "Riley", lastName: "Quinn", uscfId: "55667788", uscfExpiration: new Date('2024-11-30'), rating: 1980, grade: "11th Grade", section: 'Championship' },
    { id: "6", firstName: "Skyler", lastName: "Jones", uscfId: "99887766", uscfExpiration: new Date('2025-02-28'), rating: 1650, grade: "9th Grade", section: 'High School K-12' },
    { id: "7", firstName: "Drew", lastName: "Smith", uscfId: "11122233", uscfExpiration: new Date('2023-10-01'), rating: 2050, grade: "12th Grade", section: 'Championship' },
];


type PlayerRegistration = {
  byes: { round1: string; round2: string; };
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
};
type RegistrationSelections = Record<string, PlayerRegistration>;

type PaymentMethod = 'po' | 'check' | 'cashapp' | 'zelle';

type Confirmation = {
  id: string;
  eventName: string;
  eventDate: string;
  submissionTimestamp: string;
  selections: RegistrationSelections;
  totalInvoiced: number;
  invoiceId: string;
  invoiceUrl: string;
  teamCode: string;
  paymentMethod?: PaymentMethod;
  poNumber?: string;
  checkNumber?: string;
  checkDate?: string;
  amountPaid?: string;
  paymentFileName?: string;
  paymentFileUrl?: string;
};

type ConfirmationInputs = {
  paymentMethod: PaymentMethod;
  poNumber: string;
  checkNumber: string;
  checkDate?: Date;
  amountPaid: string;
  file: File | null;
  paymentFileName?: string;
  paymentFileUrl?: string;
};


export default function ConfirmationsPage() {
  const { toast } = useToast();
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [confInputs, setConfInputs] = useState<Record<string, Partial<ConfirmationInputs>>>({});
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  
  useEffect(() => {
    // Attempt anonymous auth on load, but don't block UI
    const authenticate = async () => {
      if (auth && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous sign-in failed on page load:", error);
          if (error instanceof Error && (error as any).code === 'auth/admin-restricted-operation') {
            setAuthError("File uploads are disabled. Anonymous sign-in is not enabled in the Firebase console. Please contact your administrator.");
          }
        }
      }
    };
    authenticate();

    // Load confirmations from local storage
    try {
      const storedConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
      storedConfirmations.sort((a: Confirmation, b: Confirmation) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime());
      setConfirmations(storedConfirmations);

      const initialInputs: Record<string, Partial<ConfirmationInputs>> = {};
      for (const conf of storedConfirmations) {
          initialInputs[conf.id] = {
              paymentMethod: conf.paymentMethod || 'po',
              poNumber: conf.poNumber || '',
              checkNumber: conf.checkNumber || '',
              amountPaid: conf.amountPaid || '',
              checkDate: conf.checkDate ? new Date(conf.checkDate) : undefined,
              file: null,
              paymentFileName: conf.paymentFileName,
              paymentFileUrl: conf.paymentFileUrl,
          };
      }
      setConfInputs(initialInputs);
    } catch (error) {
        console.error("Failed to load or parse confirmations from localStorage", error);
        setConfirmations([]);
    }
  }, []);

  const getPlayerById = (id: string) => rosterPlayers.find(p => p.id === id);

  const handleInputChange = (confId: string, field: keyof ConfirmationInputs, value: any) => {
    setConfInputs(prev => ({
        ...prev,
        [confId]: {
            ...prev[confId],
            [field]: value,
        },
    }));
  };

  const handleFileChange = (confId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      handleInputChange(confId, 'file', file);
  };
  
  const handleSavePayment = async (conf: Confirmation) => {
    setIsUpdating(prev => ({ ...prev, [conf.id]: true }));
    
    const inputs = confInputs[conf.id] || {};
    const paymentMethod = inputs.paymentMethod || 'po';

    try {
        let paymentFileName = conf.paymentFileName;
        let paymentFileUrl = conf.paymentFileUrl;

        // Step 1: Handle file upload if a file is present
        if (inputs.file) {
            // Check for auth readiness
            if (!auth || !auth.currentUser) {
                // This will use the error from page load, or a generic one.
                const message = authError || "Authentication is not ready. Cannot upload files.";
                toast({ variant: 'destructive', title: 'Upload Failed', description: message });
                setIsUpdating(prev => ({ ...prev, [conf.id]: false }));
                return;
            }
            if (!storage) {
                toast({ variant: 'destructive', title: 'Upload Failed', description: 'Firebase Storage is not configured. Please check your .env file.' });
                setIsUpdating(prev => ({ ...prev, [conf.id]: false }));
                return;
            }
            
            // Upload new file
            const storageRef = ref(storage, `payment-proofs/${conf.id}/${inputs.file.name}`);
            const snapshot = await uploadBytes(storageRef, inputs.file);
            paymentFileUrl = await getDownloadURL(snapshot.ref);
            paymentFileName = inputs.file.name;
        }
        
        // Step 2: Update Square Invoice Title
        const teamCode = conf.teamCode || generateTeamCode({ schoolName: 'SHARYLAND PIONEER H S', district: 'SHARYLAND ISD' });
        let newTitle = `${teamCode} @ ${format(new Date(conf.eventDate), 'MM/dd/yyyy')} ${conf.eventName}`;
        let toastMessage = "Payment information has been saved.";

        switch (paymentMethod) {
            case 'po':
                if (inputs.poNumber) newTitle += ` PO: ${inputs.poNumber}`;
                break;
            case 'check':
                if (inputs.checkNumber) newTitle += ` via Check #${inputs.checkNumber}`;
                if (inputs.checkDate) newTitle += ` dated ${format(inputs.checkDate, 'MM/dd/yy')}`;
                break;
            case 'cashapp':
                newTitle += ` via CashApp`;
                break;
            case 'zelle':
                newTitle += ` via Zelle`;
                break;
        }

        await updateInvoiceTitle({ invoiceId: conf.invoiceId, title: newTitle });
        toastMessage = "Payment information has been saved and the invoice has been updated.";

        // Step 3: Update local state and localStorage
        const updatedConfirmations = confirmations.map(c => {
            if (c.id === conf.id) {
                return {
                    ...c,
                    teamCode,
                    paymentMethod,
                    poNumber: inputs.poNumber,
                    checkNumber: inputs.checkNumber,
                    checkDate: inputs.checkDate ? inputs.checkDate.toISOString() : undefined,
                    amountPaid: inputs.amountPaid,
                    paymentFileName,
                    paymentFileUrl,
                };
            }
            return c;
        });

        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        setConfirmations(updatedConfirmations);
      
        // Update the inputs state to reflect saved data and clear the file
        setConfInputs(prev => ({
            ...prev,
            [conf.id]: {
                ...prev[conf.id],
                file: null,
                paymentFileName: paymentFileName,
                paymentFileUrl: paymentFileUrl,
            }
        }));
        
        toast({ title: "Success", description: toastMessage });

    } catch (error) {
        console.error("Failed to update payment information:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Update Failed", description: errorMessage });
    } finally {
        setIsUpdating(prev => ({ ...prev, [conf.id]: false }));
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Registration Confirmations</h1>
          <p className="text-muted-foreground">
            A history of all your event registration submissions.
          </p>
        </div>

        {authError && (
          <Alert variant="destructive">
            <AlertTitle>Uploads Disabled</AlertTitle>
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Submission History</CardTitle>
            <CardDescription>Click on a submission to view its details.</CardDescription>
          </CardHeader>
          <CardContent>
            {confirmations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <ClipboardCheck className="h-12 w-12" />
                <p className="font-semibold">No Confirmations Yet</p>
                <p className="text-sm">When you register for an event, a confirmation will appear here.</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {confirmations.map((conf) => {
                  const currentInputs = confInputs[conf.id] || {};
                  const selectedMethod = currentInputs.paymentMethod || 'po';

                  return (
                  <AccordionItem key={conf.id} value={conf.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full pr-4">
                        <div className="flex flex-col items-start text-left">
                            <span className="font-semibold">{conf.eventName}</span>
                            <span className="text-sm text-muted-foreground">
                            Submitted on: {format(new Date(conf.submissionTimestamp), 'PPP p')}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold">${conf.totalInvoiced.toFixed(2)}</span>
                            <span className="text-sm text-muted-foreground block">
                                {Object.keys(conf.selections).length} Player(s)
                            </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold">Registered Players ({Object.keys(conf.selections).length})</h4>
                          <Button asChild variant="outline" size="sm">
                            <a href={conf.invoiceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" /> View Invoice on Square
                            </a>
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>USCF Status</TableHead>
                              <TableHead>Byes Requested</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(conf.selections).map(([playerId, details]) => {
                              const player = getPlayerById(playerId);
                              if (!player) return null;

                              const byeText = [details.byes.round1, details.byes.round2]
                                .filter(b => b !== 'none')
                                .map(b => `R${b}`)
                                .join(', ') || 'None';

                              return (
                                <TableRow key={playerId}>
                                  <TableCell className="font-medium">{player.firstName} {player.lastName}</TableCell>
                                  <TableCell>{details.section}</TableCell>
                                  <TableCell>
                                      <Badge variant={details.uscfStatus === 'current' ? 'default' : 'secondary'} className={details.uscfStatus === 'current' ? 'bg-green-600' : ''}>
                                          {details.uscfStatus.charAt(0).toUpperCase() + details.uscfStatus.slice(1)}
                                      </Badge>
                                  </TableCell>
                                  <TableCell>{byeText}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="space-y-6 pt-6 mt-6 border-t">
                        <h4 className="font-semibold">Payment Information</h4>
                        
                        <RadioGroup
                            value={selectedMethod}
                            onValueChange={(value) => handleInputChange(conf.id, 'paymentMethod', value as PaymentMethod)}
                            className="grid grid-cols-2 md:grid-cols-4 gap-4"
                        >
                            <div><RadioGroupItem value="po" id={`po-${conf.id}`} className="peer sr-only" />
                                <Label htmlFor={`po-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Purchase Order</Label></div>
                            <div><RadioGroupItem value="check" id={`check-${conf.id}`} className="peer sr-only" />
                                <Label htmlFor={`check-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Pay with Check</Label></div>
                            <div><RadioGroupItem value="cashapp" id={`cashapp-${conf.id}`} className="peer sr-only" />
                                <Label htmlFor={`cashapp-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Cash App</Label></div>
                            <div><RadioGroupItem value="zelle" id={`zelle-${conf.id}`} className="peer sr-only" />
                                <Label htmlFor={`zelle-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Zelle</Label></div>
                        </RadioGroup>

                        {selectedMethod === 'po' && (
                          <div className="grid md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                                <Label htmlFor={`po-number-${conf.id}`}>PO Number</Label>
                                <Input id={`po-number-${conf.id}`} placeholder="Enter PO Number" value={currentInputs.poNumber || ''} onChange={(e) => handleInputChange(conf.id, 'poNumber', e.target.value)} disabled={isUpdating[conf.id]} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`po-file-${conf.id}`}>Upload PO Document</Label>
                                <Input id={`po-file-${conf.id}`} type="file" onChange={(e) => handleFileChange(conf.id, e)} disabled={isUpdating[conf.id]} />
                                {currentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {currentInputs.file.name}</span></div>
                                ) : currentInputs.paymentFileUrl && currentInputs.paymentMethod === 'po' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={currentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {currentInputs.paymentFileName}</a></Button></div>
                                ) : null }
                            </div>
                          </div>
                        )}

                        {selectedMethod === 'check' && (
                            <div className="grid md:grid-cols-3 gap-4 items-start">
                                <div className="space-y-2">
                                    <Label htmlFor={`check-number-${conf.id}`}>Check Number</Label>
                                    <Input id={`check-number-${conf.id}`} placeholder="Enter Check Number" value={currentInputs.checkNumber || ''} onChange={(e) => handleInputChange(conf.id, 'checkNumber', e.target.value)} disabled={isUpdating[conf.id]} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`check-amount-${conf.id}`}>Check Amount</Label>
                                    <Input id={`check-amount-${conf.id}`} type="number" placeholder={conf.totalInvoiced.toFixed(2)} value={currentInputs.amountPaid || ''} onChange={(e) => handleInputChange(conf.id, 'amountPaid', e.target.value)} disabled={isUpdating[conf.id]} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Check Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !currentInputs.checkDate && "text-muted-foreground"
                                            )}
                                            disabled={isUpdating[conf.id]}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {currentInputs.checkDate ? format(currentInputs.checkDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={currentInputs.checkDate}
                                            onSelect={(date) => handleInputChange(conf.id, 'checkDate', date)}
                                            initialFocus
                                        />
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
                                    <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" alt="CashApp QR Code" width={100} height={100} className="rounded-md" data-ai-hint="QR code" />
                               </div>
                               <div className="grid md:grid-cols-2 gap-4 items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor={`cashapp-amount-${conf.id}`}>Amount Paid</Label>
                                        <Input id={`cashapp-amount-${conf.id}`} type="number" placeholder={conf.totalInvoiced.toFixed(2)} value={currentInputs.amountPaid || ''} onChange={(e) => handleInputChange(conf.id, 'amountPaid', e.target.value)} disabled={isUpdating[conf.id]} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`cashapp-file-${conf.id}`}>Upload Confirmation Screenshot</Label>
                                        <Input id={`cashapp-file-${conf.id}`} type="file" accept="image/*" onChange={(e) => handleFileChange(conf.id, e)} disabled={isUpdating[conf.id]} />
                                        {currentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {currentInputs.file.name}</span></div>
                                        ) : currentInputs.paymentFileUrl && currentInputs.paymentMethod === 'cashapp' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={currentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {currentInputs.paymentFileName}</a></Button></div>
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
                                    <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" alt="Zelle QR Code" width={100} height={100} className="rounded-md" data-ai-hint="QR code" />
                               </div>
                               <div className="grid md:grid-cols-2 gap-4 items-start">
                                    <div className="space-y-2">
                                        <Label htmlFor={`zelle-amount-${conf.id}`}>Amount Paid</Label>
                                        <Input id={`zelle-amount-${conf.id}`} type="number" placeholder={conf.totalInvoiced.toFixed(2)} value={currentInputs.amountPaid || ''} onChange={(e) => handleInputChange(conf.id, 'amountPaid', e.target.value)} disabled={isUpdating[conf.id]} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`zelle-file-${conf.id}`}>Upload Confirmation Screenshot</Label>
                                        <Input id={`zelle-file-${conf.id}`} type="file" accept="image/*" onChange={(e) => handleFileChange(conf.id, e)} disabled={isUpdating[conf.id]} />
                                        {currentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {currentInputs.file.name}</span></div>
                                        ) : currentInputs.paymentFileUrl && currentInputs.paymentMethod === 'zelle' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={currentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {currentInputs.paymentFileName}</a></Button></div>
                                        ) : null }
                                    </div>
                               </div>
                            </div>
                        )}

                        <Button 
                          onClick={() => handleSavePayment(conf)} 
                          disabled={isUpdating[conf.id]}
                        >
                            {isUpdating[conf.id] ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UploadCloud className="mr-2 h-4 w-4" />
                            )}
                            Save Payment & Update Invoice
                        </Button>
                      </div>

                    </AccordionContent>
                  </AccordionItem>
                )})}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
