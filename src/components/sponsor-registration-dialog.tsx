

'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { School, User, DollarSign, CheckCircle, Clock, AlertCircle, Lock } from "lucide-react";
import { format, differenceInHours, isSameDay } from "date-fns";
import { InvoiceDetailsDialog } from '@/components/invoice-details-dialog';
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { createPsjaSplitInvoice } from '@/ai/flows/create-psja-split-invoice-flow';
import { generateTeamCode } from '@/lib/school-utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Checkbox } from './ui/checkbox';


interface SponsorRegistrationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
}

export function SponsorRegistrationDialog({ 
  isOpen, 
  onOpenChange, 
  event 
}: SponsorRegistrationDialogProps) {
  const { toast } = useToast();
  const { database, isDbLoaded } = useMasterDb();
  const { profile } = useSponsorProfile();
  
  const [rosterPlayers, setRosterPlayers] = useState<MasterPlayer[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, { section: string; uscfStatus: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // Enhanced loading effect with better error handling
  useEffect(() => {
    if (!isOpen) {
      setIsLoadingPlayers(false);
      return;
    }

    if (!profile || !isDbLoaded) {
      setIsLoadingPlayers(true);
      return;
    }

    setIsLoadingPlayers(true);
    const timer = setTimeout(() => {
      const sponsorPlayers = database.filter(p => p.district === profile.district && p.school === profile.school);
      setRosterPlayers(sponsorPlayers);
      setIsLoadingPlayers(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [profile, database, isDbLoaded, isOpen]);
  
  // Load existing registrations from Firestore
  useEffect(() => {
    const loadRegistrations = async () => {
      if (isOpen && db) {
        const invoicesCol = collection(db, 'invoices');
        const q = query(invoicesCol, where('eventId', '==', event?.id));
        const invoiceSnapshot = await getDocs(q);
        const eventRegistrations = invoiceSnapshot.docs.map(doc => doc.data());
        setRegistrations(eventRegistrations);
      }
    };
    loadRegistrations();
  }, [isOpen, event?.id]);

  // Check which students are already registered
  const getStudentRegistrationStatus = (student: MasterPlayer) => {
    const existingReg = registrations.find((confirmation: any) => 
      confirmation.selections && confirmation.selections[student.id] && confirmation.status !== 'CANCELED'
    );
    
    if (existingReg) {
      return {
        isRegistered: true,
        message: 'Already registered'
      };
    }
    
    return { isRegistered: false, message: 'Available for registration' };
  };

  const toggleStudentSelection = (student: MasterPlayer) => {
    const status = getStudentRegistrationStatus(student);
    if (status.isRegistered) return;

    setSelectedStudents(prev => {
      const { [student.id]: isSelected, ...rest } = prev;
      if (isSelected) {
        return rest;
      } else {
        const isExpired = !student.uscfExpiration || new Date(student.uscfExpiration) < new Date(event?.date);
        return {
          ...prev,
          [student.id]: {
            section: student.section || 'High School K-12',
            uscfStatus: !student.uscfId || student.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current'
          }
        };
      }
    });
  };

  const updateStudentSelection = (studentId: string, field: 'section' | 'uscfStatus', value: string) => {
    if (!value || value.trim() === '') return;
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
      
      const eventDate = new Date(event.date);
      const now = new Date();

      if (isSameDay(eventDate, now)) {
          return { fee: event.dayOfFee || event.regularFee, type: 'Day-of Registration' };
      }
      
      const hoursUntilEvent = differenceInHours(eventDate, now);
      
      if (hoursUntilEvent <= 24) {
          return { fee: event.veryLateFee || event.regularFee, type: 'Very Late Registration' };
      } else if (hoursUntilEvent <= 48) {
          return { fee: event.lateFee || event.regularFee, type: 'Late Registration' };
      }
      
      return { fee: event.regularFee, type: 'Regular Registration' };
  };

  // Calculate fees with breakdown
  const calculateFeeBreakdown = () => {
    if (!event) return { registrationFees: 0, lateFees: 0, uscfFees: 0, total: 0, feeType: 'Regular Registration' };
    
    const { fee: currentFee, type: feeType } = getFeeForEvent();
    
    const selectedCount = Object.keys(selectedStudents).length;
    const baseTotal = selectedCount * event.regularFee;
    const lateFeeTotal = selectedCount * (currentFee - event.regularFee);
    
    let uscfTotal = 0;
    const uscfFee = 24;
    
    const uscfPlayersToCharge = Object.entries(selectedStudents).filter(([playerId, details]) => {
      if (details.uscfStatus === 'current') return false;
      
      if (profile?.district === 'PHARR-SAN JUAN-ALAMO ISD') {
        const player = rosterPlayers.find(p => p.id === playerId);
        return player?.studentType !== 'gt';
      }
      
      return true;
    });

    uscfTotal = uscfPlayersToCharge.length * uscfFee;
    
    return {
      registrationFees: baseTotal,
      lateFees: lateFeeTotal,
      uscfFees: uscfTotal,
      total: baseTotal + lateFeeTotal + uscfTotal,
      feeType: feeType
    };
  };

  const feeBreakdown = calculateFeeBreakdown();

  const handleProceedToInvoice = () => {
    if (Object.keys(selectedStudents).length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Students Selected',
        description: 'Please select at least one student to register.'
      });
      return;
    }
    setShowConfirmation(true);
  };

  const handleCreateInvoice = async () => {
    if (!profile || !event || !db) return;

    setIsSubmitting(true);
    
    const isPsjaDistrict = profile.district === 'PHARR-SAN JUAN-ALAMO ISD';
    const allSelectedPlayers = Object.entries(selectedStudents).map(([playerId, details]) => ({
      player: rosterPlayers.find(p => p.id === playerId),
      details
    }));

    const hasGt = allSelectedPlayers.some(p => p.player?.studentType === 'gt');
    const hasIndependent = allSelectedPlayers.some(p => p.player?.studentType !== 'gt');

    if (isPsjaDistrict && hasGt && hasIndependent) {
        await handlePsjaSplitInvoice();
        return;
    }

    await handleStandardInvoice();
  };

  const handleStandardInvoice = async () => {
    if (!profile || !event) return;

    const { fee: currentFee } = getFeeForEvent();
    const lateFeeAmount = currentFee - event.regularFee;

    const playersToInvoice = Object.entries(selectedStudents).map(([playerId, details]) => {
      const student = rosterPlayers.find(p => p.id === playerId);
      return {
        playerName: `${student?.firstName} ${student?.lastName}`,
        uscfId: student?.uscfId || '',
        baseRegistrationFee: event.regularFee,
        lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
        uscfAction: details.uscfStatus !== 'current',
        isGtPlayer: student?.studentType === 'gt',
        section: details.section,
      };
    });

    try {
      const result = await createInvoice({
          sponsorName: `${profile.firstName} ${profile.lastName}`,
          sponsorEmail: profile.email || '',
          sponsorPhone: profile.phone || '',
          schoolName: profile.school,
          teamCode: generateTeamCode({ schoolName: profile.school, district: profile.district }),
          eventName: event.name,
          eventDate: event.date,
          uscfFee: 24,
          players: playersToInvoice,
          bookkeeperEmail: profile.bookkeeperEmail,
          gtCoordinatorEmail: profile.gtCoordinatorEmail,
          schoolAddress: profile.schoolAddress,
          schoolPhone: profile.schoolPhone,
          district: profile.district,
      });

      await saveConfirmation(result.invoiceId, result, playersToInvoice, feeBreakdown.total);
      
    } catch (error) {
        handleInvoiceError(error, "Invoice Creation Failed");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePsjaSplitInvoice = async () => {
    if (!profile || !event) return;

    const { fee: currentFee } = getFeeForEvent();
    const lateFeeAmount = currentFee - event.regularFee;

    const playersToInvoice = Object.entries(selectedStudents).map(([playerId, details]) => {
        const student = rosterPlayers.find(p => p.id === playerId);
        return {
          playerName: `${student?.firstName} ${student?.lastName}`,
          uscfId: student?.uscfId || '',
          baseRegistrationFee: event.regularFee,
          lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
          uscfAction: details.uscfStatus !== 'current',
          isGtPlayer: student?.studentType === 'gt'
        };
    });

    try {
      const result = await createPsjaSplitInvoice({
          sponsorName: `${profile.firstName} ${profile.lastName}`,
          sponsorEmail: profile.email,
          bookkeeperEmail: profile.bookkeeperEmail,
          gtCoordinatorEmail: profile.gtCoordinatorEmail,
          schoolName: profile.school,
          schoolAddress: profile.schoolAddress,
          schoolPhone: profile.schoolPhone,
          district: 'PHARR-SAN JUAN-ALAMO ISD',
          teamCode: generateTeamCode({ schoolName: profile.school, district: profile.district }),
          eventName: event.name,
          eventDate: event.date,
          uscfFee: 24,
          players: playersToInvoice
      });

      let gtInvoiceId: string | null = null;
      let indInvoiceId: string | null = null;

      if (result.gtInvoice) {
        const gtPlayers = playersToInvoice.filter(p => p.isGtPlayer);
        await saveConfirmation(result.gtInvoice.invoiceId, result.gtInvoice, gtPlayers, 0); // Total will be recalculated
        gtInvoiceId = result.gtInvoice.invoiceId;
      }

      if (result.independentInvoice) {
        const indPlayers = playersToInvoice.filter(p => !p.isGtPlayer);
        await saveConfirmation(result.independentInvoice.invoiceId, result.independentInvoice, indPlayers, 0); // Total will be recalculated
        indInvoiceId = result.independentInvoice.invoiceId;
      }
      
      toast({ title: "Split Invoices Created Successfully!", description: "Separate invoices for GT and Independent players have been created."});
      setCreatedInvoiceId(indInvoiceId || gtInvoiceId);
      setShowInvoiceModal(true);
      resetState();
      
    } catch (error) {
      handleInvoiceError(error, "Split Invoice Creation Failed");
    } finally {
        setIsSubmitting(false);
    }
  };

  const saveConfirmation = async (invoiceId: string, result: any, playersInInvoice: any[], total: number) => {
    if(!profile || !event || !db) return;
    
    const teamCode = generateTeamCode({ schoolName: profile.school, district: profile.district });
    
    const validatedSelections = Object.fromEntries(
      Object.entries(selectedStudents)
        .filter(([playerId]) => {
          const student = rosterPlayers.find(p => p.id === playerId);
          return playersInInvoice.some(p => p.playerName === `${student?.firstName} ${student?.lastName}`);
        })
        .map(([playerId, details]) => {
          if (!details.section || !details.uscfStatus) {
            throw new Error(`Missing details for player ${playerId}`);
          }
          return [
            playerId, { 
              section: details.section.trim(),
              uscfStatus: details.uscfStatus.trim(),
              status: 'active' 
            }
          ];
        })
    );
    
    const newConfirmation = {
      id: invoiceId,
      invoiceId: invoiceId,
      invoiceNumber: result.invoiceNumber,
      submissionTimestamp: new Date().toISOString(),
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      schoolName: profile.school,
      district: profile.district,
      teamCode: teamCode,
      invoiceTitle: `${teamCode} @ ${format(new Date(event.date), 'MM/dd/yyyy')} ${event.name}`,
      selections: validatedSelections,
      totalInvoiced: result.newTotalAmount || total,
      totalAmount: result.newTotalAmount || total,
      invoiceStatus: result.status,
      status: result.status,
      invoiceUrl: result.invoiceUrl,
      purchaserName: `${profile.firstName} ${profile.lastName}`,
      sponsorEmail: profile.email || '',
      sponsorPhone: profile.phone || '',
      contactEmail: profile.email || '',
      purchaserEmail: profile.email || '',
    };
    
    const invoiceDocRef = doc(db, 'invoices', invoiceId);
    await setDoc(invoiceDocRef, newConfirmation);
    
    setCreatedInvoiceId(invoiceId);
    setShowInvoiceModal(true);
    toast({title: `Invoice #${result.invoiceNumber} created successfully!`});
    resetState();
  };
  
  const handleInvoiceError = (error: any, title: string) => {
    console.error(title, error);
    const description = error instanceof Error ? error.message : "An unknown error occurred.";
    toast({
      variant: 'destructive',
      title: title,
      description: description
    });
  };

  const resetState = () => {
    setSelectedStudents({});
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const handleBackToSelection = () => {
    setShowConfirmation(false);
  };
  
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelections = rosterPlayers
        .filter(student => !getStudentRegistrationStatus(student).isRegistered)
        .reduce((acc, student) => {
          const isExpired = !student.uscfExpiration || new Date(student.uscfExpiration) < new Date(event?.date);
          acc[student.id] = {
            section: student.section || 'High School K-12',
            uscfStatus: !student.uscfId || student.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current'
          };
          return acc;
        }, {} as Record<string, { section: string; uscfStatus: string }>);
      setSelectedStudents(newSelections);
    } else {
      setSelectedStudents({});
    }
  };

  if (!event) return null;

  const isRestrictedEvent = event.isPsjaOnly && profile?.district !== 'PHARR-SAN JUAN-ALAMO ISD';

  if (event.isClosed || isRestrictedEvent) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{event.name}</DialogTitle>
                    <DialogDescription className="sr-only">Dialog for a closed or restricted event.</DialogDescription>
                </DialogHeader>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>{isRestrictedEvent ? 'Registration Restricted' : 'Registration Closed'}</AlertTitle>
                    <AlertDescription>
                        {isRestrictedEvent 
                          ? 'This event is only open to students from the PHARR-SAN JUAN-ALAMO ISD.'
                          : 'We are no longer accepting registrations for this event.'
                        }
                    </AlertDescription>
                </Alert>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen && !showConfirmation} onOpenChange={(open) => {
        if (!open) {
          setShowConfirmation(false);
          setSelectedStudents({});
        }
        onOpenChange(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Register Students for {event.name}</DialogTitle>
            <DialogDescription className="sr-only">A dialog to select students from your roster to register for the event.</DialogDescription>
            <p className="text-sm text-muted-foreground">
              {format(new Date(event.date), 'PPP')} • {event.location}
            </p>
          </DialogHeader>
           {profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
              <Alert>
                  <AlertTitle>PSJA District Notice</AlertTitle>
                  <AlertDescription>
                      USCF membership fees for students identified as GT will not be charged on this invoice. The district will handle these memberships separately.
                  </AlertDescription>
              </Alert>
            )}

          <div className="space-y-4 flex-1 overflow-y-auto pr-6 -mr-6">
            {isLoadingPlayers ? (
              <div className="text-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading your students...</p>
              </div>
            ) : rosterPlayers.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Students Found</p>
                <p>No students found for {profile?.district}/{profile?.school}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Select Students to Register</h3>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="select-all"
                            onCheckedChange={toggleSelectAll}
                            checked={rosterPlayers.length > 0 && rosterPlayers.every(p => getStudentRegistrationStatus(p).isRegistered || !!selectedStudents[p.id])}
                            ref={(el) => {
                                if (el) {
                                    const isIndeterminate = Object.keys(selectedStudents).length > 0 && Object.keys(selectedStudents).length < rosterPlayers.filter(p => !getStudentRegistrationStatus(p).isRegistered).length;
                                    el.indeterminate = isIndeterminate;
                                }
                            }}
                        />
                        <Label htmlFor="select-all">Select All</Label>
                    </div>
                </div>
                
                {rosterPlayers.map(student => {
                  const status = getStudentRegistrationStatus(student);
                  const isSelected = !!selectedStudents[student.id];
                  
                  return (
                    <Card 
                      key={student.id} 
                      className={`cursor-pointer transition-colors ${
                        status.isRegistered 
                          ? 'opacity-50 cursor-not-allowed' 
                          : isSelected 
                            ? 'ring-2 ring-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                      }`}
                      onClick={() => !status.isRegistered && toggleStudentSelection(student)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <h4 className="font-semibold">
                                {student.firstName} {student.lastName}
                                {student.studentType === 'gt' && <Badge variant="secondary" className="ml-2">GT</Badge>}
                              </h4>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>USCF ID: {student.uscfId} | Rating: {student.regularRating || 'UNR'}</p>
                                <p>Grade: {student.grade} | Section: {student.section}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {status.isRegistered ? (
                              <Badge variant="secondary">
                                {status.message}
                              </Badge>
                            ) : isSelected ? (
                               <Badge variant="default" className="bg-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Selected
                               </Badge>
                            ) : (
                              <Button variant="outline" size="sm">
                                Select
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`section-${student.id}`}>Section</Label>
                              <Select
                                value={selectedStudents[student.id]?.section || ''}
                                onValueChange={(value) => updateStudentSelection(student.id, 'section', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select section" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Kinder-1st">Kinder-1st</SelectItem>
                                  <SelectItem value="Primary K-3">Primary K-3</SelectItem>
                                  <SelectItem value="Elementary K-5">Elementary K-5</SelectItem>
                                  <SelectItem value="Middle School K-8">Middle School K-8</SelectItem>
                                  <SelectItem value="High School K-12">High School K-12</SelectItem>
                                  <SelectItem value="Championship">Championship</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label htmlFor={`uscf-${student.id}`}>USCF Status</Label>
                              <Select
                                value={selectedStudents[student.id]?.uscfStatus || ''}
                                onValueChange={(value) => updateStudentSelection(student.id, 'uscfStatus', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select USCF status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="current">Current Member</SelectItem>
                                  <SelectItem value="new">New Member (+$24)</SelectItem>
                                  <SelectItem value="renewing">Renewing Member (+$24)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
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
                <span className="flex items-center gap-1">
                  <DollarSign className="h-5 w-5" />
                  {feeBreakdown.total.toFixed(2)}
                </span>
              </div>
              {feeBreakdown.lateFees > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 mt-2">
                  <Clock className="h-4 w-4" />
                  {feeBreakdown.feeType} fees apply
                </div>
              )}
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProceedToInvoice} 
              disabled={Object.keys(selectedStudents).length === 0}
            >
              Review Charges ({Object.keys(selectedStudents).length} Student{Object.keys(selectedStudents).length !== 1 ? 's' : ''})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Registration & Charges</DialogTitle>
            <DialogDescription className="sr-only">A dialog to confirm student selections and total charges before creating an invoice.</DialogDescription>
            <p className="text-sm text-muted-foreground">
              Review the total charges for {event.name} before creating your invoice.
            </p>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Selected Students ({Object.keys(selectedStudents).length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(selectedStudents).map(([playerId, details]) => {
                  const student = rosterPlayers.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="flex justify-between items-center text-sm bg-muted/50 rounded p-2">
                      <span>{student?.firstName} {student?.lastName}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{details.section}</Badge>
                        {details.uscfStatus !== 'current' && (
                          <Badge variant="secondary" className="text-xs">USCF {details.uscfStatus}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Charge Breakdown</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Registration Fees ({Object.keys(selectedStudents).length} × ${event.regularFee})</span>
                  <span>${feeBreakdown.registrationFees.toFixed(2)}</span>
                </div>
                
                {feeBreakdown.lateFees > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>{feeBreakdown.feeType} ({Object.keys(selectedStudents).length} × ${(feeBreakdown.lateFees / Object.keys(selectedStudents).length).toFixed(2)})</span>
                    <span>${feeBreakdown.lateFees.toFixed(2)}</span>
                  </div>
                )}
                
                {feeBreakdown.uscfFees > 0 && (
                  <div className="flex justify-between">
                    <span>USCF Fees ({Object.values(selectedStudents).filter(s => s.uscfStatus !== 'current' && !rosterPlayers.find(p => p.id === Object.keys(selectedStudents)[Object.values(selectedStudents).indexOf(s)])?.studentType?.includes('gt')).length} × $24)</span>
                    <span>${feeBreakdown.uscfFees.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total Amount</span>
                  <span>${feeBreakdown.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {feeBreakdown.lateFees > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Late Registration Notice</p>
                  <p className="text-amber-700">
                    {feeBreakdown.feeType} fees have been applied due to the proximity to the event date.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleBackToSelection}>
              Back to Selection
            </Button>
            <Button onClick={handleCreateInvoice} disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : `Register Now ($${feeBreakdown.total.toFixed(2)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showInvoiceModal && createdInvoiceId && (
        <InvoiceDetailsDialog
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setCreatedInvoiceId(null);
          }}
          confirmationId={createdInvoiceId}
        />
      )}
    </>
  );
}
