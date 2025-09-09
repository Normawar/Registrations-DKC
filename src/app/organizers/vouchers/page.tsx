
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useMasterDb } from '@/context/master-db-context';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Upload, Download, UserPlus, FileText, CheckCircle, Loader2, ClipboardPaste } from 'lucide-react';
import { collection, doc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Textarea } from '@/components/ui/textarea';

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
  
  const [availableVouchers, setAvailableVouchers] = useState<string[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<any[]>([]);
  const [assignedVouchers, setAssignedVouchers] = useState<VoucherAssignment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pastedVouchers, setPastedVouchers] = useState('');

  // Load data from Firestore on component mount
  const loadData = async () => {
    if (!db) return;
    try {
        const vouchersCol = collection(db, 'vouchers');
        const assignedCol = collection(db, 'assignedVouchers');

        const [vouchersSnapshot, assignedSnapshot] = await Promise.all([
            getDocs(vouchersCol),
            getDocs(assignedCol)
        ]);

        const vouchers = vouchersSnapshot.docs.map(doc => doc.data().voucherNumber);
        const assigned = assignedSnapshot.docs.map(doc => doc.data() as VoucherAssignment);
        
        setAvailableVouchers(vouchers);
        setAssignedVouchers(assigned);
    } catch (error) {
        console.error("Failed to load voucher data from Firestore:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load voucher data.' });
    }
  };

  const loadPendingMemberships = useCallback(async () => {
    if (!db) return;
    const invoicesCol = collection(db, 'invoices');
    const invoiceSnapshot = await getDocs(invoicesCol);
    const allConfirmations = invoiceSnapshot.docs.map(doc => doc.data());

    const pending = [];
    const assignedPlayerIds = new Set(assignedVouchers.map(v => v.playerId));
    
    for (const confirmation of allConfirmations) {
      for (const [playerId, selection] of Object.entries(confirmation.selections || {})) {
        if ((selection as any).uscfStatus === 'new' || (selection as any).uscfStatus === 'renewing') {
          const player = database.find(p => p.id === playerId);
          if (player && !assignedPlayerIds.has(playerId)) {
            pending.push({
              playerId,
              player,
              confirmation,
              selection,
              membershipType: (selection as any).uscfStatus
            });
          }
        }
      }
    }
    setPendingMemberships(pending);
  }, [database, assignedVouchers]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (database.length > 0) {
      loadPendingMemberships();
    }
  }, [database, assignedVouchers, loadPendingMemberships]);


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

  const autoAssignVouchers = async () => {
    if (availableVouchers.length === 0 || !db) {
      toast({ title: "No Available Vouchers", variant: "destructive" });
      return;
    }

    const unassigned = pendingMemberships.filter(p => !assignedVouchers.find(av => av.playerId === p.playerId));
    if (unassigned.length === 0) {
      toast({ title: "No Pending Memberships to Assign" }); return;
    }

    const assignmentsToMake = Math.min(unassigned.length, availableVouchers.length);
    const newAssignments: VoucherAssignment[] = [];
    
    unassigned.slice(0, assignmentsToMake).forEach((membership, index) => {
      const voucherNumber = availableVouchers[index];
      newAssignments.push({
        id: `${membership.playerId}-${Date.now()}`,
        playerId: membership.playerId,
        playerName: `${membership.player.firstName} ${membership.player.lastName}`,
        voucherNumber,
        membershipType: membership.membershipType,
        assignedDate: new Date().toISOString(),
        eventName: membership.confirmation.eventName,
        playerEmail: membership.player.email,
        playerPhone: membership.player.phone,
        playerAddress: `${membership.player.address || ''} ${membership.player.city || ''} ${membership.player.state || ''} ${membership.player.zipCode || ''}`.trim(),
        playerBirthDate: membership.player.dob,
      });
    });

    const batch = writeBatch(db);
    newAssignments.forEach(assignment => {
        const docRef = doc(db, 'assignedVouchers', assignment.id);
        batch.set(docRef, assignment);
    });
    
    const usedVouchers = availableVouchers.slice(0, assignmentsToMake);
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
                <CardTitle>Auto-Assign Vouchers</CardTitle>
                <CardDescription>Automatically assign available vouchers to players who need new or renewed memberships.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p><strong>Available vouchers:</strong> {availableVouchers.length}</p>
                    <p><strong>Players needing memberships:</strong> {pendingMemberships.length}</p>
                  </div>
                  <Button onClick={autoAssignVouchers} disabled={availableVouchers.length === 0 || pendingMemberships.length === 0}>Auto-Assign Vouchers</Button>
                </div>
                {pendingMemberships.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Players Needing Memberships</h3>
                    <Table>
                      <TableHeader><TableRow><TableHead>Player Name</TableHead><TableHead>Type</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pendingMemberships.map(membership => (
                          <TableRow key={membership.playerId}>
                            <TableCell>{membership.player.firstName} {membership.player.lastName}</TableCell>
                            <TableCell><Badge variant={membership.membershipType === 'new' ? 'default' : 'secondary'}>{membership.membershipType}</Badge></TableCell>
                            <TableCell>{membership.confirmation.eventName}</TableCell>
                            <TableCell><Badge variant="destructive">Pending Assignment</Badge></TableCell>
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

    