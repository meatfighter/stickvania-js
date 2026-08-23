import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";

interface VersionInfo {
    readonly version: string;
    readonly buildStamp: string;
}

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const projectRootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalDistRootDir = join(projectRootDir, "dist");
const releaseComponentsRootDir = join(projectRootDir, ".release-components");
const releaseCandidatesRootDir = join(projectRootDir, ".release-candidates");
const releaseSecretsRootDir = join(projectRootDir, ".release-secrets");
const distRootDir = resolveSafeDistRootDir();
const distPwaDir = join(distRootDir, "pwa");
const versionInfo = readVersionInfo();
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

function readVersionInfo(): VersionInfo {
    const version = JSON.parse(readFileSync(new URL("../version.json", import.meta.url), "utf8")) as VersionInfo;
    if (process.env.STICKVANIA_ALLOW_VERSION_OVERRIDE === "true" && process.env.STICKVANIA_BUILD_STAMP !== undefined) {
        return {
            ...version,
            buildStamp: process.env.STICKVANIA_BUILD_STAMP
        };
    }
    return version;
}

function resolveSafeDistRootDir(): string {
    const configuredDistDir = process.env.STICKVANIA_DIST_DIR;
    const hasConfiguredDistDir = configuredDistDir !== undefined && configuredDistDir.trim() !== "";
    if (hasConfiguredDistDir && process.env.STICKVANIA_ALLOW_DIST_DIR_OVERRIDE !== "true") {
        throw new Error("STICKVANIA_DIST_DIR is reserved for release tooling and requires STICKVANIA_ALLOW_DIST_DIR_OVERRIDE=true.");
    }

    const resolvedDistDir = hasConfiguredDistDir ? resolve(projectRootDir, configuredDistDir) : canonicalDistRootDir;
    assertSafeGeneratedOutputDirectory(resolvedDistDir, !hasConfiguredDistDir);
    return resolvedDistDir;
}

function assertSafeGeneratedOutputDirectory(directory: string, allowCanonicalDist: boolean): void {
    const physicalDirectory = resolvePhysicalPathForValidation(directory);
    const allowed = allowedGeneratedOutputRoots(allowCanonicalDist).some((root) => {
        const physicalRoot = resolvePhysicalPathForValidation(root.path);
        if (root.allowExact && physicalDirectory === physicalRoot) {
            return true;
        }
        return root.allowDescendant && isSameOrInside(physicalDirectory, physicalRoot) && physicalDirectory !== physicalRoot;
    });

    if (!allowed) {
        throw new Error(`STICKVANIA_DIST_DIR must be canonical dist or a child of an allowed release-state directory: ${directory}`);
    }
}

function allowedGeneratedOutputRoots(allowCanonicalDist: boolean): Array<{
    readonly allowDescendant: boolean;
    readonly allowExact: boolean;
    readonly path: string;
}> {
    return [
        {
            allowDescendant: false,
            allowExact: allowCanonicalDist,
            path: canonicalDistRootDir
        },
        {
            allowDescendant: true,
            allowExact: false,
            path: releaseComponentsRootDir
        },
        {
            allowDescendant: true,
            allowExact: false,
            path: releaseCandidatesRootDir
        },
        {
            allowDescendant: true,
            allowExact: false,
            path: releaseSecretsRootDir
        }
    ];
}

function resolvePhysicalPathForValidation(path: string): string {
    const resolvedPath = resolve(path);
    assertExistingPathChainSafe(resolvedPath);

    if (existsSync(resolvedPath)) {
        return realpathSync.native(resolvedPath);
    }

    const parts: string[] = [];
    let existingPath = resolvedPath;
    while (!existsSync(existingPath)) {
        const parent = dirname(existingPath);
        if (parent === existingPath) {
            break;
        }
        parts.unshift(relative(parent, existingPath));
        existingPath = parent;
    }

    const physicalExistingPath = existsSync(existingPath) ? realpathSync.native(existingPath) : existingPath;
    return resolve(physicalExistingPath, ...parts);
}

function assertExistingPathChainSafe(path: string): void {
    const resolvedPath = resolve(path);
    const parsed = parse(resolvedPath);
    const relativeParts = relative(parsed.root, resolvedPath)
        .split(/[\\/]/)
        .filter((part) => part.length > 0);
    let current = parsed.root;

    for (const part of relativeParts) {
        current = join(current, part);
        if (!existsSync(current)) {
            continue;
        }

        const stat = lstatSync(current);
        if (stat.isSymbolicLink()) {
            throw new Error(`STICKVANIA_DIST_DIR must not pass through symbolic links or junctions: ${current}`);
        }
        if (!stat.isDirectory()) {
            throw new Error(`STICKVANIA_DIST_DIR must not pass through non-directory filesystem entries: ${current}`);
        }
    }
}

function isSameOrInside(path: string, possibleAncestor: string): boolean {
    const relationship = relative(possibleAncestor, path);
    return relationship === "" || (!relationship.startsWith("..") && !isAbsolute(relationship));
}

function collectFiles(directory: string): string[] {
    const rootStat = lstatSync(directory);
    if (rootStat.isSymbolicLink()) {
        throw new Error(`PWA release output must not contain symbolic links or junctions: ${directory}`);
    }
    if (!rootStat.isDirectory()) {
        throw new Error(`PWA release output must be a directory: ${directory}`);
    }

    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
            throw new Error(`PWA release output must not contain symbolic links or junctions: ${fullPath}`);
        }
        if (stat.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (stat.isFile()) {
            files.push(fullPath);
        } else {
            throw new Error(`PWA release output must not contain special filesystem entries: ${fullPath}`);
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
