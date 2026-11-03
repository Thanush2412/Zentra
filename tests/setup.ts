import { vi, beforeEach } from "vitest";

// Route handlers hand post-response work (mail, login writes) to next/server's
// after(). Next throws "after was called outside a request scope" when it runs
// with no request behind it — which is exactly how these tests invoke handlers —
// so the callback is queued instead. Tests that assert on the deferred work call
// flushAfter() from tests/afterQueue.ts.
const queue: Array<() => void | Promise<void>> = ((globalThis as any).__afterQueue ??= []);

vi.mock("next/server", async (importOriginal) => {
  const actual = await (importOriginal as any)();
  return { ...actual, after: (fn: () => void | Promise<void>) => { queue.push(fn); } };
});

// Jobs queued by a previous test are stale by definition: they close over that
// test's mocks and its database stub. Dropping them here means flushAfter() can
// only ever run work the current test scheduled.
beforeEach(() => {
  queue.length = 0;
});
