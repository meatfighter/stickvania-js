import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "dist/**",
            "node_modules/**"
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: false
            }
        },
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "no-empty": "off",
            "no-case-declarations": "off",
            "prefer-const": "off"
        }
    },
    {
        files: ["src/stickvania/**/*.ts"],
        rules: {
            "no-fallthrough": "off",
            "no-loss-of-precision": "off",
            "no-unexpected-multiline": "off",
            "no-useless-assignment": "off"
        }
    }
);
