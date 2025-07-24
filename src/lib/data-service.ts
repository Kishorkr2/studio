
import {db} from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  collectionGroup,
  getDocsFromCache,
} from 'firebase/firestore';
import type {Unsubscribe} from 'firebase/firestore';
import {
  initialOperators,
  initialMachines,
  shifts as initialShifts,
  initialProductionPlan,
} from './data';
import type {
  Operator,
  Machine,
  ShiftInfo,
  ProductionPlanItem,
  ProductionLog,
  TreadStock,
  MachineProductionData,
} from './types';
import {format} from 'date-fns';

const seedCollection = async <T>(
  collectionName: string,
  initialData: T[],
  idField: keyof T
) => {
  const collectionRef = collection(db, collectionName);
  console.log(`Seeding '${collectionName}'...`);
  const batch = writeBatch(db);
  initialData.forEach(item => {
    const docId = String(item[idField]);
    const docRef = doc(collectionRef, docId);
    batch.set(docRef, item);
  });
  await batch.commit();
};

export const subscribeToCollection = <T>(
  collectionName: string,
  setData: (data: T[]) => void,
  initialData?: T[]
): Unsubscribe => {
  const q = query(collection(db, collectionName));

  const unsub = onSnapshot(
    q,
    async querySnapshot => {
      if (
        querySnapshot.empty &&
        initialData?.length &&
        collectionName !== 'productionPlan'
      ) {
        let idField: keyof T | null = null;
        if (collectionName === 'operators') idField = 'cardNo' as keyof T;
        else if (collectionName === 'shifts') idField = 'name' as keyof T;
        else if (collectionName === 'machines') idField = 'id' as keyof T;

        if (idField) {
          try {
            await seedCollection(collectionName, initialData, idField);
            return;
          } catch (error) {
            console.error(`Failed to seed ${collectionName}:`, error);
          }
        }
      }

      const data = querySnapshot.docs.map(d => {
        const docData = d.data() as T;
        const id = d.id;

        if (collectionName === 'productionPlan') {
          return {...docData, machineId: id};
        }
        if (collectionName === 'operators') {
          return {...docData, cardNo: id};
        }
        if (collectionName === 'machines') {
          return {...docData, id: id};
        }
        return {id, ...docData};
      }) as T[];

      setData(data);
    },
    error => {
      console.error(`Error subscribing to ${collectionName}:`, error);
    }
  );

  return unsub;
};

export const subscribeToProductionLogs = (
  setData: (data: any[]) => void
): Unsubscribe => {
  const q = collection(db, 'productionLogs');
  return onSnapshot(
    q,
    querySnapshot => {
      const data = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
      setData(data);
    },
    error => {
      console.error(`Error subscribing to productionLogs: `, error);
    }
  );
};

export const subscribeToProductionLog = (
  date: Date,
  shift: ShiftInfo,
  setLog: (log: ProductionLog) => void
): Unsubscribe => {
  const logId = `production-log-${format(
    date,
    'yyyy-MM-dd'
  )}-${shift.name.replace(/\s+/g, '-')}`;
  const docRef = doc(db, 'productionLogs', logId);

  return onSnapshot(docRef, snapshot => {
    setLog(snapshot.exists() ? (snapshot.data() as ProductionLog) : {});
  });
};

export const updateOperator = async (cardNo: string, data: Partial<Operator>) =>
  await setDoc(doc(db, 'operators', cardNo), data, {merge: true});

export const addOperator = async (
  data: Omit<Operator, 'id' | 'cardNo'> & {cardNo: string}
) => {
  const {cardNo, ...operatorData} = data;
  await setDoc(doc(db, 'operators', cardNo), operatorData);
};

export const deleteOperator = async (cardNo: string) =>
  await deleteDoc(doc(db, 'operators', cardNo));

export const renameOperator = async (
  oldCardNo: string,
  newCardNo: string,
  operatorData: Operator
) => {
  const batch = writeBatch(db);
  const {cardNo, ...dataToSave} = operatorData;
  batch.set(doc(db, 'operators', newCardNo), dataToSave);
  batch.delete(doc(db, 'operators', oldCardNo));
  await batch.commit();
};

export const updateMachines = async (machines: Machine[]) => {
  const batch = writeBatch(db);
  machines.forEach(machine => {
    const {id, ...data} = machine;
    if (id) batch.set(doc(db, 'machines', id), data, {merge: true});
  });
  await batch.commit();
};

export const addMachine = async (data: Omit<Machine, 'id'>) =>
  await addDoc(collection(db, 'machines'), data);

export const deleteMachine = async (id: string) =>
  await deleteDoc(doc(db, 'machines', id));

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

  const existingDocsSnapshot = await getDocs(planCollection);
  const existingDocIds = new Set(existingDocsSnapshot.docs.map(d => d.id));

  plan.forEach(item => {
    const docRef = doc(planCollection, item.machineId);
    batch.set(docRef, item);
    existingDocIds.delete(item.machineId);
  });

  existingDocIds.forEach(docId => {
    batch.delete(doc(planCollection, docId));
  });

  await batch.commit();
};

export const saveProductionRound = async (
  date: Date,
  shift: ShiftInfo,
  round: string,
  entries: MachineProductionData[]
) => {
  const logId = `production-log-${format(
    date,
    'yyyy-MM-dd'
  )}-${shift.name.replace(/\s+/g, '-')}`;
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

  const updatePayload = {
    [`${round}`]: {
      entries: sanitizedEntries,
      status: 'synced',
    },
  };

  try {
    await setDoc(docRef, updatePayload, {merge: true});
  } catch (error) {
    console.error('Error saving production round: ', error);
  }
};

export const clearShiftData = async (date: Date, shift: ShiftInfo) => {
  const logId = `production-log-${format(
    date,
    'yyyy-MM-dd'
  )}-${shift.name.replace(/\s+/g, '-')}`;
  await deleteDoc(doc(db, 'productionLogs', logId));
};

export const saveDailyProductionLog = async (log: any) => {
  const batch = writeBatch(db);
  Object.entries(log).forEach(([dateKey, dateData]) => {
    const docRef = doc(db, 'dailyTreadProduction', dateKey);
    batch.set(docRef, dateData as any, {merge: true});
  });
  await batch.commit();
};

export const saveTreadOpeningStock = async (stock: TreadStock[]) => {
  const batch = writeBatch(db);
  const stockCollection = collection(db, 'treadOpeningStock');

  for (const item of stock) {
    const docRef = doc(stockCollection, item.sku);
    batch.set(docRef, item, {merge: true});
  }
  await batch.commit();
};

export const clearAllProductionData = async () => {
  const batch = writeBatch(db);
  const collectionsToClear = [
    'productionLogs',
    'dailyTreadProduction',
    'treadOpeningStock',
  ];

  for (const collectionName of collectionsToClear) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      snapshot.forEach(doc => batch.delete(doc.ref));
    } catch (error) {
      console.error(`Error fetching docs from ${collectionName}:`, error);
    }
  }

  await batch.commit();
};
