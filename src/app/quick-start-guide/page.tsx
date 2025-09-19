
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

    // Fallback: if specific images not found, try to find any images on the page
    if (!existingImages.roster || !existingImages.eventList || !existingImages.invoiceDetails) {
      console.log('Some images not found with specific selectors, trying fallback...');
      const allImages = Array.from(document.querySelectorAll('img'));
      console.log(`Found ${allImages.length} images on page`);
      
      // Log all image sources for debugging
      allImages.forEach((img, index) => {
        console.log(`Image ${index}: ${img.src}`);
      });

      // Try to match images by common patterns or positions
      if (!existingImages.roster && allImages.length > 0) {
        existingImages.roster = allImages.find(img => 
          img.src.includes('roster') || 
          img.alt?.toLowerCase().includes('roster') ||
          img.src.includes('1h')
        ) || allImages[0];
      }
      
      if (!existingImages.eventList && allImages.length > 1) {
        existingImages.eventList = allImages.find(img => 
          img.src.includes('event') || 
          img.alt?.toLowerCase().includes('event') ||
          img.src.includes('1k')
        ) || allImages[1];
      }
      
      if (!existingImages.registrationDialog && allImages.length > 2) {
        existingImages.registrationDialog = allImages.find(img => 
          img.src.includes('registration') || 
          img.alt?.toLowerCase().includes('registration') ||
          img.src.includes('1L')
        ) || allImages[2];
      }
      
      if (!existingImages.invoiceDetails && allImages.length > 3) {
        existingImages.invoiceDetails = allImages.find(img => 
          img.src.includes('invoice') || 
          img.alt?.toLowerCase().includes('invoice') ||
          img.src.includes('1p')
        ) || allImages[3];
      }
      
      if (!existingImages.invoicePayment && allImages.length > 4) {
        existingImages.invoicePayment = allImages.find(img => 
          img.src.includes('payment') || 
          img.alt?.toLowerCase().includes('payment') ||
          img.src.includes('1q')
        ) || allImages[4];
      }
    }

    // Debug: Log which images were found
    console.log('Images found:', Object.entries(existingImages).map(([key, img]) => ({
      [key]: img ? 'Found' : 'Not found'
    })));

    // Wait for all images to fully load
    const imageLoadPromises = Object.values(existingImages).filter(img => img).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        // Fallback timeout
        setTimeout(resolve, 2000);
      });
    });

    await Promise.all(imageLoadPromises);
    console.log('All images loaded');

    const imageDataUrls = {};
    for (const [key, img] of Object.entries(existingImages)) {
      if (img) {
        try {
          // Create a new image to ensure it's fully loaded
          const newImg = new Image();
          newImg.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            newImg.onload = resolve;
            newImg.onerror = reject;
            newImg.src = img.src;
          });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = newImg.naturalWidth || newImg.width || img.width;
          canvas.height = newImg.naturalHeight || newImg.height || img.height;
          
          ctx.drawImage(newImg, 0, 0);
          imageDataUrls[key] = canvas.toDataURL('image/png');
          console.log(`Successfully converted ${key} to data URL (${canvas.width}x${canvas.height})`);
        } catch (error) {
          console.log(`Failed to convert ${key}:`, error.message);
          // Fallback: try with original image
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth || img.width || 300;
            canvas.height = img.naturalHeight || img.height || 200;
            ctx.drawImage(img, 0, 0);
            imageDataUrls[key] = canvas.toDataURL('image/png');
            console.log(`Fallback conversion successful for ${key}`);
          } catch (fallbackError) {
            console.log(`Fallback also failed for ${key}:`, fallbackError.message);
            imageDataUrls[key] = null;
          }
        }
      } else {
        console.log(`No image element found for ${key}`);
        imageDataUrls[key] = null;
      }
    }

    // Debug: Log final conversion results
    console.log('Image conversion results:', Object.entries(imageDataUrls).map(([key, dataUrl]) => ({
      [key]: dataUrl ? 'Converted' : 'Failed'
    })));
    
    // Debug: Show which sections will have images
    console.log('Sections with images:');
    console.log('- Section 1 (Roster):', imageDataUrls.roster ? 'YES' : 'NO');
    console.log('- Section 2 (Events):', (imageDataUrls.eventList || imageDataUrls.registrationDialog) ? 'YES' : 'NO'); 
    console.log('- Section 3 (Invoices):', (imageDataUrls.invoiceDetails || imageDataUrls.invoicePayment) ? 'YES' : 'NO');

    // Create PDF
    const pdf = new jsPDF('portrait', 'pt', 'a4');
    let currentPage = 0;

    // Helper function with better layout preservation
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
      
      // Wait a moment for content to render
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

      // Add new page if not the first section
      if (!isFirstSection) {
        pdf.addPage();
        currentPage++;
      }

      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, scaledHeight);
      console.log(`Added section to page ${currentPage + 1}, scaled height: ${scaledHeight}`);
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
          
          ${imageDataUrls.roster ? 
            `<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">
              <img src="${imageDataUrls.roster}" alt="Team Roster page" style="width: 100%; max-width: 400px; height: auto; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            </div>` :
            '<div style="text-align: center; color: #dc2626; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 12px 0; font-size: 13px;"><strong>⚠️ Screenshot not available</strong><br>Please refer to the written instructions above</div>'
          }
          
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
          
          ${imageDataUrls.eventList || imageDataUrls.registrationDialog ? 
            `<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">
              ${imageDataUrls.eventList ? 
                `<img src="${imageDataUrls.eventList}" alt="Event registration page" style="width: 100%; max-width: 350px; height: auto; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : 
                '<div style="color: #6b7280; padding: 8px; font-size: 12px;">Event List Image Not Found</div>'
              }
              ${imageDataUrls.registrationDialog ? 
                `<img src="${imageDataUrls.registrationDialog}" alt="Registration dialog" style="width: 100%; max-width: 350px; height: auto; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : 
                '<div style="color: #6b7280; padding: 8px; font-size: 12px;">Registration Dialog Image Not Found</div>'
              }
            </div>` :
            '<div style="text-align: center; color: #dc2626; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 12px 0; font-size: 13px;"><strong>⚠️ Screenshots not available</strong><br>Please refer to the written instructions above</div>'
          }
          
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
          
          ${imageDataUrls.invoiceDetails || imageDataUrls.invoicePayment ? 
            `<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; margin: 12px 0; text-align: center;">
              ${imageDataUrls.invoiceDetails ? 
                `<img src="${imageDataUrls.invoiceDetails}" alt="Invoice details" style="width: 100%; max-width: 350px; height: auto; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : 
                '<div style="color: #6b7280; padding: 8px; font-size: 12px;">Invoice Details Image Not Found</div>'
              }
              ${imageDataUrls.invoicePayment ? 
                `<img src="${imageDataUrls.invoicePayment}" alt="Invoice payment options" style="width: 100%; max-width: 350px; height: auto; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : 
                '<div style="color: #6b7280; padding: 8px; font-size: 12px;">Invoice Payment Image Not Found</div>'
              }
            </div>` :
            '<div style="text-align: center; color: #dc2626; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 12px 0; font-size: 13px;"><strong>⚠️ Screenshots not available</strong><br>Please refer to the written instructions above</div>'
          }
          
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
    console.error("Failed to generate PDF:", error);
    alert(`Sorry, there was an error generating the PDF: ${error.message}`);
  } finally {
    setIsDownloading(false);
  }
};