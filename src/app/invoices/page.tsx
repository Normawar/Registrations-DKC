'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Eye, Users, DollarSign, Calendar, Building } from 'lucide-react';
import { InvoiceDisplayModal } from '@/components/invoice-display-modal';

export default function UnifiedInvoiceRegistrations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('submissionTimestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Replace the mock data loading in the unified component with this real data loading logic:
  const combinedData = useMemo(() => {
    if (typeof window === 'undefined') return [];
    
    console.log('🔄 Loading unified data from localStorage...');
    
    try {
      const allInvoices = localStorage.getItem('all_invoices');
      const confirmations = localStorage.getItem('confirmations');
      
      console.log('Raw all_invoices from localStorage:', allInvoices);
      console.log('Raw confirmations from localStorage:', confirmations);
      
      const invoicesArray = allInvoices ? JSON.parse(allInvoices) : [];
      const confirmationsArray = confirmations ? JSON.parse(confirmations) : [];
      
      console.log('Parsed invoices array:', invoicesArray);
      console.log('Parsed confirmations array:', confirmationsArray);
      
      // Combine invoice and confirmation data
      const mapped = invoicesArray.map((invoice) => {
        const confirmation = confirmationsArray.find(c => c.invoiceId === invoice.invoiceId);
        
        // Get all registrations for this invoice
        const registrations = confirmation?.registrations || [];
        
        return {
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          eventTitle: confirmation?.eventTitle || 'Unknown Event',
          companyName: confirmation?.companyName || 'Unknown',
          contactEmail: confirmation?.contactEmail || 'Unknown',
          totalAmount: invoice.totalMoney?.amount ? 
            parseFloat(invoice.totalMoney.amount) : 0,
          status: invoice.status || 'UNKNOWN',
          submissionTimestamp: confirmation?.submissionTimestamp || new Date().toISOString(),
          invoiceUrl: invoice.publicUrl || '#',
          registrations: registrations.map(reg => ({
            id: reg.id || Math.random().toString(36).substr(2, 9),
            studentName: reg.studentName || 'Unknown Student',
            grade: reg.grade || 'Unknown',
            school: reg.school || 'Unknown School',
            email: reg.email || '',
            parentName: reg.parentName || '',
            parentEmail: reg.parentEmail || ''
          }))
        };
      });
      
      console.log('Final mapped unified data:', mapped);
      return mapped;
      
    } catch (error) {
      console.error('❌ Error loading unified data from localStorage:', error);
      return [];
    }
  }, []);

  // Also add this debugging function to help track localStorage changes:
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('🔍 Unified page loading - setting up localStorage monitoring...');
    
    // Listen for storage events (when localStorage changes in other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'all_invoices' || e.key === 'confirmations') {
        console.log('🔄 Storage event detected in unified page:', e.key, 'changed from', e.oldValue, 'to', e.newValue);
        // You might want to trigger a re-render here
        window.location.reload(); // Simple approach - reload the page when data changes
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📖 Unified page became visible - checking localStorage...');
        console.log('all_invoices:', localStorage.getItem('all_invoices'));
        console.log('confirmations:', localStorage.getItem('confirmations'));
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const filteredAndSortedData = useMemo(() => {
    const filtered = combinedData.filter(item => {
      const matchesSearch = 
        item.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.eventTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.registrations.some(reg => 
          reg.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reg.school.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'invoiceNumber':
          aValue = a.invoiceNumber;
          bValue = b.invoiceNumber;
          break;
        case 'companyName':
          aValue = a.companyName;
          bValue = b.companyName;
          break;
        case 'eventTitle':
          aValue = a.eventTitle;
          bValue = b.eventTitle;
          break;
        case 'amount':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'studentCount':
          aValue = a.registrations.length;
          bValue = b.registrations.length;
          break;
        case 'submissionTimestamp':
        default:
          aValue = new Date(a.submissionTimestamp);
          bValue = new Date(b.submissionTimestamp);
          break;
      }

      if (sortDirection === 'asc') {
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      } else {
        if (aValue > bValue) return -1;
        if (aValue < bValue) return 1;
        return 0;
      }
    });
  }, [combinedData, searchTerm, statusFilter, sortField, sortDirection]);

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice({
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceUrl: invoice.invoiceUrl,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
    });
    setShowInvoiceModal(true);
  };

  const handleOpenExternal = (invoiceUrl) => {
    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
  };

  const getStatusBadge = (status) => {
    const variants = {
      'PAID': 'default',
      'UNPAID': 'destructive',
      'PENDING': 'secondary',
      'OVERDUE': 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const totalRevenue = filteredAndSortedData.reduce((sum, item) => sum + (item.status === 'PAID' ? item.totalAmount : 0), 0);
  const totalStudents = filteredAndSortedData.reduce((sum, item) => sum + item.registrations.length, 0);
  const paidInvoices = filteredAndSortedData.filter(item => item.status === 'PAID').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Invoice & Registration Management</h1>
        <p className="text-muted-foreground">
          Complete overview of all sponsorship invoices and student registrations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Registered students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidInvoices}</div>
            <p className="text-xs text-muted-foreground">of {filteredAndSortedData.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAndSortedData.length}</div>
            <p className="text-xs text-muted-foreground">New registrations</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
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

      {/* Main Table */}
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
                    <Button variant="ghost" className="h-auto p-0 font-semibold" onClick={() => handleSort('eventTitle')}>
                      Event {getSortIcon('eventTitle')}
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
                      Date {getSortIcon('submissionTimestamp')}
                    </Button>
                  </th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((invoice) => (
                  <tr key={invoice.invoiceId} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">#{invoice.invoiceNumber}</td>
                    <td className="p-2">
                      <div className="font-medium">{invoice.eventTitle}</div>
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
                          {invoice.registrations.slice(0, 2).map(reg => reg.studentName).join(', ')}
                          {invoice.registrations.length > 2 && ` +${invoice.registrations.length - 2} more`}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">${(invoice.totalAmount / 100).toFixed(2)}</div>
                    </td>
                    <td className="p-2">{getStatusBadge(invoice.status)}</td>
                    <td className="p-2">{new Date(invoice.submissionTimestamp).toLocaleDateString()}</td>
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

          {filteredAndSortedData.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No invoices found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Display Modal */}
      {showInvoiceModal && selectedInvoice && (
        <InvoiceDisplayModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          companyName={filteredAndSortedData.find(inv => inv.invoiceId === selectedInvoice.invoiceId)?.companyName || ''}
          eventTitle={filteredAndSortedData.find(inv => inv.invoiceId === selectedInvoice.invoiceId)?.eventTitle || ''}
        />
      )}
    </div>
  );
}
