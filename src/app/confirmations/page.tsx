
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';

import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ClipboardCheck, ExternalLink, UploadCloud, File as FileIcon, Loader2, Download } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { generateTeamCode } from '@/lib/school-utils';
import { auth, storage } from '@/lib/firebase';


// NOTE: These types and data are duplicated from the events page for this prototype.
// In a real application, this would likely come from a shared library or API.
type Player = {
  id: string;
  firstName: string;
  lastName: string;
  uscfId: string;
  uscfExpiration?: Date;
  rating?: number;
  grade: string;
  section: string;
};

const rosterPlayers: Player[] = [
    { id: "1", firstName: "Alex", lastName: "Ray", uscfId: "12345678", uscfExpiration: new Date('2025-12-31'), rating: 1850, grade: "10th Grade", section: 'High School K-12' },
    { id: "2", firstName: "Jordan", lastName: "Lee", uscfId: "87654321", uscfExpiration: new Date('2023-01-15'), rating: 2100, grade: "11th Grade", section: 'Championship' },
    { id: "3", firstName: "Casey", lastName: "Becker", uscfId: "11223344", uscfExpiration: new Date('2025-06-01'), rating: 1500, grade: "9th Grade", section: 'High School K-12' },
    { id: "4", firstName: "Morgan", lastName: "Taylor", uscfId: "NEW", rating: 1000, grade: "5th Grade", section: 'Elementary K-5' },
    { id: "5", firstName: "Riley", lastName: "Quinn", uscfId: "55667788", uscfExpiration: new Date('2024-11-30'), rating: 1980, grade: "11th Grade", section: 'Championship' },
    { id: "6", firstName: "Skyler", lastName: "Jones", uscfId: "99887766", uscfExpiration: new Date('2025-02-28'), rating: 1650, grade: "9th Grade", section: 'High School K-12' },
    { id: "7", firstName: "Drew", lastName: "Smith", uscfId: "11122233", uscfExpiration: new Date('2023-10-01'), rating: 2050, grade: "12th Grade", section: 'Championship' },
];


type PlayerRegistration = {
  byes: { round1: string; round2: string; };
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
};
type RegistrationSelections = Record<string, PlayerRegistration>;

type Confirmation = {
  id: string;
  eventName: string;
  eventDate: string;
  submissionTimestamp: string;
  selections: RegistrationSelections;
  totalInvoiced: number;
  invoiceId: string;
  invoiceUrl: string;
  teamCode: string;
  poNumber?: string;
  poFileName?: string;
  poFileUrl?: string;
};


