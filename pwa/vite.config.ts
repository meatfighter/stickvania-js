import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";

interface VersionInfo {
    readonly version: string;
    readonly buildStamp: string;
}

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const projectRootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalDistRootDir = join(projectRootDir, "dist");
const distRootDir = resolveSafeDistRootDir();
const distPwaDir = join(distRootDir, "pwa");
const versionInfo = JSON.parse(readFileSync(new URL("../version.json", import.meta.url), "utf8")) as VersionInfo;
const cacheVersion = `${versionInfo.version}-${versionInfo.buildStamp}`;
const encodedBuildStamp = encodeURIComponent(versionInfo.buildStamp);
const encodedCacheVersion = encodeURIComponent(cacheVersion);
const serviceWorkerPrecachePattern = /const PRECACHE_URLS = \[[\s\S]*?\];/;
const serviceWorkerVersionPlaceholder = '"__SERVICE_WORKER_VERSION__"';

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
        .replaceAll("%BUILD_STAMP%", encodedBuildStamp)
        .replaceAll("%CACHE_VERSION%", encodedCacheVersion);
}

function resolveSafeDistRootDir(): string {
    const configuredDistDir = process.env.STICKVANIA_DIST_DIR;
    const resolvedDistDir =
        configuredDistDir === undefined || configuredDistDir.trim() === "" ? canonicalDistRootDir : resolve(projectRootDir, configuredDistDir);
    assertSafeGeneratedOutputDirectory(resolvedDistDir, configuredDistDir === undefined || configuredDistDir.trim() === "");
    return resolvedDistDir;
}

function assertSafeGeneratedOutputDirectory(directory: string, allowCanonicalDist: boolean): void {
    if (isSameOrInside(projectRootDir, directory)) {
        throw new Error(`STICKVANIA_DIST_DIR must not be the repository root or one of its ancestors: ${directory}`);
    }

    if (!allowCanonicalDist && pathsOverlap(directory, canonicalDistRootDir)) {
        throw new Error(`STICKVANIA_DIST_DIR must not overlap canonical dist for redirected output: ${directory}`);
    }

    if (directory === join(projectRootDir, ".release-components")) {
        throw new Error(`STICKVANIA_DIST_DIR must not be the release components root: ${directory}`);
    }

    for (const protectedDirectory of protectedOutputOverlapDirectories()) {
        if (pathsOverlap(directory, protectedDirectory)) {
            throw new Error(`STICKVANIA_DIST_DIR must not overlap protected repository path ${protectedDirectory}: ${directory}`);
        }
    }
}

function protectedOutputOverlapDirectories(): string[] {
    return [".git", ".agents", ".codex", ".release-candidates", ".release-secrets", "about", "desktop", "node_modules", "pwa", "releases", "scripts"].map(
        (entry) => join(projectRootDir, entry)
    );
}

function pathsOverlap(first: string, second: string): boolean {
    return isSameOrInside(first, second) || isSameOrInside(second, first);
}

function isSameOrInside(path: string, possibleAncestor: string): boolean {
    const relationship = relative(possibleAncestor, path);
    return relationship === "" || (!relationship.startsWith("..") && !isAbsolute(relationship));
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

    return ["./", ...fileUrls].map(addCacheVersion);
}

function addCacheVersion(url: string): string {
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodedCacheVersion}`;
}

function formatPrecacheDeclaration(urls: string[]): string {
    return `const PRECACHE_URLS = ${JSON.stringify(urls, null, 4)};`;
}

function renderServiceWorker(text: string): string {
    if (!text.includes(serviceWorkerVersionPlaceholder)) {
        throw new Error("Unable to find service worker version placeholder in built service worker.");
    }

    return renderVersionPlaceholders(text).replaceAll(serviceWorkerVersionPlaceholder, JSON.stringify(cacheVersion));
}

function writeServiceWorkerPrecacheManifest(): void {
    const serviceWorkerPath = join(distPwaDir, "sw.js");
    if (!existsSync(serviceWorkerPath)) {
        return;
    }

    const serviceWorker = renderServiceWorker(readFileSync(serviceWorkerPath, "utf8"));
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
    base: command === "build" ? "./" : "/",
    plugins: [versionedHtmlPlugin(), versionedStaticAssetsPlugin(command)],
    define: {
        __APP_VERSION__: JSON.stringify(versionInfo.version),
        __BUILD_STAMP__: JSON.stringify(versionInfo.buildStamp),
        __CACHE_VERSION__: JSON.stringify(cacheVersion)
    },
    build: {
        outDir: distPwaDir,
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
