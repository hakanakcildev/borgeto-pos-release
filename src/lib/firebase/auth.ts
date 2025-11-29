import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { User, Branch, Company } from "./types";
import { verifyPassword } from "../utils/password";

const USERS_COLLECTION = "users";
const BRANCHES_COLLECTION = "branches";
const COMPANIES_COLLECTION = "companies";

// Sign in with email and password
export const signIn = async (
  email: string,
  password: string
): Promise<FirebaseUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// Get current user data from Firestore
export const getCurrentUserData = async (uid: string): Promise<User | null> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        lastLoginAt: docSnap.data().lastLoginAt?.toDate(),
      } as User;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Auth state listener
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};

// Check if user has access to company
export const hasCompanyAccess = async (
  uid: string,
  companyId: string
): Promise<boolean> => {
  try {
    const userData = await getCurrentUserData(uid);
    if (!userData) return false;

    // Super admin has access to all companies
    if (userData.role === "super_admin") return true;

    // Regular users need matching company ID
    return userData.companyId === companyId;
  } catch (error) {
    return false;
  }
};

// Sign in with staff username and password
export const signInWithStaffCredentials = async (
  username: string,
  password: string
): Promise<{
  user: User;
  companyId: string;
  branchId?: string;
}> => {
  try {
    // Find user by username
    const usersQuery = query(
      collection(db, USERS_COLLECTION),
      where("username", "==", username)
    );
    const usersSnapshot = await getDocs(usersQuery);

    if (usersSnapshot.empty) {
      throw new Error("Geçersiz kullanıcı adı veya şifre");
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const user = {
      id: userDoc.id,
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
      lastLoginAt: userData.lastLoginAt?.toDate(),
    } as User;

    // Verify password
    if (!user.passwordHash) {
      throw new Error("Kullanıcı şifresi yapılandırılmamış");
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      throw new Error("Geçersiz kullanıcı adı veya şifre");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error("Kullanıcı hesabı aktif değil");
    }

    // Check if user has company
    if (!user.companyId) {
      throw new Error("Kullanıcının atanmış bir firması yok");
    }

    return {
      user,
      companyId: user.companyId,
      branchId: user.assignedBranchId,
    };
  } catch (error) {
    throw error;
  }
};

// Sign in with branch credentials
export const signInWithBranchCredentials = async (
  username: string,
  password: string
): Promise<{
  branch: Branch;
  company: Company;
}> => {
  try {
    // Find branch by username
    const branchesQuery = query(
      collection(db, BRANCHES_COLLECTION),
      where("username", "==", username)
    );
    const branchesSnapshot = await getDocs(branchesQuery);

    if (branchesSnapshot.empty) {
      throw new Error("Geçersiz kullanıcı adı veya şifre");
    }

    const branchDoc = branchesSnapshot.docs[0];
    const branchData = branchDoc.data();
    const branch = {
      id: branchDoc.id,
      ...branchData,
      createdAt: branchData.createdAt?.toDate() || new Date(),
      updatedAt: branchData.updatedAt?.toDate() || new Date(),
    } as Branch;

    // Verify password
    if (!branch.passwordHash) {
      throw new Error("Şube kimlik bilgileri yapılandırılmamış");
    }

    const isValidPassword = await verifyPassword(password, branch.passwordHash);
    if (!isValidPassword) {
      throw new Error("Geçersiz kullanıcı adı veya şifre");
    }

    // Check if branch is active
    if (!branch.isActive) {
      throw new Error("Şube aktif değil");
    }

    // Get company
    const companyDoc = await getDoc(doc(db, COMPANIES_COLLECTION, branch.companyId));
    if (!companyDoc.exists()) {
      throw new Error("Firma bulunamadı");
    }

    const companyData = companyDoc.data();
    const company = {
      id: companyDoc.id,
      ...companyData,
      createdAt: companyData.createdAt?.toDate() || new Date(),
      updatedAt: companyData.updatedAt?.toDate() || new Date(),
    } as Company;

    return {
      branch,
      company,
    };
  } catch (error) {
    throw error;
  }
};

// Check if string is a valid email format
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Sign in with email/username and password (tries all methods)
export const signInWithCredentials = async (
  emailOrUsername: string,
  password: string
): Promise<{
  type: "firebase" | "staff" | "branch";
  firebaseUser?: FirebaseUser;
  user?: User;
  branch?: Branch;
  company?: Company;
  companyId: string;
  branchId?: string;
}> => {
  const trimmedInput = emailOrUsername.trim();
  
  // If input is a valid email, try Firebase Auth first
  if (isValidEmail(trimmedInput)) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        trimmedInput,
        password
      );
      
      const userData = await getCurrentUserData(userCredential.user.uid);
      if (!userData || !userData.companyId) {
        throw new Error("Kullanıcı bilgileri bulunamadı");
      }

      return {
        type: "firebase",
        firebaseUser: userCredential.user,
        user: userData,
        companyId: userData.companyId,
        branchId: userData.assignedBranchId,
      };
    } catch (firebaseError: any) {
      // If Firebase Auth fails with user-not-found or wrong-password, 
      // it might be a staff user, so try staff credentials
      if (
        firebaseError.code === "auth/user-not-found" ||
        firebaseError.code === "auth/wrong-password"
      ) {
        // Try staff credentials as fallback
        try {
          const { user, companyId, branchId } = await signInWithStaffCredentials(
            trimmedInput,
            password
          );

          return {
            type: "staff",
            user,
            companyId,
            branchId,
          };
        } catch (staffError) {
          // If staff credentials fail, try branch credentials
          try {
            const { branch, company } = await signInWithBranchCredentials(
              trimmedInput,
              password
            );

            return {
              type: "branch",
              branch,
              company,
              companyId: company.id!,
              branchId: branch.id,
            };
          } catch (branchError) {
            throw new Error("Geçersiz kullanıcı adı veya şifre");
          }
        }
      }
      // For other Firebase errors (like invalid-email), try staff/branch credentials
      try {
        const { user, companyId, branchId } = await signInWithStaffCredentials(
          trimmedInput,
          password
        );

        return {
          type: "staff",
          user,
          companyId,
          branchId,
        };
      } catch (staffError) {
        try {
          const { branch, company } = await signInWithBranchCredentials(
            trimmedInput,
            password
          );

          return {
            type: "branch",
            branch,
            company,
            companyId: company.id!,
            branchId: branch.id,
          };
        } catch (branchError) {
          throw firebaseError;
        }
      }
    }
  } else {
    // If input is not a valid email, try staff credentials first, then branch credentials
    try {
      const { user, companyId, branchId } = await signInWithStaffCredentials(
        trimmedInput,
        password
      );

      return {
        type: "staff",
        user,
        companyId,
        branchId,
      };
    } catch (staffError) {
      // If staff credentials fail, try branch credentials
      try {
        const { branch, company } = await signInWithBranchCredentials(
          trimmedInput,
          password
        );

        return {
          type: "branch",
          branch,
          company,
          companyId: company.id!,
          branchId: branch.id,
        };
      } catch (branchError) {
        throw new Error("Geçersiz kullanıcı adı veya şifre");
      }
    }
  }
};

