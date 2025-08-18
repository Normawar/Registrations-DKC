
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Eye, Users, DollarSign, Calendar, Building } from 'lucide-react';
import { InvoiceDisplayModal } from '@/components/invoice-display-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';


export default function UnifiedInvoiceRegistrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string>('submissionTimestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [data, setData] = useState<any[]>([]);

  // Load combined data from localStorage, only runs on the client
  useEffect(() => {
    
    const loadData = () => {
      console.log('🔄 Loading unified data from localStorage...');
      try {
        const allInvoices = localStorage.getItem('all_invoices');
        const confirmations = localStorage.getItem('confirmations');
        
        const invoicesArray = allInvoices ? JSON.parse(allInvoices) : [];
        const confirmationsArray = confirmations ? JSON.parse(confirmations) : [];
        
        // Combine invoice and confirmation data
        const mapped = invoicesArray.map((invoice: any) => {
          const confirmation = confirmationsArray.find((c: any) => c.id === invoice.id || (invoice.invoiceId && c.invoiceId === invoice.invoiceId));
          
          const selections = confirmation?.selections || {};
          const registrations = Object.keys(selections).map(playerId => ({
              id: playerId,
              ...selections[playerId]
          }));
          
          return {
            id: invoice.id || invoice.invoiceId,
            invoiceId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            invoiceTitle: invoice.invoiceTitle || confirmation?.eventName || 'Unknown Event',
            eventDate: confirmation?.eventDate,
            companyName: confirmation?.schoolName || invoice.schoolName || 'Unknown',
            contactEmail: confirmation?.sponsorEmail || invoice.sponsorEmail || 'Unknown',
            totalAmount: invoice.totalInvoiced || (invoice.totalMoney?.amount ? parseFloat(invoice.totalMoney.amount) : 0),
            status: invoice.invoiceStatus || invoice.status || 'UNKNOWN',
            submissionTimestamp: confirmation?.submissionTimestamp || new Date().toISOString(),
            invoiceUrl: invoice.invoiceUrl || '#',
            registrations: registrations,
          };
        });
        
        console.log('Final mapped unified data:', mapped);
        setData(mapped);
      } catch (error) {
        console.error('❌ Error loading unified data from localStorage:', error);
        setData([]);
      }
    };
    
    loadData();
    setClientReady(true);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'all_invoices' || e.key === 'confirmations') {
        console.log('🔄 Storage event detected in unified page:', e.key);
        loadData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

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

  const filteredAndSortedData = useMemo(() => {
    const filtered = data.filter((item: any) => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = 
        (item.invoiceNumber || '').toLowerCase().includes(lowerSearchTerm) ||
        (item.invoiceTitle || '').toLowerCase().includes(lowerSearchTerm) ||
        (item.companyName || '').toLowerCase().includes(lowerSearchTerm) ||
        (item.contactEmail || '').toLowerCase().includes(lowerSearchTerm) ||
        (Array.isArray(item.registrations) && item.registrations.some((reg: any) => 
          (reg.studentName || '').toLowerCase().includes(lowerSearchTerm) ||
          (reg.school || '').toLowerCase().includes(lowerSearchTerm)
        ));

      const matchesStatus = statusFilter === 'all' || (item.status && item.status.toUpperCase() === statusFilter.toUpperCase());
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a: any, b: any) => {
      let aValue, bValue;

      switch (sortField) {
        case 'invoiceNumber': aValue = a.invoiceNumber || ''; bValue = b.invoiceNumber || ''; break;
        case 'companyName': aValue = a.companyName || ''; bValue = b.companyName || ''; break;
        case 'invoiceTitle': aValue = a.invoiceTitle || ''; bValue = b.invoiceTitle || ''; break;
        case 'amount': aValue = a.totalAmount || 0; bValue = b.totalAmount || 0; break;
        case 'status': aValue = a.status || ''; bValue = b.status || ''; break;
        case 'studentCount': aValue = a.registrations.length || 0; bValue = b.registrations.length || 0; break;
        case 'eventDate': aValue = new Date(a.eventDate); bValue = new Date(b.eventDate); break;
        case 'submissionTimestamp': default: aValue = new Date(a.submissionTimestamp); bValue = new Date(b.submissionTimestamp); break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, searchTerm, statusFilter, sortField, sortDirection]);

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceUrl: invoice.invoiceUrl,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
    });
    setShowInvoiceModal(true);
  };

  const handleOpenExternal = (invoiceUrl: string) => {
    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    const variants: {[key: string]: 'default' | 'destructive' | 'secondary'} = {
      'PAID': 'default', 'COMPED': 'default',
      'UNPAID': 'destructive', 'OVERDUE': 'destructive',
    };
    return <Badge variant={variants[s] || 'secondary'} className={s === 'PAID' || s === 'COMPED' ? 'bg-green-600 text-white' : ''}>{s}</Badge>;
  };

  const totalRevenue = useMemo(() => filteredAndSortedData.reduce((sum, item) => sum + (item.status === 'PAID' ? item.totalAmount : 0), 0), [filteredAndSortedData]);
  const totalStudents = useMemo(() => filteredAndSortedData.reduce((sum, item) => sum + item.registrations.length, 0), [filteredAndSortedData]);
  const paidInvoices = useMemo(() => filteredAndSortedData.filter(item => item.status === 'PAID').length, [filteredAndSortedData]);
  const currentMonthInvoices = useMemo(() => filteredAndSortedData.filter(item => new Date(item.submissionTimestamp).getMonth() === new Date().getMonth()).length, [filteredAndSortedData]);


  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Invoice & Registration Management</h1>
          <p className="text-muted-foreground">
            Complete overview of all sponsorship invoices and student registrations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (<div className="text-2xl font-bold">${(totalRevenue).toFixed(2)}</div>) : (<Skeleton className="h-8 w-3/4" />)}
              <p className="text-xs text-muted-foreground">From paid invoices</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (<div className="text-2xl font-bold">{totalStudents}</div>) : (<Skeleton className="h-8 w-1/2" />)}
              <p className="text-xs text-muted-foreground">Registered students</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {clientReady ? (<div className="text-2xl font-bold">{paidInvoices}</div>) : (<Skeleton className="h-8 w-1/2" />)}
              <p className="text-xs text-muted-foreground">of {clientReady ? filteredAndSortedData.length : '...'} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (<div className="text-2xl font-bold">{currentMonthInvoices}</div>) : (<Skeleton className="h-8 w-1/2" />)}
              <p className="text-xs text-muted-foreground">New registrations</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter your invoices and registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by invoice #, company, event, student name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Invoices & Registrations</CardTitle>
            <CardDescription>
              Showing {filteredAndSortedData.length} invoice(s) with complete registration details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('invoiceNumber')}>
                        Invoice # {getSortIcon('invoiceNumber')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('invoiceTitle')}>
                        Invoice Title {getSortIcon('invoiceTitle')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('companyName')}>
                        Sponsor {getSortIcon('companyName')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('studentCount')}>
                        Students {getSortIcon('studentCount')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('amount')}>
                        Amount {getSortIcon('amount')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('status')}>
                        Status {getSortIcon('status')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('eventDate')}>
                        Event Date {getSortIcon('eventDate')}
                      </Button>
                    </th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!clientReady ? (
                      Array.from({length: 5}).map((_, i) => (
                          <tr key={i} className="border-b"><td colSpan={8} className="p-2"><Skeleton className="h-8 w-full"/></td></tr>
                      ))
                  ) : filteredAndSortedData.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">#{invoice.invoiceNumber}</td>
                      <td className="p-2">
                        <div className="font-medium">{invoice.invoiceTitle}</div>
                      </td>
                      <td className="p-2">
                        <div className="space-y-1">
                          <div className="font-medium">{invoice.companyName}</div>
                          <div className="text-sm text-muted-foreground">{invoice.contactEmail}</div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {invoice.registrations.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.registrations.slice(0, 2).map((reg: any) => reg.studentName).join(', ')}
                            {invoice.registrations.length > 2 && ` +${invoice.registrations.length - 2} more`}
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">${(invoice.totalAmount).toFixed(2)}</div>
                      </td>
                      <td className="p-2">{getStatusBadge(invoice.status)}</td>
                      <td className="p-2">{invoice.eventDate ? format(new Date(invoice.eventDate), 'PPP') : 'N/A'}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)} className="gap-1">
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenExternal(invoice.invoiceUrl)} className="gap-1">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {clientReady && filteredAndSortedData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No invoices found matching your criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {showInvoiceModal && selectedInvoice && (
          <InvoiceDisplayModal
            isOpen={showInvoiceModal}
            onClose={() => {
              setShowInvoiceModal(false);
              setSelectedInvoice(null);
            }}
            invoice={selectedInvoice}
            companyName={filteredAndSortedData.find(inv => inv.id === selectedInvoice.invoiceId)?.companyName || ''}
            eventTitle={filteredAndSortedData.find(inv => inv.id === selectedInvoice.invoiceId)?.invoiceTitle || ''}
          />
        )}
      </div>
    </AppLayout>
  );
}
