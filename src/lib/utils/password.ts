// Password verification utility for manager user credentials
// Supports both bcrypt (from oms-borgeto-com) and SHA-256 (legacy)

import * as bcrypt from "bcryptjs";

/**
 * Hash a password using SHA-256 (legacy staff users)
 * @param password - Plain text password
 * @returns Hashed password as hex string
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Verify a password against a hash
 * Supports both bcrypt (from oms-borgeto-com manager users) and SHA-256 (legacy)
 * @param password - Plain text password
 * @param hash - Hashed password (bcrypt or SHA-256)
 * @returns True if password matches hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  // Önce bcrypt ile dene (oms-borgeto-com manager kullanıcıları için)
  // bcrypt hash'leri $2a$, $2b$, $2x$, $2y$ ile başlar
  if (hash.startsWith("$2")) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error("Bcrypt doğrulama hatası:", error);
      return false;
    }
  }

  // Eğer bcrypt değilse, SHA-256 ile dene (legacy staff kullanıcıları için)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === hash;
}
