/**
 * Outbound HTTP with a hard deadline.
 *
 * Every external leg (Google Apps Script, Brevo, Supabase REST, Google Sheets, HiRescore)
 * used to be awaited with no timeout, so one stalled third party held the whole serverless
 * request open until the function was killed — the user saw a hung button, not an error.
 */

/** Env-tunable so a slow region or VPN can be accommodated without a redeploy. */
export const DEFAULT_FETCH_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 8000)
);

/** Mail transports are legitimately slower than a data read. */
export const MAIL_FETCH_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.MAIL_FETCH_TIMEOUT_MS || 12000)
);

/** Body uploads (8MB observation photos) need room for the transfer itself. */
export const UPLOAD_FETCH_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.UPLOAD_FETCH_TIMEOUT_MS || 30000)
);

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** A thrown AbortError is a timeout, not a caller bug — report it as one. */
export function timeoutMessage(err: any, url: string): string {
  const name = String(err?.name || "");
  const reason = err?.cause?.name === "AbortError" || name === "AbortError" ? "timed out" : String(err?.message || "failed");
  return `External request ${reason}: ${url.slice(0, 120)}`;
}
