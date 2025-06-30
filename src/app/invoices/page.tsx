
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
import { cn } from '@/lib/utils';
import { ExternalLink, RefreshCw, Receipt } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Skeleton } from '@/components/ui/skeleton';

// This combines data from event registrations and membership purchases
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

export default function InvoicesPage() {
  const { profile } = useSponsorProfile();

  const [allInvoices, setAllInvoices] = useState<CombinedInvoice[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status?: string; isLoading: boolean }>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  
  const loadAndProcessInvoices = useCallback(() => {
    let storedData: any[] = [];
    try {
        const rawData = localStorage.getItem('all_invoices');
        if (rawData) {
            storedData = JSON.parse(rawData);
        }
    } catch (e) {
        console.error("Failed to parse all_invoices from localStorage", e);
        setAllInvoices([]);
        return;
    }

    const normalizedInvoices: CombinedInvoice[] = storedData.map((inv: any) => ({
        id: inv.invoiceId || inv.id,
        description: inv.invoiceTitle || inv.eventName || (inv.membershipType ? `USCF Membership (${inv.membershipType})` : 'Invoice'),
        submissionTimestamp: inv.submissionTimestamp,
        totalInvoiced: parseFloat(String(inv.totalInvoiced)) || 0,
        invoiceId: inv.invoiceId,
        invoiceUrl: inv.invoiceUrl,
        invoiceNumber: inv.invoiceNumber,
        schoolName: inv.schoolName,
        district: inv.district,
        purchaserName: inv.purchaserName || inv.sponsorName,
        invoiceStatus: inv.invoiceStatus || inv.status,
    })).filter(inv => inv.invoiceId);

    const uniqueInvoicesMap = new Map<string, CombinedInvoice>();
    for (const inv of normalizedInvoices) {
        if (!uniqueInvoicesMap.has(inv.invoiceId!) || new Date(inv.submissionTimestamp) > new Date(uniqueInvoicesMap.get(inv.invoiceId!)!.submissionTimestamp)) {
            uniqueInvoicesMap.set(inv.invoiceId!, inv);
        }
    }
    const allUniqueInvoices = Array.from(uniqueInvoicesMap.values())
        .sort((a, b) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime());

    setAllInvoices(allUniqueInvoices);
  }, []);

  const fetchInvoiceStatus = useCallback(async (confId: string, invoiceId: string) => {
    setStatuses(prev => ({ ...prev, [confId]: { ...(prev[confId] || {}), isLoading: true } }));
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
      }
  }, []);
  
  useEffect(() => {
    loadAndProcessInvoices();
    
    const handleStorageChange = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (event.key === 'all_invoices') {
            loadAndProcessInvoices();
        }
      } else {
        loadAndProcessInvoices();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadAndProcessInvoices]);
  
  const uniqueSchools = useMemo(() => {
    const schools = new Set(allInvoices.map(inv => inv.schoolName).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(schools).sort()];
  }, [allInvoices]);
  
  const filteredInvoices = useMemo(() => {
    if (!profile) {
      return [];
    }
    return allInvoices.filter(inv => {
        if (profile.role === 'sponsor') {
            if (inv.schoolName?.trim().toUpperCase() !== profile.school?.trim().toUpperCase()) {
                return false;
            }
        } else if (profile.role === 'organizer' && schoolFilter !== 'ALL') {
            if (inv.schoolName !== schoolFilter) {
                return false;
            }
        }

        if (statusFilter !== 'ALL') {
            const currentStatus = statuses[inv.id]?.status?.toUpperCase() || inv.invoiceStatus?.toUpperCase() || '';
            if (statusFilter === 'UNPAID') {
                return ['PUBLISHED', 'UNPAID', 'DRAFT'].includes(currentStatus);
            }
            if (statusFilter === 'NO_INVOICE' && currentStatus === 'NO_INVOICE') {
                return true;
            }
            return currentStatus === statusFilter;
        }
        
        return true;
    });
  }, [allInvoices, profile, schoolFilter, statusFilter, statuses]);

    useEffect(() => {
        const invoicesToFetchStatus = filteredInvoices.filter(inv => {
            const currentStatus = statuses[inv.id]?.status?.toUpperCase() || inv.invoiceStatus?.toUpperCase() || '';
            const isFinalState = ['PAID', 'CANCELED', 'VOIDED', 'REFUNDED', 'FAILED', 'NOT_FOUND'].includes(currentStatus);
            return inv.invoiceId && !isFinalState && !statuses[inv.id]?.isLoading;
        });

        if (invoicesToFetchStatus.length > 0) {
            invoicesToFetchStatus.forEach(inv => {
                fetchInvoiceStatus(inv.id, inv.invoiceId!);
            });
        }
    }, [filteredInvoices, statuses, fetchInvoiceStatus]);
  
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
        case 'ERROR': return 'bg-destructive text-white';
        default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusDisplayName = (status?: string): string => {
    if (!status) return 'Unknown';
    if (status.toUpperCase() === 'PUBLISHED') return 'unpaid';
    if (status.toUpperCase() === 'NO_INVOICE') return 'No Invoice';
    return status.replace(/_/g, ' ').toLowerCase();
  };

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
                            const isStatusLoading = currentStatus?.isLoading;
                            
                            return (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-mono">{inv.invoiceNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{inv.description}</TableCell>
                                    <TableCell>{profile.role === 'organizer' ? inv.schoolName : inv.purchaserName}</TableCell>
                                    <TableCell>{format(new Date(inv.submissionTimestamp), 'PPP')}</TableCell>
                                    <TableCell>${inv.totalInvoiced.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(currentStatus?.status || inv.invoiceStatus))}>
                                            {isStatusLoading ? 'Loading...' : getStatusDisplayName(currentStatus?.status || inv.invoiceStatus)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => fetchInvoiceStatus(inv.id, inv.invoiceId!)} disabled={isStatusLoading || !inv.invoiceId} title="Refresh Status">
                                                <RefreshCw className={cn("h-4 w-4", isStatusLoading && "animate-spin")} />
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
