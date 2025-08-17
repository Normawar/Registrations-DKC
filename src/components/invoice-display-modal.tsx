'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface InvoiceDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceUrl: string;
    status: string;
    totalAmount: number;
  };
  companyName: string;
  eventTitle: string;
}

export function InvoiceDisplayModal({ 
  isOpen, 
  onClose, 
  invoice, 
  companyName, 
  eventTitle 
}: InvoiceDisplayModalProps) {
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(invoice.invoiceUrl);
      toast({ title: 'Invoice URL copied to clipboard' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to copy URL' });
    }
  };

  const handleOpenExternal = () => {
    window.open(invoice.invoiceUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                Invoice #{invoice.invoiceNumber} Created Successfully
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">
                  {companyName} • {eventTitle}
                </span>
                <Badge variant={invoice.status === 'UNPAID' ? 'destructive' : 'default'}>
                  {invoice.status}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 relative">
          {!isIframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading invoice...</p>
              </div>
            </div>
          )}
          
          <iframe
            src={invoice.invoiceUrl}
            className="w-full h-[70vh] border-0"
            onLoad={() => setIsIframeLoaded(true)}
            title={`Invoice ${invoice.invoiceNumber}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
        
        <div className="p-4 border-t bg-muted/20">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Invoice Total: ${(invoice.totalAmount).toFixed(2)}</span>
            <span>Created: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}