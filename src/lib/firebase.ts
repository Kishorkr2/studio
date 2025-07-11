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

let app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let db = getFirestore(app);

// Enable offline persistence
if (typeof window !== "undefined") {
    (async () => {
        try {
            await enableIndexedDbPersistence(db);
        } catch (err: any) {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence failed: multiple tabs open. Offline features may be degraded.');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not available in this browser. Offline features will be disabled.');
            } else {
                console.error("An error occurred with Firestore persistence, app will run in online-only mode.", err);
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
        } finally {
            console.log("Reloading the page to apply cache clearing.");
        }
    }
};


export { db };
