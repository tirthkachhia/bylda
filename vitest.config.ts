import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone Vitest config — intentionally does NOT extend vite.config.ts
// (which wires the full TanStack Start app pipeline). Tests only need the `@/`
// path alias and a jsdom environment for the few browser-touching modules.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
