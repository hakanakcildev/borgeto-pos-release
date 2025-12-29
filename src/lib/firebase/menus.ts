import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Menu, Category } from "./types";

const MENUS_COLLECTION = "menus";
const CATEGORIES_COLLECTION = "categories";
const QR_MENUS_COLLECTION = "qrMenus";
const MENU_CATEGORIES_COLLECTION = "menuCategories";
const MENU_ITEMS_COLLECTION = "menuItems";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => {
  const converted = {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
  
  // Ensure extras is always an array (even if undefined or null in Firestore)
  if (converted.extras !== undefined && converted.extras !== null) {
    // If extras exists, ensure it's an array
    if (!Array.isArray(converted.extras)) {
      converted.extras = [];
    }
  } else {
    // If extras is undefined or null, set it to empty array
    converted.extras = [];
  }
  
  return converted;
};

// Convert Date to Firestore timestamp
const convertToFirestore = (data: any) => {
  const firestoreData: any = {
    ...data,
    createdAt:
      data.createdAt instanceof Date
        ? Timestamp.fromDate(data.createdAt)
        : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Remove undefined values
  Object.keys(firestoreData).forEach((key) => {
    if (firestoreData[key] === undefined) {
      delete firestoreData[key];
    }
  });

  return firestoreData;
};

// Get all menus for a company (optionally filtered by branch)
export const getMenusByCompany = async (
  companyId: string,
  branchId?: string
): Promise<Menu[]> => {
  try {
    // Get all menus for company (without branch filter to avoid index issues)
    const q = query(
      collection(db, MENUS_COLLECTION),
      where("companyId", "==", companyId)
    );

    const querySnapshot = await getDocs(q);

    let menus = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Menu
    );

    // Client-side filtering by branchId if provided
    if (branchId) {
      menus = menus.filter(
        (menu) => !menu.branchId || menu.branchId === branchId
      );
    }

    // Remove duplicate menus by name + category + price combination
    // (Aynı isim, kategori ve fiyata sahip ürünler tekrar etmesin)
    const uniqueMenus = menus.reduce((acc, menu) => {
      const key = `${menu.name?.trim().toLowerCase()}_${menu.category?.trim().toLowerCase()}_${menu.price}`;
      const existing = acc.find((m) => {
        const existingKey = `${m.name?.trim().toLowerCase()}_${m.category?.trim().toLowerCase()}_${m.price}`;
        return existingKey === key;
      });
      if (!existing) {
        acc.push(menu);
      }
      return acc;
    }, [] as Menu[]);

    // Filter only available menus and sort by category first, then by name
    return uniqueMenus
      .filter((menu) => menu.isAvailable)
      .sort((a, b) => {
        if (a.category !== b.category) {
          return (a.category || "").localeCompare(b.category || "");
        }
        return (a.name || "").localeCompare(b.name || "");
      });
  } catch (error) {
    throw error;
  }
};

// Get menu by ID
export const getMenu = async (id: string): Promise<Menu | null> => {
  try {
    const docRef = doc(db, MENUS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Menu;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Get all categories for a company (optionally filtered by branch)
export const getCategoriesByCompany = async (
  companyId: string,
  branchId?: string
): Promise<Category[]> => {
  try {
    // Get all categories for company (without branch filter to avoid index issues)
    let q = query(
      collection(db, CATEGORIES_COLLECTION),
      where("companyId", "==", companyId),
      where("isActive", "==", true)
    );

    const querySnapshot = await getDocs(q);

    let categories = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Category
    );

    // Client-side filtering by branchId if provided
    if (branchId) {
      categories = categories.filter(
        (cat) => !cat.branchId || cat.branchId === branchId
      );
    }

    // Remove duplicate categories by name (case-insensitive)
    const uniqueCategories = categories.reduce((acc, category) => {
      const existing = acc.find(
        (c) =>
          c.name.trim().toLowerCase() === category.name.trim().toLowerCase()
      );
      if (!existing) {
        acc.push(category);
      }
      return acc;
    }, [] as Category[]);

    // Client-side sorting by sortOrder
    return uniqueCategories.sort((a, b) => {
      const orderA = a.sortOrder || 0;
      const orderB = b.sortOrder || 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // If sortOrder is same, sort by name
      return (a.name || "").localeCompare(b.name || "");
    });
  } catch (error) {
    throw error;
  }
};

// Get all categories (including inactive ones) for management
// Önce QR menüden yükler, yoksa normal categories collection'ından yükler
export const getAllCategoriesByCompany = async (
  companyId: string,
  branchId?: string,
  managerUserId?: string
): Promise<Category[]> => {
  try {
    let categories: Category[] = [];

    // Önce QR menüden yüklemeyi dene (manager kullanıcısına atanmış QR menü varsa)
    if (managerUserId) {
      try {
        // Manager kullanıcısına atanmış QR menüyü bul (branchId = managerUserId)
        const qrMenusQuery = query(
          collection(db, QR_MENUS_COLLECTION),
          where("companyId", "==", companyId),
          where("branchId", "==", managerUserId)
        );
        const qrMenusSnapshot = await getDocs(qrMenusQuery);

        if (!qrMenusSnapshot.empty) {
          const qrMenuDoc = qrMenusSnapshot.docs[0];
          const qrMenuId = qrMenuDoc.id;

          // QR menüye ait kategorileri yükle
          const categoriesQuery = query(
            collection(db, MENU_CATEGORIES_COLLECTION),
            where("qrMenuId", "==", qrMenuId)
          );
          const categoriesSnapshot = await getDocs(categoriesQuery);

          categories = categoriesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || "",
              description: data.description || "",
              sortOrder: data.sortOrder || 0,
              isActive: data.isActive !== false,
              companyId: companyId,
              branchId: branchId || managerUserId,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Category;
          });
        }
      } catch (qrError) {
        console.warn(
          "QR menü kategorileri yükleme hatası, normal categories collection'ından yükleniyor:",
          qrError
        );
      }
    }

    // Eğer QR menüden veri yüklenmediyse, normal categories collection'ından yükle
    if (categories.length === 0) {
      let q = query(
        collection(db, CATEGORIES_COLLECTION),
        where("companyId", "==", companyId)
      );

      const querySnapshot = await getDocs(q);

      categories = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...convertTimestamp(doc.data()),
          }) as Category
      );

      // Client-side filtering by branchId if provided
      if (branchId) {
        categories = categories.filter(
          (cat) => !cat.branchId || cat.branchId === branchId
        );
      }
    }

    // Remove duplicates by name (case-insensitive)
    // Keep the most recent one (by updatedAt)
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

    const uniqueCategories = Array.from(categoryMap.values());

    // Sort by sortOrder
    return uniqueCategories.sort((a, b) => {
      const orderA = a.sortOrder || 0;
      const orderB = b.sortOrder || 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  } catch (error) {
    throw error;
  }
};

