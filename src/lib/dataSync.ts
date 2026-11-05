/**
 * Tells every open tab and role that a data domain changed.
 *
 * DashboardLayout listens for the in-page event and the storage event and
 * re-reads the affected data; QueryProvider invalidates the matching query
 * roots. The originating tab has already updated its own cache locally.
 */
export function announceDataChanged(domain: string) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("fp_data_changed", { detail: { domain, at: Date.now() } }));
    localStorage.setItem("fp_data_changed", JSON.stringify({ domain, at: Date.now() }));
  } catch (_) {
    /* storage can be unavailable (private mode) — the in-page event still fired */
  }
}
