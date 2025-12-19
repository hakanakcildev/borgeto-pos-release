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
} from "firebase/firestore";
import { db } from "./firebase";
import type { PaymentMethodConfig } from "./types";

const COLLECTION_NAME = "paymentMethods";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any): PaymentMethodConfig => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<PaymentMethodConfig>) => {
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  return {
    ...filteredData,
    createdAt:
      filteredData.createdAt && filteredData.createdAt instanceof Date
        ? Timestamp.fromDate(filteredData.createdAt)
        : filteredData.createdAt && typeof filteredData.createdAt === "string"
          ? Timestamp.fromDate(new Date(filteredData.createdAt))
          : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
};

// Şirkete göre ödeme yöntemlerini getir (client-side sorting)
export async function getPaymentMethodsByCompany(
  companyId: string,
  branchId?: string
): Promise<PaymentMethodConfig[]> {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId)
    );

    if (branchId) {
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("branchId", "==", branchId)
      );
    }

    const snapshot = await getDocs(q);
    let methods = snapshot.docs.map((doc) =>
      convertTimestamp({ id: doc.id, ...doc.data() })
    );

    // BranchId'ye göre filtrele (client-side)
    if (branchId) {
      methods = methods.filter((m) => m.branchId === branchId);
    } else {
      // BranchId yoksa, branchId'si null veya undefined olanları al
      methods = methods.filter(
        (m) => !m.branchId || m.branchId === null || m.branchId === undefined
      );
    }

    // Duplicate kontrolü: Aynı code'a sahip olanları filtrele (en son eklenen kalır)
    const uniqueMethods = new Map<string, PaymentMethodConfig>();
    methods.forEach((method) => {
      const key = method.code;
      if (
        !uniqueMethods.has(key) ||
        (method.createdAt &&
          uniqueMethods.get(key)!.createdAt &&
          method.createdAt > uniqueMethods.get(key)!.createdAt)
      ) {
        uniqueMethods.set(key, method);
      }
    });

    // Client-side sorting (order'a göre)
    return Array.from(uniqueMethods.values()).sort((a, b) => a.order - b.order);
  } catch (error) {
    throw error;
  }
}

// Belirli bir kod ile ödeme yönteminin varlığını kontrol et
async function checkPaymentMethodExists(
  companyId: string,
  code: string,
  branchId?: string
): Promise<boolean> {
  try {
    let q = query(
      collection(db, COLLECTION_NAME),
      where("companyId", "==", companyId),
      where("code", "==", code)
    );

    if (branchId) {
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("branchId", "==", branchId),
        where("code", "==", code)
      );
    } else {
      // BranchId yoksa, branchId'si null veya undefined olanları kontrol et
      q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("code", "==", code)
      );
    }

    const snapshot = await getDocs(q);

    // BranchId yoksa, sadece branchId'si null/undefined olanları say
    if (!branchId) {
      const methods = snapshot.docs.map((doc) => doc.data());
      return methods.some((m) => !m.branchId || m.branchId === null);
    }

    return snapshot.size > 0;
  } catch (error) {
    return false;
  }
}

// Ödeme yöntemi ekle
export async function addPaymentMethod(
  data: Omit<PaymentMethodConfig, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  try {
    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      convertToFirestore(data)
    );
    return docRef.id;
  } catch (error) {
    throw error;
  }
}

// Ödeme yöntemi güncelle
export async function updatePaymentMethod(
  id: string,
  data: Partial<Omit<PaymentMethodConfig, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, convertToFirestore(data));
  } catch (error) {
    throw error;
  }
}

// Ödeme yöntemi sil
export async function deletePaymentMethod(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
}

// Ödeme yöntemi getir (ID ile)
export async function getPaymentMethod(
  id: string
): Promise<PaymentMethodConfig | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return convertTimestamp({ id: docSnap.id, ...docSnap.data() });
    }
    return null;
  } catch (error) {
    throw error;
  }
}

// Standart ödeme yöntemlerini oluştur (ilk kurulum için)
export async function createDefaultPaymentMethods(
  companyId: string,
  branchId?: string
): Promise<void> {
  try {
    const defaultMethods: Omit<
      PaymentMethodConfig,
      "id" | "createdAt" | "updatedAt"
    >[] = [
      {
        companyId,
        branchId,
        code: "cash",
        name: "Nakit",
        color: "#16a34a", // green-600
        isDefault: true,
        isActive: true,
        order: 1,
      },
      {
        companyId,
        branchId,
        code: "card",
        name: "Kart",
        color: "#2563eb", // blue-600
        isDefault: true,
        isActive: true,
        order: 2,
      },
      {
        companyId,
        branchId,
        code: "online",
        name: "Online",
        color: "#0ea5e9", // sky-500
        isDefault: true,
        isActive: true,
        order: 3,
      },
      {
        companyId,
        branchId,
        code: "pluxee",
        name: "Pluexee",
        color: "#8b5cf6", // violet-500
        isDefault: true,
        isActive: true,
        order: 4,
      },
      {
        companyId,
        branchId,
        code: "ticket",
        name: "Ticket",
        color: "#f59e0b", // amber-500
        isDefault: true,
        isActive: true,
        order: 5,
      },
      {
        companyId,
        branchId,
        code: "multinet",
        name: "Multinet",
        color: "#ec4899", // pink-500
        isDefault: true,
        isActive: true,
        order: 6,
      },
      {
        companyId,
        branchId,
        code: "setcard",
        name: "SetCard",
        color: "#10b981", // emerald-500
        isDefault: true,
        isActive: true,
        order: 7,
      },
      {
        companyId,
        branchId,
        code: "metropol",
        name: "Metropol",
        color: "#6366f1", // indigo-500
        isDefault: true,
        isActive: true,
        order: 8,
      },
    ];

    // mealCard (Yemek Kartı) kayıtlarını kaldır
    try {
      let q = query(
        collection(db, COLLECTION_NAME),
        where("companyId", "==", companyId),
        where("code", "==", "mealCard")
      );

      if (branchId) {
        q = query(
          collection(db, COLLECTION_NAME),
          where("companyId", "==", companyId),
          where("branchId", "==", branchId),
          where("code", "==", "mealCard")
        );
      }

      const mealCardSnapshot = await getDocs(q);
      const mealCardDocs = mealCardSnapshot.docs.filter((doc) => {
        const data = doc.data();
        if (branchId) {
          return data.branchId === branchId;
        }
        return (
          !data.branchId ||
          data.branchId === null ||
          data.branchId === undefined
        );
      });

      // Tüm mealCard kayıtlarını sil
      for (const doc of mealCardDocs) {
        await deleteDoc(doc.ref);
      }
    } catch (error) {
      // mealCard silme hatası kritik değil, devam et
      console.error("Error removing mealCard:", error);
    }

    // Her standart ödeme yöntemi için ayrı ayrı kontrol et ve yoksa ekle
    for (const method of defaultMethods) {
      const exists = await checkPaymentMethodExists(
        companyId,
        method.code,
        branchId
      );
      if (!exists) {
        await addPaymentMethod(method);
      }
    }
  } catch (error) {
    throw error;
  }
}
