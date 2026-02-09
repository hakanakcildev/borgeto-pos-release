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
import type { Recipe } from "./types";

const RECIPES_COLLECTION = "recipes";

// Convert Firestore timestamp to Date
const convertTimestamp = (data: any) => ({
  ...data,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// Convert Date to Firestore timestamp
const convertToFirestore = (data: any) => {
  const firestoreData: any = {
    ...data,
    createdAt: data.createdAt instanceof Date 
      ? Timestamp.fromDate(data.createdAt) 
      : Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Remove undefined values
  Object.keys(firestoreData).forEach(key => {
    if (firestoreData[key] === undefined) {
      delete firestoreData[key];
    }
  });
  
  return firestoreData;
};

// Get all recipes for a menu item
export const getRecipesByMenuId = async (
  companyId: string,
  menuId: string,
  branchId?: string
): Promise<Recipe[]> => {
  try {
    const q = query(
      collection(db, RECIPES_COLLECTION),
      where("companyId", "==", companyId),
      where("menuId", "==", menuId)
    );

    const querySnapshot = await getDocs(q);

    let recipes = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Recipe
    );

    // Client-side filtering by branchId if provided
    if (branchId) {
      recipes = recipes.filter(
        (recipe) => !recipe.branchId || recipe.branchId === branchId
      );
    }

    // Client-side sorting by stockItemName (ascending)
    return recipes.sort((a, b) => 
      (a.stockItemName || "").localeCompare(b.stockItemName || "")
    );
  } catch (error) {
    throw error;
  }
};

// Get all recipes for a company (optionally filtered by branch)
export const getAllRecipesByCompany = async (
  companyId: string,
  branchId?: string
): Promise<Recipe[]> => {
  try {
    const q = query(
      collection(db, RECIPES_COLLECTION),
      where("companyId", "==", companyId)
    );

    const querySnapshot = await getDocs(q);

    let recipes = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...convertTimestamp(doc.data()),
        }) as Recipe
    );

    // Client-side filtering by branchId if provided
    if (branchId) {
      recipes = recipes.filter(
        (recipe) => !recipe.branchId || recipe.branchId === branchId
      );
    }

    return recipes;
  } catch (error) {
    throw error;
  }
};

// Get recipe by ID
export const getRecipe = async (id: string): Promise<Recipe | null> => {
  try {
    const docRef = doc(db, RECIPES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...convertTimestamp(docSnap.data()),
      } as Recipe;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Add new recipe
export const addRecipe = async (
  recipe: Omit<Recipe, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const recipeData = convertToFirestore(recipe);
    const docRef = await addDoc(collection(db, RECIPES_COLLECTION), recipeData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update recipe
export const updateRecipe = async (
  id: string,
  updates: Partial<Recipe>
): Promise<void> => {
  try {
    const docRef = doc(db, RECIPES_COLLECTION, id);

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

// Delete recipe
export const deleteRecipe = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, RECIPES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    throw error;
  }
};

// Delete all recipes for a menu item
export const deleteRecipesByMenuId = async (
  companyId: string,
  menuId: string,
  branchId?: string
): Promise<void> => {
  try {
    const recipes = await getRecipesByMenuId(companyId, menuId, branchId);
    
    // Delete all recipes
    await Promise.all(recipes.map((recipe) => deleteRecipe(recipe.id!)));
  } catch (error) {
    throw error;
  }
};

// Bulk add recipes for a menu item
export const bulkAddRecipes = async (
  recipes: Omit<Recipe, "id" | "createdAt" | "updatedAt">[]
): Promise<string[]> => {
  try {
    const recipeIds: string[] = [];
    
    for (const recipe of recipes) {
      const id = await addRecipe(recipe);
      recipeIds.push(id);
    }
    
    return recipeIds;
  } catch (error) {
    throw error;
  }
};
