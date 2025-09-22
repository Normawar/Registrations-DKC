
'use client';

import { useState, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Download, Upload, GitCompareArrows } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { generateTeamCode } from '@/lib/school-utils';
import { Input } from '@/components/ui/input';

type UploadedPlayer = {
  Name: string;
  USCF: string;
  'POSSIBLE TEAM': string;
  GRADE: string;
};

type MatchedPlayer = UploadedPlayer & {
  firebaseUsdId: string;
  firebaseGrade: string;
  firebaseTeam: string;
  matchStatus: 'found_by_id' | 'found_by_name' | 'not_found' | 'multiple_found';
};

function UscfCrossReferencePageContent() {
  const { database: allPlayers, isDbLoaded } = useMasterDb();
  const { toast } = useToast();
  const [uploadedData, setUploadedData] = useState<UploadedPlayer[]>([]);
  const [matchedData, setMatchedData] = useState<MatchedPlayer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadedData([]);
    setMatchedData([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as UploadedPlayer[];
        setUploadedData(parsedData);
        crossReferenceData(parsedData);
      },
      error: (error) => {
        toast({
          variant: 'destructive',
          title: 'File Parse Error',
          description: error.message,
        });
        setIsProcessing(false);
      },
    });
  };

  const crossReferenceData = (data: UploadedPlayer[]) => {
    const playerMapById = new Map<string, MasterPlayer>();
    allPlayers.forEach(p => {
      if (p.uscfId && p.uscfId !== 'NEW') {
        playerMapById.set(p.uscfId, p);
      }
    });

    const newMatchedData = data.map((row): MatchedPlayer => {
      const uscfId = row.USCF?.trim();
      
      // 1. Try to match by USCF ID first (highest accuracy)
      if (uscfId) {
        const firebasePlayer = playerMapById.get(uscfId);
        if (firebasePlayer) {
          return {
            ...row,
            firebaseUsdId: firebasePlayer.uscfId,
            firebaseGrade: firebasePlayer.grade || 'Not Set',
            firebaseTeam: generateTeamCode(firebasePlayer),
            matchStatus: 'found_by_id',
          };
        }
      }

      // 2. If no USCF ID match, try to match by name flexibly
      const rawName = row.Name?.trim().toLowerCase();
      if (rawName) {
        const nameParts = rawName.split(/\s+/).filter(Boolean);
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];

          // Find players where both first and last names appear in their full name
          const potentialMatches = allPlayers.filter(p => {
            const playerFullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
            return playerFullName.includes(firstName) && playerFullName.includes(lastName);
          });

          if (potentialMatches.length === 1) {
            // Found a single, unique match by name
            const firebasePlayer = potentialMatches[0];
            return {
              ...row,
              firebaseUsdId: firebasePlayer.uscfId,
              firebaseGrade: firebasePlayer.grade || 'Not Set',
              firebaseTeam: generateTeamCode(firebasePlayer),
              matchStatus: 'found_by_name',
            };
          } else if (potentialMatches.length > 1) {
            // Multiple matches found for the same name, flag for manual review
             return {
              ...row,
              firebaseUsdId: 'Multiple Matches',
              firebaseGrade: 'N/A',
              firebaseTeam: 'N/A',
              matchStatus: 'multiple_found',
            };
          }
        }
      }

      // 3. If no match found by ID or name
      return {
        ...row,
        firebaseUsdId: 'Not Found',
        firebaseGrade: 'N/A',
        firebaseTeam: 'N/A',
        matchStatus: 'not_found',
      };
    });

    setMatchedData(newMatchedData);
    setIsProcessing(false);
    toast({
      title: 'Cross-Reference Complete',
      description: `Found unique matches for ${newMatchedData.filter(p => p.matchStatus === 'found_by_id' || p.matchStatus === 'found_by_name').length} out of ${newMatchedData.length} players.`,
    });
  };

  const handleExport = () => {
    if (matchedData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'Please upload and process a file first.',
      });
      return;
    }
    const dataToExport = matchedData.map(p => ({
        'Name': p.Name,
        'USCF': p.USCF,
        'POSSIBLE TEAM': p['POSSIBLE TEAM'],
        'GRADE': p.GRADE,
        'FIREBASE USCF ID': p.firebaseUsdId,
        'FIREBASE GRADE': p.firebaseGrade,
        'FIREBASE TEAM': p.firebaseTeam,
        'MATCH STATUS': p.matchStatus,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `cross_reference_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: MatchedPlayer['matchStatus']) => {
    switch(status) {
        case 'found_by_id': return 'bg-green-50 text-green-800';
        case 'found_by_name': return 'bg-blue-50 text-blue-800';
        case 'multiple_found': return 'bg-yellow-50 text-yellow-800';
        case 'not_found': return 'bg-red-50 text-red-800';
        default: return '';
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-headline">USCF Cross-Reference Report</h1>
          <p className="text-muted-foreground">
            Upload a CSV file to find matching player data from Firebase.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={matchedData.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Data File</CardTitle>
          <CardDescription>
            Select a CSV file with columns "Name", "USCF", "POSSIBLE TEAM", and "GRADE". The tool will fill in the Firebase columns.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing || !isDbLoaded}
                className="max-w-md"
            />
            {!isDbLoaded && <p className="text-sm text-amber-600 mt-2">Waiting for player database to load...</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cross-Reference Results</CardTitle>
          <CardDescription>
            {isProcessing ? 'Processing file...' : `Showing ${matchedData.length} records.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>USCF ID (Sheet)</TableHead>
                  <TableHead>Grade (Sheet)</TableHead>
                  <TableHead>Firebase Grade</TableHead>
                  <TableHead>Firebase Team Code</TableHead>
                  <TableHead>Match Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isProcessing ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Processing...</TableCell></TableRow>
                ) : matchedData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">Upload a file to see results.</TableCell></TableRow>
                ) : (
                  matchedData.map((player, index) => (
                    <TableRow key={index} className={getStatusColor(player.matchStatus)}>
                      <TableCell>{player.Name}</TableCell>
                      <TableCell>{player.USCF}</TableCell>
                      <TableCell>{player.GRADE}</TableCell>
                      <TableCell className="font-medium">{player.firebaseGrade}</TableCell>
                      <TableCell className="font-mono font-medium">{player.firebaseTeam}</TableCell>
                      <TableCell className="font-medium capitalize">
                        {player.matchStatus.replace(/_/g, ' ')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UscfCrossReferencePage() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <UscfCrossReferencePageContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
