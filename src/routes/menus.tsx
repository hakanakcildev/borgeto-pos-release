import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllMenusByCompany,
  getAllCategoriesByCompany,
  addMenu,
  updateMenu,
  deleteMenu,
  addCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/firebase/menus";
import type { Menu, Category } from "@/lib/firebase/types";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ChefHat,
  FolderOpen,
  Search,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/menus")({
  component: MenuManagement,
});

function MenuManagement() {
  return (
    <POSLayout>
      <MenuManagementContent />
    </POSLayout>
  );
}

function MenuManagementContent() {
  const { userData, companyId, branchId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"menus" | "categories">("menus");

  // Menu form states
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    isAvailable: true,
  });

  // Category form states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  // Bulk price update states
  const [showBulkPriceForm, setShowBulkPriceForm] = useState(false);
  const [bulkPriceForm, setBulkPriceForm] = useState({
    type: "percentage" as "percentage" | "fixed",
    value: "",
  });
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

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
        const [menusData, categoriesData] = await Promise.all([
          getAllMenusByCompany(effectiveCompanyId, effectiveBranchId || undefined),
          getAllCategoriesByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        ]);

        setMenus(menusData);
        setCategories(categoriesData);
      } catch (error) {
        alert("Veriler yüklenirken bir hata oluştu");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, branchId, userData?.companyId, userData?.assignedBranchId]);

  // Remove duplicates from menus (by name + category + price)
  const uniqueMenus = useCallback(() => {
    const menuMap = new Map<string, Menu>();
    menus.forEach((menu) => {
      const key = `${(menu.name || "").trim().toLowerCase()}_${(menu.category || "").trim().toLowerCase()}_${menu.price}`;
      const existing = menuMap.get(key);
      if (!existing) {
        menuMap.set(key, menu);
      } else {
        // Keep the one with the latest updatedAt
        const existingDate = existing.updatedAt?.getTime() || 0;
        const currentDate = menu.updatedAt?.getTime() || 0;
        if (currentDate > existingDate) {
          menuMap.set(key, menu);
        }
      }
    });
    return Array.from(menuMap.values());
  }, [menus]);

  // Remove duplicates from categories (by name)
  const uniqueCategories = useCallback(() => {
    const categoryMap = new Map<string, Category>();
    categories.forEach((category) => {
      const key = (category.name || "").trim().toLowerCase();
      const existing = categoryMap.get(key);
      if (!existing) {
        categoryMap.set(key, category);
      } else {
        // Keep the one with the latest updatedAt
        const existingDate = existing.updatedAt?.getTime() || 0;
        const currentDate = category.updatedAt?.getTime() || 0;
        if (currentDate > existingDate) {
          categoryMap.set(key, category);
        }
      }
    });
    return Array.from(categoryMap.values());
  }, [categories]);

  // Filter menus
  const filteredMenus = uniqueMenus().filter((menu) => {
    const matchesSearch =
      menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      menu.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !selectedCategory || menu.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for display
  const displayCategories = uniqueCategories();

  // Menu handlers
  const handleAddMenu = () => {
    setEditingMenu(null);
    setMenuForm({
      name: "",
      description: "",
      price: "",
      category: displayCategories[0]?.name || "",
      isAvailable: true,
    });
    setShowMenuForm(true);
  };

  const handleEditMenu = (menu: Menu) => {
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    // Sadece aynı şubeye ait ürünleri düzenleyebilir
    if (effectiveBranchId && menu.branchId && menu.branchId !== effectiveBranchId) {
      alert("Bu ürün başka bir şubeye ait. Sadece kendi şubenizin ürünlerini düzenleyebilirsiniz.");
      return;
    }
    
    setEditingMenu(menu);
    setMenuForm({
      name: menu.name,
      description: menu.description || "",
      price: menu.price.toString(),
      category: menu.category,
      isAvailable: menu.isAvailable,
    });
    setShowMenuForm(true);
  };

  const handleSaveMenu = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !menuForm.name || !menuForm.price || !menuForm.category) {
      alert("Lütfen tüm gerekli alanları doldurun");
      return;
    }

    try {
      const menuData: Omit<Menu, "id" | "createdAt" | "updatedAt"> = {
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        name: menuForm.name,
        description: menuForm.description || undefined,
        price: parseFloat(menuForm.price),
        category: menuForm.category,
        isAvailable: menuForm.isAvailable,
      };

      if (editingMenu) {
        // Güncelleme yaparken branchId'yi koru veya set et
        const updateData = {
          ...menuData,
          branchId: effectiveBranchId || editingMenu.branchId || undefined,
        };
        await updateMenu(editingMenu.id!, updateData);
      } else {
        // Yeni ürün eklerken branchId'yi set et
        await addMenu(menuData);
      }

      // Reload data
      const [menusData, categoriesData] = await Promise.all([
        getAllMenusByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        getAllCategoriesByCompany(effectiveCompanyId, effectiveBranchId || undefined),
      ]);

      setMenus(menusData);
      setCategories(categoriesData);
      setShowMenuForm(false);
      setEditingMenu(null);
    } catch (error) {
      alert("Ürün kaydedilirken bir hata oluştu");
    }
  };

  const handleDeleteMenu = async (menu: Menu) => {
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    // Sadece aynı şubeye ait ürünleri silebilir
    if (effectiveBranchId && menu.branchId && menu.branchId !== effectiveBranchId) {
      alert("Bu ürün başka bir şubeye ait. Sadece kendi şubenizin ürünlerini silebilirsiniz.");
      return;
    }
    
    if (!confirm(`${menu.name} ürününü silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const effectiveCompanyId = companyId || userData?.companyId;
      
      await deleteMenu(menu.id!);
      const menusData = await getAllMenusByCompany(
        effectiveCompanyId!,
        effectiveBranchId || undefined
      );
      setMenus(menusData);
    } catch (error) {
      alert("Ürün silinirken bir hata oluştu");
    }
  };

  // Category handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      sortOrder: categories.length,
      isActive: true,
    });
    setShowCategoryForm(true);
  };

  const handleEditCategory = (category: Category) => {
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    // Sadece aynı şubeye ait kategorileri düzenleyebilir
    if (effectiveBranchId && category.branchId && category.branchId !== effectiveBranchId) {
      alert("Bu kategori başka bir şubeye ait. Sadece kendi şubenizin kategorilerini düzenleyebilirsiniz.");
      return;
    }
    
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
    });
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId || !categoryForm.name) {
      alert("Lütfen kategori adını girin");
      return;
    }

    try {
      const categoryData: Omit<Category, "id" | "createdAt" | "updatedAt"> = {
        companyId: effectiveCompanyId,
        branchId: effectiveBranchId || undefined,
        name: categoryForm.name,
        description: categoryForm.description || undefined,
        sortOrder: categoryForm.sortOrder,
        isActive: categoryForm.isActive,
      };

      if (editingCategory) {
        // Güncelleme yaparken branchId'yi koru veya set et
        const updateData = {
          ...categoryData,
          branchId: effectiveBranchId || editingCategory.branchId || undefined,
        };
        await updateCategory(editingCategory.id!, updateData);
      } else {
        // Yeni kategori eklerken branchId'yi set et
        await addCategory(categoryData);
      }

      // Reload data
      const [menusData, categoriesData] = await Promise.all([
        getAllMenusByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        getAllCategoriesByCompany(effectiveCompanyId, effectiveBranchId || undefined),
      ]);

      setMenus(menusData);
      setCategories(categoriesData);
      setShowCategoryForm(false);
      setEditingCategory(null);
    } catch (error) {
      alert("Kategori kaydedilirken bir hata oluştu");
    }
  };

  const handleBulkPriceUpdate = async () => {
    const effectiveCompanyId = companyId || userData?.companyId;
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    if (!effectiveCompanyId) {
      alert("Firma bilgisi bulunamadı");
      return;
    }

    const value = parseFloat(bulkPriceForm.value);
    if (isNaN(value) || value === 0) {
      alert("Lütfen geçerli bir değer girin");
      return;
    }

    if (bulkPriceForm.type === "percentage" && (value < -100 || value > 1000)) {
      alert("Yüzde değeri -100 ile 1000 arasında olmalıdır");
      return;
    }

    if (!confirm(
      bulkPriceForm.type === "percentage"
        ? `Tüm ürünlerin fiyatlarını %${value} oranında güncellemek istediğinize emin misiniz?`
        : `Tüm ürünlerin fiyatlarına ₺${value} eklemek istediğinize emin misiniz?`
    )) {
      return;
    }

    try {
      setIsUpdatingPrices(true);
      const menusToUpdate = filteredMenus.filter((menu) => {
        // Sadece aynı şubeye ait ürünleri güncelle
        if (effectiveBranchId && menu.branchId && menu.branchId !== effectiveBranchId) {
          return false;
        }
        return true;
      });

      if (menusToUpdate.length === 0) {
        alert("Güncellenecek ürün bulunamadı");
        setIsUpdatingPrices(false);
        return;
      }

      // Her ürünü güncelle
      const updatePromises = menusToUpdate.map(async (menu) => {
        let newPrice: number;
        
        if (bulkPriceForm.type === "percentage") {
          newPrice = menu.price * (1 + value / 100);
        } else {
          newPrice = menu.price + value;
        }

        // Fiyat negatif olamaz
        if (newPrice < 0) {
          newPrice = 0;
        }

        // Yuvarla 2 ondalık basamağa
        newPrice = Math.round(newPrice * 100) / 100;

        const updateData = {
          price: newPrice,
          branchId: effectiveBranchId || menu.branchId || undefined,
        };

        await updateMenu(menu.id!, updateData);
      });

      await Promise.all(updatePromises);

      // Verileri yeniden yükle
      const [menusData, categoriesData] = await Promise.all([
        getAllMenusByCompany(effectiveCompanyId, effectiveBranchId || undefined),
        getAllCategoriesByCompany(effectiveCompanyId, effectiveBranchId || undefined),
      ]);

      setMenus(menusData);
      setCategories(categoriesData);
      setShowBulkPriceForm(false);
      setBulkPriceForm({ type: "percentage", value: "" });
      alert(`${menusToUpdate.length} ürünün fiyatı başarıyla güncellendi`);
    } catch (error) {
      alert("Fiyatlar güncellenirken bir hata oluştu");
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    const effectiveBranchId = branchId || userData?.assignedBranchId;
    
    // Sadece aynı şubeye ait kategorileri silebilir
    if (effectiveBranchId && category.branchId && category.branchId !== effectiveBranchId) {
      alert("Bu kategori başka bir şubeye ait. Sadece kendi şubenizin kategorilerini silebilirsiniz.");
      return;
    }
    
    // Check if category has menus
    const categoryMenus = menus.filter((m) => m.category === category.name);
    if (categoryMenus.length > 0) {
      alert(
        "Bu kategoride ürünler bulunmaktadır. Önce ürünleri silin veya başka bir kategoriye taşıyın."
      );
      return;
    }

    if (!confirm(`${category.name} kategorisini silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const effectiveCompanyId = companyId || userData?.companyId;
      
      await deleteCategory(category.id!);
      const categoriesData = await getAllCategoriesByCompany(
        effectiveCompanyId!,
        effectiveBranchId || undefined
      );
      setCategories(categoriesData);
    } catch (error) {
      alert("Kategori silinirken bir hata oluştu");
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
            <ChefHat className="h-8 w-8" />
            Ürün Yönetimi
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Kategoriler ve ürün öğelerini yönetin
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("menus")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "menus"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Ürünler ({menus.length})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "categories"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Kategoriler ({displayCategories.length})
        </button>
      </div>

      {/* Menus Tab */}
      {activeTab === "menus" && (
        <div>
          {/* Search and Filter */}
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Ürün ara..."
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
            <Button onClick={handleAddMenu} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Ürün Ekle
            </Button>
            <Button 
              onClick={() => setShowBulkPriceForm(true)} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Toplu Fiyat Güncelle
            </Button>
          </div>

          {/* Menus List */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {filteredMenus.map((menu) => (
              <div
                key={menu.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {menu.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {menu.category}
                    </p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded flex-shrink-0 ml-1 ${
                      menu.isAvailable
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {menu.isAvailable ? "Aktif" : "Pasif"}
                  </span>
                </div>
                {menu.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 line-clamp-2">
                    {menu.description}
                  </p>
                )}
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    ₺{menu.price.toFixed(2)}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditMenu(menu)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteMenu(menu)}
                      className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMenus.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <ChefHat className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || selectedCategory
                  ? "Arama kriterlerinize uygun ürün bulunamadı"
                  : "Henüz ürün eklenmemiş"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div>
          <div className="mb-4 flex justify-end">
            <Button onClick={handleAddCategory} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Kategori Ekle
            </Button>
          </div>

          {/* Categories List */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {displayCategories.map((category) => {
              const categoryMenusCount = uniqueMenus().filter(
                (m) => m.category === category.name
              ).length;
              return (
                <div
                  key={category.id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{category.name}</span>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {categoryMenusCount} ürün
                      </p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded flex-shrink-0 ml-1 ${
                        category.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {category.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  {category.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCategory(category)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCategory(category)}
                      className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {displayCategories.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <FolderOpen className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Henüz kategori eklenmemiş
              </p>
            </div>
          )}
        </div>
      )}

      {/* Menu Form Modal */}
      {showMenuForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingMenu ? "Ürün Düzenle" : "Yeni Ürün Ekle"}
              </h2>
              <button
                onClick={() => {
                  setShowMenuForm(false);
                  setEditingMenu(null);
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
                  value={menuForm.name}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, name: e.target.value })
                  }
                  className="bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Açıklama
                </label>
                <Textarea
                  value={menuForm.description}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fiyat *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={menuForm.price}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, price: e.target.value })
                  }
                  className="bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kategori *
                </label>
                <select
                  value={menuForm.category}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Kategori Seçin</option>
                  {displayCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="menuAvailable"
                  checked={menuForm.isAvailable}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, isAvailable: e.target.checked })
                  }
                  className="mr-2"
                />
                <label
                  htmlFor="menuAvailable"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Aktif
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMenuForm(false);
                    setEditingMenu(null);
                  }}
                >
                  İptal
                </Button>
                <Button onClick={handleSaveMenu} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingCategory ? "Kategori Düzenle" : "Yeni Kategori Ekle"}
              </h2>
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kategori Adı *
                </label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  className="bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Açıklama
                </label>
                <Textarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sıralama
                </label>
                <Input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-white dark:bg-gray-700"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={categoryForm.isActive}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      isActive: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <label
                  htmlFor="categoryActive"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Aktif
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                  }}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleSaveCategory}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price Update Modal */}
      {showBulkPriceForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Toplu Fiyat Güncelle
              </h2>
              <button
                onClick={() => {
                  setShowBulkPriceForm(false);
                  setBulkPriceForm({ type: "percentage", value: "" });
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={isUpdatingPrices}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Güncelleme Tipi
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bulkPriceType"
                      value="percentage"
                      checked={bulkPriceForm.type === "percentage"}
                      onChange={() =>
                        setBulkPriceForm({
                          ...bulkPriceForm,
                          type: "percentage",
                          value: "",
                        })
                      }
                      className="mr-2"
                      disabled={isUpdatingPrices}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Yüzde (%)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bulkPriceType"
                      value="fixed"
                      checked={bulkPriceForm.type === "fixed"}
                      onChange={() =>
                        setBulkPriceForm({
                          ...bulkPriceForm,
                          type: "fixed",
                          value: "",
                        })
                      }
                      className="mr-2"
                      disabled={isUpdatingPrices}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Sabit Miktar (₺)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {bulkPriceForm.type === "percentage" ? "Yüzde Değeri (%)" : "Miktar (₺)"} *
                </label>
                <Input
                  type="number"
                  step={bulkPriceForm.type === "percentage" ? "0.1" : "0.01"}
                  value={bulkPriceForm.value}
                  onChange={(e) =>
                    setBulkPriceForm({
                      ...bulkPriceForm,
                      value: e.target.value,
                    })
                  }
                  className="bg-white dark:bg-gray-700"
                  placeholder={
                    bulkPriceForm.type === "percentage"
                      ? "Örn: 10 (fiyatları %10 artırır)"
                      : "Örn: 50 (her fiyata ₺50 ekler)"
                  }
                  disabled={isUpdatingPrices}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {bulkPriceForm.type === "percentage"
                    ? "Pozitif değer artırır, negatif değer azaltır (örn: 10 = %10 artış, -5 = %5 azalış)"
                    : "Pozitif değer ekler, negatif değer çıkarır (örn: 50 = +₺50, -20 = -₺20)"}
                </p>
              </div>

              {filteredMenus.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>{filteredMenus.length}</strong> ürün güncellenecek
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBulkPriceForm(false);
                    setBulkPriceForm({ type: "percentage", value: "" });
                  }}
                  disabled={isUpdatingPrices}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleBulkPriceUpdate}
                  className="flex items-center gap-2"
                  disabled={isUpdatingPrices || !bulkPriceForm.value}
                >
                  {isUpdatingPrices ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Güncelleniyor...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Uygula
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

