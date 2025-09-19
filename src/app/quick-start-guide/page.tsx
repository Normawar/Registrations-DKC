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

    // Get the existing images and convert to data URLs
    const existingImages = {
      roster: document.querySelector('img[src*="1h.png"]'),
      eventList: document.querySelector('img[src*="1k.png"]'), 
      registrationDialog: document.querySelector('img[src*="1L.png"]'),
      invoiceDetails: document.querySelector('img[src*="1p.png"]'),
      invoicePayment: document.querySelector('img[src*="1q.png"]')
    };

    const imageDataUrls:any = {};
    for (const [key, img] of Object.entries(existingImages)) {
      if (img && (img as HTMLImageElement).complete) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width;
          canvas.height = (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height;
          ctx!.drawImage(img as HTMLImageElement, 0, 0);
          imageDataUrls[key] = canvas.toDataURL('image/png');
          console.log(`Converted ${key} to data URL`);
        } catch (error) {
            if(error instanceof Error) {
                console.log(`Failed to convert ${key}:`, error.message);
            }
          imageDataUrls[key] = null;
        }
      } else {
        imageDataUrls[key] = null;
      }
    }

    // Create PDF
    const pdf = new jsPDF('portrait', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pdfWidth - (margin * 2);

    let currentPage = 0;

    // Helper function with better image sizing
    const captureSection = async (htmlContent:string, isFirstSection = false) => {
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = htmlContent;
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '700px'; // Slightly smaller container
      tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.padding = '16px'; // Reduced padding
      
      document.body.appendChild(tempContainer);
      
      console.log(`Capturing section, height: ${tempContainer.scrollHeight}`);

      const canvas = await html2canvas(tempContainer, {
        scale: 1.1, // Slightly lower scale for better fit
        useCORS: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        height: tempContainer.scrollHeight,
        width: tempContainer.scrollWidth,
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      // Add new page if not the first section
      if (!isFirstSection) {
        pdf.addPage();
        currentPage++;
      }

      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, scaledHeight);
      console.log(`Added section to page ${currentPage + 1}, scaled height: ${scaledHeight}`);
    };

    // Section 1: Header + Alert + Step 1 (more compact)
    await captureSection(`
      <div>
        <h1 style="font-size: 26px; font-weight: bold; margin-bottom: 6px;">Sponsor Quick Start Guide</h1>
        <p style="color: #666; margin-bottom: 24px; font-size: 15px;">Welcome to ChessMate! This guide will walk you through the essential steps to get started.</p>
        
        <div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 12px; margin-bottom: 24px; border-radius: 6px;">
          <h3 style="font-weight: bold; margin: 0 0 6px 0; font-size: 16px;">First Things First: Your Roster</h3>
          <p style="margin: 0; color: #555; font-size: 14px;">The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the Roster page to get started.</p>
        </div>

        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <span style="background: #dbeafe; padding: 6px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px;">1</span>
          Step 1: Managing Your Roster
        </h2>
        
        <p style="margin-bottom: 16px; font-size: 14px;">Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px;">Adding a Player to Your Roster</h3>
          <p style="font-size: 13px; margin-bottom: 8px;">1. Navigate to the <strong>Roster</strong> page from the sidebar. You will see your team information and an empty roster list.</p>
          
          ${imageDataUrls.roster ? 
            `<div style="border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; background: #f9fafb; margin: 10px 0;">
              <img src="${imageDataUrls.roster}" alt="Team Roster page" style="width: 100%; max-width: 450px; height: auto; border-radius: 4px;">
            </div>` :
            '<div style="text-align: center; color: #666; padding: 12px; background: #f9fafb; border-radius: 6px; margin: 10px 0; font-size: 13px;">[Team Roster Page Screenshot]</div>'
          }
          
          <p style="font-size: 13px; margin-bottom: 6px;">2. Click <strong>Add from Database</strong> to search for existing players or <strong>Create New Player</strong> to add a student.</p>
          <p style="font-size: 13px; margin-bottom: 6px;">3. Use filters to find players by name, USCF ID, school, or district.</p>
          <p style="font-size: 13px; margin-bottom: 0;">4. Click <strong>Select</strong> and fill in any missing information. The player will be added to your roster.</p>
        </div>
      </div>
    `, true);

    // Section 2: Step 2 (optimized for better image fit)
    await captureSection(`
      <div>
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <span style="background: #dbeafe; padding: 6px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px;">2</span>
          Step 2: Registering for an Event
        </h2>
        
        <p style="margin-bottom: 16px; font-size: 14px;">Once your roster is set, you can register your selected players for any open tournament.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px;">Event Registration Process</h3>
          
          <p style="font-size: 13px; margin-bottom: 6px;">1. Go to the <strong>Dashboard</strong> or <strong>Register for Event</strong> page.</p>
          <p style="font-size: 13px; margin-bottom: 10px;">2. Find an upcoming event and click the <strong>Register Students</strong> button.</p>
          
          ${imageDataUrls.eventList ? 
            `<div style="border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; background: #f9fafb; margin: 8px 0;">
              <img src="${imageDataUrls.eventList}" alt="Event registration page" style="width: 100%; max-width: 400px; height: auto; border-radius: 4px; margin-bottom: 8px;">
              ${imageDataUrls.registrationDialog ? 
                `<img src="${imageDataUrls.registrationDialog}" alt="Registration dialog" style="width: 100%; max-width: 400px; height: auto; border-radius: 4px;">` : ''
              }
            </div>` :
            '<div style="text-align: center; color: #666; padding: 12px; background: #f9fafb; border-radius: 6px; margin: 8px 0; font-size: 13px;">[Event Registration Screenshots]</div>'
          }
          
          <p style="font-size: 13px; margin-bottom: 6px;">3. Select the players you wish to register for this event.</p>
          <p style="font-size: 13px; margin-bottom: 6px;">4. Confirm their <strong>Section</strong> and <strong>USCF Status</strong>.</p>
          <p style="font-size: 13px; margin-bottom: 6px;">5. Click <strong>Review Charges</strong> to see fees.</p>
          <p style="font-size: 13px; margin-bottom: 0;">6. Click <strong>Register Now</strong> to complete registration.</p>
        </div>
      </div>
    `);

    // Section 3: Step 3 (optimized for better image fit)
    await captureSection(`
      <div>
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <span style="background: #dbeafe; padding: 6px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px;">3</span>
          Step 3: Handling Invoices
        </h2>
        
        <p style="margin-bottom: 16px; font-size: 14px;">After registering, you can view and manage all your invoices from one place.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px;">Viewing and Paying Invoices</h3>
          
          <p style="font-size: 13px; margin-bottom: 6px;">1. Navigate to the <strong>Invoices & Payments</strong> page from the sidebar.</p>
          <p style="font-size: 13px; margin-bottom: 6px;">2. You will see a list of all your invoices and their current status (Paid, Unpaid, Canceled).</p>
          <p style="font-size: 13px; margin-bottom: 6px;">3. Click <strong>Details</strong> to view a specific invoice and see registered players.</p>
          <p style="font-size: 13px; margin-bottom: 10px;">4. For payment, click <strong>View Invoice on Square</strong> for credit card, or use offline methods (PO, Check, CashApp, Zelle).</p>
          
          ${imageDataUrls.invoiceDetails ? 
            `<div style="border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; background: #f9fafb; margin: 8px 0;">
              <img src="${imageDataUrls.invoiceDetails}" alt="Invoice details" style="width: 100%; max-width: 400px; height: auto; border-radius: 4px; margin-bottom: 8px;">
              ${imageDataUrls.invoicePayment ? 
                `<img src="${imageDataUrls.invoicePayment}" alt="Invoice payment options" style="width: 100%; max-width: 400px; height: auto; border-radius: 4px;">` : ''
              }
            </div>` :
            '<div style="text-align: center; color: #666; padding: 12px; background: #f9fafb; border-radius: 6px; margin: 8px 0; font-size: 13px;">[Invoice Screenshots]</div>'
          }
          
          <p style="font-size: 13px; margin-bottom: 0;">5. If paying offline, select payment method, fill in details (PO/check number), upload proof, and click <strong>Submit Payment Information</strong> for review.</p>
        </div>
      </div>
    `);

    // Section 4: Step 4
    await captureSection(`
      <div>
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
          <span style="background: #dbeafe; padding: 6px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px;">4</span>
          Need More Help?
        </h2>
        
        <p style="margin-bottom: 30px; font-size: 14px;">For more detailed instructions on every feature, please visit our new <strong>Help Center</strong>.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; background: #f8fafc;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 16px;">Additional Resources</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
            <li style="margin-bottom: 8px; font-size: 14px;">Complete step-by-step tutorials for each feature</li>
            <li style="margin-bottom: 8px; font-size: 14px;">Frequently asked questions and troubleshooting</li>
            <li style="margin-bottom: 8px; font-size: 14px;">Video guides for complex processes</li>
            <li style="margin-bottom: 0; font-size: 14px;">Contact information for technical support</li>
          </ul>
        </div>
      </div>
    `);

    pdf.save('ChessMate_Quick_Start_Guide.pdf');
    setOpenAccordionItems(originalState);
    
    console.log(`PDF completed with ${currentPage + 1} pages`);
    
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    alert(`Sorry, there was an error generating the PDF: ${(error as Error).message}`);
  } finally {
    setIsDownloading(false);
  }
};

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-start no-print">
          <div>
            <h1 className="text-3xl font-bold font-headline">Sponsor Quick Start Guide</h1>
            <p className="text-muted-foreground mt-2">
              Welcome to the new Registration App for Dark Knights Chess! This guide will walk you through the essential steps to get started.
            </p>
          </div>
           <Button onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </div>

        <div id="guide-content" className="space-y-6">
          <Alert className="pdf-page-break-avoid">
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>First Things First: Your Roster</AlertTitle>
              <AlertDescription>
                  The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <Link href="/roster" className="font-semibold underline">Roster</Link> page to get started.
              </AlertDescription>
          </Alert>

          <Accordion type="multiple" className="w-full" value={openAccordionItems} onValueChange={setOpenAccordionItems}>
            <AccordionItem value="item-1" data-radix-accordion-item className="pdf-page-break-avoid">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full"><Users className="h-5 w-5 text-primary" /></div>
                  Step 1: Managing Your Roster
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pt-2 space-y-4">
                <p>Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
                <Card className="pdf-page-break-avoid">
                  <CardHeader>
                    <CardTitle className="text-base">Adding a Player to Your Roster</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">1. Navigate to the <Link href="/roster" className="font-medium underline">Roster</Link> page from the sidebar. You will see your team information and an empty roster list.</p>
                     <div className="border rounded-lg p-4 bg-muted/50 pdf-page-break-avoid">
                       <GuideImage
                         src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2F1h.png?alt=media&token=d5caad84-adad-41e3-aa27-ce735ab3c6fd"
                         alt="A screenshot of the Team Roster page showing the Add from Database and Create New Player buttons."
                         width={600}
                         height={400}
                         className="rounded-md w-full h-auto"
                         priority
                       />
                    </div>
                    <p className="text-sm">2. Click the <strong>Add from Database</strong> button to search for existing players or <strong>Create New Player</strong> to add a student who is not in the system.</p>
                    <p className="text-sm">3. When searching, use the filters to find players by name, USCF ID, school, or district.</p>
                    <p className="text-sm">4. Once you find your student, click <strong>Select</strong>. You will be prompted to fill in any missing required information (like Grade or Section). The player will then be added to your school's roster.</p>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" data-radix-accordion-item className="pdf-page-break-avoid">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full"><Calendar className="h-5 w-5 text-primary" /></div>
                  Step 2: Registering for an Event
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pt-2 space-y-4">
                <p>Once your roster is set, you can register your selected players for any open tournament.</p>
                <Card className="pdf-page-break-avoid">
                  <CardHeader>
                    <CardTitle className="text-base">Event Registration Process</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">1. Go to the <Link href="/dashboard" className="font-medium underline">Dashboard</Link> or <Link href="/events" className="font-medium underline">Register for Event</Link> page.</p>
                    <p className="text-sm">2. Find an upcoming event and click the <strong>Register Students</strong> button.</p>
                    <div className="border rounded-lg p-4 bg-muted/50 space-y-4 pdf-page-break-avoid">
                       <GuideImage
                         src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2F1k.png?alt=media&token=c19a9a14-432d-45a4-8451-872f9b8c381c"
                         alt="A screenshot showing the event list with the register button highlighted."
                         width={600}
                         height={350}
                         className="rounded-md w-full h-auto"
                         priority
                       />
                       <GuideImage
                         src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2F1L.png?alt=media&token=1d074a8e-9c30-4327-9e1e-483a30988f56"
                         alt="A screenshot of the registration dialog where players from a roster can be selected."
                         width={600}
                         height={450}
                         className="rounded-md w-full h-auto"
                         priority
                       />
                    </div>
                    <p className="text-sm">3. A dialog will appear listing all players on your roster. Select the players you wish to register for this event.</p>
                    <p className="text-sm">4. For each selected player, confirm their <strong>Section</strong> and <strong>USCF Status</strong> (e.g., if they need a new membership or a renewal).</p>
                    <p className="text-sm">5. Click <strong>Review Charges</strong> to see a full breakdown of fees.</p>
                     <p className="text-sm">6. Finally, click <strong>Register Now</strong>. This will generate an official invoice and complete the registration.</p>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" data-radix-accordion-item className="pdf-page-break-avoid">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full"><Receipt className="h-5 w-5 text-primary" /></div>
                  Step 3: Handling Invoices
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pt-2 space-y-4">
                <p>After registering, you can view and manage all your invoices from one place.</p>
                 <Card className="pdf-page-break-avoid">
                  <CardHeader>
                    <CardTitle className="text-base">Viewing and Paying Invoices</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">1. Navigate to the <Link href="/invoices" className="font-medium underline">Invoices & Payments</Link> page from the sidebar.</p>
                    <p className="text-sm">2. Here you will see a list of all your invoices and their current status (e.g., Paid, Unpaid, Canceled).</p>
                    <p className="text-sm">3. Click <strong>Details</strong> to view a specific invoice. From here, you can see the registered players and submit payment information.</p>
                    <p className="text-sm">4. For payment, you can either click the <strong>View Invoice on Square</strong> button to pay directly with a credit card, or use an offline method like PO, Check, CashApp, or Zelle.</p>
                    <p className="text-sm">5. If paying offline, select the payment method, fill in the details (like PO or check number), upload proof of payment, and click <strong>Submit Payment Information</strong> for an organizer to review.</p>
                     <div className="border rounded-lg p-4 bg-muted/50 space-y-4 pdf-page-break-avoid">
                      <GuideImage
                        src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2F1p.png?alt=media&token=7a9e0a18-3a9d-42a5-9bb0-e3f873815d16"
                        alt="A screenshot of the invoice details view, showing player and fee breakdown."
                        width={600}
                        height={400}
                        className="rounded-md w-full h-auto"
                        priority
                      />
                      <GuideImage
                        src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/App-Images%2F1q.png?alt=media&token=358d7596-a152-4980-89fb-152eaac99f39"
                        alt="A screenshot of the invoice details view showing payment options like PO and Check."
                        width={600}
                        height={300}
                        className="rounded-md w-full h-auto"
                        priority
                      />
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" data-radix-accordion-item className="pdf-page-break-avoid">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full"><FileQuestion className="h-5 w-5 text-primary" /></div>
                  Need More Help?
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pt-2 space-y-4">
                  <p>For more detailed instructions on every feature, please visit our new <Link href="/help" className="font-semibold underline">Help Center</Link>.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </AppLayout>
  );
}