// Get all menus (including unavailable ones) for management
// Önce QR menüden yükler, yoksa normal menus collection'ından yükler
export const getAllMenusByCompany = async (
  companyId: string,
  branchId?: string,
  managerUserId?: string
): Promise<Menu[]> => {
  try {
    let menus: Menu[] = [];

    // Önce QR menüden yüklemeyi dene (manager kullanıcısına atanmış QR menü varsa)
    if (managerUserId) {
      try {
        // Manager kullanıcısına atanmış QR menüyü bul (branchId = managerUserId)
        const qrMenusQuery = query(
          collection(db, QR_MENUS_COLLECTION),
          where("companyId", "==", companyId),
          where("branchId", "==", managerUserId)
        );
        const qrMenusSnapshot = await getDocs(qrMenusQuery);

        if (!qrMenusSnapshot.empty) {
          const qrMenuDoc = qrMenusSnapshot.docs[0];
          const qrMenuId = qrMenuDoc.id;

          // QR menüye ait kategorileri yükle
          const categoriesQuery = query(
            collection(db, MENU_CATEGORIES_COLLECTION),
            where("qrMenuId", "==", qrMenuId)
          );
          const categoriesSnapshot = await getDocs(categoriesQuery);
          const categoryMap = new Map<string, string>(); // categoryId -> categoryName
          categoriesSnapshot.forEach((doc) => {
            const data = doc.data();
            categoryMap.set(doc.id, data.name || "");
          });

          // QR menüye ait ürünleri yükle
          const itemsQuery = query(
            collection(db, MENU_ITEMS_COLLECTION),
            where("qrMenuId", "==", qrMenuId)
          );
          const itemsSnapshot = await getDocs(itemsQuery);

          menus = itemsSnapshot.docs.map((doc) => {
            const data = doc.data();
            const categoryId = data.categoryId || "";
            const categoryName =
              categoryMap.get(categoryId) || data.categoryName || "";

            // Ensure extras is always an array
            let extras: any[] = [];
            if (data.extras) {
              if (Array.isArray(data.extras)) {
                extras = data.extras;
              } else {
                extras = [data.extras];
              }
            }

            return {
              id: doc.id,
              name: data.name || "",
              description: data.description || "",
              price: data.price || 0,
              category: categoryName,
              isAvailable: data.isAvailable !== false,
              companyId: companyId,
              branchId: branchId || managerUserId,
              extras: extras,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Menu;
          });
        }
      } catch (qrError) {
        console.warn(
          "QR menü yükleme hatası, normal menus collection'ından yükleniyor:",
          qrError
        );
      }
    }

    // Eğer QR menüden veri yüklenmediyse, normal menus collection'ından yükle
    if (menus.length === 0) {
      const q = query(
        collection(db, MENUS_COLLECTION),
        where("companyId", "==", companyId)
      );

      const querySnapshot = await getDocs(q);

      menus = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...convertTimestamp(doc.data()),
          }) as Menu
      );

      // Client-side filtering by branchId if provided
      if (branchId) {
        menus = menus.filter(
          (menu) => !menu.branchId || menu.branchId === branchId
        );
      }
    }

    // Remove duplicates by name + category + price combination
    // Keep the most recent one (by updatedAt)
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

    const uniqueMenus = Array.from(menuMap.values());

    // Sort by category first, then by name
    return uniqueMenus.sort((a, b) => {
      if (a.category !== b.category) {
        return (a.category || "").localeCompare(b.category || "");
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  } catch (error) {
    throw error;
  }
};

// Add new menu item
export const addMenu = async (
  menu: Omit<Menu, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const menuData = convertToFirestore(menu);
    const docRef = await addDoc(collection(db, MENUS_COLLECTION), menuData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update menu item
export const updateMenu = async (
  id: string,
  updates: Partial<Menu>
): Promise<void> => {
  try {
    // First, check if document exists in menuItems collection (QR menu)
    let docRef = doc(db, MENU_ITEMS_COLLECTION, id);
    let docSnap = await getDoc(docRef);
    let collectionName = MENU_ITEMS_COLLECTION;

    // If not found in menuItems, check in menus collection
    if (!docSnap.exists()) {
      docRef = doc(db, MENUS_COLLECTION, id);
      docSnap = await getDoc(docRef);
      collectionName = MENUS_COLLECTION;

      if (!docSnap.exists()) {
        throw new Error(`Menu with id ${id} does not exist`);
      }
    }

    // Filter out undefined values before converting
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      return;
    }

    const updateData = convertToFirestore(cleanUpdates);
    await updateDoc(docRef, updateData);
  } catch (error) {
    throw error;
  }
};

// Delete menu item
export const deleteMenu = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, MENUS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};

// Add new category
export const addCategory = async (
  category: Omit<Category, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const categoryData = convertToFirestore(category);
    const docRef = await addDoc(
      collection(db, CATEGORIES_COLLECTION),
      categoryData
    );
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update category
export const updateCategory = async (
  id: string,
  updates: Partial<Category>
): Promise<void> => {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);

    // Filter out undefined values before converting
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      return;
    }

    const updateData = convertToFirestore(cleanUpdates);
    await updateDoc(docRef, updateData);
  } catch (error) {
    throw error;
  }
};

// Delete category
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};
