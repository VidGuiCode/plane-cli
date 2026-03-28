import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow .js extensions in imports (NodeNext module resolution)
      "import/extensions": "off",
      
      // Disable rules that conflict with existing codebase patterns
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      
      // Allow console.log for CLI output
      "no-console": "off",
      
      // Allow process.exit for CLI error handling
      "no-process-exit": "off",
    },
  },
  {
    // Ignore patterns
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.config.js",
    ],
  }
);
