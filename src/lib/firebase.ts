import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, terminate } from "firebase/firestore";

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
    try {
        enableIndexedDbPersistence(db)
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    // Multiple tabs open, persistence can only be enabled
                    // in one tab at a time.
                    console.warn('Firestore persistence failed: multiple tabs open.');
                } else if (err.code == 'unimplemented') {
                    // The current browser does not support all of the
                    // features required to enable persistence
                    console.warn('Firestore persistence not available in this browser.');
                }
            });
    } catch (e) {
        console.error("Failed to enable Firestore persistence", e);
    }
}

export const clearFirestoreCache = async () => {
    if (typeof window !== 'undefined') {
        try {
            await terminate(db);
            const dbName = `firebase/firestore/${firebaseConfig.projectId}/(default)`;
            await new Promise<void>((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(dbName);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = (event) => reject(new Error(`Failed to delete IndexedDB: ${(event.target as any)?.error}`));
                deleteRequest.onblocked = () => {
                    console.warn("IndexedDB delete is blocked. Please close other tabs with this app open.");
                    // Don't reject, just warn and proceed with reinitialization. The user will need to reload.
                    resolve(); 
                };
            });

            // Re-initialize app and db
            app = initializeApp(firebaseConfig, "reinit");
            db = getFirestore(app);
            await enableIndexedDbPersistence(db);
            
            console.log("Firestore cache cleared and re-initialized successfully.");
        } catch (error) {
            console.error("Error clearing Firestore cache:", error);
            throw error;
        }
    }
};


export { db };
