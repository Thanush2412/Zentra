import crypto from "crypto";

export const CSRF_COOKIE_NAME = "ecampus_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Constant-time comparison that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Generates a masked, salt-prefixed CSRF token using the session's CSRF secret.
 * Format: base64url(randomSalt).base64url(HMAC-SHA256(randomSalt, csrfSecret))
 */
export function generateCsrfToken(csrfSecret: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hmac = crypto.createHmac("sha256", csrfSecret).update(salt).digest("base64url");
  return `${salt}.${hmac}`;
}

/**
 * Validates a submitted CSRF token against the session's secret.
 */
export function verifyCsrfToken(
  submittedToken: string | null | undefined,
  csrfSecret: string | null | undefined
): boolean {
  if (!submittedToken || !csrfSecret || typeof submittedToken !== "string") return false;
  const parts = submittedToken.split(".");
  if (parts.length !== 2) return false;
  const [salt, hmac] = parts;
  if (!salt || !hmac) return false;

  const expectedHmac = crypto.createHmac("sha256", csrfSecret).update(salt).digest("base64url");
  return safeEqual(hmac, expectedHmac);
}
