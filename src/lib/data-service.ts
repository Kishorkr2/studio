
import { db } from './firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Operator, Machine, ShiftInfo, ProductionPlanItem, MarketRequirement, TreadStock, ProductionLog } from '@/lib/types';
import { initialOperators, shifts as initialShifts, initialProductionPlan, initialMachines } from '@/lib/data';

// --- Generic Functions ---

async function seedCollection<T extends { id?: string }>(collectionName: string, initialData: T[], idField: keyof T) {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    if (snapshot.empty && initialData.length > 0) {
        console.log(`Seeding '${collectionName}'...`);
        const batch = writeBatch(db);
        initialData.forEach((item) => {
            const docId = item[idField] as string;
            const docRef = doc(db, collectionName, docId);
            batch.set(docRef, item);
        });
        await batch.commit();
    }
}

async function getCollectionData<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, collectionName));
    if (querySnapshot.empty) {
        return [];
    }
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

async function getCollectionDataWithCustomId<T>(collectionName: string, idField: keyof T): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, collectionName));
    if (querySnapshot.empty) {
        return [];
    }
    return querySnapshot.docs.map(doc => (doc.data() as T));
}


async function setCollectionData<T extends { id: string }>(collectionName: string, data: T[]) {
    const batch = writeBatch(db);
    const collectionRef = collection(db, collectionName);

    const snapshot = await getDocs(collectionRef);
    const existingIds = new Set(snapshot.docs.map(d => d.id));
    const newIds = new Set(data.map(item => item.id));

    existingIds.forEach(id => {
        if (!newIds.has(id)) {
            batch.delete(doc(collectionRef, id));
        }
    });
    
    data.forEach(item => {
        const { id, ...itemData } = item;
        const docRef = doc(collectionRef, id);
        batch.set(docRef, itemData);
    });

    await batch.commit();
}


async function setCollectionDataWithCustomId<T>(collectionName: string, data: T[], idField: keyof T) {
    const batch = writeBatch(db);
    const collectionRef = collection(db, collectionName);

    const snapshot = await getDocs(collectionRef);
    const existingIds = new Set(snapshot.docs.map(d => d.id));
    const newIds = new Set(data.map(item => item[idField] as string));

    existingIds.forEach(id => {
        if (!newIds.has(id)) {
            batch.delete(doc(collectionRef, id));
        }
    });

    data.forEach(item => {
        const docId = item[idField] as string;
        const docRef = doc(collectionRef, docId);
        batch.set(docRef, item);
    });

    await batch.commit();
}

// --- Seeding ---

export async function seedInitialData() {
    await Promise.all([
        seedCollection<Operator>('operators', initialOperators, 'id'),
        seedCollection<Machine>('machines', initialMachines, 'id'),
        seedCollection<ShiftInfo>('shifts', initialShifts, 'name'),
        seedCollection<ProductionPlanItem>('productionPlan', initialProductionPlan, 'machineId'),
    ]);
}


// --- Specific Data Functions ---

export const getOperators = () => getCollectionData<Operator>('operators');
export const saveOperators = (operators: Operator[]) => setCollectionData('operators', operators);

export const getMachines = () => getCollectionData<Machine>('machines');
export const saveMachines = (machines: Machine[]) => setCollectionData('machines', machines);

export const getShifts = () => getCollectionDataWithCustomId<ShiftInfo>('shifts', 'name');
export const saveShifts = (shifts: ShiftInfo[]) => setCollectionDataWithCustomId('shifts', shifts, 'name');

export const getProductionPlan = () => getCollectionData<ProductionPlanItem>('productionPlan');
export const saveProductionPlan = (plan: ProductionPlanItem[]) => setCollectionData('productionPlan', plan);

export const getMarketRequirements = () => getCollectionDataWithCustomId<MarketRequirement>('marketRequirements', 'sku');
export const saveMarketRequirements = (reqs: MarketRequirement[]) => setCollectionDataWithCustomId('marketRequirements', reqs, 'sku');

export const clearMarketRequirements = async () => {
    const batch = writeBatch(db);
    const snapshot = await getDocs(collection(db, 'marketRequirements'));
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

export const clearAllProductionData = async () => {
    const batch = writeBatch(db);
    const snapshot = await getDocs(collection(db, 'productionLogs'));
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}
