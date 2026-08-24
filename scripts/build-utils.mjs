import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
    closeSync,
    copyFileSync,
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
export const releaseLockUpdateDir = join(releaseComponentsDir, "release.lock.update");
export const versionPath = join(rootDir, "version.json");

export function resolveConfiguredDistDir() {
    const configuredDistDir = process.env.STICKVANIA_DIST_DIR;
    const hasConfiguredDistDir = configuredDistDir !== undefined && configuredDistDir.trim() !== "";
    if (hasConfiguredDistDir && process.env.STICKVANIA_ALLOW_DIST_DIR_OVERRIDE !== "true") {
        throw new Error("STICKVANIA_DIST_DIR is reserved for release tooling and requires STICKVANIA_ALLOW_DIST_DIR_OVERRIDE=true.");
    }

    const resolvedDistDir = resolveDistDir(configuredDistDir);
    assertSafeGeneratedOutputDirectory(resolvedDistDir, {
        allowCanonicalDist: !hasConfiguredDistDir,
        label: "STICKVANIA_DIST_DIR"
    });
    return resolvedDistDir;
}

export function resolveDistDir(configuredDistDir) {
    return configuredDistDir === undefined || configuredDistDir.trim() === "" ? canonicalDistDir : resolve(rootDir, configuredDistDir);
}

export function readVersion() {
    const version = JSON.parse(readFileSync(versionPath, "utf8").replace(/^\uFEFF/, ""));
    if (process.env.STICKVANIA_ALLOW_VERSION_OVERRIDE === "true" && process.env.STICKVANIA_BUILD_STAMP !== undefined) {
        version.buildStamp = process.env.STICKVANIA_BUILD_STAMP;
    }
    return version;
}

