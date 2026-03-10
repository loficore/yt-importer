import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  define: {
    "import.meta.vitest": "undefined",
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/core"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
  ssr: {
    noExternal: ["zod"],
  },
  test: {
    setupFiles: ["./test/setup.ts"],
    environment: "node",
    globals: true,
  },
});
