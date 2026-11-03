/**
 * Central Authentication Configuration
 * Provides single source of truth for default credentials, sourced from env if available.
 */
export const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "password123";
