import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const canonicalDistDir = join(rootDir, "dist");
export const releaseComponentsDir = join(rootDir, ".release-components");
export const distDir = resolveConfiguredDistDir();
export const versionPath = join(rootDir, "version.json");

export function resolveConfiguredDistDir() {
    return resolveDistDir(process.env.STICKVANIA_DIST_DIR);
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

export function cleanDirectory(path) {
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
