import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const canonicalDistDir = join(rootDir, "dist");
export const releaseComponentsDir = join(rootDir, ".release-components");
export const distDir = resolveConfiguredDistDir();
export const versionPath = join(rootDir, "version.json");

export function resolveConfiguredDistDir() {
    const configuredDistDir = process.env.STICKVANIA_DIST_DIR;
    const resolvedDistDir = resolveDistDir(configuredDistDir);
    assertSafeGeneratedOutputDirectory(resolvedDistDir, {
        allowCanonicalDist: configuredDistDir === undefined || configuredDistDir.trim() === "",
        label: "STICKVANIA_DIST_DIR"
    });
    return resolvedDistDir;
}

export function resolveDistDir(configuredDistDir) {
    return configuredDistDir === undefined || configuredDistDir.trim() === "" ? canonicalDistDir : resolve(rootDir, configuredDistDir);
}

export function readVersion() {
    return JSON.parse(readFileSync(versionPath, "utf8").replace(/^\uFEFF/, ""));
}

export function writeVersion(version) {
    writeFileSync(versionPath, `${JSON.stringify(version, null, 4)}\n`);
}

export function ensureDirectory(path) {
    mkdirSync(path, { recursive: true });
}

export function cleanDirectory(path, options = {}) {
    assertSafeGeneratedOutputDirectory(path, options);
    rmSync(path, { recursive: true, force: true });
    ensureDirectory(path);
}

export function copyDirectory(source, target) {
    if (!existsSync(source)) {
        return;
    }
    cpSync(source, target, { recursive: true });
}

export function renderTemplate(text, replacements) {
    return Object.entries(replacements).reduce((output, [key, value]) => output.replaceAll(key, value), text);
}

export function assertSafeGeneratedOutputDirectory(path, options = {}) {
    const resolvedPath = resolve(path);
    const allowCanonicalDist = options.allowCanonicalDist === true;
    const label = options.label ?? "generated output directory";

    if (isSameOrInside(rootDir, resolvedPath)) {
        throw new Error(`${label} must not be the repository root or one of its ancestors: ${resolvedPath}`);
    }

    if (!allowCanonicalDist && pathsOverlap(resolvedPath, canonicalDistDir)) {
        throw new Error(`${label} must not overlap canonical dist for component or redirected output: ${resolvedPath}`);
    }

    if (resolvedPath === releaseComponentsDir) {
        throw new Error(`${label} must not be the release components root: ${resolvedPath}`);
    }

    for (const protectedDirectory of protectedOutputOverlapDirectories()) {
        if (pathsOverlap(resolvedPath, protectedDirectory)) {
            throw new Error(`${label} must not overlap protected repository path ${protectedDirectory}: ${resolvedPath}`);
        }
    }
}

function protectedOutputOverlapDirectories() {
    return [".git", ".agents", ".codex", ".release-candidates", ".release-secrets", "about", "desktop", "node_modules", "pwa", "releases", "scripts"].map(
        (entry) => join(rootDir, entry)
    );
}

function pathsOverlap(first, second) {
    return isSameOrInside(first, second) || isSameOrInside(second, first);
}

function isSameOrInside(path, possibleAncestor) {
    const relationship = relative(possibleAncestor, path);
    return relationship === "" || (!relationship.startsWith("..") && !isAbsolute(relationship));
}
