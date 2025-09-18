
'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { School, User, DollarSign, CheckCircle, Lock, AlertCircle, Clock } from "lucide-react";
import { format, differenceInHours, isSameDay, startOfDay } from "date-fns";
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { InvoiceDetailsDialog } from '@/components/invoice-details-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface IndividualRegistrationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
  parentProfile: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export function IndividualRegistrationDialog({ 
  isOpen, 
  onOpenChange, 
  event, 
  parentProfile 
}: IndividualRegistrationDialogProps) {
  const { toast } = useToast();
  const { database } = useMasterDb();
  
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, { section: string; uscfStatus: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load parent's students
  useEffect(() => {
    if (parentProfile?.email && database.length > 0 && isOpen) {
      try {
        const storedParentStudents = localStorage.getItem(`parent_students_${parentProfile.email}`);
        if (storedParentStudents) {
          const studentIds = JSON.parse(storedParentStudents);
          let students = database.filter(p => studentIds.includes(p.id));
          if (event?.isPsjaOnly) {
            students = students.filter(p => p.district === 'PHARR-SAN JUAN-ALAMO ISD');
          }
          setParentStudents(students);
        }
      } catch (error) {
        console.error('Failed to load parent students:', error);
      }
    }
  }, [parentProfile, database, isOpen, event]);
  
    useEffect(() => {
        const loadRegistrations = () => {
            const storedConfirmations = localStorage.getItem('confirmations');
            if (storedConfirmations) {
                setRegistrations(JSON.parse(storedConfirmations));
            }
        };
        loadRegistrations();
    }, [isOpen]);

  // Check which students are already registered
  const getStudentRegistrationStatus = (student: MasterPlayer) => {
    const existingReg = registrations.find((confirmation: any) => 
      confirmation.eventId === event.id && 
      confirmation.selections && 
      confirmation.selections[student.id]
    );
    
    if (existingReg) {
      const isParentReg = existingReg.parentEmail === parentProfile.email;
      return {
        isRegistered: true,
        source: isParentReg ? 'parent' : 'sponsor',
        message: isParentReg ? 'Already registered by you' : 'Registered by school sponsor'
      };
    }
    
    return { isRegistered: false, source: null, message: 'Available for registration' };
  };

  const toggleStudentSelection = (student: MasterPlayer) => {
    const status = getStudentRegistrationStatus(student);
    if (status.isRegistered) return;

    setSelectedStudents(prev => {
      const { [student.id]: isSelected, ...rest } = prev;
      if (isSelected) {
        return rest;
      } else {
        const isExpired = !student.uscfExpiration || new Date(student.uscfExpiration) < new Date(event.date);
        return {
          ...prev,
          [student.id]: {
            section: student.section || 'High School K-12',
            uscfStatus: student.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current'
          }
        };
      }
    });
  };

  const updateStudentSelection = (studentId: string, field: 'section' | 'uscfStatus', value: string) => {
    setSelectedStudents(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const getFeeForEvent = () => {
    if (!event) return { fee: 0, type: 'Regular Registration' };
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : new Date(event.date);
    const now = new Date();
    if (startOfDay(now) > startOfDay(deadline)) {
        const eventDate = new Date(event.date);
        if (isSameDay(eventDate, now)) return { fee: event.dayOfFee || event.regularFee, type: 'Day-of Registration' };
        const hoursUntilEvent = differenceInHours(eventDate, now);
        if (hoursUntilEvent <= 24) return { fee: event.veryLateFee || event.regularFee, type: 'Very Late Registration' };
        return { fee: event.lateFee || event.regularFee, type: 'Late Registration' };
    }
    return { fee: event.regularFee, type: 'Regular Registration' };
  };

  const calculateFeeBreakdown = () => {
    if (!event) return { registrationFees: 0, uscfFees: 0, lateFees: 0, total: 0, feeType: 'Regular Registration' };
    const { fee: currentFee, type: feeType } = getFeeForEvent();
    const uscfFee = 24;
    const registrationFees = Object.keys(selectedStudents).length * event.regularFee;
    const lateFees = Object.keys(selectedStudents).length * (currentFee - event.regularFee);
    const uscfFees = Object.values(selectedStudents).filter(s => s.uscfStatus !== 'current').length * uscfFee;
    const total = registrationFees + lateFees + uscfFees;
    return { registrationFees, uscfFees, lateFees, total, feeType };
  };
  
  const feeBreakdown = calculateFeeBreakdown();

  const handleProceedToInvoice = () => {
    if (Object.keys(selectedStudents).length === 0) {
        toast({ variant: 'destructive', title: 'No Students Selected', description: 'Please select at least one student.' });
        return;
    }
    setShowConfirmation(true);
  };

  const handleBackToSelection = () => {
    setShowConfirmation(false);
  };

  const resetState = () => {
    setSelectedStudents({});
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedStudents).length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Students Selected',
        description: 'Please select at least one student to register.'
      });
      return;
    }
  
    setIsSubmitting(true);
  
    try {
      const generateIndividualTeamCode = (lastName: string): string => {
        const sanitized = lastName.replace(/[^A-Za-z]/g, '').toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        return `IND-${sanitized.slice(0, 4)}${timestamp}`;
      };
  
      const teamCode = generateIndividualTeamCode(parentProfile.lastName);

      const { fee: currentFee } = getFeeForEvent();
      const lateFeeAmount = currentFee - event.regularFee;
  
      const playersToInvoice = Object.entries(selectedStudents).map(([playerId, details]) => {
        const student = parentStudents.find(p => p.id === playerId);
        
        return {
          playerName: `${student?.firstName} ${student?.lastName}`,
          uscfId: student?.uscfId || '',
          baseRegistrationFee: event.regularFee,
          lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
          uscfAction: details.uscfStatus !== 'current',
        };
      });
  
      const result = await createInvoice({
        sponsorName: `${parentProfile.firstName} ${parentProfile.lastName}`,
        sponsorEmail: parentProfile.email,
        sponsorPhone: parentProfile.phone || '',
        schoolName: 'Individual Registration',
        teamCode: teamCode,
        eventName: event.name,
        eventDate: event.date,
        uscfFee: 24,
        players: playersToInvoice,
        bookkeeperEmail: undefined,
        gtCoordinatorEmail: undefined,
        schoolAddress: '',
        schoolPhone: '',
        district: 'Individual',
      });
  
      const newConfirmation = {
        id: result.invoiceId,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        submissionTimestamp: new Date().toISOString(),
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
        parentEmail: parentProfile.email,
        parentName: `${parentProfile.firstName} ${parentProfile.lastName}`,
        schoolName: 'Individual Registration',
        district: 'Individual',
        teamCode: teamCode,
        invoiceTitle: `${teamCode} @ ${format(new Date(event.date), 'MM/dd/yyyy')} ${event.name}`,
        sponsorEmail: parentProfile.email,
        sponsorPhone: parentProfile.phone || '',
        contactEmail: parentProfile.email,
        purchaserEmail: parentProfile.email,
        purchaserName: `${parentProfile.firstName} ${parentProfile.lastName}`,
        selections: Object.fromEntries(Object.entries(selectedStudents).map(([playerId, details]) => [ playerId, { ...details, status: 'active' } ])),
        totalInvoiced: feeBreakdown.total,
        totalAmount: feeBreakdown.total,
        invoiceStatus: result.status,
        status: result.status,
        invoiceUrl: result.invoiceUrl,
      };
  
      const invoiceDocRef = doc(db, 'invoices', result.invoiceId);
      await setDoc(invoiceDocRef, newConfirmation);
  
      setCreatedInvoiceId(result.invoiceId);
      setShowInvoiceModal(true);
      
      toast({
        title: "Registration Successful",
        description: `Invoice #${result.invoiceNumber} created for ${Object.keys(selectedStudents).length} student(s).`
      });
      
      resetState();
      
    } catch (error) {
      console.error('Registration failed:', error);
      const description = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: 'destructive', title: "Registration Failed", description });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!event) return null;
  
  const isPsjaRestricted = event.isPsjaOnly;

  if (event.isClosed) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{event.name}</DialogTitle></DialogHeader>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Registration Closed</AlertTitle>
                    <AlertDescription>We are no longer accepting registrations for this event.</AlertDescription>
                </Alert>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
  }

  const renderSelectionScreen = () => (
    <>
        <DialogHeader className="shrink-0">
          <DialogTitle>Register for {event?.name}</DialogTitle>
          <DialogDescription className="sr-only">A dialog to select students to register for the event.</DialogDescription>
          <p className="text-sm text-muted-foreground">{event?.date && format(new Date(event.date), 'PPP')} • {event?.location}</p>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-6 -mr-6">
          {isPsjaRestricted && (
            <Alert><AlertTitle>PSJA-Only Event</AlertTitle><AlertDescription>This event is restricted to students from the PHARR-SAN JUAN-ALAMO ISD. Only eligible students from your list are shown.</AlertDescription></Alert>
          )}
          {parentStudents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Eligible Students Found</p>
              <p>{isPsjaRestricted ? "You have no students from PHARR-SAN JUAN-ALAMO ISD on your list." : "Add students to your profile first before registering for events."}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Select Students to Register</h3>
              {parentStudents.map(student => {
                const status = getStudentRegistrationStatus(student);
                const isSelected = !!selectedStudents[student.id];
                return (
                  <Card key={student.id} className={`cursor-pointer transition-colors ${status.isRegistered ? 'opacity-50 cursor-not-allowed' : isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`} onClick={() => !status.isRegistered && toggleStudentSelection(student)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <h4 className="font-semibold">{student.firstName} {student.lastName}</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>USCF ID: {student.uscfId} | Rating: {student.regularRating || 'UNR'}</p>
                              {student.school && (<div className="flex items-center gap-1"><School className="h-3 w-3" />{student.school} - {student.district}</div>)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {status.isRegistered ? (<Badge variant={status.source === 'sponsor' ? 'default' : 'secondary'}>{status.message}</Badge>) : isSelected ? (<Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Selected</Badge>) : (<Button variant="outline" size="sm">Select</Button>)}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                          <div><Label htmlFor={`section-${student.id}`}>Section</Label><Select value={selectedStudents[student.id]?.section || ''} onValueChange={(value) => updateStudentSelection(student.id, 'section', value)}><SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger><SelectContent><SelectItem value="Kinder-1st">Kinder-1st</SelectItem><SelectItem value="Primary K-3">Primary K-3</SelectItem><SelectItem value="Elementary K-5">Elementary K-5</SelectItem><SelectItem value="Middle School K-8">Middle School K-8</SelectItem><SelectItem value="High School K-12">High School K-12</SelectItem><SelectItem value="Championship">Championship</SelectItem></SelectContent></Select></div>
                          <div><Label htmlFor={`uscf-${student.id}`}>USCF Status</Label><Select value={selectedStudents[student.id]?.uscfStatus || ''} onValueChange={(value) => updateStudentSelection(student.id, 'uscfStatus', value)}><SelectTrigger><SelectValue placeholder="Select USCF status" /></SelectTrigger><SelectContent><SelectItem value="current">Current Member</SelectItem><SelectItem value="new">New Member (+$24)</SelectItem><SelectItem value="renewing">Renewing Member (+$24)</SelectItem></SelectContent></Select></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        {Object.keys(selectedStudents).length > 0 && (
          <div className="border-t pt-4 shrink-0">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total ({Object.keys(selectedStudents).length} students):</span>
              <span className="flex items-center gap-1"><DollarSign className="h-5 w-5" />{feeBreakdown.total.toFixed(2)}</span>
            </div>
            {feeBreakdown.lateFees > 0 && (<div className="flex items-center gap-2 text-sm text-amber-600 mt-2"><Clock className="h-4 w-4" />{feeBreakdown.feeType} fees apply</div>)}
          </div>
        )}
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleProceedToInvoice} disabled={Object.keys(selectedStudents).length === 0}>Review Charges ({Object.keys(selectedStudents).length})</Button>
        </DialogFooter>
    </>
  );

  const renderConfirmationScreen = () => (
    <>
      <DialogHeader>
        <DialogTitle>Confirm Registration & Charges</DialogTitle>
        <DialogDescription>Review total charges for {event.name} before creating your invoice.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Selected Students ({Object.keys(selectedStudents).length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {Object.entries(selectedStudents).map(([playerId, details]) => {
              const student = parentStudents.find(p => p.id === playerId);
              return (<div key={playerId} className="flex justify-between items-center text-sm bg-muted/50 rounded p-2"><span>{student?.firstName} {student?.lastName}</span><div className="flex gap-2"><Badge variant="outline" className="text-xs">{details.section}</Badge>{details.uscfStatus !== 'current' && (<Badge variant="secondary" className="text-xs">USCF {details.uscfStatus}</Badge>)}</div></div>);
            })}
          </div>
        </div>
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">Charge Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Registration Fees ({Object.keys(selectedStudents).length} × ${event.regularFee})</span><span>${feeBreakdown.registrationFees.toFixed(2)}</span></div>
            {feeBreakdown.lateFees > 0 && (<div className="flex justify-between text-amber-600"><span>{feeBreakdown.feeType} ({Object.keys(selectedStudents).length} × ${(feeBreakdown.lateFees / Object.keys(selectedStudents).length).toFixed(2)})</span><span>${feeBreakdown.lateFees.toFixed(2)}</span></div>)}
            {feeBreakdown.uscfFees > 0 && (<div className="flex justify-between"><span>USCF Fees ({Object.values(selectedStudents).filter(s => s.uscfStatus !== 'current').length} × $24)</span><span>${feeBreakdown.uscfFees.toFixed(2)}</span></div>)}
            <div className="border-t pt-2 flex justify-between font-semibold"><span>Total Amount</span><span>${feeBreakdown.total.toFixed(2)}</span></div>
          </div>
        </div>
        {feeBreakdown.lateFees > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm"><p className="font-medium text-amber-800">Late Registration Notice</p><p className="text-amber-700">{feeBreakdown.feeType} fees have been applied due to the proximity to the event date.</p></div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={handleBackToSelection}>Back to Selection</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Registering...' : `Register Now ($${feeBreakdown.total.toFixed(2)})`}</Button>
      </DialogFooter>
    </>
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        {showConfirmation ? renderConfirmationScreen() : renderSelectionScreen()}
      </DialogContent>
    </Dialog>
    {showInvoiceModal && createdInvoiceId && (
      <InvoiceDetailsDialog
        isOpen={showInvoiceModal}
        onClose={() => { setShowInvoiceModal(false); setCreatedInvoiceId(null); }}
        confirmationId={createdInvoiceId}
      />
    )}
    </>
  );
}
