/**
 * Turns a /api/data outcome into one honest sentence. Before this, every symptom —
 * an expired session, a 500, an offline tab and a slice that merely hit its row cap —
 * rendered as "Couldn't reach the database", which sent people to check a healthy
 * production database.
 */
export type DataLoadCause = "session" | "server" | "network" | "offline" | "cancelled" | "partial" | "unknown";

export interface DataLoadReport {
  cause: DataLoadCause;
  message: string;
}

const SESSION_CODES = new Set(["NO_SESSION", "SESSION_EXPIRED", "SESSION_IDLE"]);

/** "student_academic_tracker" or "studentAcademicTracker" reads as a list of things, not a table name. */
function humanizeSection(name: string): string {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function listSections(sections: string[], limit = 4): string {
  const named = sections.map(humanizeSection).filter(Boolean);
  const shown = named.slice(0, limit).join(", ");
  return named.length > limit ? `${shown} and ${named.length - limit} more` : shown;
}

/** Names the lists that came back short, for the "the database is fine, the payload is capped" case. */
export function describeFailedSections(sections: string[]): string {
  if (!sections || sections.length === 0) {
    return "Part of the dashboard could not be read — the data on screen may be stale.";
  }
  return `These lists failed to load: ${listSections(sections)}. Their data may be stale.`;
}

export function describeCappedSections(sections: string[]): string {
  if (!sections || sections.length === 0) return "";
  return `Showing the newest rows only for ${listSections(sections)} — those lists are capped for load speed.`;
}

/** Describes the thrown apiFetch error, using the HTTP status the server actually returned. */
export function describeLoadFailure(err: any): DataLoadReport {
  const status = Number(err?.status) || 0;
  const code = String(err?.code || "");
  const rawMessage = String(err?.message || "").trim();

  if (SESSION_CODES.has(code) || status === 401) {
    return { cause: "session", message: "Your session expired — sign in again to reload the dashboard." };
  }
  if (status === 403) {
    return { cause: "session", message: "This account is not allowed to read the dashboard data." };
  }
  if (status >= 500) {
    return {
      cause: "server",
      message: `The server could not finish the data load (${status}). The database is reachable but the query failed — retry, then check the failing lists.`,
    };
  }
  if (String(err?.name) === "AbortError") {
    return { cause: "cancelled", message: "The data request was cancelled before it finished." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { cause: "offline", message: "You appear to be offline — the dashboard is showing cached data." };
  }
  if (!status && /failed to fetch|networkerror|load failed/i.test(rawMessage)) {
    return { cause: "network", message: "Can't reach the server — check your connection, then retry." };
  }
  return { cause: "unknown", message: rawMessage || "The dashboard data could not be loaded." };
}
