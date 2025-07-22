
import { db } from './firebase';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, writeBatch, onSnapshot, query, where, collectionGroup } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { initialOperators, initialMachines, shifts as initialShifts, initialProductionPlan } from './data';
import type { Operator, Machine, ShiftInfo, ProductionPlanItem, ProductionLog, TreadStock, MachineProductionData } from './types';
import { format } from 'date-fns';

// --- Seeding Functions ---
const seedCollection = async <T extends { id?: string }>(collectionName: string, initialData: T[]) => {
    const batch = writeBatch(db);
    const collectionRef = collection(db, collectionName);
    initialData.forEach(item => {
        const { id, ...data } = item;
        const docRef = id ? doc(collectionRef, id) : doc(collectionRef);
        batch.set(docRef, data);
    });
    await batch.commit();
};

// --- Real-time Subscriptions ---

export const subscribeToCollection = <T>(collectionName: string, setData: (data: T[]) => void, initialData?: T[]): Unsubscribe => {
    const q = collection(db, collectionName);
    return onSnapshot(q, async (querySnapshot) => {
        if (querySnapshot.empty && initialData?.length) {
            console.log(`Collection '${collectionName}' is empty. Seeding...`);
            await seedCollection(collectionName, initialData);
        } else {
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            setData(data);
        }
    }, (error) => {
        console.error(`Error subscribing to ${collectionName}: `, error);
        // Optionally handle the error, e.g., by setting an error state
    });
};

export const subscribeToDoc = <T>(collectionName: string, docId: string, setData: (data: T | null) => void): Unsubscribe => {
    const docRef = doc(db, collectionName, docId);
    return onSnapshot(docRef, (doc) => {
        setData(doc.exists() ? { id: doc.id, ...doc.data() } as T : null);
    });
};

export const subscribeToProductionLog = (date: Date, shift: ShiftInfo, setLog: (log: ProductionLog) => void): Unsubscribe => {
    const logId = `production-log-${format(date, "yyyy-MM-dd")}-${shift.name.replace(/\s+/g, '-')}`;
    const docRef = doc(db, 'productionLogs', logId);

    return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            setLog(snapshot.data() as ProductionLog);
        } else {
            setLog({});
        }
    });
};

// --- Write Functions ---

export const updateOperator = async (id: string, data: Partial<Operator>) => await setDoc(doc(db, 'operators', id), data, { merge: true });
export const addOperator = async (data: Omit<Operator, 'id'>) => await addDoc(collection(db, 'operators'), data);
export const deleteOperator = async (id: string) => await deleteDoc(doc(db, 'operators', id));

export const updateMachines = async (machines: Machine[]) => {
    const batch = writeBatch(db);
    machines.forEach(machine => {
        const { id, ...data } = machine;
        if(id) batch.set(doc(db, 'machines', id), data);
    });
    await batch.commit();
};
export const addMachine = async (data: Omit<Machine, 'id'>) => await addDoc(collection(db, 'machines'), data);
export const deleteMachine = async (id: string) => await deleteDoc(doc(db, 'machines', id));

export const updateShifts = async (shifts: ShiftInfo[]) => {
    const batch = writeBatch(db);
    shifts.forEach(shift => {
        batch.set(doc(db, 'shifts', shift.name.replace(/\s+/g, '-')), shift);
    });
    await batch.commit();
};

export const updateProductionPlan = async (plan: ProductionPlanItem[]) => {
    const batch = writeBatch(db);
    const planCollection = collection(db, 'productionPlan');
    const currentDocs = await getDocs(planCollection);
    currentDocs.forEach(doc => batch.delete(doc.ref));
    plan.forEach(item => {
        const docRef = doc(planCollection, item.machineId);
        batch.set(docRef, item);
    });
    await batch.commit();
};

export const saveProductionRound = async (date: Date, shift: ShiftInfo, round: string, entries: MachineProductionData[]) => {
    const logId = `production-log-${format(date, "yyyy-MM-dd")}-${shift.name.replace(/\s+/g, '-')}`;
    const docRef = doc(db, 'productionLogs', logId);

    const sanitizedEntries = entries.map(entry => ({
      machineId: entry.machineId || null,
      name: entry.name || null,
      status: entry.status || 'Offline',
      sku: entry.sku || null,
      sapCode: entry.sapCode || null,
      quantity: entry.quantity || 0,
      operatorId: entry.operatorId || null,
      remark: entry.remark || null,
      trolleyNo: entry.trolleyNo || null,
    }));

    await setDoc(docRef, {
        [round]: { entries: sanitizedEntries, status: 'synced' }
    }, { merge: true });
};

export const clearShiftData = async (date: Date, shift: ShiftInfo) => {
    const logId = `production-log-${format(date, "yyyy-MM-dd")}-${shift.name.replace(/\s+/g, '-')}`;
    await deleteDoc(doc(db, 'productionLogs', logId));
};

export const saveDailyProductionLog = async (log: any) => {
    const batch = writeBatch(db);
    Object.entries(log).forEach(([dateKey, dateData]) => {
        const docRef = doc(db, 'dailyTreadProduction', dateKey);
        batch.set(docRef, dateData as any);
    });
    await batch.commit();
}

export const saveTreadOpeningStock = async (stock: TreadStock[]) => {
    const batch = writeBatch(db);
    const stockCollection = collection(db, 'treadOpeningStock');
    
    // Get all SKUs from the new stock data
    const newSkus = new Set(stock.map(item => item.sku));
    
    // Find existing documents to update
    const existingDocs = await getDocs(query(stockCollection, where('sku', 'in', Array.from(newSkus))));
    const existingSkuMap = new Map(existingDocs.docs.map(d => [d.data().sku, d.id]));

    stock.forEach(item => {
        if (existingSkuMap.has(item.sku)) {
            // Update existing document
            const docRef = doc(db, 'treadOpeningStock', existingSkuMap.get(item.sku)!);
            batch.set(docRef, item);
        } else {
            // Create new document, letting firestore generate the ID
             const docRef = doc(stockCollection);
             batch.set(docRef, item);
        }
    });
    await batch.commit();
};

export const clearAllProductionData = async () => {
    const batch = writeBatch(db);
    const logsSnapshot = await getDocs(collection(db, 'productionLogs'));
    logsSnapshot.forEach(doc => batch.delete(doc.ref));
    
    const dailyLogsSnapshot = await getDocs(collection(db, 'dailyTreadProduction'));
    dailyLogsSnapshot.forEach(doc => batch.delete(doc.ref));

    const openingStockSnapshot = await getDocs(collection(db, 'treadOpeningStock'));
    openingStockSnapshot.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
};
