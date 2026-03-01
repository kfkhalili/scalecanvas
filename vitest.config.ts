import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts", "e2e/**/*.test.ts"],
    exclude: ["node_modules", "e2e/**/*.spec.ts"],
    coverage: {
      // Exclude tests that exercise third-party library behaviour rather than
      // project code — they have regression value but skew coverage numbers.
      exclude: ["lib/reactflow-addEdge.integration.test.ts"],
    },
  },
});
