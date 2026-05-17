import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import { fixupPluginRules, includeIgnoreFile } from "@eslint/compat";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, ".gitignore");
const pluginReact = fixupPluginRules(react);
const reactRecommendedConfig = {
  ...react.configs.flat.recommended,
  plugins: { react: pluginReact },
};
const reactJsxRuntimeConfig = {
  ...react.configs.flat["jsx-runtime"],
  plugins: { react: pluginReact },
};

/** @type {import('eslint').Linter.Config[]} */
export default [
  includeIgnoreFile(gitignorePath),
  { settings: { react: { version: "detect" } } },
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  reactRecommendedConfig,
  reactJsxRuntimeConfig,
];
