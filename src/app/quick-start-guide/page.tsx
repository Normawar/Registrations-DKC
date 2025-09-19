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
    
    // Step 1: Expand accordion via state
    setOpenAccordionItems(['item-1', 'item-2', 'item-3', 'item-4']);
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Step 2: MANUALLY force all content visible via DOM manipulation
    console.log('Manually expanding all accordion content...');
    
    // Find all accordion content and force it visible
    const allAccordionContent = document.querySelectorAll('[data-radix-accordion-content]');
    console.log(`Found ${allAccordionContent.length} accordion content sections`);
    
    const originalStyles: any[] = [];
    allAccordionContent.forEach((content, index) => {
      // Store original styles so we can restore them
      originalStyles[index] = {
        display: (content as HTMLElement).style.display,
        height: (content as HTMLElement).style.height,
        overflow: (content as HTMLElement).style.overflow,
        dataState: content.getAttribute('data-state')
      };
      
      // Force visible
      content.setAttribute('data-state', 'open');
      (content as HTMLElement).style.display = 'block !important';
      (content as HTMLElement).style.height = 'auto !important';
      (content as HTMLElement).style.overflow = 'visible !important';
      (content as HTMLElement).style.maxHeight = 'none !important';
      
      console.log(`Expanded accordion content ${index + 1}`);
    });

    // Step 3: Also force accordion triggers to show open state
    const allTriggers = document.querySelectorAll('[data-radix-accordion-trigger]');
    allTriggers.forEach(trigger => {
      trigger.setAttribute('data-state', 'open');
      trigger.setAttribute('aria-expanded', 'true');
    });

    // Step 4: Wait for DOM to update and images to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const images = document.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 3000);
      });
    });
    await Promise.all(imagePromises);

    // Step 5: Check what we actually have
    const guideContent = document.getElementById('guide-content')!;
    console.log('Guide content height:', guideContent.scrollHeight);
    
    allAccordionContent.forEach((content, index) => {
      console.log(`Accordion ${index + 1} height:`, (content as HTMLElement).offsetHeight, 'visible:', (content as HTMLElement).offsetHeight > 0);
    });

    // Step 6: Create complete container with header
    const tempContainer = document.createElement('div');
    tempContainer.style.backgroundColor = 'white';
    tempContainer.style.padding = '20px';
    tempContainer.style.width = '800px';
    tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Add header
    const header = document.createElement('div');
    header.innerHTML = `
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Sponsor Quick Start Guide</h1>
      <p style="color: #666; margin-bottom: 30px;">Welcome to the new Registration App for Dark Knights Chess! This guide will walk you through the essential steps to get started.</p>
    `;
    tempContainer.appendChild(header);

    // Clone the ENTIRE guide content (now with everything expanded)
    const contentClone = guideContent.cloneNode(true) as HTMLElement;
    tempContainer.appendChild(contentClone);

    // Temporarily add to DOM
    document.body.appendChild(tempContainer);
    
    console.log('Capturing expanded content...');
    console.log('Temp container height:', tempContainer.scrollHeight);

    // Step 7: Capture with more aggressive settings
    const canvas = await html2canvas(tempContainer, {
      scale: 1.0, // Lower scale to ensure everything fits
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      height: tempContainer.scrollHeight,
      width: tempContainer.scrollWidth,
      scrollX: 0,
      scrollY: 0,
      logging: true, // Enable logging to see what's happening
    });

    // Remove temporary container
    document.body.removeChild(tempContainer);

    console.log(`Final canvas: ${canvas.width}x${canvas.height}`);

    // Step 8: Create PDF with generous page sizing
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('portrait', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pdfWidth - (margin * 2);
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = contentWidth / imgWidth;
    const scaledHeight = imgHeight * ratio;
    
    // Use smaller pages to ensure nothing gets cut off
    const pageHeight = (pdfHeight - (margin * 2)) * 0.8; // Use 80% of page height
    const numPages = Math.ceil(scaledHeight / pageHeight);
    
    console.log(`Creating ${numPages} pages, scaled height: ${scaledHeight}`);

    for (let page = 0; page < numPages; page++) {
      if (page > 0) pdf.addPage();
      
      const yPosition = margin - (page * pageHeight);
      pdf.addImage(imgData, 'PNG', margin, yPosition, contentWidth, scaledHeight);
    }

    // Step 9: Restore original accordion states
    allAccordionContent.forEach((content, index) => {
      if (originalStyles[index]) {
        (content as HTMLElement).style.display = originalStyles[index].display || '';
        (content as HTMLElement).style.height = originalStyles[index].height || '';
        (content as HTMLElement).style.overflow = originalStyles[index].overflow || '';
        if (originalStyles[index].dataState) {
          content.setAttribute('data-state', originalStyles[index].dataState);
        }
      }
    });

    pdf.save('ChessMate_Quick_Start_Guide.pdf');
    setOpenAccordionItems(originalState);
    
    console.log(`PDF completed successfully with ${numPages} pages`);
    
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