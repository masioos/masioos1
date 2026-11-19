import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Module boundary (ADR-0001, soft): code outside a module imports it only through its index.ts.
  // A warning, not an error: `pnpm check` shows it and the agent fixes it before /ship.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/db/schema.ts"], // the one file allowed to collect every module's tables
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/modules/*/*"],
              message:
                "Import a module only through its index.ts: '@/modules/<name>'. Add the export there if it is missing.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/db/migrations/**"]),
]);

export default eslintConfig;
