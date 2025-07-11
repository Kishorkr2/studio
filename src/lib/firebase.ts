
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, terminate, clearIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let db = getFirestore(app);

// A variable to track if persistence has been enabled.
let persistenceEnabled = false;

// Enable offline persistence
if (typeof window !== "undefined") {
    (async () => {
        try {
            // Only try to enable persistence once.
            if (!persistenceEnabled) {
                await enableIndexedDbPersistence(db);
                persistenceEnabled = true;
            }
        } catch (err: any) {
            // This is the fallback mechanism. If persistence fails, the app will
            // continue in online-only mode, preventing a crash.
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence failed: multiple tabs open. Offline features may be degraded.');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not available in this browser. Offline features will be disabled.');
            } else {
                console.error("CRITICAL: Firestore persistence failed to initialize. The app will run in online-only mode. Please clear the cache via Admin > Settings to resolve.", err);
            }
        }
    })();
}

export const clearFirestoreCache = async () => {
    if (typeof window !== 'undefined') {
        try {
            // Terminate the existing Firestore instance to release all resources.
            await terminate(db);
            // Clear the local IndexedDB cache.
            await clearIndexedDbPersistence(db);
            console.log("Firestore local persistence cleared successfully.");
        } catch (error) {
            console.error("Error clearing Firestore cache:", error);
            throw error; // Re-throw to be caught by the UI
        } finally {
            // Re-initialize the app and Firestore after clearing.
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            // Attempt to re-enable persistence for the next session.
             (async () => {
                try {
                    await enableIndexedDbPersistence(db);
                    persistenceEnabled = true;
                } catch (e) {
                    console.error("Failed to re-enable persistence after clearing cache.", e);
                }
            })();
            console.log("Firestore re-initialized.");
        }
    }
};

export { db };
