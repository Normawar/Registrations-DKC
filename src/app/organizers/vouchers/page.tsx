
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useMasterDb } from '@/context/master-db-context';
import Papa from 'papaparse';
import { format, isSameMonth, isSameYear } from 'date-fns';
import { Upload, Download, UserPlus, FileText, CheckCircle, Loader2, ClipboardPaste, Sparkles, Award } from 'lucide-react';
import { collection, doc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEvents } from '@/hooks/use-events';

interface VoucherAssignment {
  id: string;
  playerId: string;
  playerName: string;
  voucherNumber: string;
  membershipType: 'new' | 'renewing';
  assignedDate: string;
  uscfIdAssigned?: string;
  processedDate?: string;
  eventName?: string;
  playerEmail?: string;
  playerPhone?: string;
  playerAddress?: string;
  playerBirthDate?: string;
  playerGender?: string;
  proofFileName?: string;
  proofFileUrl?: string;
}

export default function VoucherManagementPage() {
  const { toast } = useToast();
  const { database, updatePlayer } = useMasterDb();
  const { events } = useEvents();
  
  const [availableVouchers, setAvailableVouchers] = useState<string[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<any[]>([]);
  const [assignedVouchers, setAssignedVouchers] = useState<VoucherAssignment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pastedVouchers, setPastedVouchers] = useState('');
  const [expiringGtPlayers, setExpiringGtPlayers] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);

  // State for the new feature
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  
  // Load all necessary data from Firestore on component mount
  const loadData = async () => {
    if (!db) return;
    try {
        const [vouchersSnapshot, assignedSnapshot, invoicesSnapshot] = await Promise.all([
            getDocs(collection(db, 'vouchers')),
            getDocs(collection(db, 'assignedVouchers')),
            getDocs(collection(db, 'invoices')),
        ]);

        const vouchers = vouchersSnapshot.docs.map(doc => doc.data().voucherNumber);
        const assigned = assignedSnapshot.docs.map(doc => doc.data() as VoucherAssignment);
        const invoices = invoicesSnapshot.docs.map(doc => doc.data());
        
        setAvailableVouchers(vouchers);
        setAssignedVouchers(assigned);
        setAllInvoices(invoices);
    } catch (error) {
        console.error("Failed to load voucher data from Firestore:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load voucher data.' });
    }
  };

  const loadPendingMemberships = useCallback(async () => {
    if (!db) return;
    const pending = [];
    const assignedPlayerIds = new Set(assignedVouchers.map(v => v.playerId));
    
    for (const confirmation of allInvoices) {
      for (const [playerId, selection] of Object.entries(confirmation.selections || {})) {
        if ((selection as any).uscfStatus === 'new' || (selection as any).uscfStatus === 'renewing') {
          const player = database.find(p => p.id === playerId);
          if (player && !assignedPlayerIds.has(playerId)) {
            
            const isPaid = confirmation.invoiceStatus === 'PAID' || confirmation.invoiceStatus === 'COMPED';
            const isPsjaDistrict = player.district === 'PHARR-SAN JUAN-ALAMO ISD';
            const isGtPlayer = player.studentType === 'gt';

            const isEligibleForVoucher = (isPsjaDistrict && isGtPlayer) || isPaid;

            if (isEligibleForVoucher) {
              pending.push({
                playerId,
                player,
                confirmation,
                selection,
                invoiceNumber: confirmation.invoiceNumber || 'N/A',
                invoiceStatus: confirmation.invoiceStatus || 'UNKNOWN',
                membershipType: (selection as any).uscfStatus,
                eventName: confirmation.eventName
              });
            }
          }
        }
      }
    }
    setPendingMemberships(pending);
  }, [database, assignedVouchers, allInvoices]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (database.length > 0 && allInvoices.length > 0) {
      loadPendingMemberships();
    }
  }, [database, assignedVouchers, allInvoices, loadPendingMemberships]);

  const findExpiringGtPlayers = useCallback(() => {
      if (database.length === 0) return;
      const now = new Date();
      const assignedPlayerIds = new Set(assignedVouchers.map(v => v.playerId));

      const gtPlayers = database.filter(p => p.studentType === 'gt');
      const expiring = gtPlayers.filter(p => 
        !assignedPlayerIds.has(p.id) &&
        p.uscfExpiration &&
        isSameMonth(new Date(p.uscfExpiration), now) &&
        isSameYear(new Date(p.uscfExpiration), now)
      );
      setExpiringGtPlayers(expiring);
  }, [database, assignedVouchers]);

  useEffect(() => {
    findExpiringGtPlayers();
  }, [findExpiringGtPlayers]);

  const pendingGtByTournament = useMemo(() => {
    if (!selectedTournament) return [];

    const assignedPlayerIds = new Set(assignedVouchers.map(v => v.playerId));
    const tournamentInvoices = allInvoices.filter(inv => inv.eventId === selectedTournament);

    const pendingPlayers = new Map();

    for (const invoice of tournamentInvoices) {
        for (const [playerId, selection] of Object.entries(invoice.selections || {})) {
            const player = database.find(p => p.id === playerId);
            if (player && 
                player.district === 'PHARR-SAN JUAN-ALAMO ISD' && 
                player.studentType === 'gt' &&
                (selection as any).uscfStatus !== 'current' &&
                !assignedPlayerIds.has(playerId) &&
                !pendingPlayers.has(playerId)
            ) {
                pendingPlayers.set(playerId, {
                    player,
                    membershipType: (selection as any).uscfStatus,
                    eventName: invoice.eventName,
                });
            }
        }
    }
    return Array.from(pendingPlayers.values());
  }, [selectedTournament, allInvoices, database, assignedVouchers]);


  const extractVoucherNumbers = (text: string): string[] => {
    const voucherPattern = /\b\d{5}-\d{5}-\d{5}-\d{5}-\d{5}\b/g;
    const matches = text.match(voucherPattern) || [];
    return [...new Set(matches)];
  };

  const handleImportVouchers = async () => {
    if (!pastedVouchers.trim() || !db) return;

    try {
        const extractedVouchers = extractVoucherNumbers(pastedVouchers);

        if (extractedVouchers.length === 0) {
            toast({ title: "No Vouchers Found", description: "No valid voucher numbers were found in the pasted text.", variant: "destructive" });
            return;
        }

        const newVouchers = [...new Set([...availableVouchers, ...extractedVouchers])];
        
        const batch = writeBatch(db);
        newVouchers.forEach(voucher => {
            const docRef = doc(db, 'vouchers', voucher);
            batch.set(docRef, { voucherNumber: voucher });
        });
        await batch.commit();

        setAvailableVouchers(newVouchers);
        setPastedVouchers('');
        toast({ title: "Vouchers Added Successfully", description: `${extractedVouchers.length} new voucher numbers were added.` });

    } catch (error) {
        toast({ title: "Import Error", variant: "destructive", description: "Could not process the pasted text." });
    }
  };

  const autoAssignVouchers = async (playersToAssign: any[], membershipType: 'new' | 'renewing' = 'renewing') => {
      if (availableVouchers.length < playersToAssign.length) {
        toast({ title: "Not Enough Vouchers", description: `You need ${playersToAssign.length} vouchers but only have ${availableVouchers.length} available.`, variant: "destructive" });
        return;
      }
      
      const assignedPlayerIds = new Set(assignedVouchers.map(v => v.playerId));
      const unassigned = playersToAssign.filter(p => {
          const playerId = p.player?.id || p.id;
          return !assignedPlayerIds.has(playerId);
      });

      if (unassigned.length === 0) {
        toast({ title: "No new players to assign." });
        return;
      }
      
      const newAssignments: VoucherAssignment[] = [];
      
      unassigned.forEach((item, index) => {
        const voucherNumber = availableVouchers[index];
        const player = item.player || item; // Handle both pending memberships and direct player objects
        
        newAssignments.push({
          id: `${player.id}-${Date.now()}`,
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          voucherNumber,
          membershipType: item.membershipType || membershipType,
          assignedDate: new Date().toISOString(),
          eventName: item.eventName,
          playerEmail: player.email,
          playerPhone: player.phone,
          playerAddress: `${player.address || ''} ${player.city || ''} ${player.state || ''} ${player.zipCode || ''}`.trim(),
          playerBirthDate: player.dob,
        });
      });
  
      const batch = writeBatch(db);
      newAssignments.forEach(assignment => {
          const docRef = doc(db, 'assignedVouchers', assignment.id);
          batch.set(docRef, assignment);
      });
      
      const usedVouchers = availableVouchers.slice(0, newAssignments.length);
      usedVouchers.forEach(voucher => {
          const docRef = doc(db, 'vouchers', voucher);
          batch.delete(docRef);
      });
  
      await batch.commit();
      await loadData();
      
      toast({ title: "Vouchers Assigned Successfully", description: `${newAssignments.length} vouchers have been assigned.` });
  };
  
  const updatePlayerUscfId = async (assignmentId: string, newUscfId: string) => {
    if (!db || !newUscfId.trim()) return;
    
    setIsProcessing(true);
    const assignment = assignedVouchers.find(v => v.id === assignmentId);
    if (!assignment) {
        setIsProcessing(false);
        return;
    }

    const player = database.find(p => p.id === assignment.playerId);
    if (player) {
      await updatePlayer({ ...player, uscfId: newUscfId.trim() });
      
      const updatedAssignment = { ...assignment, uscfIdAssigned: newUscfId.trim(), processedDate: new Date().toISOString() };
      const docRef = doc(db, 'assignedVouchers', assignmentId);
      await updateDoc(docRef, updatedAssignment);
      
      setAssignedVouchers(prev => prev.map(v => v.id === assignmentId ? updatedAssignment : v));
      toast({ title: "USCF ID Updated" });
    }
    setIsProcessing(false);
  };

  const exportProcessingReport = () => {
    const unprocessed = assignedVouchers.filter(v => !v.uscfIdAssigned);
    
    if (unprocessed.length === 0) {
        toast({ title: 'Nothing to Export', description: 'There are no vouchers pending processing.' });
        return;
    }

    const csvData = unprocessed.map(assignment => ({
      'Player Name': assignment.playerName,
      'Voucher Number': assignment.voucherNumber,
      'Membership Type': assignment.membershipType,
      'Event': assignment.eventName || '',
      'Email': assignment.playerEmail || '',
      'Phone': assignment.playerPhone || '',
      'Address': assignment.playerAddress || '',
      'Birth Date': assignment.playerBirthDate ? format(new Date(assignment.playerBirthDate), 'yyyy-MM-dd') : '',
      'Gender': assignment.playerGender || '',
      'Assigned Date': format(new Date(assignment.assignedDate), 'yyyy-MM-dd'),
      'USCF ID': ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voucher-processing-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllVouchers = async () => {
    if (confirm('Are you sure you want to clear all voucher data? This cannot be undone.')) {
      if (!db) return;
      const batch = writeBatch(db);
      const vouchersSnapshot = await getDocs(collection(db, 'vouchers'));
      vouchersSnapshot.forEach(doc => batch.delete(doc.ref));
      const assignedSnapshot = await getDocs(collection(db, 'assignedVouchers'));
      assignedSnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      setAvailableVouchers([]);
      setAssignedVouchers([]);
      toast({ title: "Voucher Data Cleared" });
    }
  };
  
  const getStatusBadge = (status: string) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    switch(s) {
        case 'PAID':
        case 'COMPED':
            return <Badge variant="default" className="bg-green-600">Paid</Badge>;
        case 'UNPAID':
        case 'PARTIALLY_PAID':
            return <Badge variant="destructive">Unpaid</Badge>;
        case 'CANCELED':
            return <Badge variant="secondary">Canceled</Badge>;
        default:
            return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Voucher Management</h1>
            <p className="text-muted-foreground">Manage USCF membership vouchers and assignments</p>
          </div>
          <Button onClick={clearAllVouchers} variant="outline" size="sm">
            Clear All Data
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="upload">Import Vouchers</TabsTrigger>
            <TabsTrigger value="assign">Assign Vouchers</TabsTrigger>
            <TabsTrigger value="process">Process Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Vouchers</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{availableVouchers.length}</div></CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Memberships</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{pendingMemberships.length}</div><p className="text-xs text-muted-foreground">From all tournaments</p></CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assigned Vouchers</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{assignedVouchers.length}</div></CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Processed Vouchers</CardTitle>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{assignedVouchers.filter(v => v.uscfIdAssigned).length}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Recent Voucher Assignments</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player Name</TableHead>
                      <TableHead>Voucher Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedVouchers.slice(-10).reverse().map(assignment => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.playerName}</TableCell>
                        <TableCell className="font-mono">{assignment.voucherNumber}</TableCell>
                        <TableCell><Badge variant={assignment.membershipType === 'new' ? 'default' : 'secondary'}>{assignment.membershipType}</Badge></TableCell>
                        <TableCell>{format(new Date(assignment.assignedDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell><Badge variant={assignment.uscfIdAssigned ? 'default' : 'secondary'} className={assignment.uscfIdAssigned ? 'bg-green-600' : ''}>{assignment.uscfIdAssigned ? 'Processed' : 'Pending'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Paste Voucher Numbers</CardTitle>
                <CardDescription>Copy voucher numbers from your PDF or other document and paste them into the text area below. The system will automatically find and extract valid voucher numbers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                    placeholder="Paste voucher numbers here. The app will find any numbers in the format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX."
                    className="h-48"
                    value={pastedVouchers}
                    onChange={(e) => setPastedVouchers(e.target.value)}
                />
                <Button onClick={handleImportVouchers}>
                    <ClipboardPaste className="h-4 w-4 mr-2"/>
                    Import Vouchers from Text
                </Button>
                {availableVouchers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Available Vouchers ({availableVouchers.length})</h3>
                    <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded"><div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {availableVouchers.slice(0, 20).map((voucher, index) => (<code key={index} className="text-xs bg-white p-1 rounded">{voucher}</code>))}
                      </div>
                      {availableVouchers.length > 20 && (<p className="text-sm text-gray-500 mt-2">...and {availableVouchers.length - 20} more</p>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assign" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>PSJA GT Memberships by Tournament</CardTitle>
                <CardDescription>Assign vouchers to PSJA GT players who need new or renewing memberships for a specific event.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select onValueChange={setSelectedTournament}>
                    <SelectTrigger className="w-full md:w-1/2">
                      <SelectValue placeholder="Select a tournament..." />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map(event => <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => autoAssignVouchers(pendingGtByTournament)} disabled={pendingGtByTournament.length === 0}>
                    <Award className="h-4 w-4 mr-2" />
                    Assign Vouchers to {pendingGtByTournament.length} Players
                  </Button>
                </div>
                {selectedTournament && (
                  <div className="border rounded-md mt-4">
                    <Table>
                      <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>School</TableHead><TableHead>Membership Needed</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pendingGtByTournament.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center h-24">No pending GT memberships for this event.</TableCell></TableRow>
                        ) : (
                          pendingGtByTournament.map(item => (
                            <TableRow key={item.player.id}>
                              <TableCell>{item.player.firstName} {item.player.lastName}</TableCell>
                              <TableCell>{item.player.school}</TableCell>
                              <TableCell><Badge variant="destructive">{item.membershipType}</Badge></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GT Player Membership Renewals</CardTitle>
                <CardDescription>
                  This tool finds GT players whose USCF memberships are expiring this month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                    <p className="text-sm">Found <span className="font-bold">{expiringGtPlayers.length}</span> GT players with memberships expiring this month.</p>
                    <Button onClick={() => autoAssignVouchers(expiringGtPlayers)} disabled={expiringGtPlayers.length === 0}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Assign Vouchers to Expiring GT Players
                    </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Auto-Assign Vouchers (All Other Players)</CardTitle>
                <CardDescription>Automatically assign available vouchers to players who need new or renewed memberships from event registrations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p><strong>Available vouchers:</strong> {availableVouchers.length}</p>
                    <p><strong>Players needing memberships:</strong> {pendingMemberships.length}</p>
                  </div>
                  <Button onClick={() => autoAssignVouchers(pendingMemberships)} disabled={availableVouchers.length === 0 || pendingMemberships.length === 0}>Auto-Assign Vouchers</Button>
                </div>
                {pendingMemberships.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Players Needing Memberships</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Event</TableHead><TableHead>Invoice #</TableHead><TableHead>Payment Status</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pendingMemberships.map(membership => (
                          <TableRow key={membership.playerId}>
                            <TableCell>{membership.player.firstName} {membership.player.lastName}</TableCell>
                            <TableCell>{membership.eventName}</TableCell>
                            <TableCell>{membership.invoiceNumber}</TableCell>
                            <TableCell>{getStatusBadge(membership.invoiceStatus)}</TableCell>
                            <TableCell><Badge variant={membership.membershipType === 'new' ? 'default' : 'secondary'}>{membership.membershipType}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="process" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Process Assigned Vouchers</CardTitle>
                <CardDescription>Enter USCF IDs for players who have been assigned vouchers and had their memberships processed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={exportProcessingReport} variant="outline"><Download className="w-4 h-4 mr-2" />Export Processing Report</Button>
                </div>
                {assignedVouchers.filter(v => !v.uscfIdAssigned).length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Voucher</TableHead><TableHead>Type</TableHead><TableHead>USCF ID</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {assignedVouchers.filter(v => !v.uscfIdAssigned).map(assignment => (
                        <TableRow key={assignment.id}>
                          <TableCell>{assignment.playerName}</TableCell>
                          <TableCell className="font-mono text-sm">{assignment.voucherNumber}</TableCell>
                          <TableCell><Badge variant={assignment.membershipType === 'new' ? 'default' : 'secondary'}>{assignment.membershipType}</Badge></TableCell>
                          <TableCell>
                            <Input placeholder="Enter USCF ID" className="w-32" disabled={isProcessing} onBlur={(e) => { if (e.target.value.trim()) { updatePlayerUscfId(assignment.id, e.target.value.trim()); e.target.value = ''; } }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : ( <div className="text-center py-8 text-muted-foreground">No vouchers pending processing.</div> )}
              </CardContent>
            </Card>

            {assignedVouchers.filter(v => v.uscfIdAssigned).length > 0 && (
              <Card>
                <CardHeader><CardTitle>Processed Vouchers</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Player Name</TableHead><TableHead>Voucher Number</TableHead><TableHead>USCF ID</TableHead><TableHead>Processed Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {assignedVouchers.filter(v => v.uscfIdAssigned).sort((a, b) => new Date(b.processedDate || '').getTime() - new Date(a.processedDate || '').getTime()).map(assignment => (
                        <TableRow key={assignment.id}>
                          <TableCell>{assignment.playerName}</TableCell>
                          <TableCell className="font-mono text-sm">{assignment.voucherNumber}</TableCell>
                          <TableCell className="font-mono">{assignment.uscfIdAssigned}</TableCell>
                          <TableCell>{assignment.processedDate && format(new Date(assignment.processedDate), 'MMM dd, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
