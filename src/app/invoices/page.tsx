
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
    'NO_INVOICE'
];

const sampleInvoices: CombinedInvoice[] = [
  {
    id: 'sample-new-organizer-1',
    invoiceId: 'inv-sample-new-org-1',
    invoiceNumber: 'SAMP-005',
    description: 'New Organizer Invoice (Test)',
    submissionTimestamp: new Date().toISOString(),
    totalInvoiced: 175.50,
    invoiceUrl: 'https://squareup.com/invoice/inv-sample-new-org-1',
    purchaserName: 'Sponsor Name',
    invoiceStatus: 'PUBLISHED',
    schoolName: 'SHARYLAND PIONEER H S',
    district: 'SHARYLAND ISD',
  },
  {
    id: 'sample-new-uscf-1',
    invoiceId: 'inv-sample-new-uscf-1',
    invoiceNumber: 'SAMP-006',
    description: 'New USCF Membership Invoice (Test)',
    submissionTimestamp: new Date().toISOString(),
    totalInvoiced: 48.00,
    invoiceUrl: 'https://squareup.com/invoice/inv-sample-new-uscf-1',
    purchaserName: 'Sponsor Name',
    invoiceStatus: 'PAID',
    schoolName: 'SHARYLAND PIONEER H S',
    district: 'SHARYLAND ISD',
  },
  {
    id: 'sample-1',
    invoiceId: 'inv-sample-001',
    invoiceNumber: '0001',
    description: 'Fall Classic 2024 Registration',
    submissionTimestamp: new Date('2024-05-15T10:00:00Z').toISOString(),
    totalInvoiced: 125.00,
    invoiceUrl: 'https://squareup.com/invoice/inv-sample-001',
    purchaserName: 'John Doe',
    invoiceStatus: 'PAID',
    schoolName: 'SHARYLAND PIONEER H S', // Match sponsor's school
    district: 'SHARYLAND ISD',
  },
  {
    id: 'sample-2',
    invoiceId: 'inv-sample-002',
    invoiceNumber: '0002',
    description: 'USCF Membership (Youth)',
    submissionTimestamp: new Date('2024-05-18T14:30:00Z').toISOString(),
    totalInvoiced: 24.00,
    invoiceUrl: 'https://squareup.com/invoice/inv-sample-002',
    purchaserName: 'Jane Smith',
    invoiceStatus: 'PUBLISHED',
    schoolName: 'MCALLEN H S', // Different school
    district: 'MCALLEN ISD',
  },
    {
    id: 'sample-3',
    invoiceId: 'inv-sample-003',
    invoiceNumber: '0003',
    description: 'Club T-Shirt Order',
    submissionTimestamp: new Date('2024-05-20T11:00:00Z').toISOString(),
    totalInvoiced: 250.00,
    invoiceUrl: 'https://squareup.com/invoice/inv-sample-003',
    purchaserName: 'Sponsor Name',
    invoiceStatus: 'UNPAID',
    schoolName: 'SHARYLAND PIONEER H S', // Match sponsor's school
    district: 'SHARYLAND ISD',
  },
   {
    id: 'sample-4',
    invoiceId: 'inv-sample-004',
    invoiceNumber: '0004',
    description: 'Spring Scholastic 2024',
    submissionTimestamp: new Date('2024-04-10T09:00:00Z').toISOString(),
    totalInvoiced: 80.00,
    invoiceUrl: 'https://squareup.com/invoice/inv-sample-004',
    purchaserName: 'Bob Johnson',
    invoiceStatus: 'PAID',
    schoolName: 'EDINBURG H S', // Different school
    district: 'EDINBURG CISD',
  },
];


