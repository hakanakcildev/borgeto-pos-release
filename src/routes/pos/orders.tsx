import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrdersByCompany } from "@/lib/firebase/orders";
import { getTablesByCompany } from "@/lib/firebase/tables";
import type { Order, Table } from "@/lib/firebase/types";
import { Clock, Utensils } from "lucide-react";

export const Route = createFileRoute("/pos/orders")({
  component: ActiveTables,
});

function ActiveTables() {
  const { userData, companyId, branchId } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        const [tablesData, ordersData] = await Promise.all([
          getTablesByCompany(effectiveCompanyId, effectiveBranchId || undefined).catch(() => {
            return [];
          }),
          getOrdersByCompany(effectiveCompanyId, {
            branchId: effectiveBranchId || undefined,
          }).catch(() => {
            return [];
          }),
        ]);

        setTables(tablesData);
        setOrders(ordersData);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Sadece aktif siparişi olan masaları filtrele
  const activeTables = tables.filter((table) => {
    return orders.some((order) => 
      order.tableId === table.id && 
      order.status === "active" && 
      order.total > 0
    );
  });

  const getTableOrder = (tableId: string) => {
    return orders.find((order) => order.tableId === tableId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Aktif Masalar
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          {activeTables.length} aktif masa
        </p>
      </div>

      {/* Active Tables List */}
      {activeTables.length === 0 ? (
        <div className="bg-white rounded-lg p-8 sm:p-12 text-center shadow-sm border border-gray-200">
          <Utensils className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aktif masa yok
          </h3>
          <p className="text-sm text-gray-600">
            Henüz sipariş alınmamış masa bulunmuyor
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTables.map((table) => {
            const order = getTableOrder(table.id!);
            if (!order) return null;

            return (
              <Link
                key={table.id}
                to="/table/$tableId"
                params={{ tableId: table.id! }}
                search={{ area: undefined, activeOnly: false }}
                className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                {/* Table Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Masa {table.tableNumber}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{order.orderNumber}</p>
                  </div>
                </div>

                {/* Order Items Summary */}
                <div className="space-y-2 mb-4">
                  {order.items.slice(0, 3).map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">
                          {item.quantity}x
                        </span>{" "}
                        <span className="text-gray-700">{item.menuName}</span>
                      </div>
                      <span className="text-gray-600">
                        ₺{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="text-xs text-gray-500 text-center pt-2">
                      +{order.items.length - 3} ürün daha
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="mb-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>Toplam</span>
                    <span className="text-blue-600">₺{order.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>
                    {new Date(order.createdAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

