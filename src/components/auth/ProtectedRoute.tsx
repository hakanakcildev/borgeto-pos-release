import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { hasCompanyAccess } from "../../lib/firebase/auth";
import { getCompany } from "../../lib/firebase/companies";
import { Navigate, useParams } from "@tanstack/react-router";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireSuperAdmin?: boolean;
  requireCompanyAccess?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireSuperAdmin = false,
  requireCompanyAccess = false,
}) => {
  const { currentUser, userData, loading, isSuperAdmin, isAuthenticated } = useAuth();
  const params = useParams({ strict: false });
  const [accessCheck, setAccessCheck] = useState<{
    loading: boolean;
    hasAccess: boolean;
  }>({ loading: true, hasAccess: false });

  useEffect(() => {
    const checkAccess = async () => {
      if (loading) return;

      // Auth requirement check
      if (requireAuth && !isAuthenticated) {
        setAccessCheck({ loading: false, hasAccess: false });
        return;
      }

      // Super admin requirement check
      if (requireSuperAdmin && !isSuperAdmin) {
        setAccessCheck({ loading: false, hasAccess: false });
        return;
      }

      // Company access requirement check
      if (requireCompanyAccess && isAuthenticated && userData) {
        try {
          const companyId = (params as any)?.companyId || userData.companyId;

          if (!companyId) {
            setAccessCheck({ loading: false, hasAccess: false });
            return;
          }

          // Super admin has access to all companies
          if (isSuperAdmin) {
            setAccessCheck({ loading: false, hasAccess: true });
            return;
          }

          // For staff/branch users, check if they have companyId
          if (!currentUser) {
            // Staff or branch user - check if companyId matches
            setAccessCheck({ loading: false, hasAccess: !!userData.companyId && userData.companyId === companyId });
            return;
          }

          // Get company and check if user has access
          const company = await getCompany(companyId);
          if (!company) {
            setAccessCheck({ loading: false, hasAccess: false });
            return;
          }

          const userHasAccess = await hasCompanyAccess(
            currentUser.uid,
            company.id!
          );
          setAccessCheck({ loading: false, hasAccess: userHasAccess });
        } catch (error) {
          setAccessCheck({ loading: false, hasAccess: false });
        }
      } else {
        // No special requirements, allow access
        setAccessCheck({ loading: false, hasAccess: true });
      }
    };

    checkAccess();
  }, [
    currentUser,
    userData,
    loading,
    isSuperAdmin,
    isAuthenticated,
    requireAuth,
    requireSuperAdmin,
    requireCompanyAccess,
    params,
  ]);

  // Show loading while checking
  if (loading || accessCheck.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Redirect if no auth and auth required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  // Redirect if not super admin and super admin required
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/auth/login" />;
  }

  // Redirect if no company access and company access required
  if (requireCompanyAccess && !accessCheck.hasAccess) {
    return <Navigate to="/auth/login" />;
  }

  return <>{children}</>;
};

