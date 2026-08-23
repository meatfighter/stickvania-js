import { randomUUID } from "node:crypto";
import {
    closeSync,
    existsSync,
    fsyncSync,
    lstatSync,
    mkdirSync,
    openSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const canonicalDistDir = join(rootDir, "dist");
export const releaseComponentsDir = join(rootDir, ".release-components");
export const releaseCandidatesDir = join(rootDir, ".release-candidates");
export const releaseSecretsDir = join(rootDir, ".release-secrets");
export const releaseLockDir = join(releaseComponentsDir, "release.lock");
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

export function renderTemplate(text, replacements) {
    return Object.entries(replacements).reduce((output, [key, value]) => output.replaceAll(key, value), text);
}

export function assertSafeGeneratedOutputDirectory(path, options = {}) {
    const resolvedPath = resolve(path);
    const allowCanonicalDist = options.allowCanonicalDist === true;
    const label = options.label ?? "generated output directory";
    const physicalPath = resolvePhysicalPathForValidation(resolvedPath, label);
    const allowedRoot = allowedGeneratedOutputRoots(allowCanonicalDist).find((root) => {
        const physicalRoot = resolvePhysicalPathForValidation(root.path, `${label} root`);
        if (root.allowExact && isSamePath(physicalPath, physicalRoot)) {
            return true;
        }
        return root.allowDescendant && isInsidePath(physicalPath, physicalRoot) && !isSamePath(physicalPath, physicalRoot);
    });

    if (allowedRoot === undefined) {
        throw new Error(`${label} must be canonical dist or a child of an allowed release-state directory: ${resolvedPath}`);
    }
}

export function assertRealDirectoryTree(path, label = "directory tree") {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
        throw new Error(`${label} must not contain symbolic links or junctions: ${path}`);
    }
    if (!stat.isDirectory()) {
        throw new Error(`${label} must be a directory: ${path}`);
    }

    for (const entry of readdirSync(path)) {
        const fullPath = join(path, entry);
        const entryStat = lstatSync(fullPath);
        if (entryStat.isSymbolicLink()) {
            throw new Error(`${label} must not contain symbolic links or junctions: ${fullPath}`);
        }
        if (entryStat.isDirectory()) {
            assertRealDirectoryTree(fullPath, label);
        } else if (!entryStat.isFile()) {
            throw new Error(`${label} must not contain special filesystem entries: ${fullPath}`);
        }
    }
}

export function writeAtomicTextFile(path, text) {
    const tempPath = `${path}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
    const fd = openSync(tempPath, "w");
    try {
        writeFileSync(fd, text);
        fsyncSync(fd);
    } finally {
        closeSync(fd);
    }

    renameSync(tempPath, path);
    fsyncParentDirectoryBestEffort(path);
}

export function withReleaseOperationLock(operationName, callback) {
    const inheritedToken = process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
    if (inheritedToken !== undefined && inheritedToken !== "") {
        assertInheritedReleaseLock(inheritedToken, operationName);
        return callback(inheritedToken);
    }

    const token = `${process.pid}-${Date.now()}-${randomUUID()}`;
    acquireReleaseLock(operationName, token);

    const previousToken = process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
    process.env.STICKVANIA_RELEASE_LOCK_TOKEN = token;
    try {
        return callback(token);
    } finally {
        if (previousToken === undefined) {
            delete process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
        } else {
            process.env.STICKVANIA_RELEASE_LOCK_TOKEN = previousToken;
        }
        releaseReleaseLock(token);
    }
}

function allowedGeneratedOutputRoots(allowCanonicalDist) {
    return [
        {
            allowDescendant: false,
            allowExact: allowCanonicalDist,
            path: canonicalDistDir
        },
        {
            allowDescendant: true,
            allowExact: false,
            path: releaseComponentsDir
        },
        {
            allowDescendant: true,
            allowExact: false,
            path: releaseCandidatesDir
        },
        {
            allowDescendant: true,
            allowExact: false,
            path: releaseSecretsDir
        }
    ];
}

function resolvePhysicalPathForValidation(path, label) {
    const resolvedPath = resolve(path);
    assertExistingPathChainSafe(resolvedPath, label);

    if (existsSync(resolvedPath)) {
        return realpathSync.native(resolvedPath);
    }

    const parts = [];
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

function assertExistingPathChainSafe(path, label) {
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
            throw new Error(`${label} must not pass through symbolic links or junctions: ${current}`);
        }
        if (!stat.isDirectory()) {
            throw new Error(`${label} must not pass through non-directory filesystem entries: ${current}`);
        }
    }
}

function acquireReleaseLock(operationName, token) {
    ensureDirectory(releaseComponentsDir);
    assertSafeGeneratedOutputDirectory(join(releaseComponentsDir, "lock-probe"), { label: "release lock directory" });

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            mkdirSync(releaseLockDir);
        } catch (error) {
            if (error?.code !== "EEXIST" || !removeStaleReleaseLock()) {
                throw new Error(`Another release operation is already running; unable to start ${operationName}.`);
            }
            continue;
        }

        try {
            writeAtomicTextFile(
                releaseLockOwnerPath(),
                `${JSON.stringify(
                    {
                        operationName,
                        pid: process.pid,
                        startedAt: new Date().toISOString(),
                        token
                    },
                    null,
                    4
                )}\n`
            );
            return;
        } catch (error) {
            rmSync(releaseLockDir, { recursive: true, force: true });
            throw error;
        }
    }

    throw new Error(`Unable to acquire release operation lock for ${operationName}.`);
}

function assertInheritedReleaseLock(token, operationName) {
    const owner = readReleaseLockOwner();
    if (owner?.token !== token) {
        throw new Error(`Inherited release operation lock is invalid for ${operationName}.`);
    }
}

function releaseReleaseLock(token) {
    const owner = readReleaseLockOwner();
    if (owner?.token === token) {
        rmSync(releaseLockDir, { recursive: true, force: true });
    }
}

function removeStaleReleaseLock() {
    const owner = readReleaseLockOwner();
    if (owner === null) {
        const stat = lstatSync(releaseLockDir);
        if (Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
            return false;
        }
        rmSync(releaseLockDir, { recursive: true, force: true });
        return true;
    }

    if (owner.pid === process.pid || isProcessAlive(owner.pid)) {
        return false;
    }

    rmSync(releaseLockDir, { recursive: true, force: true });
    return true;
}

function readReleaseLockOwner() {
    if (!existsSync(releaseLockDir)) {
        return null;
    }

    try {
        const text = readFileSync(releaseLockOwnerPath(), "utf8");
        const owner = JSON.parse(text);
        return typeof owner.pid === "number" && typeof owner.token === "string" ? owner : null;
    } catch {
        return null;
    }
}

function releaseLockOwnerPath() {
    return join(releaseLockDir, "owner.json");
}

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === "EPERM";
    }
}

function fsyncParentDirectoryBestEffort(path) {
    try {
        const fd = openSync(dirname(path), "r");
        try {
            fsyncSync(fd);
        } finally {
            closeSync(fd);
        }
    } catch {
        // Some platforms do not allow opening directories. The file fsync and rename still provide the important atomicity.
    }
}

function isInsidePath(path, possibleAncestor) {
    const relationship = relative(possibleAncestor, path);
    return relationship === "" || (!relationship.startsWith("..") && !isAbsolute(relationship));
}

function isSamePath(first, second) {
    return first === second;
}
