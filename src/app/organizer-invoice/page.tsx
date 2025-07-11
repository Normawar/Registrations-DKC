
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { differenceInHours, isSameDay } from 'date-fns';

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
import { Loader2, PlusCircle, Trash2, ExternalLink, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useEvents, type Event } from '@/hooks/use-events';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';

const lineItemSchema = z.object({
  name: z.string().min(1, 'Item name is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  note: z.string().optional(),
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

export default function OrganizerInvoicePage() {
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
      lineItems: [{ name: '', amount: 0, note: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  });
  
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      const allInvoicesRaw = localStorage.getItem('all_invoices');
      if (allInvoicesRaw) {
        const allInvoices = JSON.parse(allInvoicesRaw);
        const invoiceToEdit = allInvoices.find((inv: any) => inv.id === editId);
        
        if (invoiceToEdit) {
          setOriginalInvoice(invoiceToEdit);
          setIsEditing(true);
          let lineItems: z.infer<typeof lineItemSchema>[] = [];
          
          if (invoiceToEdit.type === 'organizer' && invoiceToEdit.lineItems) {
            lineItems = invoiceToEdit.lineItems;
          } else if (invoiceToEdit.type === 'event' && invoiceToEdit.eventId) {
            const eventDetails = events.find(e => e.id === invoiceToEdit.eventId);
            if (eventDetails) {
              const submissionDate = new Date(invoiceToEdit.submissionTimestamp);
              const eventDate = new Date(eventDetails.date);
              
              let registrationFeePerPlayer = eventDetails.regularFee;
              const hoursUntilEvent = differenceInHours(eventDate, submissionDate);
              
              if (hoursUntilEvent <= 24) { registrationFeePerPlayer = eventDetails.veryLateFee; } 
              else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = eventDetails.lateFee; }
              if (isSameDay(eventDate, submissionDate)) { registrationFeePerPlayer = eventDetails.dayOfFee; }
              
              const uscfFee = 24;
              
              Object.entries(invoiceToEdit.selections as Record<string, any>).forEach(([playerId, details]) => {
                const player = allPlayers.find(p => p.id === playerId);
                const playerName = player ? `${player.firstName} ${player.lastName}` : `Player ${playerId}`;
                
                lineItems.push({ name: `Registration for ${playerName}`, amount: registrationFeePerPlayer, note: `Event: ${eventDetails.name}, Section: ${details.section}` });
                
                if (details.uscfStatus === 'new' || details.uscfStatus === 'renewing') {
                  lineItems.push({ name: `USCF Membership for ${playerName}`, amount: uscfFee, note: `Status: ${details.uscfStatus}` });
                }
              });
            }
          }
          
          form.reset({
            invoiceId: invoiceToEdit.invoiceId,
            schoolName: invoiceToEdit.schoolName,
            sponsorName: invoiceToEdit.purchaserName || invoiceToEdit.sponsorName,
            sponsorEmail: invoiceToEdit.sponsorEmail || '',
            invoiceTitle: (invoiceToEdit.description || invoiceToEdit.invoiceTitle || '').split('-rev.')[0].trim(),
            lineItems: lineItems.length > 0 ? lineItems : [{ name: '', amount: 0, note: '' }],
          });
        }
      }
    }
  }, [searchParams, form, events, allPlayers]);


  const uniqueSchools = useMemo(() => {
    const schoolNames = schoolData.map(s => s.schoolName);
    return [...new Set(schoolNames)].sort();
  }, []);

  async function onSubmit(values: InvoiceFormValues) {
    setIsLoading(true);

    try {
      let result;
      if (isEditing && originalInvoice) {
        
        // Determine the new invoice number for the revision.
        const baseInvoiceNumber = originalInvoice.invoiceNumber?.split('-rev.')[0] || originalInvoice.invoiceNumber || originalInvoice.id;
        const currentRevisionMatch = originalInvoice.invoiceNumber?.match(/-rev\.(\d+)$/);
        const currentRevision = currentRevisionMatch ? parseInt(currentRevisionMatch[1], 10) : 1;
        const newRevisionNumber = `${baseInvoiceNumber}-rev.${currentRevision + 1}`;
        
        result = await recreateOrganizerInvoice({
          originalInvoiceId: originalInvoice.id,
          sponsorName: values.sponsorName,
          sponsorEmail: values.sponsorEmail,
          schoolName: values.schoolName,
          invoiceTitle: values.invoiceTitle,
          invoiceNumber: newRevisionNumber,
          lineItems: values.lineItems,
        });
      } else {
        result = await createOrganizerInvoice({
          sponsorName: values.sponsorName,
          sponsorEmail: values.sponsorEmail,
          schoolName: values.schoolName,
          invoiceTitle: values.invoiceTitle,
          lineItems: values.lineItems,
        });
      }
      
      const newOrganizerInvoice = {
        id: result.newInvoiceId || result.invoiceId, // Use the new ID if it exists
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
      };
      
      const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
      
      let finalInvoices;
      if (isEditing && originalInvoice) {
        finalInvoices = existingInvoices.map((inv: any) => 
            inv.id === originalInvoice.id ? { ...inv, invoiceStatus: 'CANCELED', status: 'CANCELED' } : inv
        );
        finalInvoices.push(newOrganizerInvoice);
      } else {
        finalInvoices = [...existingInvoices, newOrganizerInvoice];
      }

      localStorage.setItem('all_invoices', JSON.stringify(finalInvoices));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('all_invoices_updated'));


      toast({
        title: `Invoice ${isEditing ? 'Updated' : 'Created'} Successfully!`,
        description: (
            <p>
              Invoice {result.invoiceNumber || result.invoiceId} has been {isEditing ? 'recreated' : 'created'}.
              <a href={result.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline ml-2">
                View Invoice
              </a>
            </p>
        ),
      });
      router.push('/invoices');
    } catch (error) {
      console.error('Failed to process invoice:', error);
      const description = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Invoice Processing Failed',
        description,
      });
    } finally {
      setIsLoading(false);
    }
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
