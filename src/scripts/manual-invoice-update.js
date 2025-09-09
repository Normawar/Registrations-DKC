
// This is a template script to manually add player registration data to a Firestore invoice document.
// You will need to fill in the player details yourself.

// How to run this script:
// 1. Make sure you are in a Node.js environment where you can run this script.
// 2. You may need to install the Firebase SDK: `npm install firebase`
// 3. Ensure your `src/lib/firebase.ts` is configured with your project credentials.

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/services/firestore-service'; // Adjust path if necessary

async function updateInvoice() {
  if (!db) {
    console.error("Firestore is not initialized. Please check your firebase config.");
    return;
  }

  const invoiceId = 'inv:0-ChA8tAATqKqV2Vn3-1kOEBDkEJ8I';
  const invoiceRef = doc(db, 'invoices', invoiceId);

  // --- Data extracted from the invoice image ---
  const selectionsData = {
    // Assuming 'NEW' for USCF ID if not available, will need to be updated later.
    "NEW_Aaliyah_Rodriguez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Alyssa_Cavazos": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Alyssa_Puga": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Devin_Valdez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Diego_Hernandez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Elias_Garcia": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Elijah_Martinez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Emely_Gonzalez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Hector_Lopez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Jacob_Gonzalez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Joel_Gonzalez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Jorge_Garcia": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Juan_Marines": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Julian_Cantu": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Matthew_Gonzalez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Sebastian_Salinas": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Victoria_Garcia": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" },
    "NEW_Yolotzin_Martinez": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing" }
  };
  
  const updatedInvoiceData = {
    district: "PHARR-SAN JUAN-ALAMO ISD",
    schoolName: "PSJA MEMORIAL EARLY COLLEGE H S",
    status: "UNPAID",
    invoiceStatus: "UNPAID",
    selections: selectionsData,
  };


  console.log(`Updating invoice ${invoiceId} with corrected sponsor info and ${Object.keys(selectionsData).length} player selections...`);

  try {
    await updateDoc(invoiceRef, updatedInvoiceData);
    console.log(`✅ Successfully updated invoice ${invoiceId}.`);
  } catch (error) {
    console.error(`🔥 Error updating invoice:`, error);
  }
}

updateInvoice().catch(console.error);
