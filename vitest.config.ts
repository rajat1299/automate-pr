import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/__tests__/**"
      ]
    },
    snapshotFormat: {
      printBasicPrototype: false,
      escapeString: false
    },
    setupFiles: ["./vitest.setup.ts"]
  }
}); 