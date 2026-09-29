/**
 * Unified Anti-Cache & CSRF Protected API Fetch Utility
 * 
 * Guarantees that all client-side API requests:
 * 1. Bypass browser disk and memory HTTP caching (no 304 Not Modified delays).
 * 2. Append a millisecond timestamp cache-buster (_t=Date.now()) on GET requests.
 * 3. Enforce "cache: no-store" and "Pragma: no-cache" headers.
 * 4. Automatically attaches the CSRF token (`x-csrf-token`) on state-changing requests (POST, PUT, DELETE, PATCH).
 * 5. Handles JSON serialization and safe response parsing.
 */

let memoryCsrfToken: string | null = null;

export function setClientCsrfToken(token: string | null) {
  memoryCsrfToken = token;
  if (typeof window !== "undefined" && token) {
    (window as any).__ecampus_csrf = token;
  }
}

export function getClientCsrfToken(): string | null {
  if (memoryCsrfToken) return memoryCsrfToken;
  if (typeof window !== "undefined") {
    if ((window as any).__ecampus_csrf) {
      return (window as any).__ecampus_csrf;
    }
    // Read from ecampus_csrf cookie
    const match = document.cookie.match(/(^|;\s*)ecampus_csrf=([^;]+)/);
    if (match && match[2]) {
      return decodeURIComponent(match[2]);
    }
  }
  return null;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Request body (can be string, FormData, Blob, or plain JS object) */
  body?: any;
  /** Skip appending timestamp query param (defaults to false for GET) */
  skipCacheBuster?: boolean;
}

export async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { skipCacheBuster = false, headers = {}, ...fetchOptions } = options;
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const isMutation = method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH";

  let finalUrl = url;

  if (isGet && !skipCacheBuster) {
    if (typeof window !== "undefined") {
      const isAbsolute = url.startsWith("http://") || url.startsWith("https://");
      const urlObj = isAbsolute
        ? new URL(url)
        : new URL(url, window.location.origin);

      urlObj.searchParams.set("_t", Date.now().toString());
      finalUrl = isAbsolute ? urlObj.toString() : `${urlObj.pathname}${urlObj.search}`;
    } else {
      const sep = url.includes("?") ? "&" : "?";
      finalUrl = `${url}${sep}_t=${Date.now()}`;
    }
  }

  const defaultHeaders: Record<string, string> = {
    "Pragma": "no-cache",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };

  // Attach CSRF token on mutating requests if not explicitly provided
  if (isMutation) {
    const csrfToken = getClientCsrfToken();
    if (csrfToken && !(headers as Record<string, string>)["x-csrf-token"]) {
      defaultHeaders["x-csrf-token"] = csrfToken;
    }
  }

  // If body is a plain JS object (not FormData/Blob/string), stringify it and set JSON content type
  if (
    options.body &&
    typeof options.body === "object" &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof ArrayBuffer) &&
    !(options.body instanceof URLSearchParams)
  ) {
    defaultHeaders["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(finalUrl, {
    ...fetchOptions,
    method,
    cache: "no-store",
    headers: {
      ...defaultHeaders,
      ...(headers as Record<string, string>)
    }
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any;

  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text().catch(() => "");
  }

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).data = data;
    (err as any).code = data?.code;
    throw err;
  }

  return data as T;
}
