import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCouriersByCompany,
  addCourier,
  updateCourier,
  deleteCourier,
  getCourierAssignmentsByCompany,
  deleteCourierAssignmentsByCourierAndDate,
} from "@/lib/firebase/couriers";
import type { Courier, CourierAssignment } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Save,
  X,
  Bike,
  Edit,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";
import { customAlert } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/couriers")({
  component: CouriersManagement,
});

function CouriersManagement() {
  return (
    <POSLayout headerTitle="Kurye Yönetimi">
      <CouriersManagementContent />
    </POSLayout>
  );
}

function CouriersManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [newCourier, setNewCourier] = useState({
    name: "",
    pricePerPackage: "",
  });
  const [isAddingCourier, setIsAddingCourier] = useState(false);
  const [assignments, setAssignments] = useState<CourierAssignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Kuryeleri yükle
  useEffect(() => {
    const loadCouriers = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        return;
      }

      setLoading(true);
      try {
        const couriersData = await getCouriersByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setCouriers(couriersData);
      } catch (error) {
        customAlert("Kuryeler yüklenirken bir hata oluştu", "Hata", "error");
      } finally {
        setLoading(false);
      }
    };

    loadCouriers();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Kurye atamalarını yükle
  useEffect(() => {
    const loadAssignments = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (!effectiveCompanyId) {
        return;
      }

      try {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        const assignmentsData = await getCourierAssignmentsByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined,
          startDate,
          endDate
        );
        setAssignments(assignmentsData);
      } catch (error) {
        // Error loading assignments
      }
    };

    loadAssignments();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId, selectedDate]);

  // Yeni kurye ekle
  const handleAddCourier = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;

    if (!effectiveCompanyId || !newCourier.name.trim() || !newCourier.pricePerPackage) {
      customAlert("Kurye adı ve paket başı fiyat gereklidir", "Uyarı", "warning");
      return;
    }

    const price = parseFloat(newCourier.pricePerPackage);
    if (isNaN(price) || price < 0) {
      customAlert("Geçerli bir fiyat girin", "Uyarı", "warning");
      return;
    }

    try {
      await addCourier(effectiveCompanyId, {
        branchId: effectiveBranchId || undefined,
        name: newCourier.name.trim(),
        pricePerPackage: price,
        isActive: true,
      });

      // Kuryeleri yeniden yükle
      const couriersData = await getCouriersByCompany(
        effectiveCompanyId,
        effectiveBranchId || undefined
      );
      setCouriers(couriersData);

      // Formu temizle
      setNewCourier({ name: "", pricePerPackage: "" });
      setIsAddingCourier(false);
    } catch (error) {
      customAlert("Kurye eklenirken bir hata oluştu", "Hata", "error");
    }
  };

  // Kurye güncelle
  const handleUpdateCourier = async () => {
    if (!editingCourier || !editingCourier.id) return;

    const price = parseFloat(editingCourier.pricePerPackage.toString());
    if (isNaN(price) || price < 0) {
      customAlert("Geçerli bir fiyat girin", "Uyarı", "warning");
      return;
    }

    try {
      await updateCourier(editingCourier.id, {
        name: editingCourier.name.trim(),
        pricePerPackage: price,
        isActive: editingCourier.isActive,
      });

      // Kuryeleri yeniden yükle
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      if (effectiveCompanyId) {
        const couriersData = await getCouriersByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setCouriers(couriersData);
      }

      setEditingCourier(null);
    } catch (error) {
      customAlert("Kurye güncellenirken bir hata oluştu", "Hata", "error");
    }
  };

  // Kurye sil
  const handleDeleteCourier = async (courierId: string) => {
    if (!confirm("Bu kuryeyi silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      await deleteCourier(courierId);

      // Kuryeleri yeniden yükle
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      if (effectiveCompanyId) {
        const couriersData = await getCouriersByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setCouriers(couriersData);
      }
    } catch (error) {
      customAlert("Kurye silinirken bir hata oluştu", "Hata", "error");
    }
  };

  // Kurye istatistiklerini hesapla
  const calculateCourierStats = useCallback(
    (courierId: string) => {
      const courierAssignments = assignments.filter((a) => a.courierId === courierId);
      const totalPackages = courierAssignments.reduce(
        (sum, a) => sum + a.packageCount,
        0
      );
      
      // Sadece nakit ödemeler için para üstü hesapla
      const totalChangeAmount = courierAssignments
        .filter((a) => a.paymentMethod === "cash")
        .reduce((sum, a) => sum + a.changeAmount, 0);
      
      const totalEarnings = courierAssignments.reduce(
        (sum, a) => sum + a.packageCount * (couriers.find((c) => c.id === courierId)?.pricePerPackage || 0),
        0
      );
      
      // Sadece nakit ödemeler için toplam tutar hesapla
      // ÖNEMLİ: Sadece nakit ödemeler için kurye kasaya ödeme yapar
      const totalPaid = courierAssignments
        .filter((a) => a.paymentMethod === "cash")
        .reduce((sum, a) => sum + a.totalAmount, 0);
      
      // Kurye kasaya ödemesi gereken = Sadece nakit ödemelerden alınan + Para üstü
      // Örnek: Müşteriden 190₺ nakit alındı, Para üstü 10₺ verildi
      // Kurye kasaya ödemeli = 190₺ + 10₺ = 200₺
      // Kurye kazancı = 80₺
      // Kuryeye ödenecek/alınacak = 80₺ - 200₺ = -120₺ (kurye 120₺ ödeyecek)
      // NOT: Kart, yemek kartı vb. ödemeler için kurye kasaya ödeme yapmaz
      const totalToPay = totalPaid + totalChangeAmount; // Sadece nakit ödemeler için kuryenin kasaya ödemesi gereken
      const amountToReceive = totalEarnings - totalToPay; // Pozitifse kuryeye ödenecek, negatifse kurye ödeyecek

      return {
        totalPackages,
        totalChangeAmount,
        totalEarnings,
        totalPaid,
        amountToReceive,
      };
    },
    [assignments, couriers]
  );

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bike className="h-8 w-8" />
          Kurye Yönetimi
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Kuryeleri yönetin ve günlük istatistikleri görüntüleyin
        </p>
      </div>

      {/* Tarih Seçici */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tarih Seç
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* Kurye Listesi */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Kuryeler
          </h2>
          <Button
            onClick={() => setIsAddingCourier(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kurye Ekle
          </Button>
        </div>

        {/* Yeni Kurye Ekleme Formu */}
        {isAddingCourier && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Yeni Kurye Ekle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kurye Adı
                </label>
                <Input
                  type="text"
                  value={newCourier.name}
                  onChange={(e) =>
                    setNewCourier({ ...newCourier, name: e.target.value })
                  }
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Paket Başı Fiyat (₺)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCourier.pricePerPackage}
                  onChange={(e) =>
                    setNewCourier({
                      ...newCourier,
                      pricePerPackage: e.target.value,
                    })
                  }
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddCourier}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Kaydet
                </Button>
                <Button
                  onClick={() => {
                    setIsAddingCourier(false);
                    setNewCourier({ name: "", pricePerPackage: "" });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  İptal
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Kurye Listesi */}
        {loading ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            Yükleniyor...
          </div>
        ) : couriers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Bike className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Henüz kurye eklenmemiş
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {couriers.map((courier) => {
              const stats = calculateCourierStats(courier.id!);
              const isEditing = editingCourier?.id === courier.id;

              return (
                <div
                  key={courier.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2"
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Kurye Adı
                        </label>
                        <Input
                          type="text"
                          value={editingCourier?.name || ""}
                          onChange={(e) =>
                            editingCourier && setEditingCourier({
                              ...editingCourier,
                              name: e.target.value,
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Paket Başı Fiyat (₺)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingCourier?.pricePerPackage || 0}
                          onChange={(e) =>
                            editingCourier && setEditingCourier({
                              ...editingCourier,
                              pricePerPackage: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`active-${courier.id}`}
                          checked={editingCourier?.isActive || false}
                          onChange={(e) =>
                            editingCourier && setEditingCourier({
                              ...editingCourier,
                              isActive: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <label
                          htmlFor={`active-${courier.id}`}
                          className="text-sm text-gray-700 dark:text-gray-300"
                        >
                          Aktif
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUpdateCourier}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Kaydet
                        </Button>
                        <Button
                          onClick={() => setEditingCourier(null)}
                          variant="outline"
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          İptal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {courier.name}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            ₺{courier.pricePerPackage.toFixed(2)}/paket
                          </p>
                          {!courier.isActive && (
                            <span className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 inline-block">
                              (Pasif)
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            onClick={() => setEditingCourier(courier)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteCourier(courier.id!)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Günlük İstatistikler */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-1.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Package className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] text-gray-600 dark:text-gray-400">
                              Paket
                            </span>
                          </div>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {stats.totalPackages}
                          </p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-1.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <DollarSign className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-[10px] text-gray-600 dark:text-gray-400">
                              Para Üstü
                            </span>
                          </div>
                          <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                            ₺{stats.totalChangeAmount.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-1.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <DollarSign className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            <span className="text-[10px] text-gray-600 dark:text-gray-400">
                              Ücret
                            </span>
                          </div>
                          <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                            ₺{stats.totalPaid.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-1.5">
                          <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                            <span className="text-[10px] text-gray-600 dark:text-gray-400">
                              Kazanç
                            </span>
                          </div>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            ₺{stats.totalEarnings.toFixed(2)}
                          </p>
                        </div>
                        <div
                          className={`rounded-lg p-1.5 ${
                            stats.amountToReceive >= 0
                              ? "bg-green-50 dark:bg-green-900/20"
                              : "bg-red-50 dark:bg-red-900/20"
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            {stats.amountToReceive >= 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                            )}
                            <span className="text-[10px] text-gray-600 dark:text-gray-400">
                              {stats.amountToReceive >= 0 ? "Kasa Ödeyecek" : "Kurye Ödeyecek"}
                            </span>
                          </div>
                          <p
                            className={`text-sm font-bold ${
                              stats.amountToReceive >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            ₺{Math.abs(stats.amountToReceive).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Ödemeler Alındı Butonu */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                        <Button
                          onClick={async () => {
                            if (!confirm(`${courier.name} için seçili tarihe ait ödemeleri sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
                              return;
                            }

                            const effectiveCompanyId = companyId || userData?.companyId;
                            const effectiveBranchId = branchId || userData?.assignedBranchId;

                            if (!effectiveCompanyId) {
                              customAlert("Şirket bilgisi bulunamadı", "Hata", "error");
                              return;
                            }

                            try {
                              const startDate = new Date(selectedDate);
                              startDate.setHours(0, 0, 0, 0);
                              const endDate = new Date(selectedDate);
                              endDate.setHours(23, 59, 59, 999);

                              await deleteCourierAssignmentsByCourierAndDate(
                                courier.id!,
                                effectiveCompanyId,
                                effectiveBranchId || undefined,
                                startDate,
                                endDate
                              );

                              // Atamaları yeniden yükle
                              const assignmentsData = await getCourierAssignmentsByCompany(
                                effectiveCompanyId,
                                effectiveBranchId || undefined,
                                startDate,
                                endDate
                              );
                              setAssignments(assignmentsData);

                              customAlert(`${courier.name} için ödemeler başarıyla sıfırlandı`, "Başarılı", "success");
                            } catch (error) {
                              customAlert("Ödemeler sıfırlanırken bir hata oluştu", "Hata", "error");
                            }
                          }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white h-9 text-xs"
                          disabled={stats.totalPackages === 0}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ödemeler Alındı
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

