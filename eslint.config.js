import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  // 1. 全局忽略配置 (必须放在最前面，且不能包含 'files' 属性)
  // 这会让 ESLint 完全跳过这些文件，不进行任何扫描
  {
    ignores: ["src/test/**", "src/test*.ts", "test/**", "test/*.ts"],
  },

  // 2. 基础预设
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylistic,
  jsdoc.configs["flat/recommended"],

  // 3. 通用 TypeScript 配置
  {
    files: ["**/*.ts"],
    plugins: {
      jsdoc,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      jsdoc: { mode: "typescript" },
    },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
          },
          publicOnly: false,
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "TSPropertySignature",
            "ClassProperty",
          ],
        },
      ],
      "jsdoc/require-description": "warn",
      "jsdoc/check-tag-names": ["warn", { definedTags: ["category"] }],
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
    },
  },

  // 4. LangChain 模块特殊规则 (保留)
  {
    files: ["src/langchain/**/*.ts"],
    rules: {
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "jsdoc/require-jsdoc": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
);
