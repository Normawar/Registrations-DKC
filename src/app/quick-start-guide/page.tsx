
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

    // Create PDF without touching original page images
    const pdf = new jsPDF('portrait', 'pt', 'a4');
    let currentPage = 0;

    const captureSection = async (htmlContent, isFirstSection = false) => {
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
    };

    // Create placeholder image HTML for PDF sections only
    const createPlaceholderImageHtml = (description) => {
      return '<div style="text-align: center; color: #9ca3af; padding: 12px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; margin: 12px 0; font-size: 12px;">📷 ' + description + ' screenshot</div>';
    };

    // Section 1: Header + Alert + Step 1
    const section1Html = `
      <div>
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #1f2937;">Sponsor Quick Start Guide</h1>
        <p style="color: #6b7280; margin-bottom: 24px; font-size: 16px;">Welcome to ChessMate! This guide will walk you through the essential steps to get started.</p>
        
        <div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 6px;">
          <h3 style="font-weight: bold; margin: 0 0 8px 0; font-size: 16px; color: #1f2937;">First Things First: Your Roster</h3>
          <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the Roster page to get started.</p>
        </div>

        <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;">
          <span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">1</span>
          Step 1: Managing Your Roster
        </h2>
        
        <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Adding a Player to Your Roster</h3>
          <p style="font-size: 13px; margin-bottom: 8px; line-height: 1.5;"><strong>1.</strong> Navigate to the <strong>Roster</strong> page from the sidebar. You will see your team information and an empty roster list.</p>
          
          ${createPlaceholderImageHtml('Team roster page')}
          
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>2.</strong> Click <strong>Add from Database</strong> to search for existing players or <strong>Create New Player</strong> to add a student.</p>
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Use filters to find players by name, USCF ID, school, or district.</p>
          <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>4.</strong> Click <strong>Select</strong> and fill in any missing information. The player will be added to your roster.</p>
        </div>
      </div>
    `;
    await captureSection(section1Html, true);

    // Section 2: Step 2
    const section2Html = `
      <div>
        <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;">
          <span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">2</span>
          Step 2: Registering for an Event
        </h2>
        
        <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">Once your roster is set, you can register your selected players for any open tournament.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Event Registration Process</h3>
          
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>1.</strong> Go to the <strong>Dashboard</strong> or <strong>Register for Event</strong> page.</p>
          <p style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;"><strong>2.</strong> Find an upcoming event and click the <strong>Register Students</strong> button.</p>
          
          ${createPlaceholderImageHtml('Event registration page')}
          ${createPlaceholderImageHtml('Registration dialog')}
          
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Select the players you wish to register for this event.</p>
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>4.</strong> Confirm their <strong>Section</strong> and <strong>USCF Status</strong>.</p>
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>5.</strong> Click <strong>Review Charges</strong> to see fees.</p>
          <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>6.</strong> Click <strong>Register Now</strong> to complete registration.</p>
        </div>
      </div>
    `;
    await captureSection(section2Html);

    // Section 3: Step 3
    const section3Html = `
      <div>
        <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;">
          <span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">3</span>
          Step 3: Handling Invoices
        </h2>
        
        <p style="margin-bottom: 16px; font-size: 14px; line-height: 1.5;">After registering, you can view and manage all your invoices from one place.</p>
        
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fafafa;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1f2937;">Viewing and Paying Invoices</h3>
          
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>1.</strong> Navigate to the <strong>Invoices & Payments</strong> page from the sidebar.</p>
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>2.</strong> You will see a list of all your invoices and their current status (Paid, Unpaid, Canceled).</p>
          <p style="font-size: 13px; margin-bottom: 6px; line-height: 1.5;"><strong>3.</strong> Click <strong>Details</strong> to view a specific invoice and see registered players.</p>
          <p style="font-size: 13px; margin-bottom: 12px; line-height: 1.5;"><strong>4.</strong> For payment, click <strong>View Invoice on Square</strong> for credit card, or use offline methods (PO, Check, CashApp, Zelle).</p>
          
          ${createPlaceholderImageHtml('Invoice details page')}
          ${createPlaceholderImageHtml('Payment options dialog')}
          
          <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>5.</strong> If paying offline, select payment method, fill in details (PO/check number), upload proof, and click <strong>Submit Payment Information</strong> for review.</p>
        </div>
      </div>
    `;
    await captureSection(section3Html);

    // Section 4: Help
    const section4Html = `
      <div>
        <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #1f2937;">
          <span style="background: #dbeafe; padding: 8px; border-radius: 50%; display: inline-flex; width: 32px; height: 32px; justify-content: center; align-items: center; font-size: 14px; font-weight: bold;">4</span>
          Need More Help?
        </h2>
        
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
      </div>
    `;
    await captureSection(section4Html);

    pdf.save('ChessMate_Quick_Start_Guide.pdf');
    setOpenAccordionItems(originalState);
    
    console.log(`PDF completed with ${currentPage + 1} pages`);
    
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    alert(`Sorry, there was an error generating the PDF: ${error.message}`);
  } finally {
    setIsDownloading(false);
  }
};

  return (
    <AppLayout>
      <div className="space-y-6" id="pdf-content">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline">Sponsor Quick Start Guide</h1>
            <p className="text-muted-foreground">Welcome to ChessMate! Here are the essential steps to get you started.</p>
          </div>
          <Button onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isDownloading ? 'Generating PDF...' : 'Download as PDF'}
          </Button>
        </div>

        <Alert className="page-break-avoid">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>First Things First: Your Roster</AlertTitle>
          <AlertDescription>
            The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <Link href="/roster" className="font-semibold text-primary underline">Roster page</Link> to get started.
          </AlertDescription>
        </Alert>

        <Accordion type="multiple" defaultValue={['item-1']} value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
          <AccordionItem value="item-1" className="border-b-0">
            <Card className="page-break-avoid">
              <CardHeader>
                <AccordionTrigger className="w-full p-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-full"><Users className="h-6 w-6 text-blue-600" /></div>
                    <div>
                      <CardTitle>Step 1: Managing Your Roster</CardTitle>
                      <CardDescription>Add, edit, and manage the players on your school's team.</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent>
                  <div className="space-y-4 text-muted-foreground">
                    <p>Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
                    <h4 className="font-semibold text-foreground">Adding a Player to Your Roster:</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Navigate to the <Link href="/roster" className="text-primary underline">Roster</Link> page from the sidebar. You will see your team information and a list of current players.</li>
                      <li>Click <strong>Add from Database</strong> to search for existing players in the system or <strong>Create New Player</strong> to add a student who has never played before.</li>
                      <li>Use the filters to find players by name, USCF ID, school, or district.</li>
                      <li>Click <strong>Select</strong> next to the correct player and fill in any missing information like grade or section. The player will now be on your roster.</li>
                    </ol>
                    <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1h.png?alt=media&token=c19a9097-f5df-4b77-a8a5-d86016752718" alt="Team Roster page showing a list of players with an 'Add from Database' button." width={800} height={450} className="rounded-lg border" />
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b-0">
            <Card className="page-break-avoid">
              <CardHeader>
                <AccordionTrigger className="w-full p-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full"><Calendar className="h-6 w-6 text-green-600" /></div>
                    <div>
                      <CardTitle>Step 2: Registering for an Event</CardTitle>
                      <CardDescription>Sign up your selected players for an upcoming tournament.</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent>
                  <div className="space-y-4 text-muted-foreground">
                    <p>Once your roster is set, you can register your players for any open tournament.</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Go to the <Link href="/dashboard" className="text-primary underline">Dashboard</Link> or <Link href="/events" className="text-primary underline">Register for Event</Link> page.</li>
                      <li>Find an upcoming event and click the <strong>Register Students</strong> button.</li>
                    </ol>
                    <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1k.png?alt=media&token=c19a9097-f5df-4b77-a8a5-d86016752718" alt="Event list showing an upcoming tournament with a 'Register Students' button." width={800} height={450} className="rounded-lg border" />
                    <ol start={3} className="list-decimal list-inside space-y-2">
                      <li>Select the players you wish to register for this event.</li>
                      <li>Confirm their <strong>Section</strong> and <strong>USCF Status</strong>. If a player needs a new or renewed membership, select the appropriate option to add the USCF fee to the invoice.</li>
                      <li>Click <strong>Review Charges</strong> to see a breakdown of fees.</li>
                      <li>Click <strong>Create Invoice</strong> to finalize the registration. An invoice will be generated, and you'll be directed to the Invoices page.</li>
                    </ol>
                    <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1L.png?alt=media&token=c19a9097-f5df-4b77-a8a5-d86016752718" alt="Registration dialog showing a list of players being selected for an event." width={800} height={450} className="rounded-lg border" />
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-b-0">
            <Card className="page-break-avoid">
              <CardHeader>
                <AccordionTrigger className="w-full p-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 p-3 rounded-full"><Receipt className="h-6 w-6 text-purple-600" /></div>
                    <div>
                      <CardTitle>Step 3: Handling Invoices</CardTitle>
                      <CardDescription>View, manage, and pay your registration invoices.</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent>
                  <div className="space-y-4 text-muted-foreground">
                    <p>After registering, you can view and manage all your invoices from one place.</p>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Navigate to the <Link href="/invoices" className="text-primary underline">Invoices & Payments</Link> page.</li>
                      <li>You will see a list of all your invoices and their status (Paid, Unpaid, Canceled).</li>
                      <li>Click <strong>Details</strong> to view a specific invoice and its registered players.</li>
                    </ol>
                    <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1p.png?alt=media&token=c19a9097-f5df-4b77-a8a5-d86016752718" alt="Invoice details dialog showing registered players and total amount due." width={800} height={450} className="rounded-lg border" />
                    <h4 className="font-semibold text-foreground pt-4">Paying an Invoice</h4>
                    <p>There are two main ways to pay:</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li><strong>Online (Credit Card):</strong> In the invoice details, click <strong>View Invoice on Square</strong> to pay securely online. Payments made through Square are automatically synced and will update the invoice status to "Paid".</li>
                      <li><strong>Offline (PO, Check, etc.):</strong> In the details, select your payment method (e.g., Purchase Order), fill in the required info (like PO number), upload proof, and submit for verification.</li>
                    </ul>
                    <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1q.png?alt=media&token=c19a9097-f5df-4b77-a8a5-d86016752718" alt="Invoice payment options showing selections for Purchase Order, Check, CashApp, and Zelle." width={800} height={450} className="rounded-lg border" />
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-b-0">
            <Card className="page-break-avoid">
              <CardHeader>
                <AccordionTrigger className="w-full p-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-full"><FileQuestion className="h-6 w-6 text-red-600" /></div>
                    <div>
                      <CardTitle>Need More Help?</CardTitle>
                      <CardDescription>Find detailed guides and get support.</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent>
                  <p className="text-muted-foreground">
                    For more detailed instructions on every feature, please visit our new <Link href="/help" className="text-primary underline font-semibold">Help Center</Link>.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}

    