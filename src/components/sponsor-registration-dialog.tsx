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
import { School, User, DollarSign, CheckCircle } from "lucide-react";
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

  const calculateTotal = () => {
    if (!event) return 0;
    const uscfFee = 24;
    return Object.entries(selectedStudents).reduce((total, [, details]) => {
      let playerTotal = event.regularFee;
      if (details.uscfStatus === 'new' || details.uscfStatus === 'renewing') {
        playerTotal += uscfFee;
      }
      return total + playerTotal;
    }, 0);
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

    if (!profile || !event) return;

    setIsSubmitting(true);

    try {
      // Import the createInvoice function
      const { createInvoice } = await import('@/ai/flows/create-invoice-flow');
      
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
        totalInvoiced: calculateTotal(),
        invoiceStatus: result.status,
        invoiceUrl: result.invoiceUrl,
        purchaserName: `${profile.firstName} ${profile.lastName}`
      };

      // Save to localStorage
      const existingConfirmations = localStorage.getItem('confirmations');
      const allConfirmations = existingConfirmations ? JSON.parse(existingConfirmations) : [];
      allConfirmations.push(newConfirmation);
      localStorage.setItem('confirmations', JSON.stringify(allConfirmations));
      
      const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
      localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, newConfirmation]));
      
      toast({
        title: "Invoice Generated Successfully!",
        description: `Invoice ${result.invoiceNumber} for ${Object.keys(selectedStudents).length} students has been created. Check your email for payment instructions.`
      });
      
      // Reset and close
      setSelectedStudents({});
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

  if (!event) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                {calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={Object.keys(selectedStudents).length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Creating Invoice...' : `Create Invoice for ${Object.keys(selectedStudents).length} Student(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
