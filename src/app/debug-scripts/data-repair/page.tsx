
'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, Sparkles, AlertTriangle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data-flow';
import Image from 'next/image';

export default function AutomatedInvoiceUploaderPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(uploadedFile);
      setExtractedData(null); // Clear previous results
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
    setExtractedData(null);

    try {
      const result = await extractInvoiceData({ fileDataUri: preview });
      setExtractedData(result);

      if (result.success) {
        toast({
          title: `Invoice ${result.action === 'updated' ? 'Updated' : 'Created'} Successfully!`,
          description: `Invoice #${result.invoiceNumber} processed for ${result.playersAdded} players.`,
        });
      } else {
        throw new Error(result.error || 'Failed to process the invoice.');
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
            Upload an image or PDF of an invoice. The AI will extract the data, check for an existing invoice number, and either create a new invoice or override an existing one.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Upload Invoice Document</CardTitle>
            <CardDescription>Drag and drop an image or PDF file below, or click to select a file.</CardDescription>
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
            <CardTitle>2. Process Invoice</CardTitle>
            <CardDescription>Once a file is uploaded, click the button below to let the AI extract the data and create or update the records.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExtractAndCreate} disabled={!file || isProcessing}>
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Processing Invoice...' : 'Extract & Process Invoice'}
            </Button>
          </CardContent>
        </Card>

        {extractedData && (
          <Card>
            <CardHeader>
                <CardTitle className={extractedData.success ? "text-green-600" : "text-red-600"}>
                    {extractedData.success ? `Processing Complete: Invoice ${extractedData.action}` : "Processing Failed"}
                </CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-xs space-y-2 bg-muted p-4 rounded-lg">
                <p><strong>Success:</strong> {String(extractedData.success)}</p>
                {extractedData.success ? (
                    <>
                        <p><strong>Action:</strong> {extractedData.action}</p>
                        <p><strong>New Invoice ID:</strong> {extractedData.invoiceId}</p>
                        <p><strong>Invoice Number:</strong> {extractedData.invoiceNumber}</p>
                        <p><strong>Players Processed:</strong> {extractedData.playersAdded}</p>
                    </>
                ) : (
                    <p><strong>Error:</strong> {extractedData.error}</p>
                )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
