export async function register() {
  // This has to stay the single, outermost condition: Next substitutes
  // process.env.NEXT_RUNTIME at compile time, so the Edge/client compilations prune
  // the import below instead of bundling pg and failing on 'fs'. Runtime-only
  // guards belong inside the block, where they cannot block that pruning.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Suppress benign client disconnects / socket aborts during Next.js compilation or tab refreshes
    if (!(globalThis as any).__ABORT_HANDLER_INSTALLED) {
      (globalThis as any).__ABORT_HANDLER_INSTALLED = true;
      process.on("uncaughtException", (err: any) => {
        const isAbort =
          err?.code === "ECONNRESET" ||
          err?.code === "EPIPE" ||
          err?.message === "aborted" ||
          /aborted|connection reset|socket hang up/i.test(err?.message || "");

        if (isAbort) {
          // Benign client abort when refreshing during compilation or navigating away
          return;
        }
        console.error("⨯ uncaughtException:", err);
      });
    }

    if (process.env.NEXT_PHASE === "phase-production-build") return;
    if (process.env.SKIP_STARTUP_MIGRATIONS === "true") return;

    const { runStartupMigrations } = await import("./lib/migrations");
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    // register() must resolve before the server serves requests, so a slow or
    // unreachable database must not hold startup hostage. Progress is recorded in
    // applied_migrations, so anything left over finishes on a later instance.
    const timedOut = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        console.warn("[migrations] startup run hit 10s; remaining migrations finish on a later instance");
        resolve();
      }, 10_000);
    });

    try {
      await Promise.race([runStartupMigrations(), timedOut]);
    } catch (err: any) {
      console.warn("[migrations] startup run failed:", err?.message || err);
    } finally {
      if (timer) clearTimeout(timer);
    }

    console.log(`[migrations] startup run finished in ${Date.now() - startedAt}ms`);
  }
}
