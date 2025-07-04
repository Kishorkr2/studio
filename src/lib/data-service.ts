import { db } from './firebase';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, writeBatch, onSnapshot, query, where, collectionGroup } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { initialOperators, initialMachines, shifts as initialShifts, initialProductionPlan } from './data';
import type { Operator, Machine, ShiftInfo, ProductionPlanItem, MarketRequirement, ProductionLog, TreadStock, MachineProductionData } from './types';
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

// --- Single Read Functions ---
export const getFullProductionHistory = async (): Promise<any[]> => {
    const logsCol = collection(db, 'productionLogs');
    const snapshot = await getDocs(logsCol);
    const allLogs: any[] = [];
    snapshot.forEach(doc => {
        allLogs.push({ id: doc.id, ...doc.data() });
    });
    return allLogs;
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

export const setMarketRequirements = async (requirements: MarketRequirement[]) => {
    const batch = writeBatch(db);
    const reqCollection = collection(db, 'marketRequirements');
    const currentDocs = await getDocs(reqCollection);
    currentDocs.forEach(doc => batch.delete(doc.ref));
    requirements.forEach(req => {
        const { id, ...data } = req;
        const docRef = doc(reqCollection);
        batch.set(docRef, data);
    });
    await batch.commit();
};

export const clearMarketRequirements = async () => {
    const reqCollection = collection(db, 'marketRequirements');
    const currentDocs = await getDocs(reqCollection);
    const batch = writeBatch(db);
    currentDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
}


export const saveProductionRound = async (date: Date, shift: ShiftInfo, round: string, entries: MachineProductionData[]) => {
    const logId = `production-log-${format(date, "yyyy-MM-dd")}-${shift.name.replace(/\s+/g, '-')}`;
    const docRef = doc(db, 'productionLogs', logId);
    await setDoc(docRef, {
        [round]: { entries, status: 'synced' }
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

export const getDailyProductionLog = async () => {
    const snapshot = await getDocs(collection(db, 'dailyTreadProduction'));
    const log: any = {};
    snapshot.forEach(doc => {
        log[doc.id] = doc.data();
    });
    return log;
};


export const saveTreadOpeningStock = async (stock: TreadStock[]) => {
    const batch = writeBatch(db);
    stock.forEach(item => {
        const docRef = doc(db, 'treadOpeningStock', item.sku);
        batch.set(docRef, item);
    });
    await batch.commit();
};

export const getTreadOpeningStock = async (): Promise<TreadStock[]> => {
    const snapshot = await getDocs(collection(db, 'treadOpeningStock'));
    return snapshot.docs.map(doc => doc.data() as TreadStock);
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
