
import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, terminate, clearIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
let db = getFirestore(app);
let persistenceEnabled = false;

if (typeof window !== "undefined" && !persistenceEnabled) {
  (async () => {
    try {
      // First, check if projectId is valid. If not, Firestore will hang.
      if (!firebaseConfig.projectId) {
          console.error("Firebase projectId is missing. App will run in a degraded mode. Please check your .env file.");
          return; // Prevent further execution
      }
      await enableIndexedDbPersistence(db);
      persistenceEnabled = true;
      console.log("Firestore offline persistence enabled.");
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open. App will run in online-only mode.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser. App will run in online-only mode.');
      } else {
        console.error("CRITICAL: Firestore persistence failed to initialize, likely due to corrupted data. The app will run in online-only mode. Please clear the cache via Admin > Settings to resolve.", err);
      }
    }
  })();
}


export const clearFirestoreCache = async () => {
    if (typeof window !== 'undefined') {
        try {
            await terminate(db);
            await clearIndexedDbPersistence(db);
            console.log("Firestore local persistence cleared successfully.");
        } catch (error) {
            console.error("Error clearing Firestore cache:", error);
            throw error;
        } finally {
            // Re-initialize the app and Firestore. This is safer than deleting the app instance.
            if(getApps().length === 0) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }
            db = getFirestore(app);
            // Re-enable persistence
            (async () => {
                try {
                    await enableIndexedDbPersistence(db);
                    persistenceEnabled = true;
                    console.log("Firestore re-initialized with persistence.");
                } catch (e) {
                    console.error("Failed to re-enable persistence after clearing cache.", e);
                }
            })();
        }
    }
};

export { db };
