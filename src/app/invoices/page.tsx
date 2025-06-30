
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { format } from 'date-fns';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
import { cn } from '@/lib/utils';
import { ExternalLink, RefreshCw, Receipt } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Skeleton } from '@/components/ui/skeleton';

// This combines data from event confirmations and membership purchases
type CombinedInvoice = {
  id: string; // confirmation ID or invoice ID
  description: string; // event name or membership type
  submissionTimestamp: string;
  totalInvoiced: number;
  invoiceId?: string;
  invoiceUrl?: string;
  invoiceNumber?: string;
  purchaserName?: string; 
  invoiceStatus?: string;
  schoolName?: string;
  district?: string;
};


const INVOICE_STATUSES = [
    'ALL',
    'PAID',
    'UNPAID',
    'PARTIALLY_PAID',
    'PAYMENT_PENDING',
    'PUBLISHED',
    'DRAFT',
    'CANCELED',
    'VOIDED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'FAILED',
];

const mockOrganizerInvoices: CombinedInvoice[] = [
    { id: 'org_inv_1', invoiceNumber: '0001', purchaserName: 'Jane Doe', schoolName: 'SHARYLAND PIONEER H S', district: 'SHARYLAND ISD', description: 'Spring Open 2024', submissionTimestamp: new Date('2024-05-20').toISOString(), totalInvoiced: 120.00, invoiceStatus: 'PAID', invoiceUrl: '#' },
    { id: 'org_inv_2', invoiceNumber: '0002', purchaserName: 'John Smith', schoolName: 'MCALLEN H S', district: 'MCALLEN ISD', description: 'Summer Championship', submissionTimestamp: new Date('2024-05-22').toISOString(), totalInvoiced: 250.00, invoiceStatus: 'UNPAID', invoiceUrl: '#' },
    { id: 'org_inv_3', invoiceNumber: '0003', purchaserName: 'Sponsor Name', schoolName: 'SHARYLAND PIONEER H S', district: 'SHARYLAND ISD', description: 'USCF Membership (Youth)', submissionTimestamp: new Date('2024-05-21').toISOString(), totalInvoiced: 24.00, invoiceStatus: 'PAID', invoiceUrl: '#' },
    { id: 'org_inv_4', invoiceNumber: '0004', purchaserName: 'Another Sponsor', schoolName: 'LA JOYA H S', district: 'LA JOYA ISD', description: 'Spring Open 2024', submissionTimestamp: new Date('2024-05-19').toISOString(), totalInvoiced: 80.00, invoiceStatus: 'CANCELED', invoiceUrl: '#' },
    { id: 'org_inv_5', invoiceNumber: '0005', purchaserName: 'Test Sponsor', schoolName: 'EDINBURG H S', district: 'EDINBURG CISD', description: 'Autumn Classic', submissionTimestamp: new Date('2024-05-25').toISOString(), totalInvoiced: 150.00, invoiceStatus: 'PUBLISHED', invoiceUrl: '#' },
    { id: 'org_inv_6', invoiceNumber: '0006', purchaserName: 'Jane Doe', schoolName: 'SHARYLAND PIONEER H S', district: 'SHARYLAND ISD', description: 'Summer Championship', submissionTimestamp: new Date('2024-05-28').toISOString(), totalInvoiced: 200.00, invoiceStatus: 'PAYMENT_PENDING', invoiceUrl: '#' },
];

