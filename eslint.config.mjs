import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright artefacts. Both are generated, both are gitignored, and a
    // failed run drops enough into them to bury a real lint error in thousands
    // of complaints about a bundled report.
    "recordings/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
