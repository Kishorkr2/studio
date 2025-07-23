
import { db } from './firebase';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, writeBatch, onSnapshot, query, where, collectionGroup, getDocsFromCache } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { initialOperators, initialMachines, shifts as initialShifts, initialProductionPlan } from './data';
import type { Operator, Machine, ShiftInfo, ProductionPlanItem, ProductionLog, TreadStock, MachineProductionData } from './types';
import { format } from 'date-fns';

const seedCollection = async <T>(collectionName: string, initialData: T[], idField: keyof T) => {
    const batch = writeBatch(db);
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    if (snapshot.empty) {
        console.log(`Collection '${collectionName}' is empty. Seeding...`);
        initialData.forEach(item => {
            const docId = String(item[idField]);
            const docRef = doc(collectionRef, docId);
            batch.set(docRef, item);
        });
        await batch.commit();
    }
};

export const subscribeToCollection = <T>(collectionName: string, setData: (data: T[]) => void, initialData?: T[]): Unsubscribe => {
    const q = collection(db, collectionName);
    
    // Define the idField based on the collection name. This is a bit of a convention-based approach.
    const getIdField = (name: string): keyof T | 'id' => {
        if (name === 'operators') return 'cardNo' as keyof T;
        if (name === 'shifts') return 'name' as keyof T;
        return 'id'; // Default for machines, productionPlan etc.
    };
    const idField = getIdField(collectionName);

    const unsub = onSnapshot(q, async (querySnapshot) => {
        if (querySnapshot.empty && initialData?.length) {
            console.log(`Seeding initial data for ${collectionName}`);
            await seedCollection(collectionName, initialData, idField as keyof any);
            // Snapshot listener will re-trigger with new data, so we don't need to call setData here.
        } else {
            const data = querySnapshot.docs.map(d => ({ [idField]: d.id, ...d.data() }) as T);
            setData(data);
        }
    }, (error) => {
        console.error(`Error subscribing to ${collectionName}:`, error);
    });

    return unsub;
};

export const subscribeToProductionLogs = (setData: (data: any[]) => void): Unsubscribe => {
    const q = collection(db, 'productionLogs');
    return onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setData(data);
    }, (error) => {
        console.error(`Error subscribing to productionLogs: `, error);
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

export const updateOperator = async (cardNo: string, data: Partial<Operator>) => await setDoc(doc(db, 'operators', cardNo), data, { merge: true });
export const addOperator = async (data: Omit<Operator, 'id' | 'cardNo'> & {cardNo: string}) => {
    const { cardNo, ...operatorData } = data;
    await setDoc(doc(db, 'operators', cardNo), operatorData);
};
export const deleteOperator = async (cardNo: string) => await deleteDoc(doc(db, 'operators', cardNo));

export const renameOperator = async (oldCardNo: string, newCardNo: string, operatorData: Operator) => {
    const batch = writeBatch(db);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cardNo, ...dataToSave } = operatorData;
    batch.set(doc(db, 'operators', newCardNo), dataToSave);
    batch.delete(doc(db, 'operators', oldCardNo));
    await batch.commit();
}

export const updateMachines = async (machines: Machine[]) => {
    const batch = writeBatch(db);
    machines.forEach(machine => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    
    for(const item of stock) {
      // For each item, query if a doc with that SKU already exists.
      const q = query(stockCollection, where("sku", "==", item.sku));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Update existing document
        const docRef = querySnapshot.docs[0].ref;
        batch.set(docRef, item);
      } else {
        // Create new document, letting Firestore generate the ID
        const docRef = doc(stockCollection);
        batch.set(docRef, item);
      }
    }
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
