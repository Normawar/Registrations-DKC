

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Eye, Users, DollarSign, Calendar, Building, AlertCircle, Edit, Trash2, Loader2, RefreshCw, XCircle } from 'lucide-react';
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
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const getStudentBreakdown = (invoice: any) => {
    if (!invoice.selections) return '0';
    
    const students = Object.values(invoice.selections);
    const gtCount = students.filter((s: any) => s.studentType === 'gt').length;
    const independentCount = students.filter((s: any) => s.studentType !== 'gt').length;
    const totalCount = students.length;
  
    // For PSJA split invoices, show type breakdown
    if (invoice.district === 'PHARR-SAN JUAN-ALAMO ISD' && (gtCount > 0 || independentCount > 0)) {
      if (gtCount > 0 && independentCount === 0) return `GT (${gtCount})`;
      if (independentCount > 0 && gtCount === 0) return `IND (${independentCount})`;
      if (gtCount > 0 && independentCount > 0) return `GT (${gtCount}) + IND (${independentCount})`;
    }
    
    // For other districts, just show total
    return `${totalCount}`;
};

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
  const { profile, isProfileLoaded } = useSponsorProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<any | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  const { database: allPlayers, dbSchools, dbDistricts, isDbLoaded } = useMasterDb();
  const [districtFilter, setDistrictFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const [playerTypeFilter, setPlayerTypeFilter] = useState('all');


  useEffect(() => {
    if (districtFilter === 'all') {
      setSchoolsForDistrict(dbSchools);
    } else {
      const schools = [...new Set(allPlayers.filter(p => p.district === districtFilter).map(p => p.school))].sort();
      setSchoolsForDistrict(schools);
    }
    setSchoolFilter('all');
  }, [districtFilter, dbSchools, allPlayers]);


  const loadData = useCallback(async () => {
    if (!db || !isProfileLoaded || !profile) {
      console.log('❌ Aborting loadData: db, profile, or isProfileLoaded not ready.');
      return;
    }

    setIsLoading(true);
    console.log(`🎯 Loading invoices for role: ${profile.role}`);

    try {
        let invoicesQuery = query(collection(db, 'invoices'));

        // Apply server-side filtering based on user role
        if (profile.role === 'district_coordinator') {
            invoicesQuery = query(invoicesQuery, where('district', '==', profile.district));
        } else if (profile.role === 'sponsor') {
            invoicesQuery = query(invoicesQuery, 
                where('district', '==', profile.district),
                where('schoolName', '==', profile.school)
            );
        } else if (profile.role === 'individual') {
            invoicesQuery = query(invoicesQuery, where('parentEmail', '==', profile.email));
        }
        
        // For organizers, no role-based filter is applied, fetching all invoices.
        
        const invoiceSnapshot = await getDocs(invoicesQuery);
        const invoicesArray = invoiceSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(invoice => 
                invoice.status !== 'CANCELED' && 
                invoice.invoiceNumber !== 'MOCK_INV'
            ); 

        console.log(`✅ Found ${invoicesArray.length} active documents for role '${profile.role}'.`);

        const mapped = invoicesArray.map((item: any) => ({
            ...item,
            id: item.id,
            invoiceTitle: item.invoiceTitle || item.eventName || item.title || 'Registration Data',
            companyName: item.schoolName || item.purchaserName || 'Unknown',
            contactEmail: item.sponsorEmail || item.purchaserEmail || item.email || 'Unknown',
            totalAmount: item.totalInvoiced || 0,
            status: item.invoiceStatus || item.status || 'UNKNOWN',
            registrations: item.selections 
                ? Object.keys(item.selections).map(playerId => ({ id: playerId, ...item.selections[playerId] })) 
                : [],
        }));

        setData(mapped);
    } catch (error) {
        console.error('❌ Error loading data from Firestore:', error);
        toast({ variant: 'destructive', title: 'Error Loading Data', description: 'Failed to load registration data. Please try again.' });
        setData([]);
    } finally {
        setIsLoading(false);
    }
}, [profile, isProfileLoaded, toast]);
  
  const handleManualRefresh = useCallback(async () => {
    await loadData();
    toast({ title: 'Data Refreshed', description: 'Registration data has been reloaded.' });
  }, [loadData, toast]);
  
  useEffect(() => {
    setClientReady(true);
    if (isProfileLoaded && profile) {
      loadData();
    }
  }, [isProfileLoaded, profile, loadData]);

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
            (item.parentEventName || '').toLowerCase().includes(lowerSearchTerm) ||
            (Array.isArray(item.registrations) && item.registrations.some((reg: any) => 
                (reg.firstName || '').toLowerCase().includes(lowerSearchTerm) ||
                (reg.lastName || '').toLowerCase().includes(lowerSearchTerm)
            ));

        const matchesStatus = statusFilter === 'all' || (item.status && item.status.toUpperCase() === statusFilter.toUpperCase());
        const matchesDistrict = districtFilter === 'all' || (item.district === districtFilter);
        const matchesSchool = schoolFilter === 'all' || (item.companyName === schoolFilter);

        let matchesPlayerType = true;
        if (playerTypeFilter !== 'all') {
            if (item.registrations?.length > 0) {
                matchesPlayerType = item.registrations.some((reg: MasterPlayer) => reg.studentType === playerTypeFilter);
            } else {
                matchesPlayerType = false;
            }
        }

        return matchesSearch && matchesStatus && matchesDistrict && matchesSchool && matchesPlayerType;
    });

    return filtered.sort((a: any, b: any) => {
      let aValue, bValue;

      switch (sortField) {
        case 'invoiceNumber': aValue = a.invoiceNumber || a.originalDocId || ''; bValue = b.invoiceNumber || b.originalDocId || ''; break;
        case 'companyName': aValue = a.companyName || ''; bValue = b.companyName || ''; break;
        case 'invoiceTitle': aValue = a.invoiceTitle || ''; bValue = b.invoiceTitle || ''; break;
        case 'amount': aValue = a.totalAmount || 0; bValue = b.totalAmount || 0; break;
        case 'status': aValue = a.status || ''; bValue = b.status || ''; break;
        case 'studentCount': aValue = a.registrations?.length || 0; bValue = b.registrations?.length || 0; break;
        case 'eventDate': aValue = a.eventDate || a.parentEventDate ? new Date(a.eventDate || a.parentEventDate).getTime() : 0; bValue = b.eventDate || b.parentEventDate ? new Date(b.eventDate || b.parentEventDate).getTime() : 0; break;
        case 'submissionTimestamp': default: aValue = a.submissionTimestamp ? new Date(a.submissionTimestamp).getTime() : 0; bValue = b.submissionTimestamp ? new Date(b.submissionTimestamp).getTime() : 0; break;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, searchTerm, statusFilter, sortField, sortDirection, districtFilter, schoolFilter, playerTypeFilter]);

  const playerCounts = useMemo(() => {
    let allPlayersInFilteredInvoices = new Set<string>();
    let gtPlayers = new Set<string>();
    let independentPlayers = new Set<string>();

    filteredAndSortedData.forEach(invoice => {
        invoice.registrations?.forEach((reg: MasterPlayer) => {
            allPlayersInFilteredInvoices.add(reg.id);
            if (reg.studentType === 'gt') gtPlayers.add(reg.id);
            if (reg.studentType === 'independent') independentPlayers.add(reg.id);
        });
    });

    return {
        all: allPlayersInFilteredInvoices.size,
        gt: gtPlayers.size,
        independent: independentPlayers.size
    };
}, [filteredAndSortedData]);

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };
  
  const handleEditInvoice = (invoiceId: string) => {
    router.push(`/organizer-invoice?edit=${invoiceId}`);
  };

  const handleCancelInvoiceClick = (invoice: any) => {
    setInvoiceToCancel(invoice);
    setIsAlertOpen(true);
  };

  const confirmCancel = async () => {
    if (!invoiceToCancel || !db || !profile) return;

    if (profile?.role !== 'organizer') {
        toast({ 
            variant: 'destructive', 
            title: 'Permission Denied', 
            description: 'Only organizers can cancel invoices.' 
        });
        setIsAlertOpen(false);
        return;
    }

    setIsCanceling(true);
    try {
      let finalStatus = 'CANCELED'; // Default status
      if (invoiceToCancel.invoiceId) {
        const result = await cancelInvoice({ 
            invoiceId: invoiceToCancel.invoiceId,
            requestingUserRole: profile.role
        });
        finalStatus = result.status; // Get the authoritative status from Square
      }
      
      const invoiceRef = doc(db, 'invoices', invoiceToCancel.id);
      await setDoc(invoiceRef, { status: finalStatus, invoiceStatus: finalStatus }, { merge: true });
      
      await loadData();
      
      toast({ 
        title: 'Invoice Action Completed', 
        description: `Invoice ${invoiceToCancel.invoiceNumber || invoiceToCancel.id} status is now ${finalStatus}.` 
      });
    } catch (error) {
      console.error("Failed to cancel invoice:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Action Failed', 
        description: error instanceof Error ? error.message : 'An unknown error occurred.' 
      });
    } finally {
      setIsCanceling(false);
      setIsAlertOpen(false);
      setInvoiceToCancel(null);
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
      'CANCELED': 'secondary',
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
  
  const gtIndTotals = useMemo(() => {
    let gtInvoiced = 0;
    let indInvoiced = 0;
    
    filteredAndSortedData.forEach(invoice => {
        const isGtInvoice = invoice.registrations?.every((reg: MasterPlayer) => reg.studentType === 'gt');
        const isIndInvoice = invoice.registrations?.every((reg: MasterPlayer) => reg.studentType !== 'gt');

        if (isGtInvoice) {
            gtInvoiced += invoice.totalAmount || 0;
        } else if (isIndInvoice) {
            indInvoiced += invoice.totalAmount || 0;
        } else {
            // For mixed invoices, you'd need to calculate based on player fees, which is more complex.
            // This is a simplified approach assuming split invoices for PSJA.
        }
    });

    return { gtInvoiced, indInvoiced };
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (
                <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
              ) : (
                <Skeleton className="h-8 w-3/4" />
              )}
              <p className="text-xs text-muted-foreground">Across all registrations</p>
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
              <CardTitle className="text-sm font-medium">GT Invoiced</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (
                <div className="text-2xl font-bold">${gtIndTotals.gtInvoiced.toFixed(2)}</div>
              ) : (
                <Skeleton className="h-8 w-3/4" />
              )}
              <p className="text-xs text-muted-foreground">Gifted & Talented total</p>
            </CardContent>
          </Card>

           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Independent Invoiced</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clientReady ? (
                <div className="text-2xl font-bold">${gtIndTotals.indInvoiced.toFixed(2)}</div>
              ) : (
                <Skeleton className="h-8 w-3/4" />
              )}
              <p className="text-xs text-muted-foreground">Independent total</p>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter your invoices and registrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <Label>Search</Label>
                    <Input
                      placeholder="Search by invoice #, school, event, student..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div>
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
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
                {profile?.role === 'organizer' && (
                    <div>
                        <Label>District</Label>
                        <Select value={districtFilter} onValueChange={setDistrictFilter}>
                          <SelectTrigger><SelectValue placeholder="Filter by district" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Districts</SelectItem>
                            {dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                <div>
                    <Label>School</Label>
                     <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                      <SelectTrigger><SelectValue placeholder="Filter by school" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Schools</SelectItem>
                        {schoolsForDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                </div>
                {(districtFilter === 'PHARR-SAN JUAN-ALAMO ISD') && (
                    <div className="lg:col-span-2">
                        <Label>Player Type</Label>
                        <RadioGroup value={playerTypeFilter} onValueChange={setPlayerTypeFilter} className="flex items-center space-x-4 pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="all" /><Label htmlFor="all" className="cursor-pointer">All ({playerCounts.all})</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="gt" id="gt" /><Label htmlFor="gt" className="cursor-pointer">GT ({playerCounts.gt})</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="independent" id="independent" /><Label htmlFor="independent" className="cursor-pointer">Independent ({playerCounts.independent})</Label></div>
                        </RadioGroup>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Invoices & Registrations</CardTitle>
            <CardDescription>
              Showing {filteredAndSortedData.length} registration record(s)
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
                        ID / Invoice # {getSortIcon('invoiceNumber')}
                      </Button>
                    </th>
                    <th className="text-left p-2">
                      <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('invoiceTitle')}>
                        Event / Title {getSortIcon('invoiceTitle')}
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
                  ) : filteredAndSortedData.map((invoice) => {
                    const isFinalState = ['PAID', 'COMPED', 'CANCELED'].includes(invoice.status?.toUpperCase());
                    return (
                    <tr key={invoice.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">
                        <div>#{invoice.invoiceNumber || invoice.originalDocId || 'N/A'}</div>
                        {invoice.sourceType && (
                          <div className="text-xs text-muted-foreground">
                            {invoice.sourceType}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{invoice.invoiceTitle}</div>
                        {invoice.parentEventName && invoice.parentEventName !== invoice.invoiceTitle && (
                          <div className="text-xs text-muted-foreground">
                            Event: {invoice.parentEventName}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="space-y-1">
                          <div className="font-medium">{invoice.companyName}</div>
                          <div className="text-sm text-muted-foreground">{invoice.contactEmail}</div>
                        </div>
                      </td>
                      <td className="p-2 font-medium">{getStudentBreakdown(invoice)}</td>
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
                                disabled={isFinalState}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                               <Button 
                                variant={isFinalState ? 'secondary' : 'destructive'}
                                size="sm" 
                                onClick={() => handleCancelInvoiceClick(invoice)}
                                className="gap-1"
                                disabled={isFinalState}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>

            {clientReady && !isLoading && filteredAndSortedData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No registration records found matching your criteria.</p>
                {data.length === 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      This search looks for registration data in event subcollections.
                    </p>
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
            confirmation={selectedInvoice}
          />
        )}
      </div>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to cancel this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the invoice in Square and update the local status to CANCELED. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancel} 
              className="bg-destructive hover:bg-destructive/90" 
              disabled={isCanceling}
            >
              {isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
