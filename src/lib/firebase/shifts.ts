import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ShiftSchedule, StoreHours, DayOfWeek } from "./types";

const SHIFTS_COLLECTION = "shiftSchedules";
const STORE_HOURS_COLLECTION = "storeHours";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Get shift schedules by company and branch
export const getShiftSchedulesByBranch = async (
  companyId: string,
  branchId: string
): Promise<ShiftSchedule[]> => {
  try {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      where("companyId", "==", companyId),
      where("branchId", "==", branchId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamp(doc.data()),
    })) as ShiftSchedule[];
  } catch (error) {
    throw error;
  }
};

// Get shift schedules by employee
export const getShiftSchedulesByEmployee = async (
  companyId: string,
  branchId: string,
  employeeId: string
): Promise<ShiftSchedule[]> => {
  try {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      where("companyId", "==", companyId),
      where("branchId", "==", branchId),
      where("employeeId", "==", employeeId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamp(doc.data()),
    })) as ShiftSchedule[];
  } catch (error) {
    throw error;
  }
};

// Create shift schedule
export const createShiftSchedule = async (
  shiftSchedule: Omit<ShiftSchedule, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, SHIFTS_COLLECTION), {
      ...shiftSchedule,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update shift schedule
export const updateShiftSchedule = async (
  id: string,
  updates: Partial<Omit<ShiftSchedule, "id" | "createdAt" | "updatedAt">>
): Promise<void> => {
  try {
    await updateDoc(doc(db, SHIFTS_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    throw error;
  }
};

// Delete shift schedule
export const deleteShiftSchedule = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, SHIFTS_COLLECTION, id));
  } catch (error) {
    throw error;
  }
};

// Get store hours by branch
export const getStoreHoursByBranch = async (
  companyId: string,
  branchId: string
): Promise<StoreHours[]> => {
  try {
    const q = query(
      collection(db, STORE_HOURS_COLLECTION),
      where("companyId", "==", companyId),
      where("branchId", "==", branchId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamp(doc.data()),
    })) as StoreHours[];
  } catch (error) {
    throw error;
  }
};

// Create or update store hours
export const upsertStoreHours = async (
  storeHours: Omit<StoreHours, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    // Önce mevcut kaydı kontrol et
    const q = query(
      collection(db, STORE_HOURS_COLLECTION),
      where("companyId", "==", storeHours.companyId),
      where("branchId", "==", storeHours.branchId),
      where("dayOfWeek", "==", storeHours.dayOfWeek)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Mevcut kaydı güncelle
      const docId = querySnapshot.docs[0].id;
      await updateDoc(doc(db, STORE_HOURS_COLLECTION, docId), {
        ...storeHours,
        updatedAt: Timestamp.now(),
      });
      return docId;
    } else {
      // Yeni kayıt oluştur
      const docRef = await addDoc(collection(db, STORE_HOURS_COLLECTION), {
        ...storeHours,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    }
  } catch (error) {
    throw error;
  }
};

// Delete store hours
export const deleteStoreHours = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, STORE_HOURS_COLLECTION, id));
  } catch (error) {
    throw error;
  }
};
