
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
    
    // Expand all accordion items
    setOpenAccordionItems(['item-1', 'item-2', 'item-3', 'item-4']);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Force expand all accordion content by setting attributes
    const accordionItems = document.querySelectorAll('[data-radix-accordion-item]');
    console.log(`Found ${accordionItems.length} accordion items`);
    
    // Force all content to be visible
    accordionItems.forEach((item, index) => {
      console.log(`Processing accordion item ${index + 1}`);
      
      // Find and expand the content within this item
      const content = item.querySelector('[data-radix-accordion-content]');
      if (content) {
        content.setAttribute('data-state', 'open');
        content.style.display = 'block';
        content.style.height = 'auto';
        content.style.overflow = 'visible';
        console.log(`Expanded content for item ${index + 1}`);
      }
      
      // Also ensure the trigger shows it's open
      const trigger = item.querySelector('[data-radix-accordion-trigger]');
      if (trigger) {
        trigger.setAttribute('data-state', 'open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    // Wait a bit more for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if accordion items actually have content now
    accordionItems.forEach((item, index) => {
      const height = (item as HTMLElement).offsetHeight;
      const content = item.querySelector('[data-radix-accordion-content]');
      const contentHeight = content ? (content as HTMLElement).offsetHeight : 0;
      console.log(`Item ${index + 1} - Total height: ${height}px, Content height: ${contentHeight}px`);
    });

    // Wait for images to load
    const images = document.querySelectorAll('#guide-content img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 3000);
      });
    });
    await Promise.all(imagePromises);

    const pdf = new jsPDF('portrait', 'pt', 'a4');
    const margin = 36;
    const contentWidth = pdf.internal.pageSize.getWidth() - (margin * 2);

    let pageCount = 0;

    // Helper function to capture and add element to PDF
    const captureElement = async (element: Element, title: string) => {
      if (!element) {
        console.log(`Element not found for: ${title}`);
        return false;
      }

      const height = (element as HTMLElement).offsetHeight;
      if (height < 50) {
        console.log(`Element too small (${height}px) for: ${title}`);
        return false;
      }

      console.log(`Capturing ${title} - Height: ${height}px`);

      // Start new page if not first
      if (pageCount > 0) {
        pdf.addPage();
      }

      try {
        const canvas = await html2canvas(element as HTMLElement, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          height: (element as HTMLElement).scrollHeight,
          width: (element as HTMLElement).scrollWidth,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
        
        pageCount++;
        console.log(`Successfully added ${title} to PDF (Page ${pageCount})`);
        return true;
      } catch (error) {
        console.error(`Failed to capture ${title}:`, error);
        return false;
      }
    };

    const guideContent = document.getElementById('guide-content');
    
    // Capture the Alert
    if (guideContent) {
        const alertCaptured = await captureElement(guideContent.children[0], 'Alert Section');
    }

    // Capture each accordion item
    let accordionCaptured = 0;
    for (let i = 0; i < accordionItems.length; i++) {
      const item = accordionItems[i];
      const success = await captureElement(item, `Step ${i + 1}`);
      if (success) accordionCaptured++;
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Total pages created: ${pageCount}`);
    console.log(`Accordion items captured: ${accordionCaptured}/${accordionItems.length}`);

    // If we didn't capture enough content, fall back to full capture
    if (pageCount < 2 && guideContent) {
      console.log('Fallback: Capturing entire content as multiple pages');
      
      // Clear the PDF and start over
      const pdf2 = new jsPDF('portrait', 'pt', 'a4');
      
      const canvas = await html2canvas(guideContent, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        height: guideContent.scrollHeight,
        width: guideContent.scrollWidth,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf2.internal.pageSize.getWidth();
      const pdfHeight = pdf2.internal.pageSize.getHeight();
      const imgHeight = canvas.height;
      const imgWidth = canvas.width;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      // Split into 4 logical pages
      const pageContentHeight = pdfHeight - (margin * 2);
      const sectionHeight = scaledHeight / 4;

      for (let page = 0; page < 4; page++) {
        if (page > 0) pdf2.addPage();
        
        const yOffset = -(page * sectionHeight) + margin;
        pdf2.addImage(imgData, 'PNG', margin, yOffset, contentWidth, scaledHeight);
      }
      
      pdf2.save('ChessMate_Quick_Start_Guide.pdf');
    } else {
      pdf.save('ChessMate_Quick_Start_Guide.pdf');
    }

    setOpenAccordionItems(originalState);
    
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
            <AccordionItem value="item-1" className="pdf-page-break-avoid">
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

            <AccordionItem value="item-2" className="pdf-page-break-avoid">
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

            <AccordionItem value="item-3" className="pdf-page-break-avoid">
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
            
            <AccordionItem value="item-4" className="pdf-page-break-avoid">
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
