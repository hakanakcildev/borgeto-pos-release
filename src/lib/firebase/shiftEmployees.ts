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
import type { ShiftEmployee } from "./types";

const SHIFT_EMPLOYEES_COLLECTION = "shiftEmployees";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Get shift employees by company and branch
export const getShiftEmployeesByBranch = async (
  companyId: string,
  branchId: string
): Promise<ShiftEmployee[]> => {
  try {
    const q = query(
      collection(db, SHIFT_EMPLOYEES_COLLECTION),
      where("companyId", "==", companyId),
      where("branchId", "==", branchId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamp(doc.data()),
    })) as ShiftEmployee[];
  } catch (error) {
    throw error;
  }
};

// Create shift employee
export const createShiftEmployee = async (
  employee: Omit<ShiftEmployee, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, SHIFT_EMPLOYEES_COLLECTION), {
      ...employee,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update shift employee
export const updateShiftEmployee = async (
  id: string,
  updates: Partial<Omit<ShiftEmployee, "id" | "createdAt" | "updatedAt">>
): Promise<void> => {
  try {
    await updateDoc(doc(db, SHIFT_EMPLOYEES_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    throw error;
  }
};

// Delete shift employee
export const deleteShiftEmployee = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, SHIFT_EMPLOYEES_COLLECTION, id));
  } catch (error) {
    throw error;
  }
};

// Get shift employee by ID
export const getShiftEmployeeById = async (
  id: string
): Promise<ShiftEmployee | null> => {
  try {
    const docRef = doc(db, SHIFT_EMPLOYEES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamp(docSnap.data()),
    } as ShiftEmployee;
  } catch (error) {
    return null;
  }
};
