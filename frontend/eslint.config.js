import js from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import parser from "@typescript-eslint/parser"
import globals from "globals"

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["dist/**"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parser, globals: globals.browser },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs?.recommended?.rules,
      "@typescript-eslint/no-unused-vars": ["warn", {"argsIgnorePattern": "^_"}],
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
]

