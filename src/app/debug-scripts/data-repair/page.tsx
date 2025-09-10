'use client';

import { useState } from 'react';
import { doc, getDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { cn } from '@/lib/utils';
import { schoolData } from '@/lib/data/school-data';
import { generateTeamCode } from '@/lib/school-utils';
import Papa from 'papaparse';

interface LogEntry {
  type: 'success' | 'error' | 'info';
  message: string;
}

// School mapping based on the team codes in the raw data
const SCHOOL_MAPPINGS = {
  'PHPCOHPROF': 'PSJA COLLEGIATE SCHOOL OF HEALTH PROFESSIONS',
  'PHKENN': 'KENNEDY MIDDLE',
  'PHASORE': 'ALFRED SORENSEN EL',
  'PHJMCKE': 'JOHN MCKEEVER EL',
  'PHGPALM': 'GERALDINE PALMER EL',
  'PHDWLONG': 'DR WILLIAM LONG EL',
  'PHACESCO': 'AIDA C ESCOBAR EL',
  'PHGGARC': 'GRACIELA GARCIA EL',
  'PHAMURP': 'AUDIE MURPHY MIDDLE',
  'PHAUST': 'AUSTIN MIDDLE',
  'PHAGARZ': 'AMANDA GARZA-PENA EL',
  'PHPTJTECOLL': 'PSJA THOMAS JEFFERSON T-STEM EARLY COLLEGE H S',
  'PHACANT': 'ARNOLDO CANTU SR EL'
};

const DISTRICT_NAME = 'PHARR-SAN JUAN-ALAMO ISD';

export default function DataRepairPage() {
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message }]);
  };

  const repairInvoiceEmailFields = async () => {
    setIsProcessing(true);
    addLog('info', 'Starting email field repair process...');
    
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersMap = new Map();
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            usersMap.set(userData.email, userData);
        });
        addLog('info', `Loaded ${usersMap.size} user profiles.`);

        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        const batch = writeBatch(db);
        let updatedCount = 0;

        invoicesSnapshot.forEach(doc => {
            const invoice = doc.data();
            const sponsorEmail = invoice.sponsorEmail || invoice.purchaserEmail;

            if (sponsorEmail && usersMap.has(sponsorEmail)) {
                const userProfile = usersMap.get(sponsorEmail);
                let needsUpdate = false;
                const updateData: any = {};

                if (!invoice.bookkeeperEmail && userProfile.bookkeeperEmail) {
                    updateData.bookkeeperEmail = userProfile.bookkeeperEmail;
                    needsUpdate = true;
                }
                if (!invoice.gtCoordinatorEmail && userProfile.gtCoordinatorEmail) {
                    updateData.gtCoordinatorEmail = userProfile.gtCoordinatorEmail;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    batch.update(doc.ref, updateData);
                    updatedCount++;
                    addLog('info', `Staged update for invoice ${doc.id} to add missing email fields.`);
                }
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            addLog('success', `Email Repair Complete: Successfully updated ${updatedCount} invoices.`);
            toast({ title: 'Repair Complete', description: `${updatedCount} invoices were updated with missing email fields.` });
        } else {
            addLog('info', 'No invoices needed email field repairs.');
            toast({ title: 'No Repairs Needed', description: 'All invoices already have the necessary email fields.' });
        }

    } catch (e: any) {
        addLog('error', `Email repair failed: ${e.message}`);
        toast({ variant: 'destructive', title: 'Repair Failed', description: e.message });
    }

    setIsProcessing(false);
  };

  const extractSchoolFromTeamCode = (invoiceText: string): { school: string; district: string } => {
    // Look for team code pattern in the invoice text
    for (const [teamCode, schoolName] of Object.entries(SCHOOL_MAPPINGS)) {
      if (invoiceText.includes(teamCode)) {
        return { school: schoolName, district: DISTRICT_NAME };
      }
    }
    
    // Fallback: try to extract from customer info
    const customerMatch = invoiceText.match(/Customer\s+([^\n]+)\n([^\/\n]+)/);
    if (customerMatch && customerMatch[2]) {
      const schoolLine = customerMatch[2].trim();
      if (schoolLine.includes('/')) {
        const parts = schoolLine.split('/');
        return { 
          school: parts[0].trim(), 
          district: parts[1] ? parts[1].trim() : DISTRICT_NAME 
        };
      }
      return { school: schoolLine, district: DISTRICT_NAME };
    }
    
    return { school: 'Unknown School', district: DISTRICT_NAME };
  };

  const parseAndProcessData = async () => {
    if (!inputText.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Input text cannot be empty.' });
      return;
    }
    
    setIsProcessing(true);
    setLogs([]);
    addLog('info', 'Starting data processing...');

    // Updated regex to handle both "for inv:" and "inv:" patterns
    const invoiceRegex = /(?:for\s+)?inv:([\w:-]+)/gi;
    const matches = [...inputText.matchAll(invoiceRegex)];
    
    if (matches.length === 0) {
      addLog('error', 'No invoice IDs found in the input text. Check the format.');
      setIsProcessing(false);
      return;
    }

    const batch = writeBatch(db);
    let processedCount = 0;
    
    // Load existing players once
    const existingPlayers = new Map<string, MasterPlayer>();
    try {
      const playersCol = collection(db, 'players');
      const playerSnapshot = await getDocs(playersCol);
      playerSnapshot.forEach(doc => {
        existingPlayers.set(doc.id, doc.data() as MasterPlayer);
      });
      addLog('info', `Loaded ${existingPlayers.size} existing players from database.`);
    } catch (error) {
      addLog('error', `Failed to load existing players: ${error}`);
      setIsProcessing(false);
      return;
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const invoiceId = `inv:${match[1]}`;
      
      // Extract text for this invoice (from this match to the next match or end of text)
      const startIndex = match.index! + match[0].length;
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : inputText.length;
      const invoiceText = inputText.substring(startIndex, endIndex);

      addLog('info', `Processing Invoice ID: ${invoiceId}`);
      
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          addLog('error', `Invoice ${invoiceId} not found in database. Skipping.`);
          continue;
        }

        const invoiceData = docSnap.data();
        const selections: Record<string, any> = {};
        const players: { name: string, uscfId: string }[] = [];
        
        // Extract school and district information
        const { school, district } = extractSchoolFromTeamCode(invoiceText);
        addLog('info', `Detected school: ${school}, district: ${district}`);
        
        // Updated regex to handle various player formats including numbers with parentheses
        const playerRegex = /(\d+)\.\s+([\w\s.\-ÁÉÍÓÚÑáéíóúñ'JRIII]+?)\s+\(([^)]+)\)/g;
        let regexMatch;
        while ((regexMatch = playerRegex.exec(invoiceText)) !== null) {
          const name = regexMatch[2].trim();
          const uscfIdRaw = regexMatch[3].trim();
          
          // Handle various USCF ID formats
          let uscfId = uscfIdRaw;
          if (uscfIdRaw.toLowerCase() === 'new' || uscfIdRaw.toLowerCase() === 'new)') {
            uscfId = 'NEW';
          }
          
          players.push({ name, uscfId });
        }

        if (players.length === 0) {
          addLog('error', `No players found in text for invoice ${invoiceId}. Raw text sample: ${invoiceText.substring(0, 200)}...`);
          continue;
        }

        addLog('info', `Found ${players.length} players for invoice ${invoiceId}: ${players.map(p => `${p.name} (${p.uscfId})`).join(', ')}`);

        // Process each player
        for (const { name, uscfId } of players) {
          const isNew = uscfId === 'NEW';
          const playerId = isNew ? `temp_${name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}` : uscfId;

          const existingPlayer = existingPlayers.get(playerId);
          
          // Determine section - default to High School K-12 for existing players, or use existing section
          const section = existingPlayer?.section || 'High School K-12';
          
          // Determine USCF status based on membership purchase
          const uscfStatus = isNew
            ? 'new'
            : (invoiceText.includes('USCF Membership') && invoiceText.toLowerCase().includes(name.toLowerCase()))
              ? 'renewing'
              : 'current';

          selections[playerId] = { 
            section, 
            status: 'active', 
            uscfStatus 
          };

          // Create placeholder for new players
          if (isNew && !existingPlayer) {
            const [firstName, ...lastNameParts] = name.split(' ');
            const lastName = lastNameParts.join(' ') || '';
            const schoolSection = 'High School K-12'; // Default section

            const placeholderPlayer: Partial<MasterPlayer> = {
              id: playerId,
              uscfId: 'NEW',
              firstName,
              lastName,
              school,
              district,
              grade: 'N/A',
              section: schoolSection, // Use school-inferred section
              email: 'placeholder@example.com',
              zipCode: '00000',
              events: 0,
              eventIds: []
            };
            
            batch.set(doc(db, 'players', playerId), placeholderPlayer);
            existingPlayers.set(playerId, placeholderPlayer as MasterPlayer); // Add to cache
            addLog('info', `Created placeholder for new player: ${name} (${playerId})`);
          }
        }

        // Update invoice with selections and school/district info
        const updateData: any = { selections };
        
        // Only update school/district if they're missing or different
        if (!invoiceData.schoolName || invoiceData.schoolName !== school) {
          updateData.schoolName = school;
          addLog('info', `Updated school name to: ${school}`);
        }
        
        if (!invoiceData.district || invoiceData.district !== district) {
          updateData.district = district;
          addLog('info', `Updated district to: ${district}`);
        }

        batch.update(docRef, updateData);
        addLog('success', `Successfully staged updates for invoice ${invoiceId} with ${players.length} players.`);
        processedCount++;

      } catch (e: any) {
        addLog('error', `Failed to process invoice ${invoiceId}: ${e.message}`);
        console.error(`Error processing invoice ${invoiceId}:`, e);
      }
    }

    // Commit all changes
    if (processedCount > 0) {
      try {
        await batch.commit();
        addLog('success', `BATCH COMMIT COMPLETE: Successfully updated ${processedCount} invoices in the database.`);
        toast({ 
          title: 'Update Complete', 
          description: `${processedCount} invoices have been updated with player selections and school information.`
        });
      } catch (e: any) {
        addLog('error', `FATAL: Batch commit failed: ${e.message}`);
        toast({ 
          variant: 'destructive', 
          title: 'Batch Commit Failed', 
          description: 'Could not save updates to the database.'
        });
      }
    } else {
      addLog('info', 'No valid invoices were processed or updated.');
      toast({ 
        variant: 'destructive', 
        title: 'No Updates', 
        description: 'No invoices were successfully processed.'
      });
    }

    setIsProcessing(false);
  };
  
    const exportCollectionData = async (collectionName: 'invoices' | 'players') => {
    setIsProcessing(true);
    addLog('info', `Exporting ${collectionName} collection...`);
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collectionName}_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog('success', `Successfully exported ${data.length} documents from ${collectionName}.`);
    } catch (e: any) {
      addLog('error', `Export failed: ${e.message}`);
    }
    setIsProcessing(false);
  };


  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair Tool</h1>
          <p className="text-muted-foreground mt-2">
            Paste raw invoice data from Square to reconcile player registrations in Firestore.
            This tool will automatically extract school information, player names, and USCF IDs.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Field Repair</CardTitle>
            <CardDescription>
              Repair missing bookkeeper and GT coordinator emails by pulling them from user profiles.
              This fixes invoices created when the automatic population wasn't working.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This will match sponsor emails to user profiles and populate missing:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
              <li>bookkeeperEmail from user profile</li>
              <li>gtCoordinatorEmail from user profile</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={repairInvoiceEmailFields} 
              disabled={isProcessing}
              variant="secondary"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Repairing...' : 'Repair Email Fields'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paste Invoice Data</CardTitle>
            <CardDescription>
              Copy the complete, raw text for one or more Square invoices into the text area below. 
              The tool will automatically find and process each invoice, extract school information,
              and create player selections with proper USCF status tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste raw text data here..."
              className="h-64 font-mono text-xs"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
            />
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={parseAndProcessData} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Process Pasted Data'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportCollectionData('invoices')}
              disabled={isProcessing}
            >
              Export Invoices
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportCollectionData('players')}
              disabled={isProcessing}
            >
              Export Players
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Log</CardTitle>
            <CardDescription>
              Review the logs below to see the status of the data processing.
              This will show which invoices were processed, what players were found,
              and any issues encountered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 h-64 overflow-y-auto bg-muted p-4 rounded-md font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Logs will appear here once processing starts.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                    {log.type === 'error' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    {log.type === 'info' && <Info className="h-4 w-4 text-blue-500 shrink-0" />}
                    <p className={cn(
                      log.type === 'success' ? 'text-green-700' :
                      log.type === 'error' ? 'text-red-700' : 'text-blue-700'
                    )}>{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}