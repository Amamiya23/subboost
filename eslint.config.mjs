import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    settings: {
      next: {
        rootDir: ["local/"],
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "dist/**",
    "local/.next/**",
    "local/.open-next/**",
    "local/.wrangler/**",
    "local/next-env.d.ts",
    "local/src/generated/**",
    "node_modules/**",
  ]),
]);
