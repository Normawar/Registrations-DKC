
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

  const invoiceId = 'inv:0-ChBL5kS7M_QOXReaRrBzEhDkEJ8I';
  const invoiceRef = doc(db, 'invoices', invoiceId);

  // --- Data extracted from the invoice image ---
  const selectionsData = {
    "16800831": { "section": "Middle School K-8", "status": "active", "uscfStatus": "renewing" },
    "30298794": { "section": "Middle School K-8", "status": "active", "uscfStatus": "renewing" },
    "30347260": { "section": "Middle School K-8", "status": "active", "uscfStatus": "renewing" },
    "30347282": { "section": "Middle School K-8", "status": "active", "uscfStatus": "renewing" },
    "31487695": { "section": "Middle School K-8", "status": "active", "uscfStatus": "current" },
    "31487845": { "section": "Middle School K-8", "status": "active", "uscfStatus": "current" },
    "32114974": { "section": "Middle School K-8", "status": "active", "uscfStatus": "current" },
    "NEW_Matthew_Gonzalez": { "section": "Middle School K-8", "status": "active", "uscfStatus": "new" },
    "NEW_Dallas_Evans": { "section": "Middle School K-8", "status": "active", "uscfStatus": "new" },
    "NEW_Ezra_Rivera": { "section": "Middle School K-8", "status": "active", "uscfStatus": "new" }
  };

  console.log(`Updating invoice ${invoiceId} with ${Object.keys(selectionsData).length} player selections...`);

  try {
    await updateDoc(invoiceRef, {
      selections: selectionsData
    });
    console.log(`✅ Successfully updated invoice ${invoiceId}.`);
  } catch (error) {
    console.error(`🔥 Error updating invoice:`, error);
  }
}

updateInvoice().catch(console.error);

