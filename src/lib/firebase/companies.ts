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
// Eğer companies collection'ında yoksa, users collection'ından admin kullanıcısını bul
export const getCompany = async (id: string): Promise<Company | null> => {
  try {
    // Önce companies collection'ından dene
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Company;
    }

    // Eğer companies'de yoksa, users collection'ından admin kullanıcısını bul
    // (oms-borgeto-com'da companyId, admin'in user ID'si veya companyId field'ı olabilir)
    const usersQuery = query(
      collection(db, "users"),
      where("companyId", "==", id),
      where("role", "==", "admin"),
      limit(1)
    );
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();

      // Admin kullanıcısından company bilgilerini oluştur
      return {
        id: id,
        name: userData.companyName || userData.name || "",
        slug: userData.companySlug || "",
        logoUrl: userData.logoUrl || null,
        phone: userData.phone || "",
        website: userData.website || "",
        address: userData.address || "",
        taxNumber: userData.taxNumber || "",
        email: userData.email || "",
        ownerName: userData.name || "",
        status: "active" as const,
        price: 0,
        hasPosAccess:
          userData.packageType === "pos-qr" ||
          userData.packageType === undefined, // Default true
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      } as Company;
    }

    // Fallback: Eğer companyId direkt user ID ise (eski sistem için)
    const userDocRef = doc(db, "users", id);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.role === "admin") {
        return {
          id: id,
          name: userData.companyName || userData.name || "",
          slug: userData.companySlug || "",
          logoUrl: userData.logoUrl || null,
          phone: userData.phone || "",
          website: userData.website || "",
          address: userData.address || "",
          taxNumber: userData.taxNumber || "",
          email: userData.email || "",
          ownerName: userData.name || "",
          status: "active" as const,
          price: 0,
          hasPosAccess:
            userData.packageType === "pos-qr" ||
            userData.packageType === undefined,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        } as Company;
      }
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