function InvoicesComponent() {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();

  const [allInvoices, setAllInvoices] = useState<CombinedInvoice[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status?: string; isLoading: boolean }>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');

  const uniqueSchools = useMemo(() => {
    const schools = new Set(allInvoices.map(inv => inv.schoolName || ''));
    return ['ALL', ...Array.from(schools).filter(Boolean).sort()];
  }, [allInvoices]);
  
  const fetchInvoiceStatus = async (confId: string, invoiceId: string, silent = false) => {
      if (!silent) {
          setStatuses(prev => ({ ...prev, [confId]: { ...prev[confId], isLoading: true } }));
      }
      try {
          const { status } = await getInvoiceStatus({ invoiceId });
          setStatuses(prev => ({ ...prev, [confId]: { status: status, isLoading: false } }));
      } catch (error) {
          console.error(`Failed to fetch status for invoice ${invoiceId}:`, error);
          if (error instanceof Error && (error.message.includes('404') || error.message.includes("Not Found"))) {
              setStatuses(prev => ({ ...prev, [confId]: { status: 'NOT_FOUND', isLoading: false } }));
          } else {
              setStatuses(prev => ({ ...prev, [confId]: { status: 'ERROR', isLoading: false } }));
          }
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

  const fetchAllInvoiceStatuses = (invoicesToFetch: CombinedInvoice[]) => {
    invoicesToFetch.forEach(inv => {
        if (inv.invoiceId && !inv.id.startsWith('sample-')) {
            fetchInvoiceStatus(inv.id, inv.invoiceId, true);
        }
    });
  };
  
  useEffect(() => {
    if (!profile) return;
    try {
        const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const membershipInvoices = JSON.parse(localStorage.getItem('membershipInvoices') || '[]');
        const organizerInvoices = JSON.parse(localStorage.getItem('organizerInvoices') || '[]');

        const allLocalInvoices = [...confirmations, ...membershipInvoices, ...organizerInvoices];
        
        const uniqueInvoicesMap = new Map<string, CombinedInvoice>();

        // Add sample invoices first, so they can be overwritten by real ones.
        for (const inv of sampleInvoices) {
            const key = inv.invoiceId || inv.id;
            uniqueInvoicesMap.set(key, inv);
        }
        
        // Normalize and add local invoices, overwriting samples with the same ID
        for (const inv of allLocalInvoices) {
            const normalizedInv: CombinedInvoice = {
                id: inv.id,
                description: inv.description || inv.eventName || (inv.membershipType ? `USCF Membership (${inv.membershipType})` : inv.invoiceTitle || 'Unknown Invoice'),
                submissionTimestamp: inv.submissionTimestamp,
                totalInvoiced: inv.totalInvoiced || 0,
                invoiceId: inv.invoiceId,
                invoiceUrl: inv.invoiceUrl,
                invoiceNumber: inv.invoiceNumber,
                schoolName: inv.schoolName || profile.school,
                district: inv.district || profile.district,
                purchaserName: inv.purchaserName || `${profile.firstName} ${profile.lastName}`,
                invoiceStatus: inv.invoiceStatus || inv.status,
            };
            const key = normalizedInv.invoiceId || normalizedInv.id;
            uniqueInvoicesMap.set(key, normalizedInv);
        }
        
        const allUniqueInvoices = Array.from(uniqueInvoicesMap.values());
            
        let filteredInvoices = allUniqueInvoices;
        if (profile.role === 'sponsor') {
            filteredInvoices = allUniqueInvoices.filter(inv => inv.schoolName === profile.school);
        }
        
        filteredInvoices.sort((a, b) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime());
        
        setAllInvoices(filteredInvoices);

        // Initialize status display for each invoice
        const initialStatuses: Record<string, { status?: string; isLoading: boolean }> = {};
        for (const inv of filteredInvoices) {
            if (inv.invoiceId) {
                initialStatuses[inv.id] = { status: inv.invoiceStatus || 'LOADING', isLoading: !inv.invoiceStatus };
            } else {
                initialStatuses[inv.id] = { status: 'NO_INVOICE', isLoading: false };
            }
        }
        setStatuses(initialStatuses);
        
        // Fetch live statuses for real invoices that aren't in a final state
        const invoicesToFetch = filteredInvoices.filter(inv => {
            const currentStatus = initialStatuses[inv.id]?.status?.toUpperCase();
            const isFinalState = ['PAID', 'CANCELED', 'VOIDED', 'REFUNDED', 'FAILED', 'NO_INVOICE', 'NOT_FOUND'].includes(currentStatus || '');
            return inv.invoiceId && !isFinalState;
        });
        fetchAllInvoiceStatuses(invoicesToFetch);

    } catch (error) {
        console.error("Failed to load invoices", error);
        setAllInvoices([]);
    }
  }, [profile]);

  const getStatusBadgeVariant = (status?: string): string => {
    if (!status) return 'bg-gray-400';
    switch (status.toUpperCase()) {
        case 'PAID': return 'bg-green-600 text-white';
        case 'DRAFT': return 'bg-gray-500';
        case 'PUBLISHED':
        case 'UNPAID': 
        case 'PARTIALLY_PAID': return 'bg-yellow-500 text-black';
        case 'CANCELED': case 'VOIDED': case 'FAILED': return 'bg-red-600 text-white';
        case 'PAYMENT_PENDING': return 'bg-purple-500 text-white';
        case 'REFUNDED': case 'PARTIALLY_REFUNDED': return 'bg-indigo-500 text-white';
        case 'LOADING': return 'bg-muted text-muted-foreground animate-pulse';
        case 'NO_INVOICE': return 'bg-slate-400 text-white';
        case 'NOT_FOUND': return 'bg-destructive/80 text-white';
        default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusDisplayName = (status?: string): string => {
    if (!status) return 'Unknown';
    if (status.toUpperCase() === 'PUBLISHED') return 'unpaid';
    if (status.toUpperCase() === 'NO_INVOICE') return 'No Invoice';
    return status.replace(/_/g, ' ').toLowerCase();
  };

  const filteredInvoices = useMemo(() => {
    let invoices = [...allInvoices];

    if (profile?.role === 'organizer' && schoolFilter !== 'ALL') {
      invoices = invoices.filter(inv => inv.schoolName === schoolFilter);
    }

    if (statusFilter !== 'ALL') {
      const liveStatusFilter = (inv: CombinedInvoice) => {
        const currentStatus = statuses[inv.id]?.status?.toUpperCase() || inv.invoiceStatus?.toUpperCase() || '';
        if (!currentStatus) return false;
        
        if (statusFilter === 'UNPAID' && ['PUBLISHED', 'UNPAID'].includes(currentStatus)) {
            return true;
        }
        if (statusFilter === 'NO_INVOICE' && currentStatus === 'NO_INVOICE') {
          return true;
        }
        return currentStatus === statusFilter;
      };
      
      invoices = invoices.filter(liveStatusFilter);
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
                : `A list of all invoices for ${profile.school}.`
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
                                        {status === 'PUBLISHED' 
                                            ? 'Unpaid' 
                                            : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')}
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
                            const currentStatus = statuses[inv.id];
                            const isLoading = currentStatus?.isLoading;
                            
                            return (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-mono">{inv.invoiceNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{inv.description}</TableCell>
                                    <TableCell>{profile.role === 'organizer' ? inv.schoolName : inv.purchaserName}</TableCell>
                                    <TableCell>{format(new Date(inv.submissionTimestamp), 'PPP')}</TableCell>
                                    <TableCell>${inv.totalInvoiced.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(currentStatus?.status || inv.invoiceStatus))}>
                                            {isLoading ? 'Loading...' : getStatusDisplayName(currentStatus?.status || inv.invoiceStatus)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => fetchInvoiceStatus(inv.id, inv.invoiceId!)} disabled={isLoading || !inv.invoiceId || inv.id.startsWith('sample-')} title="Refresh Status">
                                                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                                <span className="sr-only">Refresh Status</span>
                                            </Button>
                                            <Button asChild variant="outline" size="sm" disabled={!inv.invoiceUrl}>
                                                <a href={inv.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer" className={cn(!inv.invoiceUrl && 'pointer-events-none opacity-50')}>
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
