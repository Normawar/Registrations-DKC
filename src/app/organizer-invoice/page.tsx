

'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { differenceInHours, isSameDay, format } from 'date-fns';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { schoolData } from '@/lib/data/school-data';
import { createOrganizerInvoice } from '@/ai/flows/create-organizer-invoice-flow';
import { recreateOrganizerInvoice } from '@/ai/flows/recreate-organizer-invoice-flow';
import { recreateInvoiceFromRoster } from '@/ai/flows/recreate-invoice-from-roster-flow';
import { Loader2, PlusCircle, Trash2, ExternalLink, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useEvents, type Event } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Skeleton } from '@/components/ui/skeleton';

const lineItemSchema = z.object({
  id: z.string().optional(), // Hold player ID if applicable
  name: z.string().min(1, 'Item name is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  note: z.string().optional(),
  isUscf: z.boolean().default(false), // Flag for USCF membership items
});

const invoiceFormSchema = z.object({
  invoiceId: z.string().optional(),
  schoolName: z.string().min(1, 'Please select a school.'),
  sponsorName: z.string().min(1, 'Sponsor name is required.'),
  sponsorEmail: z.string().email('Please enter a valid email.'),
  invoiceTitle: z.string().min(3, 'Invoice title is required.'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

function OrganizerInvoiceContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { events } = useEvents();
  const { database: allPlayers } = useMasterDb();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState<any>(null);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceId: '',
      schoolName: '',
      sponsorName: '',
      sponsorEmail: '',
      invoiceTitle: '',
      lineItems: [{ name: '', amount: 0, note: '', isUscf: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });
  
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      const fetchInvoice = async () => {
        if (!db) return;
        const docRef = doc(db, 'invoices', editId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const invoiceToEdit = { id: docSnap.id, ...docSnap.data() };
          setOriginalInvoice(invoiceToEdit);
          setIsEditing(true);
          let lineItems: z.infer<typeof lineItemSchema>[] = [];
          
          if (invoiceToEdit.type === 'event' && invoiceToEdit.eventId && invoiceToEdit.selections) {
            const eventDetails = events.find(e => e.id === invoiceToEdit.eventId);
            if (eventDetails) {
              const uscfFee = 24;
              
              Object.entries(invoiceToEdit.selections as Record<string, any>).forEach(([playerId, details]) => {
                if(details.status === 'withdrawn') return;

                const player = allPlayers.find(p => p.id === playerId);
                const playerName = player ? `${player.firstName} ${player.lastName}` : `Player ${playerId}`;
                const registrationFee = invoiceToEdit.totalInvoiced / Object.keys(invoiceToEdit.selections).length;

                lineItems.push({ id: playerId, name: `Registration for ${playerName}`, amount: registrationFee, note: `Event: ${eventDetails.name}, Section: ${details.section}` });
                
                if (details.uscfStatus === 'new' || details.uscfStatus === 'renewing') {
                  lineItems.push({ id: playerId, name: `USCF Membership for ${playerName}`, amount: uscfFee, note: `Status: ${details.uscfStatus}`, isUscf: true });
                }
              });
            }
          } else if (invoiceToEdit.type === 'organizer' && invoiceToEdit.lineItems) {
            lineItems = invoiceToEdit.lineItems;
          }
          
          const existingTitle = (invoiceToEdit.description || invoiceToEdit.invoiceTitle || '').split('-rev.')[0].trim();
          const autoTitle = `${invoiceToEdit.schoolName} - ${format(new Date(), 'MMMM yyyy')}`;

          form.reset({
            invoiceId: invoiceToEdit.invoiceId || '',
            schoolName: invoiceToEdit.schoolName || '',
            sponsorName: invoiceToEdit.purchaserName || invoiceToEdit.sponsorName || '',
            sponsorEmail: invoiceToEdit.sponsorEmail || '',
            invoiceTitle: existingTitle || autoTitle,
            lineItems: lineItems.length > 0 ? lineItems.map(item => ({
              ...item,
              id: item.id || '',
              name: item.name || '',
              amount: item.amount || 0,
              note: item.note || '',
              isUscf: item.isUscf || false
            })) : [{ 
              id: '', 
              name: '', 
              amount: 0, 
              note: '', 
              isUscf: false 
            }],
          });
        }
      };
      fetchInvoice();
    }
  }, [searchParams, form, events, allPlayers]);


  const uniqueSchools = useMemo(() => {
    const schoolNames = schoolData.map(s => s.schoolName);
    return [...new Set(schoolNames)].sort();
  }, []);

  async function onSubmit(values: InvoiceFormValues) {
    setIsLoading(true);
    try {
        if (isEditing && originalInvoice?.type === 'event') {
            await handleRecreateEventInvoice(values);
        } else if (isEditing && originalInvoice) {
            await handleRecreateOrganizerInvoice(values);
        } else {
            await handleCreateNewOrganizerInvoice(values);
        }
    } catch (error) {
        console.error('Failed to process invoice:', error);
        const description = error instanceof Error ? error.message : 'An unknown error occurred.';
        toast({ variant: 'destructive', title: 'Invoice Processing Failed', description });
    } finally {
        setIsLoading(false);
    }
  }

  async function handleRecreateEventInvoice(values: InvoiceFormValues) {
    if (!originalInvoice?.eventId) throw new Error("Original event information is missing.");
    const eventDetails = events.find(e => e.id === originalInvoice.eventId);
    if (!eventDetails) throw new Error("Could not find original event details.");

    const playerItems = values.lineItems.filter(item => !item.isUscf);
    const uscfPlayerIds = new Set(values.lineItems.filter(item => item.isUscf).map(item => item.id));

    const playersToInvoice = playerItems.map(item => {
        const player = allPlayers.find(p => p.id === item.id);
        if (!player) throw new Error(`Could not find player data for ${item.name}`);
        const lateFee = item.amount - eventDetails.regularFee;
        return {
            playerName: `${player.firstName} ${player.lastName}`,
            uscfId: player.uscfId,
            baseRegistrationFee: eventDetails.regularFee,
            lateFee: lateFee > 0 ? lateFee : 0,
            uscfAction: uscfPlayerIds.has(player.id),
            isGtPlayer: player.studentType === 'gt'
        };
    });

    const result = await recreateInvoiceFromRoster({
        originalInvoiceId: originalInvoice.invoiceId,
        players: playersToInvoice,
        uscfFee: 24,
        sponsorName: values.sponsorName,
        sponsorEmail: values.sponsorEmail,
        schoolName: values.schoolName,
        teamCode: originalInvoice.teamCode,
        eventName: values.invoiceTitle,
        eventDate: eventDetails.date,
        bookkeeperEmail: originalInvoice.bookkeeperEmail,
        gtCoordinatorEmail: originalInvoice.gtCoordinatorEmail,
        district: originalInvoice.district,
        schoolAddress: originalInvoice.schoolAddress,
        schoolPhone: originalInvoice.schoolPhone,
        requestingUserRole: 'organizer'
    });
    
    const newConfirmationRecord = {
        id: result.newInvoiceId, 
        invoiceId: result.newInvoiceId,
        eventId: originalInvoice.eventId,
        eventName: values.invoiceTitle,
        eventDate: eventDetails.date,
        submissionTimestamp: new Date().toISOString(),
        invoiceNumber: result.newInvoiceNumber,
        invoiceUrl: result.newInvoiceUrl,
        invoiceStatus: result.newStatus,
        totalInvoiced: result.newTotalAmount,
        selections: playerItems.reduce((acc, item) => {
            const player = allPlayers.find(p => p.id === item.id);
            if (player) {
                const originalSelection = originalInvoice.selections[player.id] || {};
                acc[player.id] = { ...originalSelection, uscfStatus: uscfPlayerIds.has(player.id) ? 'renewing' : 'current' };
            }
            return acc;
        }, {} as any),
        previousVersionId: originalInvoice.id, 
        teamCode: originalInvoice.teamCode,
        schoolName: values.schoolName,
        district: schoolData.find(s => s.schoolName === values.schoolName)?.district || '',
        sponsorName: values.sponsorName,
        sponsorEmail: values.sponsorEmail,
    };
    
    await setDoc(doc(db, 'invoices', result.newInvoiceId), newConfirmationRecord);
    await setDoc(doc(db, 'invoices', originalInvoice.id), { status: 'CANCELED', invoiceStatus: 'CANCELED' }, { merge: true });


    toast({
        title: "Event Invoice Recreated",
        description: `Invoice ${result.newInvoiceNumber} has been created to replace the old one.`
    });
    router.push('/invoices');
  }

  async function handleRecreateOrganizerInvoice(values: InvoiceFormValues) {
      const schoolInfo = schoolData.find(s => s.schoolName === values.schoolName);
      const result = await recreateOrganizerInvoice({
          originalInvoiceId: originalInvoice.invoiceId,
          sponsorName: values.sponsorName,
          sponsorEmail: values.sponsorEmail,
          schoolName: values.schoolName,
          invoiceTitle: values.invoiceTitle,
          lineItems: values.lineItems,
          bookkeeperEmail: originalInvoice.bookkeeperEmail,
          gtCoordinatorEmail: originalInvoice.gtCoordinatorEmail,
          district: schoolInfo?.district,
          schoolAddress: schoolInfo?.streetAddress,
          schoolPhone: schoolInfo?.phone,
      });
      const newInvoiceRecord = createOrganizerInvoiceRecord(values, result);
      
      await setDoc(doc(db, 'invoices', result.newInvoiceId), newInvoiceRecord);
      await setDoc(doc(db, 'invoices', originalInvoice.id), { status: 'CANCELED', invoiceStatus: 'CANCELED' }, { merge: true });

      toastSuccess(newInvoiceRecord, true);
      router.push('/invoices');
  }

  async function handleCreateNewOrganizerInvoice(values: InvoiceFormValues) {
      const schoolInfo = schoolData.find(s => s.schoolName === values.schoolName);
      const result = await createOrganizerInvoice({
          sponsorName: values.sponsorName,
          sponsorEmail: values.sponsorEmail,
          schoolName: values.schoolName,
          invoiceTitle: values.invoiceTitle,
          lineItems: values.lineItems,
          bookkeeperEmail: originalInvoice?.bookkeeperEmail,
          gtCoordinatorEmail: originalInvoice?.gtCoordinatorEmail,
          district: schoolInfo?.district,
          schoolAddress: schoolInfo?.streetAddress,
          schoolPhone: schoolInfo?.phone,
      });
      const newInvoiceRecord = createOrganizerInvoiceRecord(values, result);
      
      await setDoc(doc(db, 'invoices', result.invoiceId), newInvoiceRecord);

      toastSuccess(newInvoiceRecord, false);
      router.push('/invoices');
  }

  const createOrganizerInvoiceRecord = (values: InvoiceFormValues, result: any) => ({
      id: result.newInvoiceId || result.invoiceId,
      invoiceId: result.newInvoiceId || result.invoiceId,
      type: 'organizer',
      invoiceTitle: values.invoiceTitle,
      description: values.invoiceTitle,
      submissionTimestamp: new Date().toISOString(),
      totalInvoiced: values.lineItems.reduce((acc, item) => acc + item.amount, 0),
      invoiceUrl: result.invoiceUrl,
      invoiceNumber: result.invoiceNumber,
      purchaserName: values.sponsorName,
      sponsorEmail: values.sponsorEmail,
      invoiceStatus: result.status,
      schoolName: values.schoolName,
      district: schoolData.find(s => s.schoolName === values.schoolName)?.district || '',
      lineItems: values.lineItems,
  });
  
  const toastSuccess = (result: any, isUpdate: boolean) => {
      toast({
        title: `Invoice ${isUpdate ? 'Updated' : 'Created'} Successfully!`,
        description: (
            <p>
              Invoice ${result.invoiceNumber || result.invoiceId} has been ${isUpdate ? 'recreated' : 'created'}.
              <a href={result.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline ml-2">
                View Invoice
              </a>
            </p>
        ),
      });
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">{isEditing ? 'Edit Invoice' : 'Create Invoice'}</h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Modify the details of an existing invoice. This will cancel the original and create a new, revised version.' : 'Generate a custom invoice for a school.'}
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Recipient Details</CardTitle>
                <CardDescription>Select the school and enter the contact information for the invoice.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="schoolName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>School</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a school" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {uniqueSchools.map((school) => (
                                <SelectItem key={school} value={school}>
                                  {school}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                        control={form.control}
                        name="invoiceTitle"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Invoice Title</FormLabel>
                            <FormControl><Input placeholder="e.g., Fall Chess Club Dues" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="sponsorName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Recipient Name</FormLabel>
                        <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="sponsorEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Recipient Email</FormLabel>
                        <FormControl><Input type="email" placeholder="jane.doe@example.com" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
                <CardDescription>Add one or more items to be included in the invoice.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-4 items-start border p-4 rounded-lg">
                    <div className='grid grid-cols-1 md:grid-cols-[1fr,1fr] gap-4'>
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name</FormLabel>
                            <FormControl><Input placeholder="e.g., Team T-Shirt" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount ($)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="25.00" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="col-span-full">
                          <FormField
                              control={form.control}
                              name={`lineItems.${index}.note`}
                              render={({ field }) => (
                                  <FormItem>
                                  <FormLabel>Notes (Optional)</FormLabel>
                                  <FormControl><Textarea placeholder="Additional details..." {...field} /></FormControl>
                                  <FormMessage />
                                  </FormItem>
                              )}
                          />
                      </div>
                    </div>
                     <div className="flex items-end h-full">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                            className="w-full md:w-auto"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove Item</span>
                        </Button>
                     </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ name: '', amount: 0, note: '' })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Line Item
                </Button>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Update & Recreate Invoice' : 'Generate Invoice'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}

function OrganizerInvoicePageSkeleton() {
    return (
        <AppLayout>
            <div className="space-y-8">
                <div>
                    <Skeleton className="h-9 w-1/2" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                </div>
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-1/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-1/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-10 w-32" />
                        </CardContent>
                        <CardFooter>
                            <Skeleton className="h-10 w-48" />
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

export default function OrganizerInvoicePage() {
    return (
        <Suspense fallback={<OrganizerInvoicePageSkeleton />}>
            <OrganizerInvoiceContent />
        </Suspense>
    );
}
