
'use client';

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function ManualInvoiceUpdatePage() {
  const [status, setStatus] = useState('pending');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const runUpdate = async () => {
      if (status !== 'pending' || !db) return;

      setStatus('running');
      const newLogs: string[] = [];

      const addLog = (message: string) => {
        console.log(message);
        newLogs.push(message);
        setLogs([...newLogs]);
      };

      // --- Invoice 4304 Data ---
      const invoiceId = 'inv:0-ChCmSldsxygecLHLDtuGWraXEJ8I';
      const invoiceRef = doc(db, 'invoices', invoiceId);
      
      const selectionsData = {
        "31498736": { "section": "High School K-12", "status": "active", "uscfStatus": "current" },
        "32052839": { "section": "High School K-12", "status": "active", "uscfStatus": "current" },
        "32052866": { "section": "High School K-12", "status": "active", "uscfStatus": "current" },
        "32052881": { "section": "High School K-12", "status": "active", "uscfStatus": "current" },
        "temp_Mia_Monrreal": { "section": "High School K-12", "status": "active", "uscfStatus": "new" },
        "temp_Diego_Cortes": { "section": "High School K-12", "status": "active", "uscfStatus": "new" },
        "temp_Ryan_Garcia": { "section": "High School K-12", "status": "active", "uscfStatus": "new" },
        "temp_Liam_Madrigal": { "section": "High School K-12", "status": "active", "uscfStatus": "new" }
      };

      const updatedInvoiceData = {
        district: "PHARR-SAN JUAN-ALAMO ISD",
        schoolName: "DR WILLIAM LONG EL",
        purchaserName: "Yeimi Garcia",
        purchaserEmail: "yeimi.garcia@psjaisd.us",
        sponsorEmail: "yeimi.garcia@psjaisd.us",
        status: "UNPAID",
        invoiceStatus: "UNPAID",
        selections: selectionsData,
      };

      addLog(`Updating invoice ${invoiceId} (#4304)...`);
      try {
        await updateDoc(invoiceRef, updatedInvoiceData);
        addLog(`✅ Successfully updated invoice ${invoiceId}.`);
      } catch (error: any) {
        addLog(`🔥 Error updating invoice ${invoiceId}: ${error.message}`);
      }

      addLog("--- Update script finished ---");
      setStatus('complete');
    };

    runUpdate();
  }, [status]);

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Manual Invoice Data Update</h1>
          <p className="text-muted-foreground mt-2">
            This page runs a one-time script to correct registration data for invoice #4304 in Firestore.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'pending' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting to start...
              </div>
            )}
            {status === 'running' && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running update script...
              </div>
            )}
            {status === 'complete' && (
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <p>✅ Update Complete!</p>
              </div>
            )}
            <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto h-64">
              {logs.length > 0 ? logs.join('\n') : 'Script has not run yet.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
