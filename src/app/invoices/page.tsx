

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
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
import { cancelInvoice } from '@/ai/flows/cancel-invoice-flow';
import { cn } from '@/lib/utils';
import { ExternalLink, RefreshCw, Receipt, MoreHorizontal, FilePenLine, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// This combines data from event registrations and membership/organizer purchases
type CombinedInvoice = {
  id: string; // confirmation ID or invoice ID
  description: string; // event name or membership/invoice type
  submissionTimestamp: string;
  totalInvoiced: number;
  invoiceId?: string;
  invoiceUrl?: string;
  invoiceNumber?: string;
  purchaserName?: string;
  invoiceStatus?: string;
  schoolName?: string;
  district?: string;
  // For editing organizer invoices
  type: 'event' | 'membership' | 'organizer';
  lineItems?: { name: string; amount: number; note?: string }[];
  sponsorEmail?: string;
  eventId?: string; // For event invoices
  selections?: any; // For event invoices
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
  const { toast } = useToast();

  const [allInvoices, setAllInvoices] = useState<CombinedInvoice[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status?: string; isLoading: boolean }>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<CombinedInvoice | null>(null);

  const [sortField, setSortField] = useState<string>('submissionTimestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
        id: inv.id,
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
        type: inv.eventId ? 'event' : inv.lineItems ? 'organizer' : inv.membershipType ? 'membership' : 'organizer',
        lineItems: inv.lineItems,
        sponsorEmail: inv.sponsorEmail || inv.purchaserEmail,
        eventId: inv.eventId,
        selections: inv.selections,
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

    const initialStatuses: Record<string, { status?: string; isLoading: boolean }> = {};
    for (const inv of allUniqueInvoices) {
        initialStatuses[inv.id] = { status: inv.invoiceStatus || 'UNKNOWN', isLoading: false };
    }
    setStatuses(initialStatuses);
  }, []);

  const fetchInvoiceStatus = useCallback(async (confId: string, invoiceId: string) => {
    setStatuses(prev => ({ ...prev, [confId]: { ...(prev[confId] || {}), isLoading: true } }));
      try {
          const { status } = await getInvoiceStatus({ invoiceId });
          setStatuses(prev => ({ ...prev, [confId]: { status: status, isLoading: false } }));
          // Update localStorage
          const allInvoicesRaw = localStorage.getItem('all_invoices') || '[]';
          const allInvoicesParsed = JSON.parse(allInvoicesRaw);
          const updatedInvoices = allInvoicesParsed.map((inv: any) => {
              if (inv.invoiceId === invoiceId) {
                  return { ...inv, status: status, invoiceStatus: status };
              }
              return inv;
          });
          localStorage.setItem('all_invoices', JSON.stringify(updatedInvoices));
          setAllInvoices(prev => prev.map(i => i.invoiceId === invoiceId ? {...i, invoiceStatus: status} : i));

      } catch (error) {
          console.error(`Failed to fetch status for invoice ${invoiceId}:`, error);
          let errorStatus = 'ERROR';
          if (error instanceof Error && (error.message.includes('404') || error.message.includes("Not Found"))) {
              errorStatus = 'NOT_FOUND';
          }
          setStatuses(prev => ({ ...prev, [confId]: { status: errorStatus, isLoading: false } }));
      }
  }, []);
  
  useEffect(() => {
    const handleStorageChange = () => {
        loadAndProcessInvoices();
    };
    
    loadAndProcessInvoices();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('all_invoices_updated', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('all_invoices_updated', handleStorageChange);
    };
  }, [loadAndProcessInvoices]);
  
  const uniqueSchools = useMemo(() => {
    const schools = new Set(allInvoices.map(inv => inv.schoolName).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(schools).sort()];
  }, [allInvoices]);
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const filteredInvoices = useMemo(() => {
    if (!profile) {
      return [];
    }
    
    let invoicesToFilter = allInvoices.filter(inv => {
        if (profile.role === 'sponsor' && inv.schoolName && profile.school) {
            if (inv.schoolName.trim().toUpperCase() !== profile.school.trim().toUpperCase()) {
                return false;
            }
        } else if (profile.role === 'organizer' && schoolFilter !== 'ALL') {
            if (inv.schoolName !== schoolFilter) {
                return false;
            }
        }

        const currentStatus = statuses[inv.id]?.status?.toUpperCase() || inv.invoiceStatus?.toUpperCase() || '';
        if (statusFilter !== 'ALL') {
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

    return invoicesToFilter.sort((a, b) => {
      const aVal = a[sortField as keyof CombinedInvoice] || '';
      const bVal = b[sortField as keyof CombinedInvoice] || '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (sortField === 'submissionTimestamp') {
        const aDate = new Date(aVal as string).getTime();
        const bDate = new Date(bVal as string).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal)) 
        : String(bVal).localeCompare(String(aVal));
    });

  }, [allInvoices, profile, schoolFilter, statusFilter, statuses, sortField, sortDirection]);
  
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
        case 'NO_INVOICE': case 'COMPED': return 'bg-sky-500 text-white';
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

  const handleCancelInvoice = (invoice: CombinedInvoice) => {
    setInvoiceToCancel(invoice);
    setIsAlertOpen(true);
  };
  
  const confirmCancel = async () => {
      if (!invoiceToCancel) return;

      try {
        await cancelInvoice({ invoiceId: invoiceToCancel.invoiceId! });
        
        const allInvoicesRaw = localStorage.getItem('all_invoices') || '[]';
        const allInvoicesParsed = JSON.parse(allInvoicesRaw);
        const updatedInvoices = allInvoicesParsed.map((inv: any) => {
            if (inv.invoiceId === invoiceToCancel.invoiceId) {
                return { ...inv, status: 'CANCELED', invoiceStatus: 'CANCELED' };
            }
            return inv;
        });
        localStorage.setItem('all_invoices', JSON.stringify(updatedInvoices));

        setAllInvoices(prev => prev.map(inv => inv.id === invoiceToCancel.id ? {...inv, invoiceStatus: 'CANCELED'} : inv));
        setStatuses(prev => ({...prev, [invoiceToCancel.id]: {status: 'CANCELED', isLoading: false}}));

        toast({ title: 'Invoice Canceled', description: `Invoice ${invoiceToCancel.invoiceNumber} has been canceled.`});
      } catch(error) {
        console.error("Failed to cancel invoice:", error);
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Could not cancel the invoice.' });
      } finally {
        setIsAlertOpen(false);
        setInvoiceToCancel(null);
      }
  }


  const hasInvoicesButFilterHidesThem = allInvoices.length > 0 && filteredInvoices.length === 0;

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
                <p className="font-semibold">
                    {hasInvoicesButFilterHidesThem ? "No Invoices Match Filter" : "No Invoices Found"}
                </p>
                <p className="text-sm">
                    {hasInvoicesButFilterHidesThem
                        ? "There are invoices, but none match your current filter selections."
                        : "There are no invoices to display. Create one from the Events, USCF, or Organizer pages."
                    }
                </p>
              </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><Button variant="ghost" className="pl-0" onClick={() => handleSort('invoiceNumber')}>Invoice # {getSortIcon('invoiceNumber')}</Button></TableHead>
                            <TableHead><Button variant="ghost" className="pl-0" onClick={() => handleSort('description')}>Description {getSortIcon('description')}</Button></TableHead>
                            <TableHead><Button variant="ghost" className="pl-0" onClick={() => handleSort(profile.role === 'organizer' ? 'schoolName' : 'purchaserName')}>{profile.role === 'organizer' ? 'School' : 'Purchaser'} {getSortIcon(profile.role === 'organizer' ? 'schoolName' : 'purchaserName')}</Button></TableHead>
                            <TableHead><Button variant="ghost" className="pl-0" onClick={() => handleSort('submissionTimestamp')}>Date {getSortIcon('submissionTimestamp')}</Button></TableHead>
                            <TableHead><Button variant="ghost" className="pl-0" onClick={() => handleSort('totalInvoiced')}>Amount {getSortIcon('totalInvoiced')}</Button></TableHead>
                            <TableHead><Button variant="ghost" className="pl-0" onClick={() => handleSort('invoiceStatus')}>Status {getSortIcon('invoiceStatus')}</Button></TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.map((inv) => {
                            const currentStatusInfo = statuses[inv.id];
                            const isStatusLoading = currentStatusInfo?.isLoading;
                            const status = currentStatusInfo?.status || inv.invoiceStatus;
                            const isCancelable = status && !['PAID', 'CANCELED', 'REFUNDED', 'VOIDED', 'COMPED', 'NOT_FOUND'].includes(status.toUpperCase());
                            
                            return (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-mono">{inv.invoiceNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{inv.description}</TableCell>
                                    <TableCell>{profile.role === 'organizer' ? inv.schoolName : inv.purchaserName}</TableCell>
                                    <TableCell>{format(new Date(inv.submissionTimestamp), 'PPP')}</TableCell>
                                    <TableCell>${inv.totalInvoiced.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(status))}>
                                            {isStatusLoading ? 'Loading...' : getStatusDisplayName(status)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => fetchInvoiceStatus(inv.id, inv.invoiceId!)} disabled={isStatusLoading || !inv.invoiceId} title="Refresh Status">
                                                <RefreshCw className={cn("h-4 w-4", isStatusLoading && "animate-spin")} />
                                                <span className="sr-only">Refresh Status</span>
                                            </Button>
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                  <DropdownMenuItem asChild>
                                                    <a href={inv.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer" className={cn(!inv.invoiceUrl && 'pointer-events-none opacity-50')}>
                                                        <ExternalLink className="mr-2 h-4 w-4" /> View Invoice
                                                    </a>
                                                  </DropdownMenuItem>
                                                  {profile.role === 'organizer' && (
                                                    <>
                                                        <DropdownMenuItem asChild>
                                                             <Link href={inv.type === 'event' ? `/confirmations#${inv.invoiceId}` : `/organizer-invoice?edit=${inv.id}`}>
                                                                <FilePenLine className="mr-2 h-4 w-4" /> Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {isCancelable && (
                                                          <DropdownMenuItem onClick={() => handleCancelInvoice(inv)} className="text-destructive">
                                                              <Trash2 className="mr-2 h-4 w-4" /> Cancel
                                                          </DropdownMenuItem>
                                                        )}
                                                    </>
                                                  )}
                                                </DropdownMenuContent>
                                             </DropdownMenu>
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

       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will cancel the invoice with number {invoiceToCancel?.invoiceNumber || invoiceToCancel?.id}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive hover:bg-destructive/90">
                Yes, Cancel Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
