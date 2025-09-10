
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

      // --- Invoice 1 Data ---
      const invoice1Id = 'inv:0-ChBvHo9HhSLsFXoFmT96z3-wEJ8I';
      const invoice1Ref = doc(db, 'invoices', invoice1Id);
      const selectionsData1 = {
        "15863055": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "16801086": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "30299472": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "30309132": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "31488082": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "31499254": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "32046484": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" }
      };
      const updatedInvoiceData1 = {
        district: "PHARR-SAN JUAN-ALAMO ISD",
        schoolName: "PSJA COLLEGIATE SCHOOL OF HEALTH PROFESSIONS",
        purchaserName: "Ashley Rodriguez",
        purchaserEmail: "ashley.rodriguez@psjaisd.us",
        sponsorEmail: "ashley.rodriguez@psjaisd.us",
        status: "UNPAID",
        invoiceStatus: "UNPAID",
        selections: selectionsData1,
      };

      addLog(`Updating invoice ${invoice1Id}...`);
      try {
        await updateDoc(invoice1Ref, updatedInvoiceData1);
        addLog(`✅ Successfully updated invoice ${invoice1Id}.`);
      } catch (error: any) {
        addLog(`🔥 Error updating invoice ${invoice1Id}: ${error.message}`);
      }

      // --- Invoice 2 Data ---
      const invoice2Id = 'inv:0-ChAn7iUtCfPpjCRGA9NEEaE9EJ8I';
      const invoice2Ref = doc(db, 'invoices', invoice2Id);
      const selectionsData2 = {
        "30271062": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "30728191": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing", "studentType": "independent" },
        "31489716": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "31489894": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "31489934": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "32115166": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "32115265": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "32115492": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
        "temp_Aurik_Romo": { "section": "High School K-12", "status": "active", "uscfStatus": "new", "studentType": "independent" },
        "temp_Jocelyn_Snow": { "section": "High School K-12", "status": "active", "uscfStatus": "new", "studentType": "independent" }
      };
      const updatedInvoiceData2 = {
        district: "PHARR-SAN JUAN-ALAMO ISD",
        schoolName: "KENNEDY MIDDLE",
        purchaserName: "Hernan Cortez",
        purchaserEmail: "hernan.cortez@psjaisd.us",
        sponsorEmail: "hernan.cortez@psjaisd.us",
        status: "UNPAID",
        invoiceStatus: "UNPAID",
        selections: selectionsData2,
      };

      addLog(`Updating invoice ${invoice2Id}...`);
      try {
        await updateDoc(invoice2Ref, updatedInvoiceData2);
        addLog(`✅ Successfully updated invoice ${invoice2Id}.`);
      } catch (error: any) {
        addLog(`🔥 Error updating invoice ${invoice2Id}: ${error.message}`);
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
            This page runs a one-time script to correct registration data in Firestore.
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
