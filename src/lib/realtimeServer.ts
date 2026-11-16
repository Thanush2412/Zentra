import crypto from "crypto";
import { logger } from "./logger";

/**
 * Cross-instance delivery.
 *
 * SSE clients live in one server instance's memory, and Vercel runs many instances,
 * so an event raised on instance A never reached a user connected to instance B
 * (the old pg_notify had no listener; LISTEN also cannot work through Supabase's
 * transaction pooler). Every event is now also written to `event_outbox`, and each
 * instance that has connected clients polls the outbox (one query every 2s per
 * instance, not per user) and delivers rows it has not already delivered.
 */
const INSTANCE_ID = `inst_${crypto.randomBytes(4).toString("hex")}`;
const OUTBOX_POLL_MS = 2000;
const OUTBOX_OVERLAP_MS = 5000; // re-read a small window to catch late commits; dedupe by event_id
const OUTBOX_RETENTION_SQL = "DELETE FROM event_outbox WHERE created_at::timestamptz < NOW() - INTERVAL '1 day'";
const SEEN_LIMIT = 5000;

export interface RealtimeClient {
  id: string;
  userId?: string;
  aliases?: string[];
  role?: string;
  collegeId?: string;
  controller: ReadableStreamDefaultController;
}

export interface RealtimeEvent {
  domain: "requests" | "attendance" | "exams" | "daily_configs" | "feedback" | "notifications" | "tracker" | "general" | (string & {});
  action: string;
  targetUserIds?: string[];
  targetRoles?: string[];
  collegeId?: string;
  payload?: any;
  timestamp?: number;
  /** Stable id used to de-duplicate local and outbox delivery. */
  eventId?: string;
}

// Persist active subscriber set across dev module reloads via globalThis
const globalForRealtime = globalThis as unknown as {
  _fpRealtimeClients?: Set<RealtimeClient>;
  _fpRealtimeSeen?: Map<string, number>;
  _fpRealtimePoller?: { timer: ReturnType<typeof setInterval> | null; cursor: string | null; busy: boolean; lastPrune: number };
};

/** event_ids already delivered by this instance (insertion-ordered, capped). */
const seen: Map<string, number> = globalForRealtime._fpRealtimeSeen || new Map<string, number>();
globalForRealtime._fpRealtimeSeen = seen;
function markSeen(id: string) {
  seen.set(id, Date.now());
  if (seen.size > SEEN_LIMIT) {
    const drop = seen.size - SEEN_LIMIT;
    let i = 0;
    for (const key of seen.keys()) {
      if (i++ >= drop) break;
      seen.delete(key);
    }
  }
}

const poller = globalForRealtime._fpRealtimePoller || { timer: null, cursor: null, busy: false, lastPrune: 0 };
globalForRealtime._fpRealtimePoller = poller;

function outboxEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

async function pollOutboxOnce() {
  if (poller.busy) return;
  poller.busy = true;
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!poller.cursor) {
      const row = await db.get("SELECT NOW()::text AS now");
      poller.cursor = row?.now || new Date().toISOString();
      return;
    }
    const rows = await db.all(
      `SELECT event_id, domain, action, college_id, target_user_ids, target_roles, payload, created_at::text AS created_at
       FROM event_outbox
       WHERE created_at::timestamptz > (?::timestamptz - INTERVAL '${Math.round(OUTBOX_OVERLAP_MS / 1000)} seconds')
       ORDER BY created_at ASC LIMIT 500`,
      [poller.cursor]
    );
    let cursor: string = poller.cursor;
    for (const r of rows) {
      if (r.created_at && r.created_at > cursor) cursor = r.created_at;
      const id = String(r.event_id || "");
      if (!id || seen.has(id)) continue;
      markSeen(id);
      const parse = (v: any) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
      const targetUserIds = parse(r.target_user_ids);
      const targetRoles = parse(r.target_roles);
      deliverLocally({
        eventId: id,
        domain: r.domain || "general",
        action: r.action || "updated",
        collegeId: r.college_id || undefined,
        targetUserIds: Array.isArray(targetUserIds) && targetUserIds.length ? targetUserIds : undefined,
        targetRoles: Array.isArray(targetRoles) && targetRoles.length ? targetRoles : undefined,
        payload: parse(r.payload) ?? undefined,
        timestamp: Date.now(),
      });
    }
    poller.cursor = cursor;
    if (Date.now() - poller.lastPrune > 10 * 60_000) {
      poller.lastPrune = Date.now();
      await db.run(OUTBOX_RETENTION_SQL).catch(() => {});
    }
  } catch (err: any) {
    logger.warn("[realtime] outbox poll failed", { error: err?.message || String(err) });
  } finally {
    poller.busy = false;
  }
}

function ensurePoller() {
  if (!outboxEnabled() || poller.timer) return;
  poller.timer = setInterval(() => {
    if (clients.size === 0) {
      if (poller.timer) clearInterval(poller.timer);
      poller.timer = null;
      poller.cursor = null;
      return;
    }
    void pollOutboxOnce();
  }, OUTBOX_POLL_MS);
  void pollOutboxOnce();
}

