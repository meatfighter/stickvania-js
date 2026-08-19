import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";

interface VersionInfo {
    readonly version: string;
    readonly buildStamp: string;
}

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const distPwaDir = join(rootDir, "..", "dist", "pwa");
const versionInfo = JSON.parse(readFileSync(new URL("../version.json", import.meta.url), "utf8")) as VersionInfo;
const encodedBuildStamp = encodeURIComponent(versionInfo.buildStamp);
const serviceWorkerPrecachePattern = /const PRECACHE_URLS = \[[\s\S]*?\];/;

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
    return text.replaceAll("%APP_VERSION%", versionInfo.version).replaceAll("%BUILD_STAMP%", encodedBuildStamp);
}

function collectFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

function createPrecacheUrls(): string[] {
    const fileUrls = collectFiles(distPwaDir)
        .map((file) => relative(distPwaDir, file).replaceAll("\\", "/"))
        .filter((file) => file !== "sw.js")
        .sort()
        .map((file) => `./${file}`);

    return ["./", ...fileUrls];
}

function formatPrecacheDeclaration(urls: string[]): string {
    return `const PRECACHE_URLS = ${JSON.stringify(urls, null, 4)};`;
}

function writeServiceWorkerPrecacheManifest(): void {
    const serviceWorkerPath = join(distPwaDir, "sw.js");
    if (!existsSync(serviceWorkerPath)) {
        return;
    }

    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    const urls = createPrecacheUrls();
    if (!serviceWorkerPrecachePattern.test(serviceWorker)) {
        throw new Error("Unable to find PRECACHE_URLS declaration in built service worker.");
    }

    writeFileSync(serviceWorkerPath, serviceWorker.replace(serviceWorkerPrecachePattern, formatPrecacheDeclaration(urls)));
}

function versionedStaticAssetsPlugin(command: string): PluginOption {
    const isBuild = command === "build";
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
            if (!isBuild) {
                return;
            }

            const indexPath = join(distPwaDir, "index.html");
            if (existsSync(indexPath)) {
                writeFileSync(indexPath, renderVersionPlaceholders(readFileSync(indexPath, "utf8")));
            }

            const manifestPath = join(distPwaDir, "manifest.webmanifest");
            if (existsSync(manifestPath)) {
                writeFileSync(manifestPath, renderVersionPlaceholders(readFileSync(manifestPath, "utf8")));
            }

            writeServiceWorkerPrecacheManifest();
        }
    };
}

export default defineConfig(({ command }) => ({
    root: rootDir,
    base: command === "build" ? "/pwa/" : "/",
    plugins: [versionedHtmlPlugin(), versionedStaticAssetsPlugin(command)],
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
