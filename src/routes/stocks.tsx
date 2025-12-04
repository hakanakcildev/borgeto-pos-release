import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllStocksByCompany,
  addStock,
  deleteStock,
  addStockMovement,
  getAllStockMovementsByCompany,
} from "@/lib/firebase/stocks";
import { getAllCategoriesByCompany, getAllMenusByCompany } from "@/lib/firebase/menus";
import type { Stock, StockMovement, StockMovementType } from "@/lib/firebase/types";
import type { Category, Menu } from "@/lib/firebase/types";
import {
  Plus,
  Trash2,
  Save,
  X,
  Package,
  Search,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { POSLayout } from "@/components/layouts/POSLayout";
import { customAlert } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/stocks")({
  component: StockManagement,
});

function StockManagement() {
  return (
    <POSLayout>
      <StockManagementContent />
    </POSLayout>
  );
}

function StockManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stocks" | "movements">("stocks");

  // Stock form states
  const [showStockForm, setShowStockForm] = useState(false);
  const [_editingStock, setEditingStock] = useState<Stock | null>(null);
  const [stockForm, setStockForm] = useState({
    name: "",
    packageType: "koli" as "koli" | "paket",
    itemsPerPackage: "",
    currentQuantity: "",
    menuId: "",
  });
  const [menuSearchTerm, setMenuSearchTerm] = useState("");

  // Movement form states
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [selectedStockForMovement, setSelectedStockForMovement] = useState<Stock | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: "in" as StockMovementType,
    quantity: "",
    unitType: "package" as "package" | "item", // Standart olarak koli/paket
    reason: "",
    notes: "",
  });

  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [stocksData, categoriesData, menusData, movementsData] = await Promise.all([
          getAllStocksByCompany(effectiveCompanyId, effectiveBranchId || undefined),
          getAllCategoriesByCompany(effectiveCompanyId, effectiveBranchId || undefined),
          getAllMenusByCompany(effectiveCompanyId, effectiveBranchId || undefined),
          getAllStockMovementsByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        ]);

        setStocks(stocksData);
        setCategories(categoriesData);
        setMenus(menusData);
        setMovements(movementsData);
      } catch (error) {
        customAlert("Veriler yüklenirken bir hata oluştu", "Hata", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Filter stocks
  const filteredStocks = stocks.filter((stock) => {
    const matchesSearch =
      stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !selectedCategory || stock.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for display
  const displayCategories = categories.filter((cat) => cat.isActive);

  // Get stocks with low quantity
  const lowStockItems = filteredStocks.filter(
    (stock) => stock.isActive && stock.currentQuantity <= stock.minQuantity
  );

  // Stock handlers
  const handleAddStock = () => {
    setEditingStock(null);
    setStockForm({
      name: "",
      packageType: "koli",
      itemsPerPackage: "",
      currentQuantity: "",
      menuId: "",
    });
    setMenuSearchTerm("");
    setShowStockForm(true);
  };

  // Filter menus for search
  const filteredMenus = menus.filter((menu) =>
    menu.name.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
    menu.category?.toLowerCase().includes(menuSearchTerm.toLowerCase())
  );

  const handleSaveStock = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    // Yeni ürün eklerken menuId zorunlu
    if (!stockForm.menuId) {
      customAlert("Lütfen menü ürününü seçin", "Uyarı", "warning");
      return;
    }
    
    if (!effectiveCompanyId || !stockForm.name) {
      customAlert("Lütfen tüm gerekli alanları doldurun", "Uyarı", "warning");
      return;
    }

    if (!stockForm.itemsPerPackage || stockForm.itemsPerPackage.trim() === "") {
      customAlert("1 kolide/pakette kaç adet olduğunu girin", "Uyarı", "warning");
      return;
    }
    
    if (!stockForm.currentQuantity || stockForm.currentQuantity.trim() === "") {
      customAlert("Mevcut stok adedini girin", "Uyarı", "warning");
      return;
    }

    const itemsPerPackage = parseInt(stockForm.itemsPerPackage);
    const currentQuantity = parseFloat(stockForm.currentQuantity);
    
    if (isNaN(itemsPerPackage) || itemsPerPackage < 1) {
      customAlert("1 kolide/pakette en az 1 adet olmalıdır", "Uyarı", "warning");
      return;
    }

    if (isNaN(currentQuantity) || currentQuantity < 0) {
      customAlert("Mevcut stok adedi geçerli bir sayı olmalıdır", "Uyarı", "warning");
      return;
    }

    try {
      // Menü adını al
      const selectedMenu = menus.find((m) => m.id === stockForm.menuId);
      const menuName = selectedMenu?.name;
      const category = selectedMenu?.category;

      const stockData: Omit<Stock, "id" | "createdAt" | "updatedAt"> = {
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        name: stockForm.name,
        packageType: stockForm.packageType,
        itemsPerPackage,
        currentQuantity,
        minQuantity: 0, // Varsayılan
        category: category || undefined,
        menuId: stockForm.menuId,
        menuName,
        isActive: true,
      };

      await addStock(stockData);

      // Reload data
      const [stocksData, movementsData] = await Promise.all([
        getAllStocksByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        getAllStockMovementsByCompany(effectiveCompanyId, effectiveBranchId || undefined),
      ]);

      setStocks(stocksData);
      setMovements(movementsData);
      setShowStockForm(false);
      setEditingStock(null);
      setMenuSearchTerm("");
      customAlert("Stok eklendi", "Başarılı", "success");
    } catch (error) {
      customAlert("Stok kaydedilirken bir hata oluştu", "Hata", "error");
    }
  };

  const handleDeleteStock = async (stock: Stock) => {
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    // Sadece aynı şubeye ait stokları silebilir
    if (effectiveBranchId && stock.branchId && stock.branchId !== effectiveBranchId) {
      customAlert("Bu stok başka bir şubeye ait.\nSadece kendi şubenizin stoklarını silebilirsiniz.", "Uyarı", "warning");
      return;
    }
    
    if (!confirm(`${stock.name} stokunu silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const effectiveCompanyId = companyId || userData?.companyId;
      
      await deleteStock(stock.id!);
      const stocksData = await getAllStocksByCompany(
        effectiveCompanyId!,
        effectiveBranchId || undefined
      );
      setStocks(stocksData);
      customAlert("Stok silindi", "Başarılı", "success");
    } catch (error) {
      customAlert("Stok silinirken bir hata oluştu", "Hata", "error");
    }
  };


  const handleSaveMovement = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !selectedStockForMovement || !movementForm.quantity) {
      customAlert("Lütfen tüm gerekli alanları doldurun", "Uyarı", "warning");
      return;
    }

    const quantity = parseFloat(movementForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      customAlert("Lütfen geçerli bir miktar girin", "Uyarı", "warning");
      return;
    }

    // Calculate actual quantity based on unitType
    let actualQuantity = quantity;
    let finalUnitType = movementForm.unitType;
    
    if (movementForm.unitType === "package") {
      // Koli/paket cinsinden: quantity * itemsPerPackage
      actualQuantity = quantity * selectedStockForMovement.itemsPerPackage;
      // quantity artık adet cinsinden olduğu için unitType'ı "item" olarak kaydet
      finalUnitType = "item";
    }

    // Check if out movement would result in negative quantity
    if (movementForm.type === "out") {
      const newQuantity = selectedStockForMovement.currentQuantity - actualQuantity;
      if (newQuantity < 0) {
        customAlert(
          `Yeterli stok yok. Mevcut stok: ${selectedStockForMovement.currentQuantity} adet`,
          "Uyarı",
          "warning"
        );
        return;
      }
    }

    try {
      const movementData: Omit<StockMovement, "id" | "createdAt"> = {
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        stockId: selectedStockForMovement.id!,
        type: movementForm.type,
        quantity: actualQuantity, // Adet cinsinden hesaplanmış miktar
        unitType: finalUnitType, // Adet cinsinden olduğu için "item"
        reason: movementForm.reason || undefined,
        notes: movementForm.notes || undefined,
        createdBy: userData?.id || "",
      };

      await addStockMovement(movementData, true);

      // Reload data
      const [stocksData, movementsData] = await Promise.all([
        getAllStocksByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        getAllStockMovementsByCompany(effectiveCompanyId, effectiveBranchId || undefined),
      ]);

      setStocks(stocksData);
      setMovements(movementsData);
      setShowMovementForm(false);
      setSelectedStockForMovement(null);
      customAlert("Stok hareketi eklendi", "Başarılı", "success");
    } catch (error) {
      customAlert("Stok hareketi eklenirken bir hata oluştu", "Hata", "error");
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
            <Package className="h-8 w-8" />
            Stok Yönetimi
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Stok kalemlerini ve hareketlerini yönetin
          </p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {lowStockItems.length} stok kalemi minimum seviyenin altında
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("stocks")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "stocks"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Stoklar ({stocks.length})
        </button>
        <button
          onClick={() => setActiveTab("movements")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "movements"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Hareketler ({movements.length})
        </button>
      </div>

      {/* Stocks Tab */}
      {activeTab === "stocks" && (
        <div>
          {/* Search and Filter */}
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Stok ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800"
              />
            </div>
            <select
              value={selectedCategory || ""}
              onChange={(e) =>
                setSelectedCategory(e.target.value || null)
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Tüm Kategoriler</option>
              {displayCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <Button onClick={handleAddStock} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Stok Ekle
            </Button>
          </div>

          {/* Stocks List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredStocks.map((stock) => {
              const isLowStock = stock.isActive && stock.currentQuantity <= stock.minQuantity;
              return (
                <div
                  key={stock.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border transition-shadow ${
                    isLowStock
                      ? "border-red-300 dark:border-red-700"
                      : "border-gray-200 dark:border-gray-700"
                  } hover:shadow-md`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {stock.name}
                      </h3>
                      {stock.category && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {stock.category}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded flex-shrink-0 ml-1 ${
                        stock.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {stock.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  
                  {stock.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {stock.description}
                    </p>
                  )}

                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Mevcut:</span>
                      <span className={`text-sm font-bold ${
                        isLowStock
                          ? "text-red-600 dark:text-red-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}>
                        {stock.currentQuantity} adet
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {stock.packageType === "koli" ? "Koli" : "Paket"}:
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.floor(stock.currentQuantity / stock.itemsPerPackage)} {stock.packageType}
                        ({stock.itemsPerPackage} adet/{stock.packageType})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Min:</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {stock.minQuantity} adet
                      </span>
                    </div>
                    {stock.maxQuantity && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Max:</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {stock.maxQuantity} adet
                        </span>
                      </div>
                    )}
                    {stock.menuName && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Menü: {stock.menuName}
                      </div>
                    )}
                  </div>

                  {stock.cost && (
                    <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                      Maliyet: ₺{stock.cost.toFixed(2)}/adet
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1 mt-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedStockForMovement(stock);
                          setMovementForm({
                            type: "in",
                            quantity: "",
                            unitType: "package",
                            reason: "",
                            notes: "",
                          });
                          setShowMovementForm(true);
                        }}
                        className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white border-0"
                        title="Ekle"
                      >
                        <ArrowUp className="h-3 w-3 mr-1" />
                        Ekle
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedStockForMovement(stock);
                          setMovementForm({
                            type: "out",
                            quantity: "",
                            unitType: "package",
                            reason: "",
                            notes: "",
                          });
                          setShowMovementForm(true);
                        }}
                        className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white border-0"
                        title="Çıkar"
                      >
                        <ArrowDown className="h-3 w-3 mr-1" />
                        Çıkar
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDeleteStock(stock)}
                      className="bg-red-600 hover:bg-red-700 text-white border-0 h-7 w-7 p-0"
                      title="Sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredStocks.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Package className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || selectedCategory
                  ? "Arama kriterlerinize uygun stok bulunamadı"
                  : "Henüz stok eklenmemiş"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === "movements" && (
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stok
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tip
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Miktar
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Sebep
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Notlar
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {movements.map((movement) => {
                    const stock = stocks.find((s) => s.id === movement.stockId);
                    return (
                      <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(movement.createdAt).toLocaleString("tr-TR")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {stock?.name || "Bilinmeyen"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${
                            movement.type === "in"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : movement.type === "out"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {movement.type === "in" ? (
                              <>
                                <ArrowUp className="h-3 w-3" />
                                Giriş
                              </>
                            ) : movement.type === "out" ? (
                              <>
                                <ArrowDown className="h-3 w-3" />
                                Çıkış
                              </>
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3" />
                                Düzeltme
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {movement.quantity} adet
                          {movement.unitType === "package" && stock && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              ({movement.quantity / stock.itemsPerPackage} {stock.packageType})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {movement.reason || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {movement.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {movements.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Henüz stok hareketi yok
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Form Modal */}
      {showStockForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Yeni Stok Ekle
              </h2>
              <button
                onClick={() => {
                  setShowStockForm(false);
                  setEditingStock(null);
                  setMenuSearchTerm("");
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ürün Adı *
                </label>
                <Input
                  value={stockForm.name}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, name: e.target.value })
                  }
                  className="bg-white dark:bg-gray-700"
                  placeholder="Örn: Domates, Peynir..."
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    1
                  </span>
                  <select
                    value={stockForm.packageType}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, packageType: e.target.value as "koli" | "paket" })
                    }
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="koli">Koli</option>
                    <option value="paket">Paket</option>
                  </select>
                  <Input
                    type="number"
                    min="1"
                    value={stockForm.itemsPerPackage}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, itemsPerPackage: e.target.value })
                    }
                    className="bg-white dark:bg-gray-700"
                    placeholder="12"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Adet *
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Menü Ürünü Eşleştir *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    value={menuSearchTerm}
                    onChange={(e) => setMenuSearchTerm(e.target.value)}
                    placeholder="Menü ürünü ara..."
                    className="pl-10 bg-white dark:bg-gray-700 mb-2"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  {filteredMenus.length > 0 ? (
                    filteredMenus.map((menu) => (
                      <div
                        key={menu.id}
                        onClick={() => {
                          setStockForm({ ...stockForm, menuId: menu.id! });
                          setMenuSearchTerm(menu.name);
                        }}
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                          stockForm.menuId === menu.id ? "bg-blue-100 dark:bg-blue-900/30" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {menu.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {menu.category} - ₺{menu.price.toFixed(2)}
                            </p>
                          </div>
                          {stockForm.menuId === menu.id && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Menü bulunamadı
                    </div>
                  )}
                </div>
                {stockForm.menuId && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ {menus.find((m) => m.id === stockForm.menuId)?.name} seçildi
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mevcut Stok Adedi (Adet) *
                </label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={stockForm.currentQuantity}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, currentQuantity: e.target.value })
                  }
                  className="bg-white dark:bg-gray-700"
                  placeholder="0"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowStockForm(false);
                    setEditingStock(null);
                    setMenuSearchTerm("");
                  }}
                >
                  İptal
                </Button>
                <Button onClick={handleSaveStock} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Stok Ürünü Oluştur
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement Form Modal */}
      {showMovementForm && selectedStockForMovement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Stok Hareketi Ekle
              </h2>
              <button
                onClick={() => {
                  setShowMovementForm(false);
                  setSelectedStockForMovement(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Stok:</strong> {selectedStockForMovement.name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Mevcut Miktar:</strong> {selectedStockForMovement.currentQuantity} adet
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{selectedStockForMovement.packageType === "koli" ? "Koli" : "Paket"}:</strong> {Math.floor(selectedStockForMovement.currentQuantity / selectedStockForMovement.itemsPerPackage)} {selectedStockForMovement.packageType}
                ({selectedStockForMovement.itemsPerPackage} adet/{selectedStockForMovement.packageType})
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hareket Tipi *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="movementType"
                      value="in"
                      checked={movementForm.type === "in"}
                      onChange={() =>
                        setMovementForm({ ...movementForm, type: "in" })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <ArrowUp className="h-4 w-4 text-green-600" />
                      Giriş
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="movementType"
                      value="out"
                      checked={movementForm.type === "out"}
                      onChange={() =>
                        setMovementForm({ ...movementForm, type: "out" })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <ArrowDown className="h-4 w-4 text-red-600" />
                      Çıkış
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="movementType"
                      value="adjustment"
                      checked={movementForm.type === "adjustment"}
                      onChange={() =>
                        setMovementForm({ ...movementForm, type: "adjustment" })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <RotateCcw className="h-4 w-4 text-blue-600" />
                      Düzeltme
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Birim Tipi *
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="unitType"
                      value="package"
                      checked={movementForm.unitType === "package"}
                      onChange={() =>
                        setMovementForm({ ...movementForm, unitType: "package" })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedStockForMovement.packageType === "koli" ? "Koli" : "Paket"}
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="unitType"
                      value="item"
                      checked={movementForm.unitType === "item"}
                      onChange={() =>
                        setMovementForm({ ...movementForm, unitType: "item" })
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Adet
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Miktar ({movementForm.unitType === "package" 
                    ? selectedStockForMovement.packageType === "koli" ? "Koli" : "Paket"
                    : "Adet"}) *
                </label>
                <Input
                  type="number"
                  step={movementForm.unitType === "package" ? "1" : "1"}
                  min="1"
                  value={movementForm.quantity}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, quantity: e.target.value })
                  }
                  className="bg-white dark:bg-gray-700"
                />
                {movementForm.unitType === "package" && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {movementForm.quantity ? 
                      `${parseFloat(movementForm.quantity) * selectedStockForMovement.itemsPerPackage} adet eklenecek/çıkarılacak` 
                      : ""}
                  </p>
                )}
                {movementForm.type === "adjustment" && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Düzeltme tipinde miktar, yeni toplam miktarı temsil eder (adet cinsinden)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sebep
                </label>
                <Input
                  value={movementForm.reason}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, reason: e.target.value })
                  }
                  placeholder="Örn: Satış, Alış, Sayım düzeltmesi"
                  className="bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notlar
                </label>
                <Textarea
                  value={movementForm.notes}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMovementForm(false);
                    setSelectedStockForMovement(null);
                  }}
                >
                  İptal
                </Button>
                <Button onClick={handleSaveMovement} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

