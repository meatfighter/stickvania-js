import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";

interface VersionInfo {
    readonly version: string;
    readonly buildStamp: string;
}

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const versionInfo = JSON.parse(readFileSync(new URL("../version.json", import.meta.url), "utf8")) as VersionInfo;
const encodedBuildStamp = encodeURIComponent(versionInfo.buildStamp);

function versionedHtmlPlugin(): PluginOption {
    return {
        name: "stickvania-versioned-html",
        transformIndexHtml: {
            order: "post",
            handler(html: string): string {
                return renderVersionPlaceholders(html);
            }
        }
    };
}

function renderVersionPlaceholders(text: string): string {
    return text
        .replaceAll("%APP_VERSION%", versionInfo.version)
        .replaceAll("%BUILD_STAMP%", encodedBuildStamp);
}

function ensureAppModuleScriptId(text: string): string {
    if (text.includes("id=\"app-module-script\"")) {
        return text;
    }
    return text.replace(
        /<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc=)/,
        "<script id=\"app-module-script\""
    );
}

function versionedStaticAssetsPlugin(): PluginOption {
    return {
        name: "stickvania-versioned-static-assets",
        generateBundle(_options, bundle): void {
            for (const asset of Object.values(bundle)) {
                if (asset.type !== "asset" || typeof asset.source !== "string") {
                    continue;
                }
                asset.source = renderVersionPlaceholders(asset.source);
            }
        },
        closeBundle(): void {
            const indexPath = join(rootDir, "..", "dist", "pwa", "index.html");
            if (existsSync(indexPath)) {
                writeFileSync(indexPath, ensureAppModuleScriptId(renderVersionPlaceholders(readFileSync(indexPath, "utf8"))));
            }

            const manifestPath = join(rootDir, "..", "dist", "pwa", "manifest.webmanifest");
            if (!existsSync(manifestPath)) {
                return;
            }
            writeFileSync(manifestPath, renderVersionPlaceholders(readFileSync(manifestPath, "utf8")));
        }
    };
}

export default defineConfig(({ command }) => ({
    root: rootDir,
    base: command === "build" ? "/pwa/" : "/",
    plugins: [
        versionedHtmlPlugin(),
        versionedStaticAssetsPlugin()
    ],
    define: {
        __APP_VERSION__: JSON.stringify(versionInfo.version),
        __BUILD_STAMP__: JSON.stringify(versionInfo.buildStamp)
    },
    build: {
        outDir: "../dist/pwa",
        emptyOutDir: true,
        target: "es2022",
        sourcemap: false
    },
    server: {
        port: 5174,
        strictPort: false
    },
    preview: {
        port: 4174,
        strictPort: false
    }
}));
