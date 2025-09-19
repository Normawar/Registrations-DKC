
'use client';

import { useState, useCallback } from 'react';
import { useMasterDb, type UploadProgress } from '@/context/master-db-context';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Check, AlertTriangle } from 'lucide-react';
import { OrganizerGuard } from '@/components/auth-guard';

function DataRepairPageContent() {
  const { bulkUpdateFromCSV } = useMasterDb();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [results, setResults] = useState<{ updated: number; created: number; errors: string[] } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setUploading(true);
    setResults(null);
    setProgress({
        stage: 'parsing',
        currentBatch: 0,
        totalBatches: 0,
        uploadedRecords: 0,
        totalRecords: 0,
        percentage: 0,
        message: 'Reading CSV file...'
    });

    try {
      const result = await bulkUpdateFromCSV(file, (progressUpdate) => {
        setProgress(progressUpdate);
      });
      setResults(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during upload';
      setResults({ updated: 0, created: 0, errors: [message] });
    } finally {
      setUploading(false);
      // Clear file input
      event.target.value = '';
    }
  };
  
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'parsing': return '📄';
      case 'uploading': return '⬆️';
      case 'complete': return '✅';
      default: return '🚀';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair Tool</h1>
          <p className="text-muted-foreground mt-2">
            Upload a CSV file to bulk-update player records in the database.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Corrected Roster</CardTitle>
            <CardDescription>
              Select the CSV file that contains the correct player data. The tool will find players by their USCF ID and update their records with the information from the file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Drag and drop your CSV file here or click to select a file.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {uploading && progress && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                      <p className="font-medium capitalize flex items-center gap-2">
                        {getStageIcon(progress.stage)} {progress.stage}
                      </p>
                      <p className="text-sm font-mono">{progress.percentage}%</p>
                  </div>
                  <Progress value={progress.percentage} />
                  <p className="text-sm text-muted-foreground">{progress.message}</p>
              </div>
            )}
            {results && !uploading && (
                <div className={`mt-6 p-4 rounded-lg border ${results.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <h4 className="font-semibold flex items-center gap-2">
                        {results.errors.length > 0 ? <AlertTriangle className="text-red-600"/> : <Check className="text-green-600"/>}
                        Repair Process Complete
                    </h4>
                    <p className="text-sm mt-2">Updated {results.updated} existing players and created {results.created} new players.</p>
                    {results.errors.length > 0 && (
                        <div className="mt-2">
                            <p className="text-sm text-red-700 font-medium">Errors:</p>
                            <pre className="text-xs bg-red-100 p-2 rounded-md max-h-32 overflow-auto mt-1">{results.errors.join('\n')}</pre>
                        </div>
                    )}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function GuardedDataRepairPage() {
    return (
        <OrganizerGuard>
            <DataRepairPageContent />
        </OrganizerGuard>
    )
}
