import tseslint from "typescript-eslint";

const typeAware = {
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: ["./web/tsconfig.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: { "@typescript-eslint": tseslint.plugin },
};

export default tseslint.config(
  {
    ignores: ["web/.astro/**", "web/dist/**"],
  },
  {
    files: ["web/**/*.ts"],
    ...typeAware,
    rules: {
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },
  {
    files: ["web/**/*.tsx"],
    ...typeAware,
    rules: {
      "@typescript-eslint/prefer-readonly-parameter-types": ["error", { ignoreInferredTypes: true }],
    },
  }
);
