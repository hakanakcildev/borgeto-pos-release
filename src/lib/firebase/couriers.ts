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
import type { Courier, CourierAssignment } from "./types";

const COURIERS_COLLECTION = "couriers";
const COURIER_ASSIGNMENTS_COLLECTION = "courierAssignments";

// Convert Firestore timestamp to Date
const convertCourierTimestamp = (data: any): Courier => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

const convertAssignmentTimestamp = (data: any): CourierAssignment => ({
  ...data,
  assignedAt: data.assignedAt?.toDate() || new Date(),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: Partial<Courier>) => {
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  return {
    ...filteredData,
    createdAt: filteredData.createdAt && filteredData.createdAt instanceof Date
      ? Timestamp.fromDate(filteredData.createdAt)
      : filteredData.createdAt && typeof filteredData.createdAt === 'string'
      ? Timestamp.fromDate(new Date(filteredData.createdAt))
      : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
};

const convertAssignmentToFirestore = (data: Partial<CourierAssignment>) => {
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  return {
    ...filteredData,
    assignedAt: filteredData.assignedAt && filteredData.assignedAt instanceof Date
      ? Timestamp.fromDate(filteredData.assignedAt)
      : filteredData.assignedAt && typeof filteredData.assignedAt === 'string'
      ? Timestamp.fromDate(new Date(filteredData.assignedAt))
      : Timestamp.now(),
  };
};

// Şirkete göre kuryeleri getir
export async function getCouriersByCompany(
  companyId: string,
  branchId?: string
): Promise<Courier[]> {
  try {
    let q = query(
      collection(db, COURIERS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const snapshot = await getDocs(q);
    let couriers = snapshot.docs.map((doc) =>
      convertCourierTimestamp({ id: doc.id, ...doc.data() })
    );

    // BranchId'ye göre filtrele (client-side)
    if (branchId) {
      couriers = couriers.filter((c) => c.branchId === branchId);
    } else {
      couriers = couriers.filter((c) => !c.branchId || c.branchId === null || c.branchId === undefined);
    }

    // Client-side sıralama (en yeni önce)
    couriers.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return couriers;
  } catch (error) {
    throw error;
  }
}

// Kurye oluştur
export async function addCourier(
  companyId: string,
  courierData: Omit<Courier, "id" | "companyId" | "createdAt" | "updatedAt">
): Promise<string> {
  try {
    const data = {
      ...courierData,
      companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(
      collection(db, COURIERS_COLLECTION),
      convertToFirestore(data)
    );

    return docRef.id;
  } catch (error) {
    throw error;
  }
}

// Kurye güncelle
export async function updateCourier(
  courierId: string,
  updates: Partial<Omit<Courier, "id" | "companyId" | "createdAt" | "updatedAt">>
): Promise<void> {
  try {
    const docRef = doc(db, COURIERS_COLLECTION, courierId);
    await updateDoc(docRef, convertToFirestore(updates));
  } catch (error) {
    throw error;
  }
}

// Kurye sil
export async function deleteCourier(courierId: string): Promise<void> {
  try {
    const docRef = doc(db, COURIERS_COLLECTION, courierId);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
}

// Kurye getir
export async function getCourier(courierId: string): Promise<Courier | null> {
  try {
    const docRef = doc(db, COURIERS_COLLECTION, courierId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertCourierTimestamp({ id: docSnap.id, ...docSnap.data() });
    }

    return null;
  } catch (error) {
    throw error;
  }
}

// Kurye ataması oluştur
export async function addCourierAssignment(
  assignment: Omit<CourierAssignment, "id" | "assignedAt">
): Promise<string> {
  try {
    const data = {
      ...assignment,
      assignedAt: new Date(),
    };

    const docRef = await addDoc(
      collection(db, COURIER_ASSIGNMENTS_COLLECTION),
      convertAssignmentToFirestore(data)
    );

    return docRef.id;
  } catch (error) {
    throw error;
  }
}

// Şirkete göre kurye atamalarını getir
export async function getCourierAssignmentsByCompany(
  companyId: string,
  branchId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<CourierAssignment[]> {
  try {
    let q = query(
      collection(db, COURIER_ASSIGNMENTS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const snapshot = await getDocs(q);
    let assignments = snapshot.docs.map((doc) =>
      convertAssignmentTimestamp({ id: doc.id, ...doc.data() })
    );

    // BranchId'ye göre filtrele
    if (branchId) {
      assignments = assignments.filter((a) => a.branchId === branchId);
    }

    // Tarih aralığına göre filtrele
    if (startDate) {
      assignments = assignments.filter((a) => a.assignedAt >= startDate);
    }
    if (endDate) {
      assignments = assignments.filter((a) => a.assignedAt <= endDate);
    }

    // Client-side sıralama (en yeni önce)
    assignments.sort((a, b) => {
      const dateA = a.assignedAt instanceof Date ? a.assignedAt.getTime() : new Date(a.assignedAt).getTime();
      const dateB = b.assignedAt instanceof Date ? b.assignedAt.getTime() : new Date(b.assignedAt).getTime();
      return dateB - dateA;
    });

    return assignments;
  } catch (error) {
    throw error;
  }
}

// Kuryeye göre atamaları getir
export async function getCourierAssignmentsByCourier(
  courierId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CourierAssignment[]> {
  try {
    let q = query(
      collection(db, COURIER_ASSIGNMENTS_COLLECTION),
      where("courierId", "==", courierId)
    );

    const snapshot = await getDocs(q);
    let assignments = snapshot.docs.map((doc) =>
      convertAssignmentTimestamp({ id: doc.id, ...doc.data() })
    );

    // Tarih aralığına göre filtrele
    if (startDate) {
      assignments = assignments.filter((a) => a.assignedAt >= startDate);
    }
    if (endDate) {
      assignments = assignments.filter((a) => a.assignedAt <= endDate);
    }

    // Client-side sıralama (en yeni önce)
    assignments.sort((a, b) => {
      const dateA = a.assignedAt instanceof Date ? a.assignedAt.getTime() : new Date(a.assignedAt).getTime();
      const dateB = b.assignedAt instanceof Date ? b.assignedAt.getTime() : new Date(b.assignedAt).getTime();
      return dateB - dateA;
    });

    return assignments;
  } catch (error) {
    throw error;
  }
}

// Seçili tarihe ait tüm kurye atamalarını sil
export async function deleteCourierAssignmentsByDate(
  companyId: string,
  branchId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<void> {
  try {
    let q = query(
      collection(db, COURIER_ASSIGNMENTS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const snapshot = await getDocs(q);
    const assignments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertAssignmentTimestamp({ id: doc.id, ...doc.data() }),
    }));

    // BranchId ve tarih aralığına göre filtrele
    const assignmentsToDelete = assignments.filter((a) => {
      if (branchId && a.branchId !== branchId) {
        return false;
      }
      if (a.assignedAt < startDate || a.assignedAt > endDate) {
        return false;
      }
      return true;
    });

    // Filtrelenmiş atamaları sil
    const deletePromises = assignmentsToDelete.map((assignment) => {
      const docRef = doc(db, COURIER_ASSIGNMENTS_COLLECTION, assignment.id!);
      return deleteDoc(docRef);
    });

    await Promise.all(deletePromises);
  } catch (error) {
    throw error;
  }
}

// Belirli bir kuryeye ait seçili tarihe ait atamaları sil
export async function deleteCourierAssignmentsByCourierAndDate(
  courierId: string,
  companyId: string,
  branchId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<void> {
  try {
    let q = query(
      collection(db, COURIER_ASSIGNMENTS_COLLECTION),
      where("companyId", "==", companyId),
      where("courierId", "==", courierId)
    );

    const snapshot = await getDocs(q);
    const assignments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...convertAssignmentTimestamp({ id: doc.id, ...doc.data() }),
    }));

    // BranchId ve tarih aralığına göre filtrele
    const assignmentsToDelete = assignments.filter((a) => {
      if (branchId && a.branchId !== branchId) {
        return false;
      }
      if (a.assignedAt < startDate || a.assignedAt > endDate) {
        return false;
      }
      return true;
    });

    // Filtrelenmiş atamaları sil
    const deletePromises = assignmentsToDelete.map((assignment) => {
      const docRef = doc(db, COURIER_ASSIGNMENTS_COLLECTION, assignment.id!);
      return deleteDoc(docRef);
    });

    await Promise.all(deletePromises);
  } catch (error) {
    throw error;
  }
}
