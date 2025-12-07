import {
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "./types";
import { hashPassword } from "../utils/password";

const USERS_COLLECTION = "users";

// Get users by company and branch
export const getUsersByBranch = async (
  companyId: string,
  branchId: string
): Promise<User[]> => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where("companyId", "==", companyId),
      where("assignedBranchId", "==", branchId)
    );
    const querySnapshot = await getDocs(q);

    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      lastLoginAt: doc.data().lastLoginAt?.toDate(),
    })) as User[];

    // Sort by createdAt descending (newest first)
    return users.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  } catch (error) {
    throw error;
  }
};

// Create staff user (garson hesabı) with username and password
export const createStaffUser = async (
  companyId: string,
  branchId: string,
  username: string,
  password: string,
  displayName: string,
  allowedIp: string
): Promise<{ userId: string; username: string; password: string }> => {
  try {
    // Check if username already exists
    const existingUserQuery = query(
      collection(db, USERS_COLLECTION),
      where("username", "==", username),
      where("companyId", "==", companyId)
    );
    const existingUserSnapshot = await getDocs(existingUserQuery);

    if (!existingUserSnapshot.empty) {
      throw new Error("Bu kullanıcı adı zaten kullanılıyor");
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user document
    const userData = {
      email: `${username}@${companyId}.local`, // Placeholder email
      displayName,
      username,
      passwordHash,
      role: "staff" as const,
      companyId,
      assignedBranchId: branchId,
      allowedIp, // İzin verilen IP adresi
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, USERS_COLLECTION), userData);

    return {
      userId: docRef.id,
      username,
      password,
    };
  } catch (error) {
    throw error;
  }
};

// Update staff user
export const updateStaffUser = async (
  userId: string,
  updates: {
    displayName?: string;
    isActive?: boolean;
    password?: string;
    allowedIp?: string;
  }
): Promise<void> => {
  try {
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    if (updates.displayName !== undefined) {
      updateData.displayName = updates.displayName;
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    if (updates.password) {
      updateData.passwordHash = await hashPassword(updates.password);
    }

    if (updates.allowedIp !== undefined) {
      updateData.allowedIp = updates.allowedIp;
    }

    await updateDoc(doc(db, USERS_COLLECTION, userId), updateData);
  } catch (error) {
    throw error;
  }
};

// Delete staff user
export const deleteStaffUser = async (userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
  } catch (error) {
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const userData = docSnap.data();
    return {
      id: docSnap.id,
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
      lastLoginAt: userData.lastLoginAt?.toDate(),
    } as User;
  } catch (error) {
    return null;
  }
};