/** Writes the event to event_outbox so other instances deliver it too. */
function persistToOutbox(event: RealtimeEvent & { eventId: string }) {
  if (!outboxEnabled()) return;
  const work = (async () => {
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      await db.run(
        `INSERT INTO event_outbox (event_id, domain, action, college_id, target_user_ids, target_roles, origin_tab_id, payload, created_at)
         VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, NOW()) ON CONFLICT DO NOTHING`,
        [
          event.eventId,
          event.domain,
          event.action,
          event.collegeId || null,
          event.targetUserIds && event.targetUserIds.length ? JSON.stringify(event.targetUserIds) : null,
          event.targetRoles && event.targetRoles.length ? JSON.stringify(event.targetRoles) : null,
          INSTANCE_ID,
          JSON.stringify(event.payload ?? null),
        ]
      );
    } catch (err: any) {
      logger.warn("[realtime] outbox insert failed", { error: err?.message || String(err) });
    }
  })();
  // Keep a serverless invocation alive until the write lands when we are inside a request.
  import("next/server")
    .then(({ after }) => { try { after(work); } catch { /* outside a request scope */ } })
    .catch(() => {});
}

const clients: Set<RealtimeClient> =
  globalForRealtime._fpRealtimeClients || new Set<RealtimeClient>();

if (process.env.NODE_ENV !== "production") {
  globalForRealtime._fpRealtimeClients = clients;
}

export function addRealtimeClient(client: RealtimeClient) {
  clients.add(client);
  ensurePoller();
  // Send initial handshake
  try {
    const encoder = new TextEncoder();
    client.controller.enqueue(
      encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", at: Date.now() })}\n\n`)
    );
  } catch (_) {
    clients.delete(client);
  }
}

export function removeRealtimeClient(id: string) {
  for (const client of clients) {
    if (client.id === id) {
      clients.delete(client);
      break;
    }
  }
}

/**
 * Publishes an event: delivered immediately to this instance's clients and written
 * to the outbox for every other instance. Pass `{ persist: false }` when the caller
 * already wrote the outbox row itself (dispatchSystemNotification does).
 */
export function notifyRealtimeEvent(event: RealtimeEvent, options?: { persist?: boolean }) {
  const eventId = event.eventId || `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const fullEvent = { ...event, eventId, timestamp: event.timestamp || Date.now() };
  markSeen(eventId);
  deliverLocally(fullEvent);
  if (options?.persist !== false) persistToOutbox(fullEvent);
}

function deliverLocally(fullEvent: RealtimeEvent) {
  const event = fullEvent;
  const encoder = new TextEncoder();
  const message = `event: fp_event\ndata: ${JSON.stringify(fullEvent)}\n\n`;
  const encoded = encoder.encode(message);

  const staleClients: RealtimeClient[] = [];

  const targetUserIdsLower = event.targetUserIds && event.targetUserIds.length > 0
    ? new Set(event.targetUserIds.map((u) => String(u).toLowerCase().trim()))
    : null;

  const targetRolesLower = event.targetRoles && event.targetRoles.length > 0
    ? new Set(event.targetRoles.map((r) => String(r).toLowerCase().trim()))
    : null;

  for (const client of clients) {
    try {
      const clientRoleLower = client.role ? client.role.toLowerCase().trim() : "";
      const clientAliases = new Set<string>();
      if (client.userId) clientAliases.add(client.userId.toLowerCase().trim());
      if (client.aliases) {
        client.aliases.forEach((a) => clientAliases.add(String(a).toLowerCase().trim()));
      }

      let isTargeted = false;

      // 1. User alias matching (case-insensitive across user UUID, reference_id, and email)
      if (targetUserIdsLower && targetUserIdsLower.size > 0) {
        for (const alias of clientAliases) {
          if (targetUserIdsLower.has(alias)) {
            isTargeted = true;
            break;
          }
        }
      }

      // 2. Role matching
      if (!isTargeted && targetRolesLower && targetRolesLower.size > 0) {
        if (clientRoleLower && (targetRolesLower.has(clientRoleLower) || targetRolesLower.has("all"))) {
          isTargeted = true;
        }
      }

      // 3. Super Admin global governance & system alerts
      if (!isTargeted && (clientRoleLower === "admin" || clientRoleLower === "superadmin")) {
        if (
          event.domain === "notifications" ||
          event.domain === "feedback" ||
          (event.domain === "requests" && (!targetRolesLower || targetRolesLower.has("admin")))
        ) {
          isTargeted = true;
        }
      }

      // 4. Universal broadcast if no specific user or role constraints
      if (!targetUserIdsLower && !targetRolesLower) {
        isTargeted = true;
      }

      if (!isTargeted) continue;

      // 5. College scope filter (Admins bypass college filters to see system-wide events)
      if (
        event.collegeId &&
        client.collegeId &&
        client.collegeId !== "all" &&
        event.collegeId !== "all" &&
        clientRoleLower !== "admin" &&
        clientRoleLower !== "superadmin"
      ) {
        if (client.collegeId.toLowerCase() !== event.collegeId.toLowerCase()) {
          continue;
        }
      }

      client.controller.enqueue(encoded);
    } catch (err) {
      staleClients.push(client);
    }
  }

  for (const stale of staleClients) {
    clients.delete(stale);
  }
}

