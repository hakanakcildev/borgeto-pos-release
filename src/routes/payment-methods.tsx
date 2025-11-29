import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPaymentMethodsByCompany,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createDefaultPaymentMethods,
} from "@/lib/firebase/paymentMethods";
import type { PaymentMethodConfig } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Save,
  X,
  CreditCard,
  Edit,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/payment-methods")({
  component: PaymentMethodsManagement,
});

function PaymentMethodsManagement() {
  return (
    <POSLayout>
      <PaymentMethodsManagementContent />
    </POSLayout>
  );
}

function PaymentMethodsManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodConfig | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    name: "",
    code: "",
    color: "#16a34a",
  });
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

  // Ödeme yöntemlerini yükle
  useEffect(() => {
    const loadPaymentMethods = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      if (!effectiveCompanyId) {
        return;
      }

      setLoadingPaymentMethods(true);
      try {
        // Önce varsayılan ödeme yöntemlerini oluştur (yoksa)
        await createDefaultPaymentMethods(effectiveCompanyId, effectiveBranchId || undefined).catch(() => {
        });
        
        // Ödeme yöntemlerini yükle
        const methods = await getPaymentMethodsByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setPaymentMethods(methods);
      } catch (error) {
        alert("Ödeme yöntemleri yüklenirken bir hata oluştu");
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    loadPaymentMethods();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Yeni ödeme yöntemi ekle
  const handleAddPaymentMethod = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !newPaymentMethod.name.trim() || !newPaymentMethod.code.trim()) {
      alert("Ödeme yöntemi adı ve kodu gereklidir");
      return;
    }

    try {
      await addPaymentMethod({
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        name: newPaymentMethod.name.trim(),
        code: newPaymentMethod.code.trim().toLowerCase(),
        color: newPaymentMethod.color,
        isActive: true,
        isDefault: false,
        order: paymentMethods.length,
      });

      // Ödeme yöntemlerini yeniden yükle
      const methods = await getPaymentMethodsByCompany(
        effectiveCompanyId,
        effectiveBranchId || undefined
      );
      setPaymentMethods(methods);
      
      // Formu temizle
      setNewPaymentMethod({
        name: "",
        code: "",
        color: "#16a34a",
      });
      setIsAddingPaymentMethod(false);
    } catch (error) {
      alert("Ödeme yöntemi eklenirken bir hata oluştu");
    }
  };

  // Ödeme yöntemini güncelle
  const handleUpdatePaymentMethod = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !editingPaymentMethod?.id) {
      return;
    }

    try {
      await updatePaymentMethod(editingPaymentMethod.id, {
        name: editingPaymentMethod.name.trim(),
        color: editingPaymentMethod.color,
        isActive: editingPaymentMethod.isActive,
      });

      // Ödeme yöntemlerini yeniden yükle
      const reloadMethods = await getPaymentMethodsByCompany(
        effectiveCompanyId,
        effectiveBranchId || undefined
      );
      setPaymentMethods(reloadMethods);
      setEditingPaymentMethod(null);
    } catch (error) {
      alert("Ödeme yöntemi güncellenirken bir hata oluştu");
    }
  };

  // Ödeme yöntemini sil
  const handleDeletePaymentMethod = async (methodId: string, isDefault: boolean) => {
    if (isDefault) {
      alert("Standart ödeme yöntemleri silinemez");
      return;
    }

    if (!confirm("Bu ödeme yöntemini silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      await deletePaymentMethod(methodId);
      
      // Ödeme yöntemlerini yeniden yükle
      const methods = await getPaymentMethodsByCompany(
        effectiveCompanyId!,
        effectiveBranchId || undefined
      );
      setPaymentMethods(methods);
    } catch (error) {
      alert("Ödeme yöntemi silinirken bir hata oluştu");
    }
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Ödeme Yöntemleri
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Ödeme yöntemlerini yönetin, ekleyin veya düzenleyin
        </p>
      </div>

      {/* Ödeme Yöntemleri Listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ödeme Yöntemleri</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Ödeme yöntemlerini yönetin, ekleyin veya düzenleyin
            </p>
          </div>
          {!isAddingPaymentMethod && !editingPaymentMethod && (
            <Button onClick={() => setIsAddingPaymentMethod(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Ödeme Yöntemi
            </Button>
          )}
        </div>

            {loadingPaymentMethods ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
              </div>
            ) : (
              <>
                {/* Yeni Ödeme Yöntemi Ekleme Formu */}
                {isAddingPaymentMethod && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 sm:p-6 mb-6 border border-gray-200 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Yeni Ödeme Yöntemi Ekle
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ödeme Yöntemi Adı
                    </label>
                    <Input
                      value={newPaymentMethod.name}
                      onChange={(e) =>
                        setNewPaymentMethod({
                          ...newPaymentMethod,
                          name: e.target.value,
                        })
                      }
                      placeholder="Örn: Mobil Ödeme, Kripto Para"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kod (Benzersiz)
                    </label>
                    <Input
                      value={newPaymentMethod.code}
                      onChange={(e) =>
                        setNewPaymentMethod({
                          ...newPaymentMethod,
                          code: e.target.value,
                        })
                      }
                      placeholder="Örn: mobile, crypto"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Renk
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={newPaymentMethod.color}
                        onChange={(e) =>
                          setNewPaymentMethod({
                            ...newPaymentMethod,
                            color: e.target.value,
                          })
                        }
                        className="w-20 h-10"
                      />
                      <Input
                        value={newPaymentMethod.color}
                        onChange={(e) =>
                          setNewPaymentMethod({
                            ...newPaymentMethod,
                            color: e.target.value,
                          })
                        }
                        placeholder="#16a34a"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddPaymentMethod}>
                      <Save className="h-4 w-4 mr-2" />
                      Kaydet
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddingPaymentMethod(false);
                        setNewPaymentMethod({
                          name: "",
                          code: "",
                          color: "#16a34a",
                        });
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      İptal
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Ödeme Yöntemleri Listesi */}
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>Henüz ödeme yöntemi eklenmemiş</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                      >
                    {editingPaymentMethod?.id === method.id && editingPaymentMethod ? (
                      <div className="space-y-3">
                        <Input
                          value={editingPaymentMethod.name}
                          onChange={(e) =>
                            setEditingPaymentMethod({
                              ...editingPaymentMethod,
                              name: e.target.value,
                              companyId: editingPaymentMethod.companyId || "",
                            })
                          }
                          className="w-full"
                        />
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={editingPaymentMethod.color || "#16a34a"}
                            onChange={(e) =>
                              setEditingPaymentMethod({
                                ...editingPaymentMethod,
                                color: e.target.value,
                                companyId: editingPaymentMethod.companyId || "",
                              })
                            }
                            className="w-16 h-10"
                          />
                          <Input
                            value={editingPaymentMethod.color || "#16a34a"}
                            onChange={(e) =>
                              setEditingPaymentMethod({
                                ...editingPaymentMethod,
                                color: e.target.value,
                                companyId: editingPaymentMethod.companyId || "",
                              })
                            }
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editingPaymentMethod.isActive}
                              onChange={(e) =>
                                setEditingPaymentMethod({
                                  ...editingPaymentMethod,
                                  isActive: e.target.checked,
                                  companyId: editingPaymentMethod.companyId || "",
                                })
                              }
                              className="mr-2"
                            />
                            Aktif
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleUpdatePaymentMethod}
                            className="flex-1"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Kaydet
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPaymentMethod(null)}
                            className="flex-1"
                          >
                            <X className="h-3 w-3 mr-1" />
                            İptal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{
                              backgroundColor: method.color || "#16a34a",
                            }}
                          >
                            {method.name.charAt(0).toUpperCase()}
                          </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  {method.name}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {method.code}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {method.isDefault && (
                                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                    Standart
                                  </span>
                                )}
                                {!method.isActive && (
                                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                    Pasif
                                  </span>
                                )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingPaymentMethod(method)}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                              title="Düzenle"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {!method.isDefault && (
                              <button
                                onClick={() =>
                                  handleDeletePaymentMethod(
                                    method.id!,
                                    method.isDefault
                                  )
                                }
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title="Sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

