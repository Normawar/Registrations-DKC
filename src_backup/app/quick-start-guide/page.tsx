
'use client';

import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Users, Calendar, Receipt, FileQuestion, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Component for handling image errors with fallback
const GuideImage = ({ src, alt, width, height, className, ...props }: any) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (error) {
    return (
      <div
        className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center`}
        style={{ width, height }}
      >
        <div className="text-center p-4">
          <p className="text-sm text-gray-500 mb-2">Image not available</p>
          <p className="text-xs text-gray-400">{alt}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative page-break-avoid">
      {loading && (
        <div
          className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center"
          style={{ width, height }}
        >
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        onLoad={() => setLoading(false)}
        {...props}
      />
    </div>
  );
};

export default function QuickStartGuidePage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [openAccordionItems, setOpenAccordionItems] = useState(['item-1']);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);

    try {
      const originalState = [...openAccordionItems];
      
      // Expand all accordion items first
      setOpenAccordionItems(['item-1', 'item-2', 'item-3', 'item-4']);
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Correct Firebase Storage URLs with proper tokens
      const imageUrls = {
        roster: "https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1h.png?alt=media&token=d5caad84-adad-41e3-aa27-ce735ab3c6fd",
        eventList: "https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1k.png?alt=media&token=3ae8d3de-6956-4886-980c-4af456ddf6ac",
        registrationDialog: "https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1L.png?alt=media&token=1d074a8e-9c30-4327-9e1e-483a30988f56",
        invoiceDetails: "https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1p.png?alt=media&token=7a9e0a18-3a9d-42a5-9bb0-e3f873815d16",
        invoicePayment: "https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1q.png?alt=media&token=358d7596-a152-4980-89fb-152eaac99f39"
      };

      // Convert images to data URLs
      const convertImageToDataUrl = async (url: string, name: string) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error(`Failed to convert ${name}:`, error);
          return null;
        }
      };

      const [rosterData, eventData, dialogData, invoiceData, paymentData] = await Promise.all([
        convertImageToDataUrl(imageUrls.roster, 'roster'),
        convertImageToDataUrl(imageUrls.eventList, 'eventList'),
        convertImageToDataUrl(imageUrls.registrationDialog, 'registrationDialog'),
        convertImageToDataUrl(imageUrls.invoiceDetails, 'invoiceDetails'),
        convertImageToDataUrl(imageUrls.invoicePayment, 'invoicePayment')
      ]);

      const pdf = new jsPDF('portrait', 'pt', 'a4');
      let currentPage = 0;

      const captureSection = async (htmlContent: string, isFirstSection = false) => {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = htmlContent;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '800px';
        tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        tempContainer.style.backgroundColor = 'white';
        tempContainer.style.padding = '20px';
        tempContainer.style.lineHeight = '1.4';
        tempContainer.style.boxSizing = 'border-box';
        document.body.appendChild(tempContainer);
        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = await html2canvas(tempContainer, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          height: tempContainer.scrollHeight,
          width: tempContainer.scrollWidth,
          logging: false,
        });

        document.body.removeChild(tempContainer);

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const margin = 40;
        const contentWidth = pdfWidth - (margin * 2);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = contentWidth / imgWidth;
        const scaledHeight = imgHeight * ratio;

        if (!isFirstSection) {
          pdf.addPage();
          currentPage++;
        }

        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, scaledHeight);
      };

      const createImageHtml = (dataUrl: string | null, altText: string, placeholder: string) => {
        if (dataUrl) {
          return `<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;"><img src="${dataUrl}" alt="${altText}" style="width: 100%; max-width: 400px; height: auto; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>`;
        } else {
          return `<div style="text-align: center; color: #9ca3af; padding: 8px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 4px; margin: 8px 0; font-size: 11px;">📷 ${placeholder}</div>`;
        }
      };

      const section1Html = `
        <div>
          <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #1f2937;">Sponsor Quick Start Guide</h1>
          <p style="color: #6b7280; margin-bottom: 24px; font-size: 16px;">Welcome to ChessMate! This guide will walk you through the essential steps to get started.</p>
          <div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 6px;">
            <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px; color: #1f2937;">First Things First: Your Roster</h3>
            <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the Roster page to get started.</p>
          </div>
          <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">1</span> Step 1: Managing Your Roster</h2>
          <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Adding a Player to Your Roster</h3>
            <p style="font-size: 13px; margin-bottom: 8px; line-height: 1.5;"><strong>1.</strong> Navigate to the <strong>Roster</strong> page from the sidebar. You will see your team information and an empty roster list.</p>
            ${createImageHtml(rosterData as string | null, 'Team Roster page', 'Roster screenshot here')}
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>2.</strong> Click <strong>Add from Database</strong> to search for existing players or <strong>Create New Player</strong> to add a student.</p>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Use filters to find players by name, USCF ID, school, or district.</p>
            <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>4.</strong> Click <strong>Select</strong> and fill in any missing information. The player will be added to your roster.</p>
          </div>
        </div>`;
      await captureSection(section1Html, true);

      const section2Html = `
        <div>
          <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">2</span> Step 2: Registering for an Event</h2>
          <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">Once your roster is set, you can register your selected players for any open tournament.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Event Registration Process</h3>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>1.</strong> Go to the <strong>Dashboard</strong> or <strong>Register for Event</strong> page.</p>
            <p style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;"><strong>2.</strong> Find an upcoming event and click the <strong>Register Students</strong> button.</p>
            ${createImageHtml(eventData as string | null, 'Event registration page', 'Event screenshot here')}
            ${createImageHtml(dialogData as string | null, 'Registration dialog', 'Dialog screenshot here')}
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Select the players you wish to register for this event.</p>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>4.</strong> Confirm their <strong>Section</strong> and <strong>USCF Status</strong>.</p>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>5.</strong> Click <strong>Review Charges</strong> to see fees.</p>
            <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>6.</strong> Click <strong>Register Now</strong> to complete registration.</p>
          </div>
        </div>`;
      await captureSection(section2Html);

      const section3Html = `
        <div>
          <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">3</span> Step 3: Handling Invoices</h2>
          <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">After registering, you can view and manage all your invoices from one place.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Viewing and Paying Invoices</h3>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>1.</strong> Navigate to the <strong>Invoices & Payments</strong> page from the sidebar.</p>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>2.</strong> You will see a list of all your invoices and their current status (Paid, Unpaid, Canceled).</p>
            <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Click <strong>Details</strong> to view a specific invoice and see registered players.</p>
            <p style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;"><strong>4.</strong> For payment, click <strong>View Invoice on Square</strong> for credit card, or use offline methods (PO, Check, CashApp, Zelle).</p>
            ${createImageHtml(invoiceData as string | null, 'Invoice details', 'Invoice screenshot here')}
            ${createImageHtml(paymentData as string | null, 'Payment options', 'Payment screenshot here')}
            <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>5.</strong> If paying offline, select payment method, fill in details (PO/check number), upload proof, and click <strong>Submit Payment Information</strong> for review.</p>
          </div>
        </div>`;
      await captureSection(section3Html);

      const section4Html = `
        <div>
          <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">4</span> Need More Help?</h2>
          <p style="margin-bottom: 24px; font-size: 14px; line-height: 1.5;">For more detailed instructions on every feature, please visit our new <strong>Help Center</strong>.</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; background: #f8fafc;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #1f2937;">Additional Resources</h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
              <li style="margin-bottom: 8px; font-size: 14px;">Complete step-by-step tutorials for each feature</li>
              <li style="margin-bottom: 8px; font-size: 14px;">Frequently asked questions and troubleshooting</li>
              <li style="margin-bottom: 8px; font-size: 14px;">Video guides for complex processes</li>
              <li style="margin-bottom: 0; font-size: 14px;">Contact information for technical support</li>
            </ul>
          </div>
        </div>`;
      await captureSection(section4Html);

      pdf.save('ChessMate_Quick_Start_Guide.pdf');
      setOpenAccordionItems(originalState);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert(`Sorry, there was an error generating the PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold font-headline">Sponsor Quick Start Guide</h1>
            <Button onClick={handleDownloadPdf} disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? 'Generating PDF...' : 'Download as PDF'}
            </Button>
          </div>
          <p className="text-muted-foreground">
            Welcome to ChessMate! This guide will walk you through the essential steps to get started.
          </p>
        </div>

        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <Lightbulb className="h-4 w-4 !text-blue-800" />
          <AlertTitle className="font-semibold">First Things First: Your Roster</AlertTitle>
          <AlertDescription>
            The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <Link href="/roster" className="font-bold underline">Roster page</Link> to get started.
          </AlertDescription>
        </Alert>

        <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
          <Card>
            <AccordionItem value="item-1" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Step 1: Managing Your Roster</h3>
                    <p className="text-sm text-muted-foreground">Add players to your school's roster to prepare for registration.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <Card className="bg-muted/50 p-6">
                  <h4 className="font-semibold text-base mb-2">Adding a Player to Your Roster</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Navigate to the <Link href="/roster" className="font-medium text-primary hover:underline">Roster page</Link> from the sidebar. You will see your team information and an empty roster list.</li>
                    <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1h.png?alt=media&token=d5caad84-adad-41e3-aa27-ce735ab3c6fd" alt="Team Roster page showing an empty roster list and the Add from Database button." width={600} height={350} className="my-2 rounded-md border" />
                    <li>Click <strong>Add from Database</strong> to search for existing players or <strong>Create New Player</strong> to add a student not found in the system.</li>
                    <li>Use the filters to find players by name, USCF ID, school, or district.</li>
                    <li>Click <strong>Select</strong> and fill in any missing information in the dialog that appears. The player will then be added to your roster.</li>
                  </ol>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
            <AccordionItem value="item-2" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Calendar className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Step 2: Registering for an Event</h3>
                    <p className="text-sm text-muted-foreground">Select players from your roster to register for a tournament.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <Card className="bg-muted/50 p-6">
                    <h4 className="font-semibold text-base mb-2">Event Registration Process</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Go to the <Link href="/dashboard" className="font-medium text-primary hover:underline">Dashboard</Link> or <Link href="/events" className="font-medium text-primary hover:underline">Register for Event</Link> page.</li>
                        <li>Find an upcoming event and click the <strong>Register Students</strong> button.</li>
                        <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1k.png?alt=media&token=3ae8d3de-6956-4886-980c-4af456ddf6ac" alt="Event list with Register Students button highlighted." width={600} height={200} className="my-2 rounded-md border" />
                        <li>In the dialog that appears, select the players from your roster that you wish to register.</li>
                        <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1L.png?alt=media&token=1d074a8e-9c30-4327-9e1e-483a30988f56" alt="Registration dialog showing a list of players to select." width={600} height={400} className="my-2 rounded-md border" />
                        <li>Confirm each player's <strong>Section</strong> and <strong>USCF Status</strong>.</li>
                        <li>Click <strong>Review Charges</strong> to see a breakdown of fees.</li>
                        <li>Click <strong>Create Invoice</strong> to finalize the registration and generate an invoice.</li>
                    </ol>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
            <AccordionItem value="item-3" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Receipt className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Step 3: Handling Invoices</h3>
                    <p className="text-sm text-muted-foreground">View and pay invoices for your registrations.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <Card className="bg-muted/50 p-6">
                    <h4 className="font-semibold text-base mb-2">Viewing and Paying Invoices</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Navigate to the <Link href="/invoices" className="font-medium text-primary hover:underline">Invoices & Payments</Link> page.</li>
                        <li>Click <strong>Details</strong> on an invoice to see a list of registered players.</li>
                        <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1p.png?alt=media&token=7a9e0a18-3a9d-42a5-9bb0-e3f873815d16" alt="Invoice details dialog." width={600} height={400} className="my-2 rounded-md border" />
                        <li>To pay online, click <strong>View Invoice on Square</strong> to use a credit card. Payments will be automatically marked as paid.</li>
                        <li>To pay offline, select the method (PO, Check, etc.), fill in the details, upload proof, and click <strong>Submit Payment Information</strong> for review by an organizer.</li>
                        <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/App-Images%2F1q.png?alt=media&token=358d7596-a152-4980-89fb-152eaac99f39" alt="Offline payment options in the invoice dialog." width={600} height={450} className="my-2 rounded-md border" />
                    </ol>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
            <AccordionItem value="item-4" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="bg-purple-100 p-3 rounded-full">
                    <FileQuestion className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Need More Help?</h3>
                    <p className="text-sm text-muted-foreground">Find detailed guides and answers to common questions.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                 <Card className="bg-muted/50 p-6">
                    <h4 className="font-semibold text-base mb-2">Visit the Help Center</h4>
                    <p className="text-sm mb-4">
                        For more detailed, step-by-step instructions on every feature of the ChessMate platform, please visit our new <Link href="/help" className="font-medium text-primary hover:underline">Help Center</Link>.
                    </p>
                    <p className="text-sm font-semibold">The Help Center includes:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                        <li>Complete tutorials for each feature</li>
                        <li>Frequently asked questions and troubleshooting tips</li>
                        <li>Video guides for complex processes</li>
                        <li>Contact information for technical support</li>
                    </ul>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Card>
        </Accordion>
      </div>
    </AppLayout>
  );
};
