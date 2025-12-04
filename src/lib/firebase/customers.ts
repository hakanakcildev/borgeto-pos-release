import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy,
  deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CustomerAccount } from "./types";

const COLLECTION_NAME = "customers";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
  lastOrderAt: data.lastOrderAt?.toDate() || undefined,
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<CustomerAccount>) => {
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  const result: any = {
    ...filteredData,
    createdAt:
      filteredData.createdAt && filteredData.createdAt instanceof Date
        ? Timestamp.fromDate(filteredData.createdAt)
        : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // lastOrderAt sadece varsa ekle
  if (filteredData.lastOrderAt && filteredData.lastOrderAt instanceof Date) {
    result.lastOrderAt = Timestamp.fromDate(filteredData.lastOrderAt);
  } else if (filteredData.lastOrderAt === null) {
    result.lastOrderAt = deleteField();
  }

  return result;
};

// Get all customers for a company (optionally filtered by branch)
export const getCustomersByCompany = async (
  companyId: string,
  branchId?: string
): Promise<CustomerAccount[]> => {
  try {
    let q;
    if (branchId) {
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("branchId", "==", branchId),
        where("isActive", "==", true)
      );
    } else {
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("isActive", "==", true)
      );
    }

    const querySnapshot = await getDocs(q);
    const customers = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertTimestamp(doc.data()),
    })) as CustomerAccount[];
    
    // Client-side sorting to avoid composite index issues
    return customers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    // If collection doesn't exist or is empty, return empty array
    return [];
  }
};

// Get a single customer by ID
export const getCustomer = async (
  customerId: string
): Promise<CustomerAccount | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, customerId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamp(docSnap.data()),
    } as CustomerAccount;
  } catch (error) {
    throw new Error(`Error fetching customer: ${error}`);
  }
};

// Add a new customer
export const addCustomer = async (
  customer: Omit<CustomerAccount, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const firestoreData = convertToFirestore(customer);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), firestoreData);
    return docRef.id;
  } catch (error) {
    throw new Error(`Error adding customer: ${error}`);
  }
};

// Update a customer
export const updateCustomer = async (
  customerId: string,
  updates: Partial<CustomerAccount>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, customerId);
    const firestoreData = convertToFirestore(updates);
    await updateDoc(docRef, firestoreData);
  } catch (error) {
    throw new Error(`Error updating customer: ${error}`);
  }
};

// Delete a customer (soft delete - set isActive to false)
export const deleteCustomer = async (customerId: string): Promise<void> => {
  try {
    await updateCustomer(customerId, { isActive: false });
  } catch (error) {
    throw new Error(`Error deleting customer: ${error}`);
  }
};

