'use server';

import { collection, doc, setDoc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { DailyProductionEntry } from '../types';
import { format } from 'date-fns';

export async function saveDailyProductionToFirebase(
  log: Record<string, Record<string, Record<string, DailyProductionEntry>>>
) {
  try {
    for (const [dateKey, dateData] of Object.entries(log)) {
      const docRef = doc(firestore, 'dailyTreadProduction', dateKey);
      await setDoc(docRef, { data: dateData }, { merge: true });
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving to Firebase:', error);
    return { success: false, error: error.message };
  }
}

export async function getDailyProductionFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(firestore, 'dailyTreadProduction'));
    const log: Record<string, Record<string, Record<string, DailyProductionEntry>>> = {};
    
    querySnapshot.forEach((doc) => {
      log[doc.id] = doc.data().data;
    });
    
    return log;
  } catch (error) {
    console.error('Error fetching from Firebase:', error);
    return {};
  }
}