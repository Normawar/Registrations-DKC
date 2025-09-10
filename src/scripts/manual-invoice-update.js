
// This is a template script to manually add player registration data to a Firestore invoice document.
// You will need to fill in the player details yourself.

// How to run this script:
// 1. Make sure you are in a Node.js environment where you can run this script.
// 2. You may need to install the Firebase SDK: `npm install firebase`
// 3. Ensure your `src/lib/firebase.ts` is configured with your project credentials.

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/services/firestore-service'; // Adjust path if necessary

async function updateInvoices() {
  if (!db) {
    console.error("Firestore is not initialized. Please check your firebase config.");
    return;
  }

  // --- Invoice 1 Data: inv:0-ChBvHo9HhSLsFXoFmT96z3-wEJ8I ---
  const invoice1Id = 'inv:0-ChBvHo9HhSLsFXoFmT96z3-wEJ8I';
  const invoice1Ref = doc(db, 'invoices', invoice1Id);
  const selectionsData1 = {
    "15863055": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "16801086": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "30299472": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "30309132": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "31488082": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "31499254": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "32046484": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" }
  };
  const updatedInvoiceData1 = {
    district: "PHARR-SAN JUAN-ALAMO ISD",
    schoolName: "PSJA COLLEGIATE SCHOOL OF HEALTH PROFESSIONS",
    purchaserName: "Ashley Rodriguez",
    purchaserEmail: "ashley.rodriguez@psjaisd.us",
    sponsorEmail: "ashley.rodriguez@psjaisd.us",
    status: "UNPAID",
    invoiceStatus: "UNPAID",
    selections: selectionsData1,
  };

  console.log(`Updating invoice ${invoice1Id}...`);
  try {
    await updateDoc(invoice1Ref, updatedInvoiceData1);
    console.log(`✅ Successfully updated invoice ${invoice1Id}.`);
  } catch (error) {
    console.error(`🔥 Error updating invoice ${invoice1Id}:`, error);
  }

  // --- Invoice 2 Data: inv:0-ChAn7iUtCfPpjCRGA9NEEaE9EJ8I ---
  const invoice2Id = 'inv:0-ChAn7iUtCfPpjCRGA9NEEaE9EJ8I';
  const invoice2Ref = doc(db, 'invoices', invoice2Id);
  const selectionsData2 = {
    "30271062": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "30728191": { "section": "High School K-12", "status": "active", "uscfStatus": "renewing", "studentType": "independent" },
    "31489716": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "31489894": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "31489934": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "32115166": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "32115265": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "32115492": { "section": "High School K-12", "status": "active", "uscfStatus": "current", "studentType": "independent" },
    "temp_Aurik_Romo": { "section": "High School K-12", "status": "active", "uscfStatus": "new", "studentType": "independent" },
    "temp_Jocelyn_Snow": { "section": "High School K-12", "status": "active", "uscfStatus": "new", "studentType": "independent" }
  };
  const updatedInvoiceData2 = {
    district: "PHARR-SAN JUAN-ALAMO ISD",
    schoolName: "KENNEDY MIDDLE",
    purchaserName: "Hernan Cortez",
    purchaserEmail: "hernan.cortez@psjaisd.us",
    sponsorEmail: "hernan.cortez@psjaisd.us",
    status: "UNPAID",
    invoiceStatus: "UNPAID",
    selections: selectionsData2,
  };

  console.log(`Updating invoice ${invoice2Id}...`);
  try {
    await updateDoc(invoice2Ref, updatedInvoiceData2);
    console.log(`✅ Successfully updated invoice ${invoice2Id}.`);
  } catch (error) {
    console.error(`🔥 Error updating invoice ${invoice2Id}:`, error);
  }
}

updateInvoices().catch(console.error);
