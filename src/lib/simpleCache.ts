/**
 * simpleCache.ts
 *
 * Lightweight in-process LRU-style TTL cache for read-heavy, rarely-changing
 * data (mentor lists, slot grids, college configs).
 *
 * Intentionally tiny — no external deps, no persistence, no sharing across
 * PM2 worker processes. Good enough for single-instance and PM2 instances:1
 * deployments where India→Singapore latency makes every DB round-trip ~75ms.
 *
 * Usage:
 *   const hit = cacheGet("mentors:Clg_TEST");
 *   if (hit) return NextResponse.json(hit);
 *   const data = await db.all("SELECT * FROM mentors WHERE college_id = ?", id);
 *   cacheSet("mentors:Clg_TEST", { success: true, mentors: data });
 *   return NextResponse.json(data);
 *
 * Cache is invalidated automatically by TTL. Write routes (POST/PUT/DELETE)
 * should call cacheDel(prefix) to evict stale entries immediately.
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Returns cached value if still valid, otherwise null. */
export function cacheGet(key: string): any | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/** Stores value in cache for `ttlSeconds` (default 60). */
export function cacheSet(key: string, data: any, ttlSeconds = 60): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Deletes all cache keys that start with `prefix`.
 * Call this from POST/PUT/DELETE handlers so reads immediately see fresh data.
 * Example: cacheDel("mentors:") after inserting/updating a mentor.
 */
export function cacheDel(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
