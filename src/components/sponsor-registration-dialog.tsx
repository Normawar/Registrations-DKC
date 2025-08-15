'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { School, User, DollarSign, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format, differenceInHours, isSameDay } from "date-fns";

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
  const { database } = useMasterDb();
  const { profile } = useSponsorProfile();
  
  const [rosterPlayers, setRosterPlayers] = useState<MasterPlayer[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, { section: string; uscfStatus: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load sponsor's roster players
  useEffect(() => {
    if (profile && database.length > 0 && isOpen) {
      const sponsorPlayers = database.filter(p => 
        p.district === profile.district && p.school === profile.school
      );
      setRosterPlayers(sponsorPlayers);
    }
  }, [profile, database, isOpen]);
  
  // Load existing registrations
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
      confirmation.eventId === event?.id && 
      confirmation.selections && 
      confirmation.selections[student.id]
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

  // Calculate fees with breakdown
  const calculateFeeBreakdown = () => {
    if (!event) return { registrationFees: 0, lateFees: 0, uscfFees: 0, total: 0 };
    
    // Calculate current registration fee based on timing
    let registrationFeePerPlayer = event.regularFee;
    const eventDate = new Date(event.date);
    const now = new Date();
    
    if (isSameDay(eventDate, now)) {
      registrationFeePerPlayer = event.dayOfFee || event.regularFee;
    } else {
      const hoursUntilEvent = differenceInHours(eventDate, now);
      if (hoursUntilEvent <= 24) {
        registrationFeePerPlayer = event.veryLateFee || event.regularFee;
      } else if (hoursUntilEvent <= 48) {
        registrationFeePerPlayer = event.lateFee || event.regularFee;
      }
    }
    
    const selectedCount = Object.keys(selectedStudents).length;
    const lateFeePerPlayer = registrationFeePerPlayer - event.regularFee;
    const uscfCount = Object.values(selectedStudents).filter(s => s.uscfStatus !== 'current').length;
    const uscfFee = 24;
    
    return {
      registrationFees: selectedCount * event.regularFee,
      lateFees: selectedCount * lateFeePerPlayer,
      uscfFees: uscfCount * uscfFee,
      total: (selectedCount * registrationFeePerPlayer) + (uscfCount * uscfFee),
      feeType: lateFeePerPlayer > 0 ? (
        isSameDay(eventDate, now) ? 'Day-of Registration' :
        differenceInHours(eventDate, now) <= 24 ? 'Very Late Registration' :
        'Late Registration'
      ) : 'Regular Registration'
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
    if (!profile || !event) return;

    setIsSubmitting(true);

    try {
      // Import the createInvoice function
      const { createInvoice } = await import('@/ai/flows/create-invoice-flow');
      
      // Calculate current registration fee based on timing
      let registrationFeePerPlayer = event.regularFee;
      const eventDate = new Date(event.date);
      const now = new Date();
      const hoursUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      if (hoursUntilEvent <= 0) {
        registrationFeePerPlayer = event.dayOfFee || event.regularFee;
      } else if (hoursUntilEvent <= 24) {
        registrationFeePerPlayer = event.veryLateFee || event.regularFee;
      } else if (hoursUntilEvent <= 48) {
        registrationFeePerPlayer = event.lateFee || event.regularFee;
      }

      // Prepare players for invoice
      const playersToInvoice = Object.entries(selectedStudents).map(([playerId, details]) => {
        const student = rosterPlayers.find(p => p.id === playerId);
        const lateFeeAmount = registrationFeePerPlayer - event.regularFee;
        
        return {
          playerName: `${student?.firstName} ${student?.lastName}`,
          uscfId: student?.uscfId || '',
          baseRegistrationFee: event.regularFee,
          lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
          uscfAction: details.uscfStatus !== 'current',
        };
      });

      const uscfFee = 24;
      
      // Generate team code from profile
      const teamCode = `${profile.school.split(' ').map(word => word.charAt(0)).join('').toUpperCase()}${profile.district.split(' ').map(word => word.charAt(0)).join('').toUpperCase()}`.substring(0, 6);

      // Create the Square invoice
      const result = await createInvoice({
        sponsorName: `${profile.firstName} ${profile.lastName}`,
        sponsorEmail: profile.email || '',
        schoolName: profile.school,
        teamCode: teamCode,
        eventName: event.name,
        eventDate: event.date,
        uscfFee,
        players: playersToInvoice
      });

      console.log('Invoice creation result:', result);

      // Create confirmation record
      const newConfirmation = {
        id: result.invoiceId,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        submissionTimestamp: new Date().toISOString(),
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
        schoolName: profile.school,
        district: profile.district,
        teamCode: teamCode,
        selections: Object.fromEntries(
          Object.entries(selectedStudents).map(([playerId, details]) => [
            playerId,
            {
              ...details,
              status: 'active'
            }
          ])
        ),
        totalInvoiced: feeBreakdown.total,
        invoiceStatus: result.status,
        invoiceUrl: result.invoiceUrl || result.publicUrl,
        purchaserName: `${profile.firstName} ${profile.lastName}`
      };

      // Save to localStorage
      const existingConfirmations = localStorage.getItem('confirmations');
      const allConfirmations = existingConfirmations ? JSON.parse(existingConfirmations) : [];
      allConfirmations.push(newConfirmation);
      localStorage.setItem('confirmations', JSON.stringify(allConfirmations));
      
      const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
      localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, newConfirmation]));
      
      // Determine which URL to use for opening the invoice
      const invoiceUrl = result.invoiceUrl || result.publicUrl || result.public_url;
      
      console.log('Invoice creation result details:', {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        status: result.status,
        invoiceUrl: invoiceUrl,
        allFields: Object.keys(result)
      });
      
      if (invoiceUrl) {
        toast({
          title: "Invoice Generated Successfully!",
          description: `Invoice ${result.invoiceNumber} for ${Object.keys(selectedStudents).length} students has been created. Opening invoice...`
        });
        
        console.log('Attempting to open invoice URL:', invoiceUrl);
        
        // Try multiple approaches to open the invoice
        let opened = false;
        
        try {
          // Method 1: Direct window.open (works best if called immediately after user action)
          const newWindow = window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
          
          if (newWindow && !newWindow.closed) {
            console.log('Invoice opened successfully with window.open');
            opened = true;
          } else {
            console.warn('window.open was blocked or failed');
          }
        } catch (error) {
          console.error('window.open failed:', error);
        }
        
        if (!opened) {
          // Method 2: Create a temporary link and click it programmatically
          try {
            const link = document.createElement('a');
            link.href = invoiceUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log('Invoice opened using temporary link method');
            opened = true;
          } catch (error) {
            console.error('Temporary link method failed:', error);
          }
        }
        
        if (!opened) {
          // Method 3: Show a manual link if both automated methods fail
          console.warn('All automated methods failed, showing manual link');
          
          // Update the toast to show a clickable link
          setTimeout(() => {
            toast({
              title: "Invoice Ready - Click to Open",
              description: (
                <div className="space-y-3">
                  <p className="text-sm">Invoice {result.invoiceNumber} is ready for payment.</p>
                  <a 
                    href={invoiceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 transition-colors"
                    onClick={(e) => {
                      console.log('Manual link clicked:', invoiceUrl);
                      // Let the default behavior handle the link
                    }}
                  >
                    Open Invoice to Pay →
                  </a>
                  <div className="text-xs text-muted-foreground">
                    <p>If the link doesn't work, copy this URL:</p>
                    <code className="bg-muted px-1 rounded text-xs break-all">{invoiceUrl}</code>
                  </div>
                </div>
              ),
              duration: 15000, // Show for 15 seconds
            });
          }, 1000);
        }
        
        // Also try to copy URL to clipboard as backup
        try {
          await navigator.clipboard.writeText(invoiceUrl);
          console.log('Invoice URL copied to clipboard:', invoiceUrl);
        } catch (clipboardError) {
          console.warn('Could not copy to clipboard:', clipboardError);
        }
        
      } else {
        console.warn('No invoice URL available in result:', result);
        
        toast({
          title: "Invoice Created Successfully!",
          description: `Invoice ${result.invoiceNumber} has been created. Please check your email for the payment link or contact support with invoice number ${result.invoiceNumber}.`
        });
      }
      
      // Reset and close
      setSelectedStudents({});
      setShowConfirmation(false);
      onOpenChange(false);
      
      // Trigger storage event to update other components
      window.dispatchEvent(new Event('storage'));
      
    } catch (error) {
      console.error('Registration failed:', error);
      const description = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        variant: 'destructive',
        title: "Invoice Creation Failed",
        description: description
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToSelection = () => {
    setShowConfirmation(false);
  };

  if (!event) return null;

  return (
    <>
      {/* Main Registration Dialog */}
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
            <p className="text-sm text-muted-foreground">
              {format(new Date(event.date), 'PPP')} • {event.location}
            </p>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto pr-6 -mr-6">
            {rosterPlayers.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Students in Roster</p>
                <p>Add students to your roster first before registering for events.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <h3 className="text-lg font-semibold">Select Students to Register</h3>
                
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Registration & Charges</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Review the total charges for {event.name} before creating your invoice.
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selected Students Summary */}
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

            {/* Fee Breakdown */}
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
                    <span>USCF Fees ({Object.values(selectedStudents).filter(s => s.uscfStatus !== 'current').length} × $24)</span>
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
              {isSubmitting ? 'Creating Invoice...' : `Create Invoice (${feeBreakdown.total.toFixed(2)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}