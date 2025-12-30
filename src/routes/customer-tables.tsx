import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTablesByCompany, deleteTable } from "@/lib/firebase/tables";
import {
  getCustomersByCompany,
  deleteCustomer,
} from "@/lib/firebase/customers";
import { getOrdersByCompany } from "@/lib/firebase/orders";
import type { Table, CustomerAccount } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Trash2, User, Loader2 } from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";
import { customAlert } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/customer-tables")({
  component: CustomerTablesManagement,
});

function CustomerTablesManagement() {
  try {
    return (
      <POSLayout headerTitle="Cari Masalar">
        <CustomerTablesManagementContent />
      </POSLayout>
    );
  } catch (error) {
    console.error("CustomerTablesManagement render hatası:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Render Hatası
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : "Bilinmeyen hata"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Yeniden Yükle
          </button>
        </div>
      </div>
    );
  }
}

function CustomerTablesManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [customerTables, setCustomerTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const effectiveCompanyId = companyId || userData?.companyId;
        const effectiveBranchId = branchId || userData?.assignedBranchId;

        if (!effectiveCompanyId) {
          console.warn("⚠️ CompanyId bulunamadı, veri yükleme atlandı");
          setLoading(false);
          return;
        }

        console.log("📊 Cari masaları yükleniyor...", {
          companyId: effectiveCompanyId,
          branchId: effectiveBranchId,
        });

        // Cari masalarını yükle
        const tablesData = await getTablesByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        let customerTablesData = tablesData.filter((t) => t.area === "Cari");

        console.log("✅ Masalar yüklendi:", customerTablesData.length);

        // Carileri yükle
        const customersData = await getCustomersByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setCustomers(customersData);
        console.log("✅ Cariler yüklendi:", customersData.length);

        // Siparişleri yükle (son kullanım tarihini bulmak için)
        const ordersData = await getOrdersByCompany(effectiveCompanyId, {
          branchId: effectiveBranchId || undefined,
        });
        console.log("✅ Siparişler yüklendi:", ordersData.length);

        // Her cari masası için son sipariş tarihini bul ve sırala
        customerTablesData = customerTablesData.map((table) => {
          const customer = customersData.find(
            (c) => c.name === table.tableNumber
          );

          // Bu masaya ait son siparişi bul
          const tableOrders = ordersData.filter((o) => o.tableId === table.id);

          const lastOrderDate =
            tableOrders.length > 0
              ? new Date(
                  Math.max(...tableOrders.map((o) => o.updatedAt.getTime()))
                )
              : customer?.lastOrderAt || table.updatedAt || table.createdAt;

          return {
            ...table,
            _lastOrderDate: lastOrderDate,
          };
        });

        // Tarihe göre sırala (en son kullanılan üstte)
        customerTablesData.sort((a, b) => {
          const dateA = (a as any)._lastOrderDate?.getTime() || 0;
          const dateB = (b as any)._lastOrderDate?.getTime() || 0;
          return dateB - dateA; // En yeni üstte
        });

        setCustomerTables(customerTablesData);
        console.log(
          "✅ Cari masaları başarıyla yüklendi:",
          customerTablesData.length
        );
      } catch (error) {
        console.error("❌ Veri yükleme hatası:", error);
        customAlert("Veriler yüklenirken bir hata oluştu", "Hata", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, branchId, userData]);

  const handleDeleteCustomer = async (
    customer: CustomerAccount,
    table: Table
  ) => {
    await customAlert(
      `${customer.name} carisini ve masasını silmek istediğinize emin misiniz?`,
      "Onay",
      "warning"
    );

    try {
      // Önce masayı sil
      if (table.id) {
        await deleteTable(table.id);
      }

      // Sonra cariyi sil (soft delete)
      if (customer.id) {
        await deleteCustomer(customer.id);
      }

      // Verileri yeniden yükle
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;

      if (effectiveCompanyId) {
        const tablesData = await getTablesByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        const customerTablesData = tablesData.filter((t) => t.area === "Cari");
        setCustomerTables(customerTablesData);

        const customersData = await getCustomersByCompany(
          effectiveCompanyId,
          effectiveBranchId || undefined
        );
        setCustomers(customersData);
      }

      customAlert("Cari başarıyla silindi", "Başarılı", "success");
    } catch (error) {
      customAlert("Cari silinirken bir hata oluştu", "Hata", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="shrink-0 p-4 xl:p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Cari Masaları
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Cari hesaplarınızı ve masalarını yönetin
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 xl:p-6">
        {customerTables.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Henüz cari masası bulunmuyor
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {customerTables.map((table) => {
              const customer = customers.find(
                (c) => c.name === table.tableNumber
              );

              return (
                <div
                  key={table.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all h-full flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3 shrink-0">
                    <Link
                      to="/table/$tableId"
                      params={{ tableId: table.id! }}
                      search={{
                        area: undefined,
                        activeOnly: false,
                        payment: undefined,
                      }}
                      className="flex-1 min-w-0"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                        {table.tableNumber}
                      </h3>
                      {customer && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {customer.phone || "Telefon yok"}
                        </p>
                      )}
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (customer) {
                          handleDeleteCustomer(customer, table);
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          table.status === "occupied"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {table.status === "occupied" ? "Dolu" : "Müsait"}
                      </span>
                    </div>
                    <Link
                      to="/table/$tableId"
                      params={{ tableId: table.id! }}
                      search={{
                        area: undefined,
                        activeOnly: false,
                        payment: undefined,
                      }}
                    >
                      <Button size="sm" variant="outline">
                        Aç
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
