import admin from 'firebase-admin';

// Function to safely initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  try {
    // Check if the app is already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin SDK already initialized.');
      return admin.app();
    }

    // Initialize the Firebase Admin SDK
    console.log('Initializing Firebase Admin SDK...');
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized successfully.');
    
    return admin.app();
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    // Depending on the environment, you might want to handle this differently.
    // For example, in a production environment, you might want to throw the error
    // to prevent the application from running with a misconfigured Firebase connection.
    throw error;
  }
};

// Initialize the app
const app = initializeFirebaseAdmin();

// Get the Firestore instance
// Ensure that Firestore is accessed after initialization
let db: admin.firestore.Firestore;
try {
  db = app.firestore();
  console.log('Firestore instance retrieved successfully.');
} catch (error) {
  console.error('Failed to retrieve Firestore instance:', error);
  throw error; // Or handle it as needed
}

export { db, admin };
