import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // src/lib modules import each other via the "@/..." alias; without this they
    // cannot be imported from tests at all.
    alias: { "@": "/src" },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
  },
});
