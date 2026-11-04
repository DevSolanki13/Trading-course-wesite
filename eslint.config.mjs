import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["app/**/opengraph-image.tsx", "app/**/twitter-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/backend", "@/backend/**", "**/backend/**", "node:*"],
              message:
                "Frontend code must use application routes rather than import backend internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/frontend", "@/frontend/**", "**/frontend/**"],
              message: "Backend code must not depend on frontend presentation code.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-demo/**",
    ".local-data/**",
    ".agents/**",
    "out/**",
    "dist/**",
    "next-env.d.ts",
    "artifacts/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
