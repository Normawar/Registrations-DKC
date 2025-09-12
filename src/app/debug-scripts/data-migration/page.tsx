
'use client';

import { useState, useEffect } from 'react';
import { doc, writeBatch, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { correctedData } from '@/lib/data/migration-data';


export default function DataMigrationPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const runMigration = async () => {
    setIsProcessing(true);
    setLogs([]);
    const addLog = (message: string) => setLogs(prev => [...prev, message]);

    if (!db) {
      addLog("❌ Firestore DB is not initialized. Aborting.");
      setIsProcessing(false);
      return;
    }
    
    addLog("🚀 Starting data migration process...");

    try {
        const batch = writeBatch(db);
        let playersToUpdate = 0;
        let invoicesToUpdate = 0;

        // Group players by invoice number
        const invoices: Record<string, any[]> = {};
        correctedData.forEach(row => {
            const invoiceNum = row.invoiceNumber || `temp-${Date.now()}`;
            if (!invoices[invoiceNum]) {
                invoices[invoiceNum] = [];
            }
            invoices[invoiceNum].push(row);
        });

        addLog(`📄 Found ${Object.keys(invoices).length} unique invoices to process.`);

        for (const invoiceNumber in invoices) {
            const players = invoices[invoiceNumber];
            const firstPlayer = players[0];
            const invoiceId = `inv_migrated_${invoiceNumber}_${Date.now()}`;
            const selections: Record<string, any> = {};

            addLog(`--- Processing Invoice #${invoiceNumber} ---`);

            for (const player of players) {
                const playerId = player.uscfId || `temp_${player.studentName?.replace(/\s+/g, '_')}`;
                if (!playerId) continue;

                // Prepare player data for 'players' collection
                const [firstName, ...lastNameParts] = (player.studentName || 'Unknown').split(' ');
                const lastName = lastNameParts.join(' ') || '';
                
                const playerData: Partial<MasterPlayer> = {
                    id: playerId,
                    uscfId: player.uscfId,
                    firstName: firstName,
                    lastName: lastName,
                    studentType: player.studentType === 'GT' ? 'gt' : 'independent',
                    school: player.school,
                    district: player.district,
                    email: player.email || '',
                    phone: player.phone || '',
                };

                const playerRef = doc(db, 'players', playerId);
                batch.set(playerRef, removeUndefined(playerData), { merge: true });
                playersToUpdate++;
                
                // Prepare selections for invoice
                selections[playerId] = {
                    section: 'High School K-12', // Default section
                    status: 'active',
                    uscfStatus: player.uscfFee > 0 ? 'new' : 'current',
                };
            }
            
            // Prepare invoice data for 'invoices' collection
            const invoiceData = {
                id: invoiceId,
                invoiceId: invoiceId,
                invoiceNumber: invoiceNumber,
                type: 'event',
                eventName: 'Liberty MS (PSJA students only) on September 13th, 2025',
                eventDate: new Date('2025-09-13T00:00:00.000Z').toISOString(),
                submissionTimestamp: new Date().toISOString(),
                purchaserName: firstPlayer.customer || 'Sponsor PSJA',
                sponsorEmail: firstPlayer.email,
                schoolName: firstPlayer.school,
                district: firstPlayer.district,
                bookkeeperEmail: firstPlayer.bookkeeper,
                gtCoordinatorEmail: firstPlayer.gtCoordinator,
                status: firstPlayer.status || 'UNPAID',
                invoiceStatus: firstPlayer.status || 'UNPAID',
                selections: selections,
                totalInvoiced: players.reduce((sum, p) => sum + p.total, 0),
            };

            const invoiceRef = doc(db, 'invoices', invoiceId);
            batch.set(invoiceRef, removeUndefined(invoiceData));
            invoicesToUpdate++;
            addLog(`✅ Staged invoice #${invoiceNumber} with ${Object.keys(selections).length} players.`);
        }

        addLog(`\n🔄 Committing ${playersToUpdate} player updates and ${invoicesToUpdate} invoice updates to the database...`);
        await batch.commit();

        addLog(`\n🎉 --- MIGRATION COMPLETE ---`);
        addLog(`Updated/Created ${playersToUpdate} player records.`);
        addLog(`Updated/Created ${invoicesToUpdate} invoice records.`);
        toast({ title: 'Migration Complete', description: 'Data has been successfully saved to Firestore.' });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        addLog(`❌ FATAL ERROR during migration: ${errorMessage}`);
        console.error(error);
        toast({ variant: 'destructive', title: 'Migration Failed', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">CSV Data Migration Tool</h1>
          <p className="text-muted-foreground mt-2">
            This tool will process the hardcoded CSV data and update the Firestore database.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Data Migration</CardTitle>
            <CardDescription>
              Click the button below to start the one-time migration process. This will update the 'players' and 'invoices' collections based on the provided CSV data.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <button
              onClick={runMigration}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Migrating Data...' : 'Start Migration'}
            </button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Migration Log</CardTitle>
            <CardDescription>
              Follow the progress of the data migration below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 h-64 overflow-y-auto bg-muted p-4 rounded-md font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Logs will appear here once the migration starts.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <p className={cn(log.startsWith('❌') ? 'text-red-700' : 'text-green-700')}>{log}</p>
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

// Helper to remove undefined values for Firebase
const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    if (typeof obj === 'object') {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
                cleaned[key] = removeUndefined(obj[key]);
            }
        });
        return cleaned;
    }
    return obj;
};
