
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

    console.log('Starting image detection...');
    
    // Find all images on the page
    const allImages = Array.from(document.querySelectorAll('img'));
    console.log(`Total images found: ${allImages.length}`);
    
    allImages.forEach((img, index) => {
      console.log(`Image ${index}:`, {
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
      });
    });

    // Simple image assignment - just use first few images found
    const rosterImg = allImages[0] || null;
    const eventImg = allImages[1] || null;
    const dialogImg = allImages[2] || null;
    const invoiceImg = allImages[3] || null;
    const paymentImg = allImages[4] || null;

    console.log('Images assigned:', {
      roster: rosterImg ? 'Found' : 'None',
      event: eventImg ? 'Found' : 'None',
      dialog: dialogImg ? 'Found' : 'None',
      invoice: invoiceImg ? 'Found' : 'None',
      payment: paymentImg ? 'Found' : 'None'
    });

    // Convert images to data URLs
    const convertImage = async (img: HTMLImageElement | null, name: string) => {
      if (!img) return null;
      
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const width = img.naturalWidth || img.width || 400;
        const height = img.naturalHeight || img.height || 300;
        
        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          console.log(`Converted ${name}: ${width}x${height}`);
          return canvas.toDataURL('image/png');
        }
      } catch (error: any) {
        console.log(`Failed to convert ${name}:`, error.message);
      }
      return null;
    };

    const rosterData = await convertImage(rosterImg, 'roster');
    const eventData = await convertImage(eventImg, 'event');
    const dialogData = await convertImage(dialogImg, 'dialog');
    const invoiceData = await convertImage(invoiceImg, 'invoice');
    const paymentData = await convertImage(paymentImg, 'payment');

    console.log('Conversion results:', {
      roster: rosterData ? 'Success' : 'Failed',
      event: eventData ? 'Success' : 'Failed',
      dialog: dialogData ? 'Success' : 'Failed',
      invoice: invoiceData ? 'Success' : 'Failed',
      payment: paymentData ? 'Success' : 'Failed'
    });

    // Create PDF
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
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(tempContainer, {
        scale: 1.5,
        useCORS: false,
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
      console.log(`Added section to page ${currentPage + 1}`);
    };

    // Simple function to create image HTML
    const createImageHtml = (dataUrl: string | null, altText: string, placeholder: string) => {
      if (dataUrl) {
        return '<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;"><img src="' + dataUrl + '" alt="' + altText + '" style="width: 100%; max-width: 400px; height: auto; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>';
      } else {
        return '<div style="text-align: center; color: #9ca3af; padding: 8px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 4px; margin: 8px 0; font-size: 11px;">📷 ' + placeholder + '</div>';
      }
    };

    // Section 1: Roster
    const rosterImageHtml = createImageHtml(rosterData, 'Team Roster page', 'Roster screenshot here');
    
    const section1Html = '<div><h1 style="font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #1f2937;">Sponsor Quick Start Guide</h1><p style="color: #6b7280; margin-bottom: 24px; font-size: 16px;">Welcome to ChessMate! This guide will walk you through the essential steps to get started.</p><div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 6px;"><h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px; color: #1f2937;">First Things First: Your Roster</h3><p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the Roster page to get started.</p></div><h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">1</span>Step 1: Managing Your Roster</h2><p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p><div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;"><h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Adding a Player to Your Roster</h3><p style="font-size: 13px; margin-bottom: 8px; line-height: 1.5;"><strong>1.</strong> Navigate to the <strong>Roster</strong> page from the sidebar. You will see your team information and an empty roster list.</p>' + rosterImageHtml + '<p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>2.</strong> Click <strong>Add from Database</strong> to search for existing players or <strong>Create New Player</strong> to add a student.</p><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Use filters to find players by name, USCF ID, school, or district.</p><p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>4.</strong> Click <strong>Select</strong> and fill in any missing information. The player will be added to your roster.</p></div></div>';
    
    await captureSection(section1Html, true);

    // Section 2: Events
    const eventImageHtml = createImageHtml(eventData, 'Event registration', 'Event screenshot here');
    const dialogImageHtml = createImageHtml(dialogData, 'Registration dialog', 'Dialog screenshot here');
    const eventImagesHtml = '<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">' + eventImageHtml + dialogImageHtml + '</div>';
    
    const section2Html = '<div><h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">2</span>Step 2: Registering for an Event</h2><p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">Once your roster is set, you can register your selected players for any open tournament.</p><div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;"><h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Event Registration Process</h3><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>1.</strong> Go to the <strong>Dashboard</strong> or <strong>Register for Event</strong> page.</p><p style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;"><strong>2.</strong> Find an upcoming event and click the <strong>Register Students</strong> button.</p>' + eventImagesHtml + '<p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Select the players you wish to register for this event.</p><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>4.</strong> Confirm their <strong>Section</strong> and <strong>USCF Status</strong>.</p><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>5.</strong> Click <strong>Review Charges</strong> to see fees.</p><p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>6.</strong> Click <strong>Register Now</strong> to complete registration.</p></div></div>';
    
    await captureSection(section2Html);

    // Section 3: Invoices
    const invoiceImageHtml = createImageHtml(invoiceData, 'Invoice details', 'Invoice screenshot here');
    const paymentImageHtml = createImageHtml(paymentData, 'Payment options', 'Payment screenshot here');
    const invoiceImagesHtml = '<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">' + invoiceImageHtml + paymentImageHtml + '</div>';
    
    const section3Html = '<div><h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">3</span>Step 3: Handling Invoices</h2><p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">After registering, you can view and manage all your invoices from one place.</p><div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;"><h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Viewing and Paying Invoices</h3><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>1.</strong> Navigate to the <strong>Invoices & Payments</strong> page from the sidebar.</p><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>2.</strong> You will see a list of all your invoices and their current status (Paid, Unpaid, Canceled).</p><p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Click <strong>Details</strong> to view a specific invoice and see registered players.</p><p style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;"><strong>4.</strong> For payment, click <strong>View Invoice on Square</strong> for credit card, or use offline methods (PO, Check, CashApp, Zelle).</p>' + invoiceImagesHtml + '<p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>5.</strong> If paying offline, select payment method, fill in details (PO/check number), upload proof, and click <strong>Submit Payment Information</strong> for review.</p></div></div>';
    
    await captureSection(section3Html);

    // Section 4: Help
    const section4Html = '<div><h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;"><span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">4</span>Need More Help?</h2><p style="margin-bottom: 24px; font-size: 14px; line-height: 1.5;">For more detailed instructions on every feature, please visit our new <strong>Help Center</strong>.</p><div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; background: #f8fafc;"><h3 style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #1f2937;">Additional Resources</h3><ul style="margin: 0; padding-left: 20px; line-height: 1.6;"><li style="margin-bottom: 8px; font-size: 14px;">Complete step-by-step tutorials for each feature</li><li style="margin-bottom: 8px; font-size: 14px;">Frequently asked questions and troubleshooting</li><li style="margin-bottom: 8px; font-size: 14px;">Video guides for complex processes</li><li style="margin-bottom: 0; font-size: 14px;">Contact information for technical support</li></ul></div></div>';
    
    await captureSection(section4Html);

    pdf.save('ChessMate_Quick_Start_Guide.pdf');
    setOpenAccordionItems(originalState);
    
    console.log(`PDF completed with ${currentPage + 1} pages`);
    
  } catch (error: any) {
    console.error("Failed to generate PDF:", error);
    alert(`Sorry, there was an error generating the PDF: ${error.message}`);
  } finally {
    setIsDownloading(false);
  }
};

  return (
    <AppLayout>
      <div className="space-y-8" id="guide-content">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline">Sponsor Quick Start Guide</h1>
            <p className="text-muted-foreground">Welcome to ChessMate! This guide will walk you through the essential steps to get started.</p>
          </div>
          <Button onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Generating PDF...' : 'Download as PDF'}
          </Button>
        </div>

        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <Lightbulb className="h-4 w-4 !text-blue-600" />
          <AlertTitle className="text-blue-900">First Things First: Your Roster</AlertTitle>
          <AlertDescription>
            The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <Link href="/roster" className="font-bold underline hover:text-blue-700">Roster page</Link> to get started.
          </AlertDescription>
        </Alert>

        <Accordion type="multiple" defaultValue={['item-1']} value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
          <Card>
            <AccordionItem value="item-1" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-left">Step 1: Managing Your Roster</h2>
                    <p className="text-sm text-muted-foreground text-left">Add or create players to build your team.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <p className="mb-4">Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
                <ol className="list-decimal list-inside space-y-4">
                  <li>Navigate to the <strong>Roster</strong> page from the sidebar. You will see your team information and an empty roster list.</li>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/1h.png?alt=media&token=c3c6f8f1-8f56-4b13-883a-86c071d18c99" alt="Team Roster page showing an empty list and options to add players." width={800} height={450} className="rounded-lg border shadow-md my-2" />
                  <li>Click <strong>Add from Database</strong> to search for existing players in the entire system or <strong>Create New Player</strong> to add a completely new student.</li>
                  <li>Use the search filters to find players by name, USCF ID, school, or district.</li>
                  <li>From the search results, click <strong>Select</strong> and then fill in any missing information (like grade or section) in the dialog that appears. The player will then be added to your official roster.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
            <AccordionItem value="item-2" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-left">Step 2: Registering for an Event</h2>
                    <p className="text-sm text-muted-foreground text-left">Select players from your roster for a tournament.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                 <p className="mb-4">Once your roster is set, you can register your players for any open tournament.</p>
                <ol className="list-decimal list-inside space-y-4">
                  <li>Go to the <strong>Dashboard</strong> or <strong>Register for Event</strong> page.</li>
                  <li>Find an upcoming event and click the <strong>Register Students</strong> button.</li>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/1k.png?alt=media&token=9635e9c0-6d43-4318-9710-38827f31c260" alt="Event registration page showing a list of upcoming tournaments." width={800} height={450} className="rounded-lg border shadow-md my-2" />
                  <li>In the dialog that appears, select the players from your roster you wish to register.</li>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/1L.png?alt=media&token=2b719089-9a74-4b53-a550-96f3c5b497b7" alt="Registration dialog showing a list of players to select." width={800} height={450} className="rounded-lg border shadow-md my-2" />
                  <li>For each selected player, you must confirm their <strong>Section</strong> and their <strong>USCF Status</strong>. If a player needs a new or renewed membership, select the appropriate option to add the USCF fee to the invoice.</li>
                  <li>Click <strong>Review Charges</strong> to see a breakdown of all fees.</li>
                  <li>Click <strong>Register Now</strong> to finalize the registration and create an invoice.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
            <AccordionItem value="item-3" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-left">Step 3: Handling Invoices</h2>
                    <p className="text-sm text-muted-foreground text-left">View and pay for your event registrations.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <p className="mb-4">After registering, you can view and manage all your invoices from one central place.</p>
                 <ol className="list-decimal list-inside space-y-4">
                  <li>Navigate to the <strong>Invoices & Payments</strong> page from the sidebar to see a list of all your invoices and their status (Paid, Unpaid, Canceled).</li>
                  <li>Click <strong>Details</strong> to view a specific invoice, including the list of registered players.</li>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/1p.png?alt=media&token=f6a1d82f-87a1-4328-86d1-447a16f2125f" alt="Invoice details dialog showing player list and payment summary." width={800} height={450} className="rounded-lg border shadow-md my-2" />
                  <li>To pay online, click <strong>View Invoice on Square</strong> to use a credit card.</li>
                  <li>To pay offline, select the payment method (PO, Check, etc.), fill in the details, upload proof, and click <strong>Submit Payment Information</strong> for review.</li>
                   <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.appspot.com/o/1q.png?alt=media&token=f0d2c67c-9b88-466d-8533-3112a9e3fc1e" alt="Offline payment options including Purchase Order, Check, CashApp, and Zelle." width={800} height={450} className="rounded-lg border shadow-md my-2" />
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Card>
          
           <Card>
            <AccordionItem value="item-4" className="border-b-0">
              <AccordionTrigger className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full">
                    <FileQuestion className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-left">Need More Help?</h2>
                    <p className="text-sm text-muted-foreground text-left">Find detailed guides and answers to common questions.</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <p className="mb-4">For more detailed instructions, troubleshooting, and video guides, please visit our comprehensive <strong>Help Center</strong>.</p>
                <Button asChild>
                  <Link href="/help">Go to Help Center</Link>
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Card>

        </Accordion>
      </div>
    </AppLayout>
  );
}