export default function ConfirmationsPage() {
  const { toast } = useToast();
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [poInputs, setPoInputs] = useState<Record<string, { number: string; file: File | null }>>({});
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const storedConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
    storedConfirmations.sort((a: Confirmation, b: Confirmation) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime());
    setConfirmations(storedConfirmations);
  }, []);

  const getPlayerById = (id: string) => rosterPlayers.find(p => p.id === id);

  const handlePoInputChange = (confId: string, value: string) => {
    setPoInputs(prev => ({
      ...prev,
      [confId]: { ...(prev[confId] || { file: null }), number: value }
    }));
  };

  const handlePoFileChange = (confId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPoInputs(prev => ({
      ...prev,
      [confId]: { ...(prev[confId] || { number: '' }), file }
    }));
  };
  
  const handleSavePo = async (conf: Confirmation) => {
    setIsUpdating(prev => ({...prev, [conf.id]: true}));
    
    const poNumber = poInputs[conf.id]?.number !== undefined ? poInputs[conf.id].number : conf.poNumber ?? '';
    const poFile = poInputs[conf.id]?.file;

    try {
        let poFileName = conf.poFileName;
        let poFileUrl = conf.poFileUrl;
        let toastMessage = "Your changes have been saved locally.";

        // Upload new file if there is one
        if (poFile) {
            if (!storage || !auth) {
              toast({
                variant: "destructive",
                title: "Configuration Error",
                description: "Firebase Storage is not configured. Please check your .env file and restart the server.",
              });
              setIsUpdating(prev => ({...prev, [conf.id]: false}));
              return;
            }

            // Ensure user is authenticated anonymously
            if (!auth.currentUser) {
              await signInAnonymously(auth);
            }

            const storageRef = ref(storage, `purchase-orders/${conf.id}/${poFile.name}`);
            const snapshot = await uploadBytes(storageRef, poFile);
            poFileUrl = await getDownloadURL(snapshot.ref);
            poFileName = poFile.name;
        }
        
      const teamCode = conf.teamCode || generateTeamCode({ schoolName: 'SHARYLAND PIONEER H S', district: 'SHARYLAND ISD' });

      if (poNumber && teamCode) {
        const newTitle = `${teamCode} @ ${format(new Date(conf.eventDate), 'MM/dd/yyyy')} ${conf.eventName} PO: ${poNumber}`;
        await updateInvoiceTitle({ invoiceId: conf.invoiceId, title: newTitle });
        toastMessage = "Purchase Order information has been saved and the invoice has been updated.";
      }

      const updatedConfirmations = confirmations.map(c => {
        if (c.id === conf.id) {
          return {
            ...c,
            poNumber: poNumber,
            poFileName: poFileName,
            poFileUrl: poFileUrl,
            teamCode: teamCode,
          };
        }
        return c;
      });

      localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
      setConfirmations(updatedConfirmations);
      
      setPoInputs(prev => ({
        ...prev,
        [conf.id]: { number: poNumber, file: null },
      }));
      
      toast({
          title: "Success",
          description: toastMessage,
      });

    } catch (error) {
        console.error("Failed to update PO information:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: errorMessage,
        });
    } finally {
        setIsUpdating(prev => ({...prev, [conf.id]: false}));
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Registration Confirmations</h1>
          <p className="text-muted-foreground">
            A history of all your event registration submissions.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submission History</CardTitle>
            <CardDescription>Click on a submission to view its details.</CardDescription>
          </CardHeader>
          <CardContent>
            {confirmations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <ClipboardCheck className="h-12 w-12" />
                <p className="font-semibold">No Confirmations Yet</p>
                <p className="text-sm">When you register for an event, a confirmation will appear here.</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {confirmations.map((conf) => (
                  <AccordionItem key={conf.id} value={conf.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full pr-4">
                        <div className="flex flex-col items-start text-left">
                            <span className="font-semibold">{conf.eventName}</span>
                            <span className="text-sm text-muted-foreground">
                            Submitted on: {format(new Date(conf.submissionTimestamp), 'PPP p')}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold">${conf.totalInvoiced.toFixed(2)}</span>
                            <span className="text-sm text-muted-foreground block">
                                {Object.keys(conf.selections).length} Player(s)
                            </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold">Registered Players ({Object.keys(conf.selections).length})</h4>
                          <Button asChild variant="outline" size="sm">
                            <a href={conf.invoiceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" /> View Invoice on Square
                            </a>
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>USCF Status</TableHead>
                              <TableHead>Byes Requested</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(conf.selections).map(([playerId, details]) => {
                              const player = getPlayerById(playerId);
                              if (!player) return null;

                              const byeText = [details.byes.round1, details.byes.round2]
                                .filter(b => b !== 'none')
                                .map(b => `R${b}`)
                                .join(', ') || 'None';

                              return (
                                <TableRow key={playerId}>
                                  <TableCell className="font-medium">{player.firstName} {player.lastName}</TableCell>
                                  <TableCell>{details.section}</TableCell>
                                  <TableCell>
                                      <Badge variant={details.uscfStatus === 'current' ? 'default' : 'secondary'} className={details.uscfStatus === 'current' ? 'bg-green-600' : ''}>
                                          {details.uscfStatus.charAt(0).toUpperCase() + details.uscfStatus.slice(1)}
                                      </Badge>
                                  </TableCell>
                                  <TableCell>{byeText}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="space-y-4 pt-6 mt-6 border-t">
                        <h4 className="font-semibold">Purchase Order Information</h4>
                        <div className="grid md:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                                <Label htmlFor={`po-number-${conf.id}`}>PO Number</Label>
                                <Input
                                    id={`po-number-${conf.id}`}
                                    placeholder="Enter PO Number"
                                    value={poInputs[conf.id]?.number ?? conf.poNumber ?? ''}
                                    onChange={(e) => handlePoInputChange(conf.id, e.target.value)}
                                    disabled={isUpdating[conf.id]}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`po-file-${conf.id}`}>Upload PO Document</Label>
                                <Input 
                                  id={`po-file-${conf.id}`} 
                                  type="file"
                                  onChange={(e) => handlePoFileChange(conf.id, e)}
                                  disabled={isUpdating[conf.id]}
                                />
                                {poInputs[conf.id]?.file ? (
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1">
                                        <FileIcon className="h-4 w-4" />
                                        <span>Selected: {poInputs[conf.id].file.name}</span>
                                    </div>
                                ) : conf.poFileUrl && conf.poFileName ? (
                                    <div className="pt-1">
                                        <Button asChild variant="link" className="p-0 h-auto">
                                            <a href={conf.poFileUrl} target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4 w-4" /> View {conf.poFileName}
                                            </a>
                                        </Button>
                                    </div>
                                ) : null }
                            </div>
                        </div>
                        <Button 
                          onClick={() => handleSavePo(conf)} 
                          disabled={isUpdating[conf.id]}
                        >
                            {isUpdating[conf.id] ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UploadCloud className="mr-2 h-4 w-4" />
                            )}
                            Save PO & Update Invoice
                        </Button>
                      </div>

                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
