import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTablesByCompany,
  addTable,
  deleteTable,
  updateTable,
} from "@/lib/firebase/tables";
import type { Table } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Save,
  X,
  Utensils,
} from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";
import { customAlert } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/tables")({
  component: TablesManagement,
});

function TablesManagement() {
  return (
    <POSLayout>
      <TablesManagementContent />
    </POSLayout>
  );
}

function TablesManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [newAreaName, setNewAreaName] = useState("");
  const [isAddingArea, setIsAddingArea] = useState(false);

  useEffect(() => {
    const loadTables = async () => {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      if (!effectiveCompanyId) {
        setLoading(false);
        return;
      }

      try {
        const tablesData = await getTablesByCompany(effectiveCompanyId, effectiveBranchId || undefined);
        
        // Duplicate masaları temizle
        const removeDuplicateTables = (tables: Table[]): Table[] => {
          const tableMap = new Map<string, Table>();
          
          tables.forEach((table) => {
            const key = `${table.area}-${table.tableNumber}`;
            const existing = tableMap.get(key);
            
            if (!existing) {
              tableMap.set(key, table);
            } else {
              const existingDate = existing.updatedAt || existing.createdAt;
              const currentDate = table.updatedAt || table.createdAt;
              
              if (currentDate > existingDate) {
                tableMap.set(key, table);
              }
            }
          });
          
          return Array.from(tableMap.values());
        };
        
        const uniqueTables = removeDuplicateTables(tablesData);
        
        // Eski masaların area alanını düzelt (eğer yoksa, boşsa veya sadece sayı ise "Diğer" olarak ata)
        const tablesWithoutArea = uniqueTables.filter(
          (t) => {
            if (!t.area || t.area.trim() === "") return true;
            // Sadece sayı olan area değerlerini de düzelt (örn: "3", "15")
            const isNumber = /^\d+$/.test(t.area.trim());
            return isNumber;
          }
        );
        
        if (tablesWithoutArea.length > 0) {
          await Promise.all(
            tablesWithoutArea.map((table) =>
              updateTable(table.id!, { area: "Diğer" })
            )
          );
          // Masaları yeniden yükle
          const updatedTables = await getTablesByCompany(effectiveCompanyId, effectiveBranchId || undefined);
          const uniqueUpdatedTables = removeDuplicateTables(updatedTables);
          setTables(uniqueUpdatedTables);
          
          // İlk alanı otomatik seç
          if (updatedTables.length > 0 && !selectedArea) {
            const areas = Array.from(
              new Set(
                updatedTables
                  .map((t) => t.area)
                  .filter((area) => area && area.trim() !== "")
              )
            ).sort();
            if (areas.length > 0) {
              setSelectedArea(areas[0]);
            }
          }
        } else {
          setTables(uniqueTables);
          // İlk alanı otomatik seç (undefined veya boş string'leri filtrele)
          if (uniqueTables.length > 0 && !selectedArea) {
            const areas = Array.from(
              new Set(
                uniqueTables
                  .map((t) => t.area)
                  .filter((area) => area && area.trim() !== "")
              )
            ).sort();
            if (areas.length > 0) {
              setSelectedArea(areas[0]);
            }
          }
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Tüm alanları getir (undefined veya boş string'leri filtrele)
  const areas = Array.from(
    new Set(
      tables
        .map((t) => t.area)
        .filter((area) => area && area.trim() !== "")
    )
  ).sort();

  // Seçili alandaki masaları getir (masa numarasına göre sırala)
  const tablesInArea = selectedArea
    ? tables
        .filter((t) => t.area === selectedArea)
        .sort((a, b) => {
          // Masa numarasından sayıyı çıkar (örn: "Bahçe 1" -> 1)
          const extractNumber = (tableNumber: string) => {
            const match = tableNumber.match(/\d+$/);
            return match ? parseInt(match[0], 10) : 0;
          };
          
          const aNum = extractNumber(a.tableNumber);
          const bNum = extractNumber(b.tableNumber);
          
          // Önce sayıya göre sırala
          if (aNum !== bNum) {
            return aNum - bNum;
          }
          
          // Sayılar aynıysa alfabetik sırala
          return a.tableNumber.localeCompare(b.tableNumber, undefined, {
            numeric: true,
            sensitivity: 'base'
          });
        })
    : [];

  // Yeni alan ekle
  const handleAddArea = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !newAreaName.trim()) {
      customAlert("Alan adı gereklidir", "Uyarı", "warning");
      return;
    }

    const areaName = newAreaName.trim();
    
    // Alan zaten var mı kontrol et
    if (areas.includes(areaName)) {
      customAlert("Bu alan zaten mevcut", "Uyarı", "warning");
      setNewAreaName("");
      setIsAddingArea(false);
      return;
    }

    // Yeni alana ilk masayı otomatik ekle
    try {
      await addTable({
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        area: areaName,
        tableNumber: `${areaName} 1`,
        status: "available",
      });

      // Masaları yeniden yükle
      const tablesData = await getTablesByCompany(effectiveCompanyId, effectiveBranchId || undefined);
      // Duplicate masaları temizle
      const removeDuplicateTables = (tables: Table[]): Table[] => {
        const tableMap = new Map<string, Table>();
        
        tables.forEach((table) => {
          const key = `${table.area}-${table.tableNumber}`;
          const existing = tableMap.get(key);
          
          if (!existing) {
            tableMap.set(key, table);
          } else {
            const existingDate = existing.updatedAt || existing.createdAt;
            const currentDate = table.updatedAt || table.createdAt;
            
            if (currentDate > existingDate) {
              tableMap.set(key, table);
            }
          }
        });
        
        return Array.from(tableMap.values());
      };
      const uniqueTables = removeDuplicateTables(tablesData);
      setTables(uniqueTables);
      setSelectedArea(areaName);
      setNewAreaName("");
      setIsAddingArea(false);
    } catch (error) {
      customAlert("Alan eklenirken bir hata oluştu", "Hata", "error");
    }
  };

  // Seçili alana yeni masa ekle (otomatik numaralandırma)
  const handleAddTable = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !selectedArea) {
      customAlert("Lütfen önce bir alan seçin", "Uyarı", "warning");
      return;
    }

    try {
      // Seçili alandaki masaları say
      const areaTables = tables.filter((t) => t.area === selectedArea);
      const nextTableNumber = areaTables.length + 1;
      const tableNumber = `${selectedArea} ${nextTableNumber}`;

      await addTable({
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        area: selectedArea,
        tableNumber: tableNumber,
        status: "available",
      });

      // Masaları yeniden yükle
      const tablesData = await getTablesByCompany(effectiveCompanyId, effectiveBranchId || undefined);
      // Duplicate masaları temizle
      const removeDuplicateTables = (tables: Table[]): Table[] => {
        const tableMap = new Map<string, Table>();
        
        tables.forEach((table) => {
          const key = `${table.area}-${table.tableNumber}`;
          const existing = tableMap.get(key);
          
          if (!existing) {
            tableMap.set(key, table);
          } else {
            const existingDate = existing.updatedAt || existing.createdAt;
            const currentDate = table.updatedAt || table.createdAt;
            
            if (currentDate > existingDate) {
              tableMap.set(key, table);
            }
          }
        });
        
        return Array.from(tableMap.values());
      };
      const uniqueTables = removeDuplicateTables(tablesData);
      setTables(uniqueTables);
    } catch (error) {
      customAlert("Masa eklenirken bir hata oluştu", "Hata", "error");
    }
  };

  // Masayı sil
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("Bu masayı silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      await deleteTable(tableId);
      const tablesData = await getTablesByCompany(effectiveCompanyId!, effectiveBranchId || undefined);
      setTables(tablesData);
    } catch (error) {
      customAlert("Masa silinirken bir hata oluştu", "Hata", "error");
    }
  };

  // Alanı sil (alan içindeki tüm masaları sil)
  const handleDeleteArea = async (areaName: string) => {
    if (!confirm(`"${areaName}" alanını ve içindeki tüm masaları silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const effectiveCompanyId = companyId || userData?.companyId;
      const effectiveBranchId = branchId || userData?.assignedBranchId;
      
      const areaTables = tables.filter((t) => t.area === areaName);
      await Promise.all(areaTables.map((table) => deleteTable(table.id!)));
      
      const tablesData = await getTablesByCompany(effectiveCompanyId!, effectiveBranchId || undefined);
      setTables(tablesData);
      
      // Eğer silinen alan seçiliyse, başka bir alan seç
      if (selectedArea === areaName && tablesData.length > 0) {
        const remainingAreas = Array.from(new Set(tablesData.map((t) => t.area))).sort();
        if (remainingAreas.length > 0) {
          setSelectedArea(remainingAreas[0]);
        } else {
          setSelectedArea("");
        }
      } else if (tablesData.length === 0) {
        setSelectedArea("");
      }
    } catch (error) {
      customAlert("Alan silinirken bir hata oluştu", "Hata", "error");
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Masa Yönetimi
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Masaları ve alanları yönetin
        </p>
      </div>

      {/* Alan Yönetimi Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Alan Yönetimi</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Teras, Salon, Bahçe gibi alanlar oluşturun
            </p>
          </div>
          {!isAddingArea && (
            <Button onClick={() => setIsAddingArea(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Alan Ekle
            </Button>
          )}
        </div>

        {/* Yeni Alan Ekleme Formu */}
        {isAddingArea && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 sm:p-6 mb-6 border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Yeni Alan Ekle
            </h3>
            <div className="flex gap-3">
              <Input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Örn: Teras, Salon, Bahçe"
                className="flex-1"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAddArea();
                  }
                }}
              />
              <Button onClick={handleAddArea}>
                <Save className="h-4 w-4 mr-2" />
                Ekle
              </Button>
              <Button variant="outline" onClick={() => {
                setIsAddingArea(false);
                setNewAreaName("");
              }}>
                <X className="h-4 w-4 mr-2" />
                İptal
              </Button>
            </div>
          </div>
        )}

        {/* Alan Listesi */}
        {areas.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Utensils className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>Henüz alan eklenmemiş</p>
            <p className="text-sm mt-2">Yukarıdaki butona tıklayarak ilk alanınızı ekleyin</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {areas.map((area) => {
              const areaTables = tables.filter((t) => t.area === area);
              return (
                <button
                  key={area}
                  onClick={() => setSelectedArea(area)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedArea === area
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {area} ({areaTables.length})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Masa Yönetimi Section */}
      {selectedArea && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedArea} Masaları
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {tablesInArea.length} masa - Masalar otomatik numaralandırılır
              </p>
            </div>
            <Button onClick={handleAddTable}>
              <Plus className="h-4 w-4 mr-2" />
              Masa Ekle
            </Button>
          </div>

          {/* Masalar Listesi */}
          {tablesInArea.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <p>Bu alanda henüz masa yok</p>
              <p className="text-sm mt-2">Yukarıdaki "Masa Ekle" butonuna tıklayın</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {tablesInArea.map((table) => (
                <div
                  key={table.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                >
                  <div className="text-center">
                    <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto mb-1.5">
                      {table.tableNumber.split(" ")[1] || table.tableNumber}
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-xs mb-1">
                      {table.tableNumber}
                    </h3>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        table.status === "available"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          : table.status === "occupied"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                          : table.status === "reserved"
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                          : "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                      }`}
                    >
                      {table.status === "available"
                        ? "Müsait"
                        : table.status === "occupied"
                        ? "Dolu"
                        : table.status === "reserved"
                        ? "Rezerve"
                        : "Temizleniyor"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTable(table.id!)}
                    className="absolute top-1 right-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-0.5"
                    title="Masayı Sil"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Alanı Sil Butonu */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => handleDeleteArea(selectedArea)}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {selectedArea} Alanını Sil
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

