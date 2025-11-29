import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTablesByCompany } from "@/lib/firebase/tables";
import { getTableHistory, checkAndClearTableHistory, getTablesWithHistory, clearAllTableHistory } from "@/lib/firebase/tableHistory";
import type { Table } from "@/lib/firebase/types";
import type { TableHistoryItem } from "@/lib/firebase/tableHistory";
import { POSLayout } from "@/components/layouts/POSLayout";
import { History, Clock, Package, X, ArrowRight, CreditCard, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/table-history")({
  component: TableHistory,
});

function TableHistory() {
  return (
    <POSLayout>
      <TableHistoryContent />
    </POSLayout>
  );
}

function TableHistoryContent() {
  const { userData, companyId, branchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [history, setHistory] = useState<TableHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Günlük temizleme kontrolü
  useEffect(() => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (effectiveCompanyId) {
      checkAndClearTableHistory(effectiveCompanyId, effectiveBranchId || undefined);
    }
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Masaları yükle (sadece işlem yapılmış masalar)
  useEffect(() => {
    const loadTables = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // İşlem yapılmış masa ID'lerini al
        const tablesWithHistoryIds = await getTablesWithHistory(effectiveCompanyId, effectiveBranchId || undefined);
        
        
        if (tablesWithHistoryIds.length === 0) {
          setTables([]);
          setLoading(false);
          return;
        }
        
        // Tüm masaları al
        const allTables = await getTablesByCompany(effectiveCompanyId, effectiveBranchId || undefined);
        
        // Sadece işlem yapılmış masaları filtrele
        const filteredTables = allTables.filter((table) => 
          table.id && tablesWithHistoryIds.includes(table.id)
        );
        
        
        setTables(filteredTables.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber)));
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Seçilen masanın geçmişini yükle
  const loadTableHistory = useCallback(async (tableId: string) => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId) return;

    try {
      setHistoryLoading(true);
      const historyData = await getTableHistory(effectiveCompanyId, tableId, effectiveBranchId || undefined);
      setHistory(historyData);
    } catch (error) {
    } finally {
      setHistoryLoading(false);
    }
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  useEffect(() => {
    if (selectedTableId) {
      loadTableHistory(selectedTableId);
    } else {
      setHistory([]);
    }
  }, [selectedTableId, loadTableHistory]);

  const getActionIcon = (action: TableHistoryItem["action"]) => {
    switch (action) {
      case "item_added":
        return <ShoppingCart className="h-4 w-4" />;
      case "item_cancelled":
        return <X className="h-4 w-4" />;
      case "item_moved":
      case "table_moved":
        return <ArrowRight className="h-4 w-4" />;
      case "partial_payment":
      case "full_payment":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: TableHistoryItem["action"]) => {
    switch (action) {
      case "item_added":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
      case "item_cancelled":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
      case "item_moved":
      case "table_moved":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
      case "partial_payment":
      case "full_payment":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Az önce";
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Tüm masa geçmişini temizle
  const handleClearAll = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId) return;

    try {
      setIsClearing(true);
      await clearAllTableHistory(effectiveCompanyId, effectiveBranchId || undefined);
      setShowClearConfirm(false);
      // State'i temizle
      setTables([]);
      setHistory([]);
      setSelectedTableId(null);
    } catch (error) {
      alert("Masa geçmişi temizlenirken bir hata oluştu");
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="h-8 w-8" />
            Masa Geçmişi
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Masaların tüm hareketlerini görüntüleyin
          </p>
        </div>
        <Button
          onClick={() => setShowClearConfirm(true)}
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Tüm Geçmişi Temizle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Masa Listesi */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Masalar
            </h2>
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
              {tables.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Masa bulunamadı
                </p>
              ) : (
                tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTableId(table.id!)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedTableId === table.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Masa {table.tableNumber}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        selectedTableId === table.id
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                      }`}>
                        {table.status === "available" ? "Müsait" :
                         table.status === "occupied" ? "Dolu" :
                         table.status === "reserved" ? "Rezerve" : "Temizlik"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Geçmiş Listesi */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {!selectedTableId ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  Geçmişini görmek için bir masa seçin
                </p>
              </div>
            ) : historyLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">
                  Bu masa için henüz geçmiş kaydı bulunmuyor
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getActionColor(item.action)}`}>
                        {getActionIcon(item.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.description}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        {item.details && (
                          <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {item.details.menuName && (
                              <p>
                                <span className="font-medium">Ürün:</span> {item.details.menuName}
                                {item.details.quantity && ` (${item.details.quantity} adet)`}
                              </p>
                            )}
                            {item.details.subtotal && (
                              <p>
                                <span className="font-medium">Tutar:</span> ₺{item.details.subtotal.toFixed(2)}
                              </p>
                            )}
                            {item.details.movedFromTableNumber && (
                              <p>
                                <span className="font-medium">Nereden:</span> Masa {item.details.movedFromTableNumber}
                              </p>
                            )}
                            {item.details.movedToTableNumber && (
                              <p>
                                <span className="font-medium">Nereye:</span> Masa {item.details.movedToTableNumber}
                              </p>
                            )}
                            {item.details.paymentAmount && (
                              <p>
                                <span className="font-medium">Ödeme Tutarı:</span> ₺{item.details.paymentAmount.toFixed(2)}
                                {item.details.paymentMethod && ` (${item.details.paymentMethod === "cash" ? "Nakit" : item.details.paymentMethod === "card" ? "Kart" : "Yemek Kartı"})`}
                              </p>
                            )}
                            {item.details.paidItems && item.details.paidItems.length > 0 && (
                              <div className="mt-2">
                                <p className="font-medium mb-1">Ödenen Ürünler:</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {item.details.paidItems.map((paidItem, idx) => (
                                    <li key={idx}>
                                      {paidItem.menuName} ({paidItem.quantity} adet) - ₺{paidItem.subtotal.toFixed(2)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tüm Geçmişi Temizle Onay Modalı */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Tüm Masa Geçmişini Temizle
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Bu işlem tüm masa geçmişi verilerini kalıcı olarak silecektir. Bu işlem geri alınamaz. Emin misiniz?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleClearAll}
                disabled={isClearing}
                variant="destructive"
                className="flex-1"
              >
                {isClearing ? "Temizleniyor..." : "Evet, Temizle"}
              </Button>
              <Button
                onClick={() => setShowClearConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

