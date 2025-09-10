
'use client';

import { useState } from 'react';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MasterPlayer } from '@/lib/data/full-master-player-data';

interface LogEntry {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function DataRepairPage() {
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message }]);
  };

  const parseAndProcessData = async () => {
    if (!inputText.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Input text cannot be empty.' });
      return;
    }
    
    setIsProcessing(true);
    setLogs([]);
    addLog('info', 'Starting data processing...');

    const invoiceRegex = /for inv:([\w:-]+)/g;
    const invoices = inputText.split(invoiceRegex);
    const batch = writeBatch(db);

    let processedCount = 0;

    // The first element is the text before the first match, so we skip it.
    // We iterate in steps of 2: [invoiceId, invoiceText, invoiceId, invoiceText, ...]
    for (let i = 1; i < invoices.length; i += 2) {
        const invoiceId = `inv:${invoices[i]}`.trim();
        const invoiceText = invoices[i+1];

        if (!invoiceId || !invoiceText) continue;

        addLog('info', `Processing Invoice ID: ${invoiceId}`);
        const docRef = doc(db, 'invoices', invoiceId);
        
        try {
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                addLog('error', `Invoice ${invoiceId} not found in database. Skipping.`);
                continue;
            }

            const invoiceData = docSnap.data();
            const selections: Record<string, any> = {};
            const players: { uscfId: string, name: string }[] = [];
            
            // Regex to find player lines like "1. Esteban Garza JR (15863055)"
            const playerRegex = /\d+\.\s+([\w\s.\-ÁÉÍÓÚÑáéíóúñ'JRIII]+?)\s+\(([\w\d]+)\)/g;
            let match;
            while ((match = playerRegex.exec(invoiceText)) !== null) {
                const name = match[1].trim();
                const uscfId = match[2].trim();
                players.push({ name, uscfId });
            }

            if (players.length === 0) {
                addLog('error', `No players found in text for invoice ${invoiceId}.`);
                continue;
            }

            addLog('info', `Found ${players.length} players for invoice ${invoiceId}.`);

            const existingPlayers = new Map<string, MasterPlayer>();
            const playersCol = collection(db, 'players');
            const playerSnapshot = await getDocs(playersCol);
            playerSnapshot.forEach(doc => {
              existingPlayers.set(doc.id, doc.data() as MasterPlayer);
            });
            
            players.forEach(({ name, uscfId }) => {
                const isNew = uscfId.toLowerCase() === 'new';
                const playerId = isNew ? `temp_${name.replace(/\s+/g, '_')}` : uscfId;

                // For existing players, find their section from the master DB if possible
                const existingPlayer = existingPlayers.get(playerId);
                const section = existingPlayer?.section || 'High School K-12';
                
                // Determine USCF Status based on existing data
                const uscfStatus = isNew
                  ? 'new'
                  : (invoiceText.includes('USCF Membership') && invoiceText.includes(name))
                    ? 'renewing'
                    : 'current';

                selections[playerId] = { section, status: 'active', uscfStatus };

                // If player is 'new', we may need to create a placeholder master player doc
                if (isNew && !existingPlayer) {
                  const [firstName, ...lastNameParts] = name.split(' ');
                  const lastName = lastNameParts.join(' ');
                  const placeholderPlayer: Partial<MasterPlayer> = {
                    id: playerId,
                    uscfId: 'NEW',
                    firstName,
                    lastName,
                    school: invoiceData.schoolName,
                    district: invoiceData.district,
                    grade: 'N/A',
                    section: 'N/A',
                    email: 'placeholder@example.com',
                    zipCode: '00000',
                    events: 0,
                    eventIds: []
                  };
                  batch.set(doc(db, 'players', playerId), placeholderPlayer);
                  addLog('info', `Creating placeholder for new player: ${name}`);
                }
            });

            // Update the invoice document in the batch
            batch.update(docRef, { selections });
            addLog('success', `Successfully processed and staged updates for invoice ${invoiceId}.`);
            processedCount++;

        } catch (e: any) {
            addLog('error', `Failed to process invoice ${invoiceId}: ${e.message}`);
        }
    }

    if (processedCount > 0) {
      try {
        await batch.commit();
        addLog('success', `BATCH COMMIT COMPLETE: Successfully updated ${processedCount} invoices in the database.`);
        toast({ title: 'Update Complete', description: `${processedCount} invoices have been updated.`});
      } catch (e: any) {
        addLog('error', `FATAL: Batch commit failed: ${e.message}`);
        toast({ variant: 'destructive', title: 'Batch Commit Failed', description: 'Could not save updates to the database.'});
      }
    } else {
      addLog('info', 'No valid invoices were processed or updated.');
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
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Paste Invoice Data</CardTitle>
            <CardDescription>
              Copy the complete, raw text for one or more Square invoices into the text area below. The tool will automatically find and process each invoice.
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
          <CardFooter>
            <Button onClick={parseAndProcessData} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Process Pasted Data'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Processing Log</CardTitle>
                <CardDescription>
                    Review the logs below to see the status of the data processing.
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
                                <p className={
                                    log.type === 'success' ? 'text-green-700' :
                                    log.type === 'error' ? 'text-red-700' : 'text-blue-700'
                                }>{log.message}</p>
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

