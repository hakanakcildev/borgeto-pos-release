import React, { createContext, useContext, useEffect, useState } from "react";
import { type User as FirebaseUser } from "firebase/auth";
import { onAuthStateChange, getCurrentUserData } from "../lib/firebase/auth";
import { clearAllTableHistory } from "../lib/firebase/tableHistory";
import type { User, Branch, Company } from "../lib/firebase/types";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  branchData: Branch | null;
  companyData: Company | null;
  companyId: string | null;
  branchId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  authType: "firebase" | "staff" | "branch" | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [authType, setAuthType] = useState<"firebase" | "staff" | "branch" | null>(null);
  const [loading, setLoading] = useState(true);

  // Load auth data from localStorage on mount
  useEffect(() => {
    const loadSessionAuth = () => {
      try {
        const posAuthStr = localStorage.getItem("posAuth");
        if (posAuthStr) {
          const posAuth = JSON.parse(posAuthStr);
          setAuthType(posAuth.type);
          setCompanyId(posAuth.companyId);
          setBranchId(posAuth.branchId);
          setUserData(posAuth.user || null);
          setBranchData(posAuth.branch || null);
          setCompanyData(posAuth.company || null);
        }
      } catch (error) {
      } finally {
        // Always set loading to false after initial load
        setLoading(false);
      }
    };

    loadSessionAuth();
  }, []);

  // Listen for storage changes (when login happens in another tab/window)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "posAuth") {
        try {
          if (e.newValue) {
            const posAuth = JSON.parse(e.newValue);
            setAuthType(posAuth.type);
            setCompanyId(posAuth.companyId);
            setBranchId(posAuth.branchId);
            setUserData(posAuth.user || null);
            setBranchData(posAuth.branch || null);
            setCompanyData(posAuth.company || null);
          } else {
            // Cleared
            setCurrentUser(null);
            setUserData(null);
            setBranchData(null);
            setCompanyData(null);
            setCompanyId(null);
            setBranchId(null);
            setAuthType(null);
          }
        } catch (error) {
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const userDataFromDb = await getCurrentUserData(user.uid);
          setUserData(userDataFromDb);
          if (userDataFromDb) {
            setCompanyId(userDataFromDb.companyId || null);
            setBranchId(userDataFromDb.assignedBranchId || null);
            setAuthType("firebase");
          }
        } catch (error) {
          setUserData(null);
        }
      } else {
        // If Firebase Auth user is null, check localStorage
        const posAuthStr = localStorage.getItem("posAuth");
        if (posAuthStr) {
          try {
            const posAuth = JSON.parse(posAuthStr);
            setAuthType(posAuth.type);
            setCompanyId(posAuth.companyId);
            setBranchId(posAuth.branchId);
            setUserData(posAuth.user || null);
            setBranchData(posAuth.branch || null);
            setCompanyData(posAuth.company || null);
          } catch (error) {
          }
        } else {
          setUserData(null);
          setBranchData(null);
          setCompanyData(null);
          setCompanyId(null);
          setBranchId(null);
          setAuthType(null);
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Masa geçmişi temizleme dinleyicisi (Electron IPC event)
  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.onTriggerClearTableHistory) {
      window.electronAPI.onTriggerClearTableHistory(async () => {
        // Eğer authenticated ise companyId ve branchId'yi al
        if (companyId) {
          try {
            await clearAllTableHistory(companyId, branchId || undefined);
          } catch (error) {
          }
        }
      });
    }
  }, [companyId, branchId]);

  const value: AuthContextType = {
    currentUser,
    userData,
    branchData,
    companyData,
    companyId,
    branchId,
    loading,
    isAuthenticated: !!currentUser || !!userData || !!branchData,
    isSuperAdmin: userData?.role === "super_admin",
    authType,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

