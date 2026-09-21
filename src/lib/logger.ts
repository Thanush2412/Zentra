/**
 * Minimal structured logger (plan item 19).
 *
 * JSON lines in production (searchable in Vercel/CloudWatch), human-readable
 * in development. Level controlled by LOG_LEVEL env var: debug|info|warn|error
 * (default: info in prod, debug locally).
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): Level {
  const env = (process.env.LOG_LEVEL || "").toLowerCase();
  if (env in LEVEL_WEIGHT) return env as Level;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function emit(level: Level, msg: string, meta?: Record<string, any>) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel()]) return;

  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify({ ts: timestamp, level, msg, ...(meta || {}) });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    if (meta && Object.keys(meta).length > 0) {
      (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(prefix, msg, meta);
    } else {
      (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(prefix, msg);
    }
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, any>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, any>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, any>) => emit("error", msg, meta),
};
