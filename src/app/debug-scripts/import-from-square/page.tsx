
'use client';

import { useState } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Loader2, DownloadCloud } from 'lucide-react';
import { importSquareInvoices } from '@/ai/flows/import-square-invoices-flow';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function ImportFromSquarePage() {
  const { toast } = useToast();
  const [startInvoiceNumber, setStartInvoiceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    if (!startInvoiceNumber.trim()) {
      toast({ variant: 'destructive', title: 'Invalid Number', description: 'Please enter a valid starting invoice number.' });
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const result = await importSquareInvoices({ startInvoiceNumber: parseInt(startInvoiceNumber, 10) });
      setResults(result);

      if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: `Import Partially Failed`,
          description: `Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}. Check results for details.`,
          duration: 10000,
        });
      } else {
        toast({
          title: "Import Complete!",
          description: `Successfully created ${result.created} and updated ${result.updated} invoices from Square.`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Import Failed', description: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Direct Square Invoice Importer</h1>
          <p className="text-muted-foreground mt-2">
            Fetch and process invoices directly from the Square API starting from a specific invoice number.
          </p>
        </div>
        
        <Alert>
          <AlertTitle>Important Note</AlertTitle>
          <AlertDescription>
            This tool directly interacts with the Square API. It's powerful but should be used with caution. Ensure your Square credentials in the `.env` file are correct before starting.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>1. Set Starting Point</CardTitle>
            <CardDescription>Enter the first invoice number you want to start importing from. The tool will fetch all invoices with that number and higher.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="invoice-number">Starting Invoice Number</Label>
                <Input
                    id="invoice-number"
                    type="number"
                    placeholder="e.g., 4299"
                    value={startInvoiceNumber}
                    onChange={(e) => setStartInvoiceNumber(e.target.value)}
                    disabled={isProcessing}
                />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleImport} disabled={isProcessing || !startInvoiceNumber}>
              <DownloadCloud className="mr-2 h-4 w-4" />
              {isProcessing ? 'Importing from Square...' : 'Start Import'}
            </Button>
          </CardFooter>
        </Card>

        {isProcessing && !results && (
            <Card className="flex items-center justify-center p-8">
                <Loader2 className="mr-4 h-8 w-8 animate-spin" />
                <p className="text-lg">Fetching and processing invoices... This may take several minutes.</p>
            </Card>
        )}

        {results && (
          <Card>
            <CardHeader>
                <CardTitle className={results.failed > 0 ? "text-destructive" : "text-green-600"}>
                    Import Finished
                </CardTitle>
                <CardDescription>Summary of the import operation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-2 border rounded-md"><p className="text-2xl font-bold">{results.created}</p><p className="text-sm text-muted-foreground">Created</p></div>
                  <div className="p-2 border rounded-md"><p className="text-2xl font-bold">{results.updated}</p><p className="text-sm text-muted-foreground">Updated</p></div>
                  <div className="p-2 border rounded-md"><p className="text-2xl font-bold text-destructive">{results.failed}</p><p className="text-sm text-muted-foreground">Failed</p></div>
              </div>
              {results.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-destructive">Error Details:</h4>
                  <pre className="mt-2 text-xs bg-muted p-4 rounded-md max-h-48 overflow-y-auto">
                    {results.errors.join('\n')}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
