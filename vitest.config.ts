import { defineConfig } from "vitest/config";

// These suites read .env.local and talk to the REAL database (and one sends real web
// pushes). They must never run by accident — `npm test` used to write notification
// rows to production. Run them deliberately against a test database with:
//   RUN_LIVE_TESTS=1 DATABASE_URL=<test db> npx vitest run
const LIVE_TESTS = [
  "tests/all-missing-notifications.test.ts",
  "tests/day-order-notification.test.ts",
  "tests/realtime-outbox-db.test.ts",
  "tests/realtime-notifications-engine.test.ts",
  "tests/realtime-triggers-audit.test.ts",
  "tests/test-live-send.test.ts",
  "tests/web-push-integration.test.ts",
];

export default defineConfig({
  resolve: {
    // src/lib modules import each other via the "@/..." alias; without this they
    // cannot be imported from tests at all.
    alias: { "@": "/src" },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: process.env.RUN_LIVE_TESTS === "1" ? ["**/node_modules/**"] : ["**/node_modules/**", ...LIVE_TESTS],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
  },
});
