
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
  
      // Try to find specific images
      const existingImages: { [key: string]: HTMLImageElement | null | undefined } = {
        roster: document.querySelector('img[src*="1h.png"]') || allImages[0],
        eventList: document.querySelector('img[src*="1k.png"]') || allImages[1], 
        registrationDialog: document.querySelector('img[src*="1L.png"]') || allImages[2],
        invoiceDetails: document.querySelector('img[src*="1p.png"]') || allImages[3],
        invoicePayment: document.querySelector('img[src*="1q.png"]') || allImages[4]
      };
  
      console.log('Final image detection results:');
      Object.entries(existingImages).forEach(([key, img]) => {
        console.log(`${key}:`, img ? `Found - ${img.src}` : 'Not found');
      });
  
      // Convert images to data URLs
      const imageDataUrls: { [key: string]: string | null } = {};
      for (const [key, img] of Object.entries(existingImages)) {
        if (img) {
          try {
            console.log(`Processing image ${key}:`, { src: img.src, complete: img.complete });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const width = img.naturalWidth || img.width || 400;
            const height = img.naturalHeight || img.height || 300;
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            imageDataUrls[key] = canvas.toDataURL('image/png');
            console.log(`✓ Successfully converted ${key} (${width}x${height})`);
            
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.log(`✗ Failed to convert ${key}:`, message);
            imageDataUrls[key] = null;
          }
        } else {
          console.log(`✗ No image element found for ${key}`);
          imageDataUrls[key] = null;
        }
      }
  
      // Debug output
      const totalImagesFound = Object.values(imageDataUrls).filter(Boolean).length;
      if (totalImagesFound === 0) {
        console.log('⚠️ No images were found. PDF will be generated with placeholders.');
      } else {
        console.log(`✓ Found ${totalImagesFound} images for the PDF.`);
      }
  
      // Helper function to generate image HTML
      const generateImageHtml = (imageKey: string, altText: string, fallbackText: string) => {
        if (imageDataUrls[imageKey]) {
          return `<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">
            <img src="${imageDataUrls[imageKey]}" alt="${altText}" style="width: 100%; max-width: 400px; height: auto; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          </div>`;
        } else {
          return `<div style="text-align: center; color: #9ca3af; padding: 8px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 4px; margin: 8px 0; font-size: 11px;">
            📷 ${fallbackText}
          </div>`;
        }
      };
  
      // Helper function to generate multi-image HTML
      const generateMultiImageHtml = (imageKeys: string[], altTexts: string[], fallbackText: string) => {
        const hasAnyImage = imageKeys.some(key => imageDataUrls[key]);
        
        if (hasAnyImage) {
          const imageHtmlParts = imageKeys.map((key, index) => {
            if (imageDataUrls[key]) {
              return `<img src="${imageDataUrls[key]}" alt="${altTexts[index]}" style="width: 100%; max-width: 350px; height: auto; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
            } else {
              return `<div style="color: #9ca3af; padding: 4px; font-size: 10px;">📷 ${altTexts[index]} not found</div>`;
            }
          }).join('');
          
          return `<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">
            ${imageHtmlParts}
          </div>`;
        } else {
          return `<div style="text-align: center; color: #9ca3af; padding: 8px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 4px; margin: 8px 0; font-size: 11px;">
            📷 ${fallbackText}
          </div>`;
        }
      };
  
      // Create PDF
      const pdf = new jsPDF('portrait', 'pt', 'a4');
      let currentPage = 0;
  
      // Helper function with better layout preservation
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
        
        console.log(`Capturing section, height: ${tempContainer.scrollHeight}`);
  
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
        console.log(`Added section to page ${currentPage + 1}, scaled height: ${scaledHeight}`);
      };
  
      // Generate image HTML strings
      const rosterImageHtml = generateImageHtml('roster', 'Team Roster page', 'Screenshot will be added here');
  
      const eventImagesHtml = generateMultiImageHtml(
        ['eventList', 'registrationDialog'], 
        ['Event registration page', 'Registration dialog'], 
        'Screenshots will be added here'
      );
  
      const invoiceImagesHtml = generateMultiImageHtml(
        ['invoiceDetails', 'invoicePayment'], 
        ['Invoice details', 'Invoice payment options'], 
        'Screenshots will be added here'
      );
  
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
            
            ${rosterImageHtml}
            
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
            
            ${eventImagesHtml}
            
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
            
            ${invoiceImagesHtml}
            
            <p style="font-size: 13px; margin-bottom: 0; line-height: 1.5;"><strong>5.</strong> If paying offline, select payment method, fill in details (PO/check number), upload proof, and click <strong>Submit Payment Information</strong> for review.</p>
          </div>
        </div>
      `;
      await captureSection(section3Html);
  
      // Section 4: Step 4
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error("Failed to generate PDF:", error);
      alert(`Sorry, there was an error generating the PDF: ${message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8" id="guide-content">
        <div className="flex justify-between items-center no-print">
          <div>
            <h1 className="text-3xl font-bold font-headline">Sponsor Quick Start Guide</h1>
            <p className="text-muted-foreground">Welcome to ChessMate! This guide will walk you through the essential steps.</p>
          </div>
          <Button onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Generating PDF...' : 'Download as PDF'}
          </Button>
        </div>

        <Alert className="no-print">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>First Things First: Your Roster</AlertTitle>
          <AlertDescription>
            The most important first step is to ensure your team roster is complete and accurate. You cannot register players for an event if their information is missing. Visit the <Link href="/roster" className="font-bold underline">Roster</Link> page to get started.
          </AlertDescription>
        </Alert>

        <Accordion type="multiple" className="w-full" value={openAccordionItems} onValueChange={setOpenAccordionItems}>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center font-bold">1</div>
                Step 1: Managing Your Roster
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p>Your roster is the list of all students sponsored by your school. Keeping this up-to-date is crucial for event registration.</p>
              <Card>
                <CardHeader><CardTitle>Adding a Player to Your Roster</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>1.</strong> Navigate to the <Link href="/roster" className="text-primary underline">Roster</Link> page from the sidebar. You will see your team information and a roster list.</p>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1h.png?alt=media&token=e11400e9-2287-43c2-a8c6-f78a221f7ed4" alt="Team Roster page showing an empty roster and options to add players." width={800} height={450} className="rounded-md border shadow-sm" />
                  <p><strong>2.</strong> Click <strong>Add from Database</strong> to search for existing players or <strong>Create New Player</strong> to add a student from scratch.</p>
                  <p><strong>3.</strong> Use filters to find players by name, USCF ID, school, or district.</p>
                  <p><strong>4.</strong> Click <strong>Select</strong> next to the correct player and fill in any missing information in the dialog that appears. The player will then be added to your roster.</p>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center font-bold">2</div>
                Step 2: Registering for an Event
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p>Once your roster is set, you can register your selected players for any open tournament.</p>
              <Card>
                <CardHeader><CardTitle>Event Registration Process</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>1.</strong> Go to the <Link href="/dashboard" className="text-primary underline">Dashboard</Link> or <Link href="/events" className="text-primary underline">Register for Event</Link> page.</p>
                  <p><strong>2.</strong> Find an upcoming event and click the <strong>Register Students</strong> button.</p>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1k.png?alt=media&token=c190209c-3081-42e5-82e1-454589d873d9" alt="Event registration page showing a list of upcoming tournaments." width={800} height={450} className="rounded-md border shadow-sm" />
                  <p><strong>3.</strong> In the dialog that opens, select the players you wish to register for this event.</p>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1L.png?alt=media&token=42e5ab71-7053-4328-9892-36c1e55bd35f" alt="Registration dialog showing a list of students to select for the tournament." width={800} height={450} className="rounded-md border shadow-sm" />
                  <p><strong>4.</strong> Confirm their <strong>Section</strong> and <strong>USCF Status</strong>. If a player needs a new or renewed membership, select the appropriate option to add the USCF fee to the invoice.</p>
                  <p><strong>5.</strong> Click <strong>Review Charges</strong> to see a breakdown of all fees (Registration, Late Fees, USCF Fees).</p>
                  <p><strong>6.</strong> Click <strong>Create Invoice</strong> to finalize the registration. An invoice will be generated and you will be taken to the Invoices page to complete payment.</p>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center font-bold">3</div>
                Step 3: Handling Invoices
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p>After registering, you can view and manage all your invoices from one place.</p>
              <Card>
                <CardHeader><CardTitle>Viewing and Paying Invoices</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>1.</strong> Navigate to the <Link href="/invoices" className="text-primary underline">Invoices & Payments</Link> page from the sidebar.</p>
                  <p><strong>2.</strong> You will see a list of all your invoices and their current status (Paid, Unpaid, Canceled).</p>
                  <p><strong>3.</strong> Click <strong>Details</strong> to view a specific invoice and see registered players.</p>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1p.png?alt=media&token=c190209c-3081-42e5-82e1-454589d873d9" alt="Invoice details dialog showing registered players and total amount due." width={800} height={450} className="rounded-md border shadow-sm" />
                  <p><strong>4.</strong> For payment, click <strong>View Invoice on Square</strong> for credit card, or use offline methods (PO, Check, CashApp, Zelle).</p>
                  <GuideImage src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/1q.png?alt=media&token=d143c080-6927-4c4f-9e73-b7b5e40e29b1" alt="Invoice payment options, including online via Square and offline methods like PO and Check." width={800} height={450} className="rounded-md border shadow-sm" />
                  <p><strong>5.</strong> If paying offline, select payment method, fill in details (PO/check number), upload proof, and click <strong>Submit Payment Information</strong> for review.</p>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center font-bold">4</div>
                Need More Help?
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p>For more detailed instructions on every feature, please visit our new <Link href="/help" className="text-primary underline">Help Center</Link>.</p>
              <Card>
                <CardHeader><CardTitle>Additional Resources</CardTitle></CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Complete step-by-step tutorials for each feature</li>
                    <li>Frequently asked questions and troubleshooting</li>
                    <li>Video guides for complex processes</li>
                    <li>Contact information for technical support</li>
                  </ul>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}
