/**
 * Single source of truth for "super admin" sessions.
 *
 * The role is resolved once by the server at login (users.role === SUPER_ADMIN_ROLE) and
 * propagated to the client as a session flag, so no component or API route needs to
 * hardcode a specific person's email address to recognise an owner account.
 */

/** DB role that grants unrestricted access to every workspace. */
export const SUPER_ADMIN_ROLE = "admin";

/** localStorage key holding the server-issued super-admin session flag. */
export const SUPER_ADMIN_FLAG_KEY = "fp_is_super_admin";

/** Persists (or clears) the super-admin flag for the current browser session. */
export function setSuperAdminSession(isSuperAdmin: boolean): void {
  if (typeof window === "undefined") return;
  if (isSuperAdmin) {
    localStorage.setItem(SUPER_ADMIN_FLAG_KEY, "true");
  } else {
    localStorage.removeItem(SUPER_ADMIN_FLAG_KEY);
  }
}

/** Returns true when the current browser session was issued a super-admin login. */
export function isSuperAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SUPER_ADMIN_FLAG_KEY) === "true";
}

/** Pure role check — usable on the server and the client. */
export function roleGrantsSuperAdmin(role?: string | null): boolean {
  return (role || "").toLowerCase().trim() === SUPER_ADMIN_ROLE;
}
