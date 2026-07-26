import crypto from "crypto";

/**
 * Hashes a plaintext password using Node.js crypto pbkdf2.
 */
export function hashPassword(password: string): string {
  if (!password) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored password string.
 * Supports legacy plaintext passwords for smooth backward compatibility,
 * returning true if exact match, otherwise verifying the salt:hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  // Check if stored format is salt:hash
  if (storedHash.includes(":")) {
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
    } catch {
      return false;
    }
  }

  // Legacy plaintext fallback
  return password === storedHash;
}