function InvoicesComponent() {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();

  const [allInvoices, setAllInvoices] = useState<CombinedInvoice[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status?: string; isLoading: boolean }>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');

  const uniqueSchools = useMemo(() => {
    const schools = new Set(mockOrganizerInvoices.map(inv => inv.schoolName || ''));
    return ['ALL', ...Array.from(schools).filter(Boolean).sort()];
  }, []);

  const fetchAllInvoiceStatuses = (invoicesToFetch: CombinedInvoice[]) => {
    invoicesToFetch.forEach(inv => {
        if (inv.invoiceId && inv.invoiceStatus !== 'PAID' && inv.invoiceStatus !== 'CANCELED' && inv.invoiceStatus !== 'VOIDED' && inv.invoiceStatus !== 'REFUNDED') {
            fetchInvoiceStatus(inv.id, inv.invoiceId, true);
        } else {
            setStatuses(prev => ({...prev, [inv.id]: { status: inv.invoiceStatus, isLoading: false }}))
        }
    });
  };

  const fetchInvoiceStatus = async (confId: string, invoiceId: string, silent = false) => {
      if (!silent) {
          setStatuses(prev => ({ ...prev, [confId]: { ...prev[confId], isLoading: true } }));
      }
      try {
          const { status } = await getInvoiceStatus({ invoiceId });
          setStatuses(prev => ({ ...prev, [confId]: { status: status, isLoading: false } }));
      } catch (error) {
          console.error(`Failed to fetch status for invoice ${invoiceId}:`, error);
          setStatuses(prev => ({ ...prev, [confId]: { status: 'ERROR', isLoading: false } }));
          if (!silent) {
            const description = error instanceof Error ? error.message : "Failed to get the latest invoice status from Square.";
            toast({
                variant: "destructive",
                title: "Could not refresh status",
                description: description
            });
          }
      }
  };
  
  useEffect(() => {
    if (!profile) return;
    try {
        if (profile.role === 'organizer') {
            const initialStatuses: Record<string, { status?: string; isLoading: boolean }> = {};
            for (const inv of mockOrganizerInvoices) {
                initialStatuses[inv.id] = { status: inv.invoiceStatus, isLoading: false };
            }
            setAllInvoices(mockOrganizerInvoices);
            setStatuses(initialStatuses);
            return;
        }

        // Sponsor view
        const eventConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const membershipInvoices = JSON.parse(localStorage.getItem('membershipInvoices') || '[]');

        const sponsorEmail = profile.email;

        const combined: CombinedInvoice[] = [
            ...eventConfirmations
            .filter((c: any) => c.invoiceId && c.sponsorEmail === sponsorEmail)
            .map((c: any) => ({
                id: c.id,
                description: c.eventName,
                submissionTimestamp: c.submissionTimestamp,
                totalInvoiced: c.totalInvoiced,
                invoiceId: c.invoiceId,
                invoiceUrl: c.invoiceUrl,
                invoiceNumber: c.invoiceNumber,
                purchaserName: `${profile?.firstName || 'Sponsor'} ${profile?.lastName || ''}`.trim(),
                invoiceStatus: c.invoiceStatus,
                schoolName: profile.school,
                district: profile.district,
            })),
            ...membershipInvoices
            .filter((i: any) => i.invoiceId && i.purchaserEmail === sponsorEmail)
            .map((i: any) => ({
                id: i.invoiceId,
                description: `USCF Membership (${i.membershipType})`,
                submissionTimestamp: i.submissionTimestamp,
                totalInvoiced: i.totalInvoiced,
                invoiceId: i.invoiceId,
                invoiceUrl: i.invoiceUrl,
                invoiceNumber: i.invoiceNumber,
                purchaserName: i.purchaserName,
                invoiceStatus: i.status,
                schoolName: profile.school,
                district: profile.district,
            }))
        ];
        
        combined.sort((a, b) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime());
        
        setAllInvoices(combined);

        const initialStatuses: Record<string, { status?: string; isLoading: boolean }> = {};
        for (const inv of combined) {
            if (inv.invoiceId) {
                initialStatuses[inv.id] = { status: inv.invoiceStatus || 'LOADING', isLoading: true };
            }
        }
        setStatuses(initialStatuses);
        
        fetchAllInvoiceStatuses(combined);

    } catch (error) {
        console.error("Failed to load invoices from localStorage", error);
        setAllInvoices([]);
    }
  }, [profile]);

  const getStatusBadgeVariant = (status?: string): string => {
    if (!status) return 'bg-gray-400';
    switch (status.toUpperCase()) {
        case 'PAID': return 'bg-green-600 text-white';
        case 'DRAFT': return 'bg-gray-500';
        case 'PUBLISHED': return 'bg-blue-500 text-white';
        case 'UNPAID': case 'PARTIALLY_PAID': return 'bg-yellow-500 text-black';
        case 'CANCELED': case 'VOIDED': case 'FAILED': return 'bg-red-600 text-white';
        case 'PAYMENT_PENDING': return 'bg-purple-500 text-white';
        case 'REFUNDED': case 'PARTIALLY_REFUNDED': return 'bg-indigo-500 text-white';
        case 'LOADING': return 'bg-muted text-muted-foreground animate-pulse';
        default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredInvoices = useMemo(() => {
    let invoices = [...allInvoices];

    if (profile?.role === 'organizer' && schoolFilter !== 'ALL') {
      invoices = invoices.filter(inv => inv.schoolName === schoolFilter);
    }

    if (statusFilter !== 'ALL') {
      const liveStatusFilter = (inv: CombinedInvoice) => statuses[inv.id]?.status?.toUpperCase() === statusFilter;
      const mockStatusFilter = (inv: CombinedInvoice) => inv.invoiceStatus?.toUpperCase() === statusFilter;
      
      invoices = invoices.filter(profile?.role === 'organizer' ? mockStatusFilter : liveStatusFilter);
    }

    return invoices;
  }, [allInvoices, statuses, statusFilter, schoolFilter, profile]);
  
  if (!profile) {
    return (
        <AppLayout>
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-full" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Invoices</h1>
          <p className="text-muted-foreground">
            {profile.role === 'organizer' 
                ? 'A comprehensive list of all invoices across all schools.'
                : 'A comprehensive list of all generated invoices for your events and memberships.'
            }
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>All Invoices</CardTitle>
                    <CardDescription>Filter invoices by their current payment status.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {profile.role === 'organizer' && (
                        <div className="w-full sm:w-auto">
                            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                                <SelectTrigger className="w-full sm:w-[240px]">
                                    <SelectValue placeholder="Filter by school..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueSchools.map(school => (
                                        <SelectItem key={school} value={school}>
                                            {school === 'ALL' ? 'All Schools' : school}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="w-full sm:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filter by status..." />
                            </SelectTrigger>
                            <SelectContent>
                                {INVOICE_STATUSES.map(status => (
                                    <SelectItem key={status} value={status}>
                                        {status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <Receipt className="h-12 w-12" />
                <p className="font-semibold">No Invoices Found</p>
                <p className="text-sm">There are no invoices matching the selected filter, or no invoices have been created yet.</p>
              </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>{profile.role === 'organizer' ? 'School' : 'Purchaser'}</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.map((inv) => {
                            const currentStatus = profile.role === 'sponsor' ? statuses[inv.id] : { status: inv.invoiceStatus, isLoading: false };
                            const isLoading = profile.role === 'sponsor' && currentStatus?.isLoading;
                            
                            return (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-mono">{inv.invoiceNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{inv.description}</TableCell>
                                    <TableCell>{profile.role === 'organizer' ? inv.schoolName : inv.purchaserName}</TableCell>
                                    <TableCell>{format(new Date(inv.submissionTimestamp), 'PPP')}</TableCell>
                                    <TableCell>${inv.totalInvoiced.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(currentStatus?.status))}>
                                            {isLoading ? 'Loading...' : currentStatus?.status?.replace(/_/g, ' ').toLowerCase() || 'Unknown'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {profile.role === 'sponsor' && (
                                                <Button variant="ghost" size="icon" onClick={() => fetchInvoiceStatus(inv.id, inv.invoiceId!)} disabled={isLoading || !inv.invoiceId} title="Refresh Status">
                                                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                                    <span className="sr-only">Refresh Status</span>
                                                </Button>
                                            )}
                                            <Button asChild variant="outline" size="sm" disabled={!inv.invoiceUrl}>
                                                <a href={inv.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer" className={cn(!inv.invoiceUrl && 'pointer-events-none')}>
                                                <ExternalLink className="mr-2 h-4 w-4" /> View
                                                </a>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function InvoicesPage() {
    return (
        <Suspense fallback={<AppLayout><div>Loading...</div></AppLayout>}>
            <InvoicesComponent />
        </Suspense>
    )
}
