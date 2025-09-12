
'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, Sparkles, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data-flow';
import Image from 'next/image';

export default function AutomatedInvoiceUploaderPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ExtractInvoiceDataOutput | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(uploadedFile);
      setProcessResult(null); // Clear previous results
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleExtractAndCreate = async () => {
    if (!file || !preview) {
      toast({ variant: 'destructive', title: 'No file selected' });
      return;
    }

    setIsProcessing(true);
    setProcessResult(null);

    try {
      const result = await extractInvoiceData({ fileDataUri: preview });
      setProcessResult(result);

      if (result.success) {
        toast({
          title: "Processing Complete!",
          description: `Successfully processed ${result.processedInvoices.length} invoice(s) from the document.`,
        });
      } else {
        throw new Error(result.processedInvoices[0]?.error || 'Failed to process the document.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Processing Failed', description: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Automated Invoice Uploader</h1>
          <p className="text-muted-foreground mt-2">
            Upload an image or PDF. The AI will extract data for all invoices found, identify GT/Independent players, check for existing invoice numbers, and create or update records.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Upload Invoice Document</CardTitle>
            <CardDescription>Drag and drop a file below, or click to select a file. You can now upload PDFs with multiple invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                {isDragActive ? (
                  <p>Drop the file here...</p>
                ) : (
                  <p>Drag 'n' drop an invoice file here, or click to select</p>
                )}
                <p className="text-xs">Supports images (PNG, JPG) and PDF files.</p>
              </div>
            </div>

            {preview && file && (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">File Preview:</h4>
                <div className="border rounded-lg p-2 flex items-center gap-4">
                  {file.type.startsWith('image/') ? (
                    <Image src={preview} alt="File preview" width={80} height={80} className="object-cover rounded-md" />
                  ) : (
                    <FileText className="h-16 w-16 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Process Invoice(s)</CardTitle>
            <CardDescription>Once a file is uploaded, click the button below to let the AI extract the data and create or update records.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExtractAndCreate} disabled={!file || isProcessing}>
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Processing Document...' : 'Extract & Process Document'}
            </Button>
          </CardContent>
        </Card>

        {processResult && (
          <Card>
            <CardHeader>
                <CardTitle className={processResult.success ? "text-green-600" : "text-red-600"}>
                    {processResult.success ? `Processing Complete` : "Processing Failed"}
                </CardTitle>
                <CardDescription>Summary of the document processing operation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {processResult.processedInvoices.map((item, index) => (
                  <div key={index} className={`p-4 border rounded-lg ${item.action === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-start gap-3">
                        {item.action === 'error' ? <XCircle className="h-5 w-5 text-red-600" /> : <CheckCircle className="h-5 w-5 text-green-600" />}
                        <div className="flex-1">
                            <p className="font-semibold">Invoice #{item.invoiceNumber || `Unknown ${index + 1}`}</p>
                            {item.action !== 'error' ? (
                                <p className="text-sm">
                                    Action: <span className="capitalize font-medium">{item.action}</span> | 
                                    Players: <span className="font-medium">{item.playersAdded}</span>
                                </p>
                            ) : (
                                <p className="text-sm text-red-700">Error: {item.error}</p>
                            )}
                        </div>
                    </div>
                  </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

    