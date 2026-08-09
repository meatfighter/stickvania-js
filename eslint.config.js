import js from "@eslint/js";
import tseslint from "typescript-eslint";

const browserGlobals = {
    __APP_VERSION__: "readonly",
    __BUILD_STAMP__: "readonly",
    console: "readonly",
    document: "readonly",
    HTMLElement: "readonly",
    HTMLButtonElement: "readonly",
    HTMLInputElement: "readonly",
    location: "readonly",
    navigator: "readonly"
};

const serviceWorkerGlobals = {
    caches: "readonly",
    console: "readonly",
    fetch: "readonly",
    self: "readonly",
    URL: "readonly"
};

export default tseslint.config(
    {
        ignores: [
            "dist/**",
            "desktop/build/**",
            "desktop/dist/**",
            "desktop/target/**",
            "node_modules/**"
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                projectService: false
            },
            globals: browserGlobals
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
        files: ["pwa/src/stickvania/**/*.ts"],
        rules: {
            "no-fallthrough": "off",
            "no-loss-of-precision": "off",
            "no-unexpected-multiline": "off",
            "no-useless-assignment": "off"
        }
    },
    {
        files: ["pwa/vite.config.ts"],
        languageOptions: {
            globals: {
                Buffer: "readonly",
                console: "readonly"
            }
        }
    },
    {
        files: ["pwa/public/sw.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: serviceWorkerGlobals
        }
    }
);
