/**
 * Run whatever the route handed to after() during a test request.
 * Nested after() calls are drained too, so a deferred block that schedules more
 * post-response work still settles before the assertions continue.
 */
export async function flushAfter(): Promise<void> {
  const queue: Array<() => void | Promise<void>> = ((globalThis as any).__afterQueue ??= []);
  while (queue.length > 0) {
    const tasks = queue.splice(0, queue.length);
    await Promise.all(tasks.map((task) => task()));
  }
}
