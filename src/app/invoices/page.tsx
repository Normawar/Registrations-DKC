
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Eye, Users, DollarSign, Calendar, Building, AlertCircle, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { InvoiceDetailsDialog } from '@/components/invoice-details-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { useToast } from '@/hooks/use-toast';
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
import { cancelInvoice } from '@/ai/flows/cancel-invoice-flow';
import { useRouter } from 'next/navigation';

export default function UnifiedInvoiceRegistrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string>('submissionTimestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Enhanced loadData with comprehensive debugging
  const loadData = useCallback(async () => {
    if (!db || !profile) {
      console.log('❌ Missing db or profile:', { db: !!db, profile: !!profile });
      return;
    }
    
    setIsLoading(true);
    console.log('🔍 Loading data for profile:', {
      role: profile.role,
      district: profile.district,
      school: profile.school,
      email: profile.email
    });
    
    try {
      const invoicesCol = collection(db, 'invoices');
      const invoiceSnapshot = await getDocs(invoicesCol);
      let firestoreInvoices = invoiceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log('📊 Raw Firestore invoices:', firestoreInvoices.length);
      
      // Debug: Log today's invoices specifically
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayInvoices = firestoreInvoices.filter(inv => {
        const submissionDate = inv.submissionTimestamp ? new Date(inv.submissionTimestamp) : null;
        if (submissionDate) {
          submissionDate.setHours(0, 0, 0, 0);
          return submissionDate.getTime() === today.getTime();
        }
        return false;
      });
      
      console.log('📅 Today\'s invoices found:', todayInvoices.length, todayInvoices);

      // Load from local storage
      let localConfirmations: any[] = [];
      try {
        const stored = localStorage.getItem('confirmations');
        if (stored) {
          localConfirmations = JSON.parse(stored);
        }
      } catch(e) {
        console.error("Failed to parse confirmations from local storage", e);
      }

      console.log('💾 Local confirmations:', localConfirmations.length);

      // Combine and deduplicate
      const combinedData = [...firestoreInvoices, ...localConfirmations];
      console.log('🔄 Combined data before dedup:', combinedData.length);
      
      const uniqueDataMap = new Map();
      combinedData.forEach(item => {
        if (item.id) {
          uniqueDataMap.set(item.id, { ...uniqueDataMap.get(item.id), ...item });
        }
      });
      let invoicesArray = Array.from(uniqueDataMap.values());
      console.log('✨ After deduplication:', invoicesArray.length);
      
      // Role-based filtering with enhanced logging
      const beforeRoleFilter = invoicesArray.length;
      console.log('👤 Applying role filter for:', profile.role);
      
      if (profile.role === 'organizer') {
        console.log('🏢 Organizer role - showing all invoices (no filtering)');
        // Organizer sees all invoices, no filtering needed
      } else if (profile.role === 'district_coordinator') {
        invoicesArray = invoicesArray.filter((inv: any) => {
          const matches = inv.district === profile.district;
          if (!matches) {
            console.log('❌ Invoice filtered out by district:', inv.id, inv.district, 'vs', profile.district);
          }
          return matches;
        });
        console.log(`🏫 District coordinator filter: ${beforeRoleFilter} -> ${invoicesArray.length}`);
        
        if (profile.district === 'PHARR-SAN JUAN-ALAMO ISD') {
          const beforeGTFilter = invoicesArray.length;
          invoicesArray = invoicesArray.filter((inv: any) => inv.gtCoordinatorEmail && inv.gtCoordinatorEmail.trim() !== '');
          console.log(`📧 GT Coordinator email filter: ${beforeGTFilter} -> ${invoicesArray.length}`);
        }
      } else if (profile.role === 'sponsor') {
        invoicesArray = invoicesArray.filter((inv: any) => {
          const matchesSchool = inv.schoolName === profile.school;
          const matchesDistrict = inv.district === profile.district;
          if (!matchesSchool || !matchesDistrict) {
            console.log('❌ Invoice filtered out by school/district:', inv.id, {
              invoiceSchool: inv.schoolName,
              profileSchool: profile.school,
              invoiceDistrict: inv.district,
              profileDistrict: profile.district
            });
          }
          return matchesSchool && matchesDistrict;
        });
        console.log(`🎓 Sponsor filter: ${beforeRoleFilter} -> ${invoicesArray.length}`);
      } else if (profile.role === 'individual') {
        invoicesArray = invoicesArray.filter((inv: any) => {
          const matches = inv.parentEmail === profile.email;
          if (!matches) {
            console.log('❌ Invoice filtered out by email:', inv.id, inv.parentEmail, 'vs', profile.email);
          }
          return matches;
        });
        console.log(`👨‍👩‍👧‍👦 Individual filter: ${beforeRoleFilter} -> ${invoicesArray.length}`);
      }

      console.log('🎯 Final filtered invoices:', invoicesArray.length);
      
      const mapped = invoicesArray.map((invoice: any) => {
        let registrations: any[] = [];
        if (invoice.selections) {
          registrations = Object.keys(invoice.selections).map(playerId => ({
            id: playerId,
            ...invoice.selections[playerId]
          }));
        } else if (invoice.registrations) {
          registrations = invoice.registrations;
        }

        const getInvoiceTitle = () => {
          if (invoice.invoiceTitle && typeof invoice.invoiceTitle === 'string' && invoice.invoiceTitle.trim() !== '') {
            return invoice.invoiceTitle.trim();
          }
          if (invoice.eventName && typeof invoice.eventName === 'string' && invoice.eventName.trim() !== '') {
            return invoice.eventName.trim();
          }
          if (invoice.membershipType) {
            return `USCF ${invoice.membershipType}`;
          }
          if (invoice.title) {
            return invoice.title;
          }
          return 'Unknown Event';
        };

        return {
          ...invoice,
          id: invoice.id || invoice.invoiceId || invoice.eventId,
          invoiceTitle: getInvoiceTitle(),
          companyName: invoice.schoolName || invoice.purchaserName || invoice.school || 'Unknown',
          contactEmail: invoice.sponsorEmail || invoice.purchaserEmail || invoice.email || 'Unknown',
          totalAmount: invoice.totalInvoiced || invoice.totalAmount || (invoice.totalMoney?.amount ? parseFloat(invoice.totalMoney.amount) : 0),
          status: invoice.invoiceStatus || invoice.status || 'UNKNOWN',
          registrations: registrations,
        };
      });
      
      console.log('📋 Final mapped data:', mapped.length);
      setData(mapped);
      
    } catch (error) {
      console.error('❌ Error loading unified data from Firestore:', error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Data',
        description: 'Failed to load invoices. Please try refreshing the page.'
      });
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile, toast]);
  
  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    await loadData();
    toast({
      title: 'Data Refreshed',
      description: 'Invoice data has been reloaded from the database.'
    });
  }, [loadData, toast]);
  
  useEffect(() => {
    console.log('🔄 Profile changed, loading data:', profile);
    if (profile) {
      loadData();
    }
    setClientReady(true);
  }, [profile, loadData]);

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
    console.log('🔍 Filtering data:', { 
      totalData: data.length, 
      searchTerm, 
      statusFilter,
      sortField,
      sortDirection 
    });
    
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

    console.log('📊 After filtering:', filtered.length);

    return filtered.sort((a: any, b: any) => {
      let aValue, bValue;

      switch (sortField) {
        case 'invoiceNumber': aValue = a.invoiceNumber || ''; bValue = b.invoiceNumber || ''; break;
        case 'companyName': aValue = a.companyName || ''; bValue = b.companyName || ''; break;
        case 'invoiceTitle': aValue = a.invoiceTitle || ''; bValue = b.invoiceTitle || ''; break;
        case 'amount': aValue = a.totalAmount || 0; bValue = b.totalAmount || 0; break;
        case 'status': aValue = a.status || ''; bValue = b.status || ''; break;
        case 'studentCount': aValue = a.registrations?.length || 0; bValue = b.registrations?.length || 0; break;
        case 'eventDate': aValue = a.eventDate ? new Date(a.eventDate).getTime() : 0; bValue = b.eventDate ? new Date(b.eventDate).getTime() : 0; break;
        case 'submissionTimestamp': default: aValue = a.submissionTimestamp ? new Date(a.submissionTimestamp).getTime() : 0; bValue = b.submissionTimestamp ? new Date(b.submissionTimestamp).getTime() : 0; break;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, searchTerm, statusFilter, sortField, sortDirection]);

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };
  
  const handleEditInvoice = (invoiceId: string) => {
    router.push(`/organizer-invoice?edit=${invoiceId}`);
  };

  const handleDeleteInvoice = (invoice: any) => {
    setInvoiceToDelete(invoice);
    setIsAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || !db) return;

    setIsDeleting(true);
    try {
      if (invoiceToDelete.invoiceId && invoiceToDelete.invoiceId.startsWith('inv:')) {
        await cancelInvoice({ invoiceId: invoiceToDelete.invoiceId });
      }

      const invoiceRef = doc(db, 'invoices', invoiceToDelete.id);
      await setDoc(invoiceRef, { status: 'CANCELED', invoiceStatus: 'CANCELED' }, { merge: true });
      
      await loadData();
      
      toast({ 
        title: 'Invoice Canceled', 
        description: `Invoice ${invoiceToDelete.invoiceNumber || invoiceToDelete.id} has been marked as canceled.` 
      });
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Deletion Failed', 
        description: error instanceof Error ? error.message : 'An unknown error occurred.' 
      });
    } finally {
      setIsDeleting(false);
      setIsAlertOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const getStatusBadge = (status: string, totalPaid?: number, totalInvoiced?: number) => {
    const s = (status || '').toUpperCase();
    
    let displayStatus = s;
    if (totalPaid && totalInvoiced && totalPaid > 0 && totalPaid < totalInvoiced) {
      displayStatus = 'PARTIALLY_PAID';
    }
    
    const variants: {[key: string]: 'default' | 'destructive' | 'secondary'} = {
      'PAID': 'default', 
      'COMPED': 'default',
      'UNPAID': 'destructive', 
      'OVERDUE': 'destructive',
      'CANCELED': 'destructive',
      'PARTIALLY_PAID': 'secondary',
    };
    
    let className = '';
    if (displayStatus === 'PAID' || displayStatus === 'COMPED') className = 'bg-green-600 text-white';
    if (displayStatus === 'PENDING-PO') className = 'bg-yellow-500 text-black';
    if (displayStatus === 'PARTIALLY_PAID') className = 'bg-blue-600 text-white';

    return <Badge variant={variants[displayStatus] || 'secondary'} className={className}>
      {displayStatus.replace(/_/g, ' ')}
    </Badge>;
  };

  const totalAmount = useMemo(() => filteredAndSortedData.reduce((sum, item) => sum + (item.totalAmount || 0), 0), [filteredAndSortedData]);
  const outstandingInvoices = useMemo(() => {
    return filteredAndSortedData.filter(item => {
      const status = item.status?.toUpperCase();
      const totalPaid = item.totalPaid || 0;
      const totalAmount = item.totalAmount || 0;
      
      return status === 'UNPAID' || 
             status === 'OVERDUE' || 
             status === 'PARTIALLY_PAID' ||
             (totalPaid > 0 && totalPaid < totalAmount);
    }).length;
  }, [filteredAndSortedData]);
  const paidInvoices = useMemo(() => filteredAndSortedData.filter(item => item.status === 'PAID').length, [filteredAndSortedData]);
  const outstandingAmount = useMemo(() => {
    return filteredAndSortedData
      .filter(item => {
        const status = item.status?.toUpperCase();
        const totalPaid = item.totalPaid || 0;
        const totalAmount = item.totalAmount || 0;
        
        return status === 'UNPAID' || 
               status === 'OVERDUE' || 
               status === 'PARTIALLY_PAID' ||
               (totalPaid > 0 && totalPaid < totalAmount);
      })
      .reduce((sum, item) => {
        const totalAmount = item.totalAmount || 0;
        const totalPaid = item.totalPaid || 0;
        return sum + (totalAmount - totalPaid);
      }, 0);
  }, [filteredAndSortedData]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Invoice & Registration Management</h1>
            <p className="text-muted-foreground">
              Complete overview of all sponsorship invoices and student registrations
            </p>
          </div>
          <Button 
            onClick={handleManualRefresh} 
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Debug Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Profile:</strong> {profile?.role} | {profile?.school} | {profile?.district}
                </div>
                <div>
                  <strong>Data:</strong> {data.length} raw | {filteredAndSortedData.length} filtered
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {profile?.role === 'organizer' ? 'Total Revenue' : 'Total Expense'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (
                <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
              ) : (
                <Skeleton className="h-8 w-3/4" />
              )}
              <p className="text-xs text-muted-foreground">Across all invoices</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {clientReady ? (
                 <div className="text-2xl font-bold">${outstandingAmount.toFixed(2)}</div>
               ) : (
                 <Skeleton className="h-8 w-3/4" />
               )}
              <p className="text-xs text-muted-foreground">{outstandingInvoices} invoice(s) require payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {clientReady ? (
                 <div className="text-2xl font-bold">{paidInvoices}</div>
               ) : (
                 <Skeleton className="h-8 w-1/2" />
               )}
              <p className="text-xs text-muted-foreground">of {clientReady ? filteredAndSortedData.length : '...'} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               {clientReady ? (
                 <div className="text-2xl font-bold">{data.length}</div>
               ) : (
                 <Skeleton className="h-8 w-1/2" />
               )}
              <p className="text-xs text-muted-foreground">in the system</p>
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
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PENDING-PO">Pending Verification</SelectItem>
                  <SelectItem value="COMPED">Comped</SelectItem>
                  <SelectItem value="CANCELED">Canceled</SelectItem>
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
              {isLoading && " (Loading...)"}
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
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('submissionTimestamp')}>
                        Created {getSortIcon('submissionTimestamp')}
                      </Button>
                    </th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!clientReady || isLoading ? (
                      Array.from({length: 5}).map((_, i) => (
                          <tr key={i} className="border-b">
                            <td colSpan={8} className="p-2">
                              <Skeleton className="h-8 w-full"/>
                            </td>
                          </tr>
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
                            {invoice.registrations?.length || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.registrations?.slice(0, 2).map((reg: any) => reg.studentName).join(', ')}
                            {invoice.registrations?.length > 2 && ` +${invoice.registrations.length - 2} more`}
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="space-y-1">
                          <div className="font-medium">${(invoice.totalAmount || 0).toFixed(2)}</div>
                          {invoice.totalPaid > 0 && invoice.totalPaid < invoice.totalAmount && (
                            <div className="text-xs text-green-600">
                              Paid: ${invoice.totalPaid.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {getStatusBadge(invoice.status, invoice.totalPaid, invoice.totalAmount)}
                      </td>
                      <td className="p-2">
                        {invoice.submissionTimestamp ? format(new Date(invoice.submissionTimestamp), 'PPp') : 'N/A'}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewInvoice(invoice)} 
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            Details
                          </Button>
                          {profile?.role === 'organizer' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => handleEditInvoice(invoice.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                onClick={() => handleDeleteInvoice(invoice)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {clientReady && !isLoading && filteredAndSortedData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No invoices found matching your criteria.</p>
                {data.length === 0 && (
                  <div className="mt-4">
                    <Button onClick={handleManualRefresh} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Refreshing
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {showInvoiceModal && selectedInvoice && (
          <InvoiceDetailsDialog
            isOpen={showInvoiceModal}
            onClose={() => {
              setShowInvoiceModal(false);
              setSelectedInvoice(null);
            }}
            confirmationId={selectedInvoice.id}
          />
        )}
      </div>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete invoice #{invoiceToDelete?.invoiceNumber}. If this is a Square invoice, it will also be canceled. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive hover:bg-destructive/90" 
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}