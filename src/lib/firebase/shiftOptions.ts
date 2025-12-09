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
import type { ShiftOption } from "./types";

const SHIFT_OPTIONS_COLLECTION = "shiftOptions";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Get shift options by company and branch
export const getShiftOptionsByBranch = async (
  companyId: string,
  branchId: string
): Promise<ShiftOption[]> => {
  try {
    const q = query(
      collection(db, SHIFT_OPTIONS_COLLECTION),
      where("companyId", "==", companyId),
      where("branchId", "==", branchId)
    );

    const querySnapshot = await getDocs(q);
    const options = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamp(doc.data()),
    })) as ShiftOption[];

    // Client-side sorting by order
    return options.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error("Error getting shift options:", error);
    throw error;
  }
};

// Get shift option by ID
export const getShiftOptionById = async (
  id: string
): Promise<ShiftOption | null> => {
  try {
    const docRef = doc(db, SHIFT_OPTIONS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamp(docSnap.data()),
    } as ShiftOption;
  } catch (error) {
    console.error("Error getting shift option:", error);
    throw error;
  }
};

// Create shift option
export const createShiftOption = async (
  option: Omit<ShiftOption, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, SHIFT_OPTIONS_COLLECTION), {
      ...option,
      createdAt: now,
      updatedAt: now,
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating shift option:", error);
    throw error;
  }
};

// Update shift option
export const updateShiftOption = async (
  id: string,
  option: Partial<Omit<ShiftOption, "id" | "createdAt" | "updatedAt">>
): Promise<void> => {
  try {
    const docRef = doc(db, SHIFT_OPTIONS_COLLECTION, id);
    await updateDoc(docRef, {
      ...option,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating shift option:", error);
    throw error;
  }
};

// Delete shift option
export const deleteShiftOption = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, SHIFT_OPTIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting shift option:", error);
    throw error;
  }
};
