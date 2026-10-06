import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Design system §9: app components must use theme/domain tokens
      // (var(--primary), var(--domain-customers), …) instead of raw hex in
      // inline styles. Warning, not error: marketing/brand moments (landing,
      // onboarding) legitimately use literal palettes.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            'JSXAttribute[name.name="style"] Property[key.name=/^(color|background|backgroundColor|borderColor|fill|stroke)$/] > Literal[value=/#[0-9a-fA-F]{3,8}/]',
          message:
            "Use a design token (var(--primary), var(--domain-*), …) instead of raw hex in inline styles.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
