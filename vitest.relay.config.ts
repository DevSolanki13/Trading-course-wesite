import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-native": fileURLToPath(
        new URL("./apps/payment-relay/node_modules/react-native/index.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["apps/payment-relay/tests/**/*.test.tsx"],
  },
});
