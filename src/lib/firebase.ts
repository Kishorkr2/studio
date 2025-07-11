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
    (async () => {
        try {
            await enableIndexedDbPersistence(db);
        } catch (err: any) {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence failed: multiple tabs open. Offline features will be disabled.');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not available in this browser. Offline features will be disabled.');
            } else {
                console.error("An error occurred with Firestore persistence. Offline features will be disabled.", err);
            }
        }
    })();
}

export const clearFirestoreCache = async () => {
    if (typeof window !== 'undefined') {
        try {
            // Terminate the existing Firestore instance to release locks.
            await terminate(db);

            // Delete the entire Firebase app instance.
            // This is a more aggressive way to clear state.
            await deleteApp(app);
            console.log("Firebase app instance deleted.");

            // Physically delete the IndexedDB database.
            // This name is specific to how Firebase Firestore JS SDK names its DB.
             const dbName = `firestore/${firebaseConfig.projectId}/(default)/main`;

            await new Promise<void>((resolve, reject) => {
                console.log(`Attempting to delete IndexedDB: ${dbName}`);
                try {
                    const deleteRequest = indexedDB.deleteDatabase(dbName);
                    deleteRequest.onsuccess = () => {
                        console.log("IndexedDB deleted successfully.");
                        resolve();
                    };
                    deleteRequest.onerror = (event) => {
                        console.error("Failed to delete IndexedDB:", (event.target as any)?.error);
                        reject(new Error(`Failed to delete IndexedDB: ${(event.target as any)?.error}`));
                    };
                    deleteRequest.onblocked = () => {
                        console.warn("IndexedDB delete is blocked. Please close other tabs with this app open.");
                        // This can happen if other tabs have the DB open.
                        // We will still try to reload and hope for the best.
                        resolve();
                    };
                } catch (e) {
                     console.error("Error initiating IndexedDB deletion:", e);
                     reject(e);
                }
            });

        } catch (error) {
            console.error("Error clearing Firestore cache:", error);
            // We will proceed to reload regardless of error, as it's the best chance of recovery.
        } finally {
            // A full page reload is necessary to apply the changes.
            console.log("Reloading the page to apply cache clearing.");
        }
    }
};


export { db };
