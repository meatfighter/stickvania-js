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
    HTMLSelectElement: "readonly",
    ResizeObserver: "readonly",
    cancelAnimationFrame: "readonly",
    clearTimeout: "readonly",
    location: "readonly",
    localStorage: "readonly",
    navigator: "readonly",
    Option: "readonly",
    performance: "readonly",
    requestAnimationFrame: "readonly",
    setTimeout: "readonly",
    window: "readonly"
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
            ".dist-active-before-*/**",
            ".dist-pending-*/**",
            ".dist-previous-*/**",
            ".release-candidates/**",
            ".release-components/**",
            ".release-secrets/**",
            "desktop/build/**",
            "desktop/dist/**",
            "desktop/target/**",
            "dist/**",
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
            "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: true }],
            "prefer-const": "off"
        }
    },
    {
        files: [
            "pwa/src/main.ts",
            "pwa/src/app/**/*.ts",
            "pwa/src/rumble/**/*.ts",
            "pwa/src/stickvania/BrowserStorageKeys.ts",
            "pwa/src/stickvania/ControllerSupport.ts",
            "pwa/src/stickvania/persistence/**/*.ts",
            "pwa/src/ResourceVersions.generated.ts",
            "pwa/src/resources.ts"
        ],
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "error",
            "prefer-const": "error",
            "no-empty": ["error", { allowEmptyCatch: true }]
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
