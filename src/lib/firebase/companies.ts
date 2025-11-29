import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Company } from "./types";

const COLLECTION_NAME = "companies";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Get company by ID
export const getCompany = async (id: string): Promise<Company | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Company;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Get company by slug
export const getCompanyBySlug = async (
  slug: string
): Promise<Company | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("slug", "==", slug),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...convertTimestamp(doc.data()),
      } as Company;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

