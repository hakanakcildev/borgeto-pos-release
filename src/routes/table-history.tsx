import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBillsByCompany } from "@/lib/firebase/bills";
import type { Bill } from "@/lib/firebase/types";
import { POSLayout } from "@/components/layouts/POSLayout";
import { History, Clock, Receipt, X, Printer } from "lucide-react";
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Tüm adisyonları yükle
  useEffect(() => {
    const loadBills = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const billsData = await getBillsByCompany(effectiveCompanyId, {
          branchId: effectiveBranchId || undefined,
        });
        setBills(billsData);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);


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

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePrint = () => {
    if (!selectedBill) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const paymentMethodName = (method: string) => {
      return method === "cash" ? "Nakit" : 
             method === "card" ? "Kart" : 
             method === "mealCard" ? "Yemek Kartı" : 
             method;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Adisyon - ${selectedBill.billNumber}</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 1cm;
              }
            }
            body {
              font-family: Arial, sans-serif;
              max-width: 80mm;
              margin: 0 auto;
              padding: 20px;
              font-size: 12px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .header h1 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
            }
            .info {
              margin-bottom: 15px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .items {
              border-top: 1px solid #ccc;
              border-bottom: 1px solid #ccc;
              padding: 10px 0;
              margin: 15px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .item-name {
              flex: 1;
            }
            .item-quantity {
              margin: 0 10px;
            }
            .totals {
              margin-top: 15px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-weight: bold;
            }
            .payments {
              margin-top: 15px;
              border-top: 1px solid #ccc;
              padding-top: 10px;
            }
            .payment-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #ccc;
              font-size: 10px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ADİSYON</h1>
            <p>${selectedBill.billNumber}</p>
          </div>
          
          <div class="info">
            <div class="info-row">
              <span>Masa:</span>
              <span><strong>${selectedBill.tableNumber}</strong></span>
            </div>
            <div class="info-row">
              <span>Tarih:</span>
              <span>${formatFullDate(selectedBill.createdAt)}</span>
            </div>
            ${selectedBill.customerName ? `
            <div class="info-row">
              <span>Müşteri:</span>
              <span>${selectedBill.customerName}</span>
            </div>
            ` : ''}
            ${selectedBill.customerPhone ? `
            <div class="info-row">
              <span>Telefon:</span>
              <span>${selectedBill.customerPhone}</span>
            </div>
            ` : ''}
          </div>

          <div class="items">
            ${selectedBill.items.map(item => `
              <div class="item">
                <span class="item-name">${item.menuName}</span>
                <span class="item-quantity">x${item.quantity}</span>
                <span>₺${item.subtotal.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          <div class="totals">
            <div class="info-row">
              <span>Ara Toplam:</span>
              <span>₺${selectedBill.subtotal.toFixed(2)}</span>
            </div>
            ${selectedBill.discount && selectedBill.discount > 0 ? `
            <div class="info-row">
              <span>İndirim:</span>
              <span>-₺${selectedBill.discount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row">
              <span>TOPLAM:</span>
              <span>₺${selectedBill.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="payments">
            <strong>Ödemeler:</strong>
            ${selectedBill.payments.map(payment => `
              <div class="payment-row">
                <span>${paymentMethodName(payment.method)}</span>
                <span>₺${payment.amount.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          ${selectedBill.notes ? `
          <div class="info" style="margin-top: 15px;">
            <strong>Notlar:</strong>
            <p>${selectedBill.notes}</p>
          </div>
          ` : ''}

          <div class="footer">
            <p>Teşekkür ederiz!</p>
            <p>${formatFullDate(selectedBill.createdAt)}</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="h-8 w-8" />
          Masa Geçmişi
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Tüm adisyon geçmişini görüntüleyin
        </p>
      </div>

      {/* Adisyon Listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              Henüz adisyon kaydı bulunmuyor
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
            {bills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => setSelectedBill(bill)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">
                          {bill.billNumber}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          Masa {bill.tableNumber}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(bill.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-gray-900 dark:text-white">
                      ₺{bill.total.toFixed(2)}
                    </p>
                    {bill.discount && bill.discount > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-through">
                        ₺{bill.subtotal.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Ürünler */}
                <div className="mb-3 space-y-1">
                  {bill.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.menuName} <span className="text-gray-500 dark:text-gray-400">x{item.quantity}</span>
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        ₺{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Ödemeler */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ödemeler:</p>
                  <div className="space-y-1">
                    {bill.payments.map((payment, idx) => {
                      const paymentMethodName = payment.method === "cash" ? "Nakit" : 
                                                 payment.method === "card" ? "Kart" : 
                                                 payment.method === "mealCard" ? "Yemek Kartı" : 
                                                 payment.method;
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            {paymentMethodName}
                          </span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            ₺{payment.amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* İndirim */}
                {bill.discount && bill.discount > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">İndirim:</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        -₺{bill.discount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adisyon Detay Modalı */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedBill.billNumber}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFullDate(selectedBill.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Yazdır
                </Button>
                <button
                  onClick={() => setSelectedBill(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Masa ve Müşteri Bilgileri */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Masa</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedBill.tableNumber}
                  </p>
                </div>
                {selectedBill.customerName && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Müşteri</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {selectedBill.customerName}
                    </p>
                    {selectedBill.customerPhone && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {selectedBill.customerPhone}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Ürünler */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Ürünler
                </h3>
                <div className="space-y-2">
                  {selectedBill.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.menuName}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Not: {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.quantity} adet
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ₺{item.subtotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Toplamlar */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ara Toplam</span>
                    <span className="text-gray-900 dark:text-white">
                      ₺{selectedBill.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {selectedBill.discount && selectedBill.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">İndirim</span>
                      <span className="text-red-600 dark:text-red-400">
                        -₺{selectedBill.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">TOPLAM</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      ₺{selectedBill.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ödemeler */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Ödemeler
                </h3>
                <div className="space-y-2">
                  {selectedBill.payments.map((payment, idx) => {
                    const paymentMethodName = payment.method === "cash" ? "Nakit" : 
                                               payment.method === "card" ? "Kart" : 
                                               payment.method === "mealCard" ? "Yemek Kartı" : 
                                               payment.method;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {paymentMethodName}
                          </p>
                          {payment.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ₺{payment.amount.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notlar */}
              {selectedBill.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Notlar
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300">{selectedBill.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

