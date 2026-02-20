import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
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

// Sign in with manager username/email and password
// Sadece users koleksiyonunu kontrol eder
export const signInWithStaffCredentials = async (
  usernameOrEmail: string,
  password: string
): Promise<{
  user: User;
  companyId: string;
  branchId?: string;
}> => {
  try {
    console.log(
      "[signInWithStaffCredentials] Kullanıcı aranıyor:",
      usernameOrEmail
    );

    // Önce email ile ara (oms-borgeto-com'da manager'lar email ile kaydediliyor)
    let usersSnapshot = await getDocs(
      query(
        collection(db, USERS_COLLECTION),
        where("email", "==", usernameOrEmail)
      )
    );

    // Email ile bulunamazsa username ile dene
    if (usersSnapshot.empty) {
      console.log(
        "[signInWithStaffCredentials] Email ile bulunamadı, username ile deneniyor..."
      );
      usersSnapshot = await getDocs(
        query(
          collection(db, USERS_COLLECTION),
          where("username", "==", usernameOrEmail)
        )
      );
    }

    if (usersSnapshot.empty) {
      console.error("[signInWithStaffCredentials] Kullanıcı bulunamadı");
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

    console.log(
      "[signInWithStaffCredentials] Kullanıcı bulundu:",
      user.id,
      "Rol:",
      user.role
    );

    // Sadece manager rolündeki kullanıcılar giriş yapabilir
    if (user.role !== "manager") {
      throw new Error("Sadece manager rolündeki kullanıcılar giriş yapabilir");
    }

    // Şifre kontrolü
    if (!user.passwordHash) {
      console.error("[signInWithStaffCredentials] Şifre hash yok");
      throw new Error("Kullanıcı şifresi yapılandırılmamış");
    }

    console.log("[signInWithStaffCredentials] Şifre doğrulanıyor...");
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      console.error("[signInWithStaffCredentials] Şifre yanlış");
      throw new Error("Geçersiz kullanıcı adı veya şifre");
    }

    // Kullanıcı aktif mi kontrol et
    if (user.isActive === false) {
      throw new Error("Kullanıcı hesabı aktif değil");
    }

    // companyId kontrolü
    if (!user.companyId) {
      console.error(
        "[signInWithStaffCredentials] Kullanıcının companyId'si yok"
      );
      throw new Error("Kullanıcının atanmış bir firması yok");
    }

    const companyIdString = String(user.companyId).trim();
    if (!companyIdString) {
      throw new Error("Kullanıcının atanmış bir firması yok");
    }

    console.log(
      "[signInWithStaffCredentials] Giriş başarılı, companyId:",
      companyIdString
    );

    return {
      user,
      companyId: companyIdString,
      branchId: user.assignedBranchId || user.id,
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
    const companyDoc = await getDoc(
      doc(db, COMPANIES_COLLECTION, branch.companyId)
    );
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

// Sign in with username and password (only manager role)
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

  console.log("[signInWithCredentials] Başlangıç:", trimmedInput);

  // Manager ve staff kullanıcılar Firebase Auth'da değil, önce Firestore'dan kontrol et
  // Önce staff/manager credentials'ı dene (email veya username ile)
  try {
    console.log("[signInWithCredentials] Staff credentials deneniyor...");
    const { user, companyId, branchId } = await signInWithStaffCredentials(
      trimmedInput,
      password
    );
    console.log(
      "[signInWithCredentials] Staff credentials başarılı:",
      user.role,
      companyId
    );

    // Check POS access
    console.log(
      "[signInWithCredentials] Company bilgileri yükleniyor...",
      companyId
    );
    const { getCompany } = await import("./companies");
    const company = await getCompany(companyId);
    if (!company) {
      console.error("[signInWithCredentials] Company bulunamadı:", companyId);
      console.error(
        "[signInWithCredentials] Kullanıcı companyId:",
        user.companyId
      );
      throw new Error(
        `Firma bilgileri bulunamadı. Lütfen sistem yöneticinizle iletişime geçin. (Company ID: ${companyId})`
      );
    }

    // Check if company has POS access
    if (company.hasPosAccess === false) {
      console.error("[signInWithCredentials] POS erişimi yok");
      throw new Error(
        "POS Sistemine erişiminiz yok. Lütfen QR Menü sistemini kullanın."
      );
    }

    console.log("[signInWithCredentials] Giriş başarılı (staff)");
    return {
      type: "staff",
      user,
      company: company,
      companyId,
      branchId,
    };
  } catch (staffError) {
    console.log(
      "[signInWithCredentials] Manager credentials başarısız:",
      staffError
    );
    // Manager credentials başarısız oldu, direkt hata fırlat
    // Sadece manager rolündeki kullanıcılar giriş yapabilir
    if (staffError instanceof Error) {
      throw staffError;
    }
    throw new Error("Geçersiz kullanıcı adı veya şifre");
  }
};