export function writeVersion(version) {
    writeAtomicTextFile(versionPath, `${JSON.stringify(version, null, 4)}\n`);
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
    const rendered = Object.entries(replacements).reduce((output, [key, value]) => output.replaceAll(key, value), text);
    const unresolvedPlaceholders = [...new Set([...rendered.matchAll(/__[A-Z0-9_]+__/g)].map((match) => match[0]))];
    if (unresolvedPlaceholders.length > 0) {
        throw new Error(`Template contains unresolved placeholders: ${unresolvedPlaceholders.join(", ")}`);
    }
    return rendered;
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

export function assertSafeFileMutationDestination(path, label = "file destination") {
    const resolvedPath = resolve(path);
    assertExistingPathChainSafe(dirname(resolvedPath), label);

    if (!existsSync(resolvedPath)) {
        return;
    }

    let stat;
    try {
        stat = lstatSync(resolvedPath);
    } catch (error) {
        if (error?.code === "ENOENT") {
            return;
        }
        throw error;
    }
    if (stat.isSymbolicLink()) {
        throw new Error(`${label} must not be a symbolic link or junction: ${resolvedPath}`);
    }
    if (!stat.isFile()) {
        throw new Error(`${label} must be a regular file: ${resolvedPath}`);
    }
    if (stat.nlink > 1) {
        throw new Error(`${label} must not be a hard link: ${resolvedPath}`);
    }
}

export function copyFileAtomic(sourcePath, destinationPath, options = {}) {
    const label = options.label ?? "atomic copy destination";
    assertSafeFileMutationDestination(destinationPath, label);

    const tempPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
    let tempCreated = false;
    try {
        copyFileSync(sourcePath, tempPath);
        tempCreated = true;
        fsyncFileBestEffort(tempPath);
        assertSafeFileMutationDestination(destinationPath, label);
        renameSync(tempPath, destinationPath);
        fsyncParentDirectoryBestEffort(destinationPath);
    } catch (error) {
        if (tempCreated || existsSync(tempPath)) {
            try {
                rmSync(tempPath, { force: true });
            } catch {
                // Preserve the original copy or rename failure.
            }
        }
        throw error;
    }
}

export function writeAtomicTextFile(path, text, options = {}) {
    writeAtomicFile(path, text, options);
}

export function writeAtomicBinaryFile(path, data, options = {}) {
    writeAtomicFile(path, data, options);
}

function writeAtomicFile(path, data, options = {}) {
    const label = options.label ?? "atomic file destination";
    assertSafeFileMutationDestination(path, label);

    const tempPath = `${path}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
    let fd = null;
    try {
        fd = openSync(tempPath, "w");
        writeFileSync(fd, data);
        fsyncSync(fd);
        closeSync(fd);
        fd = null;
        assertSafeFileMutationDestination(path, label);
        renameSync(tempPath, path);
        fsyncParentDirectoryBestEffort(path);
    } catch (error) {
        if (fd !== null) {
            try {
                closeSync(fd);
            } catch {
                // Preserve the original write or rename failure.
            }
        }
        try {
            rmSync(tempPath, { force: true });
        } catch {
            // Preserve the original write or rename failure.
        }
        throw error;
    }
}

export function withReleaseOperationLock(operationName, callback) {
    const inheritedToken = process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
    let ownsLock = false;
    let registeredHolder = false;
    let token = inheritedToken;

    if (inheritedToken !== undefined && inheritedToken !== "") {
        registerReleaseLockHolder(inheritedToken, operationName, process.pid);
        registeredHolder = true;
    } else {
        token = `${process.pid}-${Date.now()}-${randomUUID()}`;
        acquireReleaseLock(operationName, token);
        ownsLock = true;
    }

    const previousToken = process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
    process.env.STICKVANIA_RELEASE_LOCK_TOKEN = token;

    const release = () => {
        if (previousToken === undefined) {
            delete process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
        } else {
            process.env.STICKVANIA_RELEASE_LOCK_TOKEN = previousToken;
        }
        if (registeredHolder) {
            unregisterReleaseLockHolder(token, process.pid);
        }
        if (ownsLock) {
            releaseReleaseLock(token);
        }
    };

    try {
        const result = callback(token);
        if (result !== null && typeof result === "object" && typeof result.then === "function") {
            return result.finally(release);
        }
        release();
        return result;
    } catch (error) {
        release();
        throw error;
    }
}

export function runCommandWithReleaseLock(command, args, options = {}) {
    const token = process.env.STICKVANIA_RELEASE_LOCK_TOKEN;
    const env = { ...(options.env ?? process.env) };
    if (token !== undefined && token !== "") {
        env.STICKVANIA_RELEASE_LOCK_TOKEN = token;
    }
    const child = spawn(command, args, {
        cwd: options.cwd ?? rootDir,
        env,
        stdio: options.stdio ?? "inherit"
    });
    let registeredHolder = false;

    if (token !== undefined && token !== "" && child.pid !== undefined) {
        try {
            registerReleaseLockHolder(token, `${command} ${args.join(" ")}`.trim(), child.pid);
            registeredHolder = true;
        } catch (error) {
            child.kill();
            throw error;
        }
    }

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            if (registeredHolder) {
                unregisterReleaseLockHolder(token, child.pid);
                registeredHolder = false;
            }
        };

        child.once("error", (error) => {
            cleanup();
            reject(error);
        });
        child.once("close", (code, signal) => {
            cleanup();
            resolve({
                signal,
                status: code ?? (signal === null ? 0 : 1)
            });
        });
    });
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
                        holders: [
                            {
                                operationName,
                                pid: process.pid,
                                startedAt: new Date().toISOString()
                            }
                        ],
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

function withReleaseLockOwnerUpdate(operationName, callback) {
    const token = acquireReleaseLockOwnerUpdateGuard(operationName);
    try {
        return callback();
    } finally {
        releaseReleaseLockOwnerUpdateGuard(token);
    }
}

function acquireReleaseLockOwnerUpdateGuard(operationName) {
    ensureDirectory(releaseComponentsDir);

    const token = `${process.pid}-${Date.now()}-${randomUUID()}`;
    const deadline = Date.now() + 5000;
    while (true) {
        try {
            mkdirSync(releaseLockUpdateDir);
        } catch (error) {
            if (error?.code !== "EEXIST" || !removeStaleReleaseLockOwnerUpdateGuard()) {
                if (Date.now() >= deadline) {
                    throw new Error(`Timed out waiting for release lock owner update guard while trying to ${operationName}.`);
                }
                sleepReleaseLockUpdateRetry();
            }
            continue;
        }

        try {
            writeAtomicTextFile(
                releaseLockUpdateOwnerPath(),
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
            return token;
        } catch (error) {
            rmSync(releaseLockUpdateDir, { recursive: true, force: true });
            throw error;
        }
    }
}

function releaseReleaseLockOwnerUpdateGuard(token) {
    const owner = readReleaseLockOwnerUpdateGuardOwner();
    if (owner?.token === token || (owner === null && existsSync(releaseLockUpdateDir))) {
        rmSync(releaseLockUpdateDir, { recursive: true, force: true });
    }
}

function removeStaleReleaseLockOwnerUpdateGuard() {
    let stat;
    try {
        stat = lstatSync(releaseLockUpdateDir);
    } catch (error) {
        if (error?.code === "ENOENT") {
            return true;
        }
        throw error;
    }

    if (!existsSync(releaseLockUpdateDir)) {
        return true;
    }

    if (stat.isSymbolicLink()) {
        throw new Error(`release lock owner update guard must not be a symbolic link or junction: ${releaseLockUpdateDir}`);
    }
    if (!stat.isDirectory()) {
        throw new Error(`release lock owner update guard must be a directory: ${releaseLockUpdateDir}`);
    }

    const owner = readReleaseLockOwnerUpdateGuardOwner();
    if (owner === null) {
        if (!existsSync(releaseLockUpdateDir)) {
            return true;
        }
        if (Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
            return false;
        }
        console.warn("Recovering stale malformed release lock owner update guard.");
        rmSync(releaseLockUpdateDir, { recursive: true, force: true });
        return true;
    }

    if (owner.pid === process.pid || isProcessAlive(owner.pid)) {
        return false;
    }

    rmSync(releaseLockUpdateDir, { recursive: true, force: true });
    return true;
}

function registerReleaseLockHolder(token, operationName, pid) {
    withReleaseLockOwnerUpdate(`register ${operationName}`, () => {
        const owner = readReleaseLockOwner();
        if (owner?.token !== token) {
            throw new Error(`Inherited release operation lock is invalid for ${operationName}.`);
        }

        owner.holders = normalizedReleaseLockHolders(owner).filter((holder) => holder.pid !== pid);
        owner.holders.push({
            operationName,
            pid,
            startedAt: new Date().toISOString()
        });
        writeReleaseLockOwner(owner);
    });
}

function unregisterReleaseLockHolder(token, pid) {
    withReleaseLockOwnerUpdate("unregister release lock holder", () => {
        const owner = readReleaseLockOwner();
        if (owner?.token !== token) {
            return;
        }

        owner.holders = normalizedReleaseLockHolders(owner).filter((holder) => holder.pid !== pid);
        writeReleaseLockOwner(owner);
    });
}

function releaseReleaseLock(token) {
    withReleaseLockOwnerUpdate("release operation lock", () => {
        const owner = readReleaseLockOwner();
        if (owner?.token === token) {
            rmSync(releaseLockDir, { recursive: true, force: true });
        }
    });
}

function removeStaleReleaseLock() {
    return withReleaseLockOwnerUpdate("recover stale release operation lock", () => {
        const owner = readReleaseLockOwner();
        if (owner === null) {
            let stat;
            try {
                stat = lstatSync(releaseLockDir);
            } catch (error) {
                if (error?.code === "ENOENT") {
                    return true;
                }
                throw error;
            }
            if (!existsSync(releaseLockDir)) {
                return true;
            }
            if (Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
                return false;
            }
            console.warn("Recovering stale malformed release operation lock.");
            rmSync(releaseLockDir, { recursive: true, force: true });
            return true;
        }

        if (normalizedReleaseLockHolders(owner).some((holder) => holder.pid === process.pid || isProcessAlive(holder.pid))) {
            return false;
        }

        rmSync(releaseLockDir, { recursive: true, force: true });
        return true;
    });
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

function readReleaseLockOwnerUpdateGuardOwner() {
    if (!existsSync(releaseLockUpdateDir)) {
        return null;
    }

    try {
        const text = readFileSync(releaseLockUpdateOwnerPath(), "utf8");
        const owner = JSON.parse(text);
        return typeof owner.pid === "number" && typeof owner.token === "string" ? owner : null;
    } catch {
        return null;
    }
}

function writeReleaseLockOwner(owner) {
    writeAtomicTextFile(releaseLockOwnerPath(), `${JSON.stringify(owner, null, 4)}\n`);
}

function normalizedReleaseLockHolders(owner) {
    if (Array.isArray(owner.holders)) {
        return owner.holders.filter((holder) => typeof holder?.pid === "number");
    }
    return typeof owner.pid === "number"
        ? [
              {
                  operationName: owner.operationName ?? "unknown",
                  pid: owner.pid,
                  startedAt: owner.startedAt ?? null
              }
          ]
        : [];
}

function releaseLockOwnerPath() {
    return join(releaseLockDir, "owner.json");
}

function releaseLockUpdateOwnerPath() {
    return join(releaseLockUpdateDir, "owner.json");
}

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === "EPERM";
    }
}

function fsyncFileBestEffort(path) {
    try {
        const fd = openSync(path, "r+");
        try {
            fsyncSync(fd);
        } finally {
            closeSync(fd);
        }
    } catch {
        // Best effort only; the final rename still provides atomic replacement.
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

function sleepReleaseLockUpdateRetry() {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
}

function isInsidePath(path, possibleAncestor) {
    const relationship = relative(possibleAncestor, path);
    return relationship === "" || (!relationship.startsWith("..") && !isAbsolute(relationship));
}

function isSamePath(first, second) {
    return first === second;
}
