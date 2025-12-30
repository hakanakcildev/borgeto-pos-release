import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUsersByBranch,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
} from "@/lib/firebase/users";
import { getLocalIP } from "@/lib/utils/ip";
import type { User } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Save,
  X,
  User as UserIcon,
  Shield,
  Users,
  Edit,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";
import { customAlert } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/users")({
  component: UsersManagement,
});

function UsersManagement() {
  return (
    <POSLayout headerTitle="Kullanıcı Yönetimi">
      <UsersManagementContent />
    </POSLayout>
  );
}

export function UsersManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [localIP, setLocalIP] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    displayName: "",
    allowedIp: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId || !effectiveBranchId) {
        setLoading(false);
        return;
      }

      try {
        const usersData = await getUsersByBranch(
          effectiveCompanyId,
          effectiveBranchId
        );
        setUsers(usersData);
      } catch (error) {
        console.error("Error loading users:", error);
      } finally {
        setLoading(false);
      }
    };

    const loadIP = async () => {
      const ip = await getLocalIP();
      setLocalIP(ip);
      if (ip && !formData.allowedIp) {
        setFormData((prev) => ({ ...prev, allowedIp: ip }));
      }
    };

    loadData();
    loadIP();
  }, [companyId, branchId, userData]);

  const handleAddUser = async () => {
    if (!formData.username || !formData.password || !formData.displayName) {
      await customAlert("Lütfen tüm alanları doldurun", "Hata", "error");
      return;
    }

    if (!formData.allowedIp) {
      await customAlert("IP adresi gerekli", "Hata", "error");
      return;
    }

    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId || !effectiveBranchId) {
      return;
    }

    try {
      await createStaffUser(
        effectiveCompanyId,
        effectiveBranchId,
        formData.username,
        formData.password,
        formData.displayName,
        formData.allowedIp
      );

      // Reload users
      const usersData = await getUsersByBranch(
        effectiveCompanyId,
        effectiveBranchId
      );
      setUsers(usersData);

      // Reset form
      setFormData({
        username: "",
        password: "",
        displayName: "",
        allowedIp: localIP || "",
      });
      setShowAddModal(false);

      await customAlert("Garson hesabı oluşturuldu", "Başarılı", "success");
    } catch (error: any) {
      await customAlert(
        error.message || "Garson hesabı oluşturulamadı",
        "Hata",
        "error"
      );
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    if (!formData.displayName) {
      await customAlert("Ad Soyad gerekli", "Hata", "error");
      return;
    }

    try {
      await updateStaffUser(editingUser.id!, {
        displayName: formData.displayName,
        password: formData.password || undefined,
        allowedIp: formData.allowedIp || undefined,
      });

      // Reload users
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (effectiveCompanyId && effectiveBranchId) {
        const usersData = await getUsersByBranch(
          effectiveCompanyId,
          effectiveBranchId
        );
        setUsers(usersData);
      }

      setEditingUser(null);
      setFormData({
        username: "",
        password: "",
        displayName: "",
        allowedIp: localIP || "",
      });

      await customAlert("Kullanıcı güncellendi", "Başarılı", "success");
    } catch (error: any) {
      await customAlert(
        error.message || "Kullanıcı güncellenemedi",
        "Hata",
        "error"
      );
    }
  };

  const handleDeleteUser = async (userId: string, displayName: string) => {
    const confirmed = window.confirm(
      `${displayName} adlı kullanıcıyı silmek istediğinize emin misiniz?`
    );

    if (!confirmed) return;

    try {
      await deleteStaffUser(userId);

      // Reload users
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (effectiveCompanyId && effectiveBranchId) {
        const usersData = await getUsersByBranch(
          effectiveCompanyId,
          effectiveBranchId
        );
        setUsers(usersData);
      }

      await customAlert("Kullanıcı silindi", "Başarılı", "success");
    } catch (error: any) {
      await customAlert(
        error.message || "Kullanıcı silinemedi",
        "Hata",
        "error"
      );
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username || "",
      password: "",
      displayName: user.displayName,
      allowedIp: user.allowedIp || localIP || "",
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      displayName: "",
      allowedIp: localIP || "",
    });
    setEditingUser(null);
    setShowAddModal(false);
  };

  const getRoleBadge = (role: User["role"]) => {
    if (role === "manager" || role === "admin") {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
          Şube Yöneticisi
        </span>
      );
    } else if (role === "staff") {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
          Garson
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Şube yöneticisi ve garsonları filtrele
  // Manager veya admin rolüne sahip kullanıcıyı şube yöneticisi olarak göster
  // Sadece role === "staff" olan kullanıcılar garson listesinde gösterilecek
  const managerUser = users.find(
    (u) => u.role === "manager" || u.role === "admin"
  );
  // Sadece staff rolüne sahip kullanıcıları filtrele (kesinlikle staff olmalı)
  const staffUsers = users.filter((u) => u.role === "staff");

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-8 w-8" />
            Kullanıcılar
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Şube yöneticisi ve garson hesaplarını yönetin
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Garson Ekle
        </Button>
      </div>

      {/* Şube Yöneticisi */}
      {managerUser && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Şube Yöneticisi
          </h2>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {managerUser.displayName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {managerUser.username}
                  </p>
                </div>
              </div>
              {getRoleBadge(managerUser.role)}
            </div>
          </div>
        </div>
      )}

      {/* Garsonlar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Garsonlar ({staffUsers.length})
        </h2>

        {staffUsers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Henüz garson hesabı oluşturulmamış
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffUsers.map((user) => (
              <div
                key={user.id}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {user.username}
                      </p>
                    </div>
                  </div>
                  {getRoleBadge(user.role)}
                </div>

                <div className="space-y-2 mb-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      İzin Verilen IP
                    </p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                      {user.allowedIp || "Belirtilmemiş"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Durum
                    </p>
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {user.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => openEditModal(user)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Düzenle
                  </Button>
                  <Button
                    onClick={() => handleDeleteUser(user.id!, user.displayName)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingUser ? "Garson Düzenle" : "Yeni Garson Ekle"}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kullanıcı Adı
                </label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  disabled={!!editingUser}
                  placeholder="garson1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ad Soyad
                </label>
                <Input
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  placeholder="Ahmet Yılmaz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Şifre {editingUser && "(Değiştirmek için doldurun)"}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  İzin Verilen IP Adresi
                </label>
                <Input
                  value={formData.allowedIp}
                  onChange={(e) =>
                    setFormData({ ...formData, allowedIp: e.target.value })
                  }
                  placeholder="192.168.1.100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Mevcut IP: {localIP || "Yükleniyor..."}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={resetForm} variant="outline" className="flex-1">
                İptal
              </Button>
              <Button
                onClick={editingUser ? handleUpdateUser : handleAddUser}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingUser ? "Güncelle" : "Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
