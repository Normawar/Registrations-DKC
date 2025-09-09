
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

  // --- 🚨 FILL IN THIS DATA 🚨 ---
  // You need to get the list of players from your invoice screenshot.
  // For each player, find their USCF ID and the section they were registered in.
  const selectionsData = {
    // Example for one player:
    "16800831": { // This is the Player's USCF ID.
      "section": "Middle School K-8", // The section they played in.
      "status": "active",
      "uscfStatus": "renewing" // Can be "current", "new", or "renewing".
    },
    // Add another player like this:
    "PLAYER_ID_2": {
      "section": "Championship",
      "status": "active",
      "uscfStatus": "current"
    },
    // ... add an entry for every player on the invoice.
  };

  if (Object.keys(selectionsData).length <= 1 && selectionsData.PLAYER_ID_2) {
      console.error("❌ Please fill in the selectionsData object with real player information before running the script.");
      return;
  }

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
