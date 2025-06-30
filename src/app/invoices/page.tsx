
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
import { ExternalLink, RefreshCw, ClipboardList, Receipt } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';

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

function InvoicesComponent() {
  const { toast } = useToast();
  const { profile: sponsorProfile } = useSponsorProfile();

  const [allInvoices, setAllInvoices] = useState<CombinedInvoice[]>([]);
  const [statuses, setStatuses] = useState<Record<string, { status?: string; isLoading: boolean }>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchAllInvoiceStatuses = (invoicesToFetch: CombinedInvoice[]) => {
    invoicesToFetch.forEach(inv => {
        if (inv.invoiceId) {
            fetchInvoiceStatus(inv.id, inv.invoiceId, true);
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
    try {
      const eventConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
      const membershipInvoices = JSON.parse(localStorage.getItem('membershipInvoices') || '[]');

      const combined = [
        ...eventConfirmations
          .filter((c: any) => c.invoiceId)
          .map((c: any) => ({
            id: c.id,
            description: c.eventName,
            submissionTimestamp: c.submissionTimestamp,
            totalInvoiced: c.totalInvoiced,
            invoiceId: c.invoiceId,
            invoiceUrl: c.invoiceUrl,
            invoiceNumber: c.invoiceNumber,
            purchaserName: `${sponsorProfile?.firstName || 'Sponsor'} ${sponsorProfile?.lastName || ''}`.trim(),
            invoiceStatus: c.invoiceStatus,
          })),
        ...membershipInvoices
          .filter((i: any) => i.invoiceId)
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
  }, [sponsorProfile]);

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
    if (statusFilter === 'ALL') {
      return allInvoices;
    }
    return allInvoices.filter(inv => statuses[inv.id]?.status?.toUpperCase() === statusFilter);
  }, [allInvoices, statuses, statusFilter]);
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Invoices</h1>
          <p className="text-muted-foreground">
            A comprehensive list of all generated invoices for your events and memberships.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>All Invoices</CardTitle>
                    <CardDescription>Filter invoices by their current payment status.</CardDescription>
                </div>
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
                            <TableHead>Purchaser</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.map((inv) => {
                            const currentStatus = statuses[inv.id];
                            return (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-mono">{inv.invoiceNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{inv.description}</TableCell>
                                    <TableCell>{inv.purchaserName}</TableCell>
                                    <TableCell>{format(new Date(inv.submissionTimestamp), 'PPP')}</TableCell>
                                    <TableCell>${inv.totalInvoiced.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(currentStatus?.status))}>
                                            {currentStatus?.isLoading ? 'Loading...' : currentStatus?.status?.replace(/_/g, ' ').toLowerCase() || 'Unknown'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => fetchInvoiceStatus(inv.id, inv.invoiceId!)} disabled={currentStatus?.isLoading || !inv.invoiceId} title="Refresh Status">
                                                <RefreshCw className={cn("h-4 w-4", currentStatus?.isLoading && "animate-spin")} />
                                                <span className="sr-only">Refresh Status</span>
                                            </Button>
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
