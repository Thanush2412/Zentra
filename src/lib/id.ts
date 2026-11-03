/**
 * Centralised ID generation utility.
 * Replaces the scattered Date.now() + Math.random() pattern across 15+ API routes.
 * Uses crypto.randomBytes for true collision resistance.
 */
import { randomBytes } from "crypto";

/**
 * Generates a time-sortable, collision-resistant ID.
 * Format: prefix_<ms-timestamp>_<8-hex-chars>
 * Example: slot_1700000000000_a3f9b2c1
 */
export function generateId(prefix: string): string {
  const random = randomBytes(4).toString("hex"); // 8 hex chars = 4 billion combos
  return `${prefix}_${Date.now()}_${random}`;
}

/**
 * Generates a fully random UUID-based ID.
 * Use when prefix-based IDs are not needed.
 */
export function generateUUID(prefix?: string): string {
  const uuid = randomBytes(16).toString("hex");
  // Format as 8-4-4-4-12
  const formatted = [
    uuid.slice(0, 8),
    uuid.slice(8, 12),
    uuid.slice(12, 16),
    uuid.slice(16, 20),
    uuid.slice(20, 32),
  ].join("-");
  return prefix ? `${prefix}_${formatted}` : formatted;
}
