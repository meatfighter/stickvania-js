import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { copyFileAtomic, readVersion, rootDir, runCommandWithReleaseLock, withReleaseOperationLock } from "./build-utils.mjs";
import { createStoredZipFromDirectory } from "./zip-store.mjs";

const version = readVersion();
const desktopDir = join(rootDir, "desktop");
const sourceDir = join(desktopDir, "src");
const libDir = join(desktopDir, "lib");
const licensesDir = join(desktopDir, "licenses");
const nativeDir = join(desktopDir, "natives");
const thirdPartySourcesDir = join(desktopDir, "third-party-sources");
const targetDir = join(desktopDir, "target");
const classesDir = join(targetDir, "classes");
const targetLibDir = join(targetDir, "lib");
const targetNativeDir = join(targetDir, "natives");
const distributionRoot = join(targetDir, "distribution");
const distributionName = "stickvania-desktop";
const versionedJarPath = join(targetDir, `${distributionName}-${version.version}.jar`);
const stableJarPath = join(targetDir, `${distributionName}.jar`);
const versionedZipPath = join(targetDir, `${distributionName}-${version.version}.zip`);
const stableZipPath = join(targetDir, `${distributionName}.zip`);
const sourcesFile = join(targetDir, "sources.txt");
const manifestPath = join(targetDir, "MANIFEST.MF");
const runtimeJars = ["slick.jar", "lwjgl.jar", "lwjgl_util.jar", "jinput.jar", "jogg-0.0.7.jar", "jorbis-0.0.17.jar"];
const licenseFiles = [
    "GNU-LIBRARY-GPL-2.0.txt",
    "JINPUT-BSD.txt",
    "JORBIS-JOGG-LGPL-NOTICE.txt",
    "LWJGL-2-BSD.txt",
    "OPENAL-SOFT-LGPL-NOTICE.txt",
    "README.md",
    "SLICK2D-BSD-3-CLAUSE.txt"
];
const thirdPartySourceArtifacts = [
    {
        name: "jogg-0.0.7-jcraft-jorbis-28592f3-source.zip",
        sha256: "0c814790741d14debc4a88214bdf8d0369a521a652e4d9a375b0cdfdbc21597a"
    },
    {
        name: "jorbis-0.0.17-sources.jar",
        sha256: "1643dd368b9c160276caf8d1f6a8c0aae43ca5bf49b53348a2a01623641708e5"
    },
    {
        name: "openal-soft-1.14.tar.bz2",
        sha256: "87bd8d61d5943387898c92b6a2bbbb26118e745dec57550c817526a70fad0914"
    }
];

function commandExists(command) {
    const finder = process.platform === "win32" ? "where.exe" : "which";
    const result = spawnSync(finder, [command], { stdio: "ignore" });
    return result.status === 0;
}

async function run(command, args, cwd = rootDir) {
    const result = await runCommandWithReleaseLock(command, args, {
        cwd,
        stdio: "inherit"
    });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(" ")}`);
    }
}

function runCapture(command, args, cwd = rootDir) {
    return spawnSync(command, args, {
        cwd,
        encoding: "utf8"
    });
}

function parseJavaFeatureVersion(output) {
    const match = output.match(/(?:javac|(?:openjdk|java) version)\s+"?(\d+)(?:\.(\d+))?/i);
    if (!match) {
        return null;
    }
    const major = Number(match[1]);
    if (major === 1 && match[2] !== undefined) {
        return Number(match[2]);
    }
    return major;
}

function getJavacFeatureVersion() {
    const result = runCapture("javac", ["-version"]);
    if (result.error || result.status !== 0) {
        return null;
    }
    return parseJavaFeatureVersion(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
}

function collectJavaFiles(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = assertRealFilesystemEntry(full, "desktop Java source");
        if (stat.isDirectory()) {
            collectJavaFiles(full, files);
        } else if (stat.isFile() && entry.endsWith(".java")) {
            files.push(full);
        }
    }
    return files;
}

function copyResources(source, target) {
    for (const entry of readdirSync(source)) {
        const sourcePath = join(source, entry);
        const targetPath = join(target, entry);
        const stat = assertRealFilesystemEntry(sourcePath, "desktop resource tree");
        if (stat.isDirectory()) {
            mkdirSync(targetPath, { recursive: true });
            copyResources(sourcePath, targetPath);
        } else if (stat.isFile() && !entry.endsWith(".java")) {
            mkdirSync(dirname(targetPath), { recursive: true });
            copyFileSync(sourcePath, targetPath);
        }
    }
}

function copyDirectoryContents(source, target) {
    const sourceStat = assertRealFilesystemEntry(source, "desktop copy source tree");
    if (!sourceStat.isDirectory()) {
        throw new Error(`desktop copy source tree must be a directory: ${source}`);
    }
    assertDesktopGeneratedPathSafe(target, "desktop copy target tree");
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source)) {
        copyDirectoryEntry(join(source, entry), join(target, entry), "desktop runtime tree");
    }
}

function copyDirectoryEntry(source, target, label) {
    const stat = assertRealFilesystemEntry(source, label);
    if (stat.isDirectory()) {
        mkdirSync(target, { recursive: true });
        for (const entry of readdirSync(source)) {
            copyDirectoryEntry(join(source, entry), join(target, entry), label);
        }
    } else if (stat.isFile()) {
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
    }
}

function assertRealFilesystemEntry(path, label) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
        throw new Error(`${label} must not contain symbolic links or junctions: ${path}`);
    }
    if (!stat.isDirectory() && !stat.isFile()) {
        throw new Error(`${label} must not contain special filesystem entries: ${path}`);
    }
    return stat;
}

function formatManifestAttribute(name, value) {
    const maxLineLength = 68;
    const parts = value.split(" ");
    let current = `${name}:`;
    let output = "";

    for (const part of parts) {
        const candidate = `${current} ${part}`;
        if (Buffer.byteLength(candidate, "utf8") > maxLineLength && current !== `${name}:`) {
            output += `${current} \n`;
            current = ` ${part}`;
        } else {
            current = candidate;
        }
    }

    return `${output}${current}\n`;
}

function writeManifest() {
    const classPath = runtimeJars.map((name) => `lib/${name}`).join(" ");
    const manifest = ["Manifest-Version: 1.0\n", "Main-Class: stickvania.Main\n", formatManifestAttribute("Class-Path", classPath), "\n"].join("");
    writeFileSync(manifestPath, manifest);
}

function verifyRuntimeDependencies() {
    for (const jar of runtimeJars) {
        const path = join(libDir, jar);
        if (!existsSync(path)) {
            throw new Error(`Missing desktop runtime jar: ${path}`);
        }
    }
    if (!existsSync(nativeDir)) {
        throw new Error(`Missing desktop native directory: ${nativeDir}`);
    }
    const windowsNativeDir = join(nativeDir, "windows");
    for (const dll of ["lwjgl64.dll", "OpenAL64.dll", "jinput-dx8_64.dll", "jinput-raw_64.dll"]) {
        if (!existsSync(join(windowsNativeDir, dll))) {
            throw new Error(`Missing Windows 64-bit native library: ${join(windowsNativeDir, dll)}`);
        }
    }
    verifyLicenseBundle();
    verifyThirdPartySources();
}

function copyRuntimeToTarget() {
    assertDesktopGeneratedPathSafe(targetLibDir, "desktop runtime lib target");
    rmSync(targetLibDir, { recursive: true, force: true });
    mkdirSync(targetLibDir, { recursive: true });
    for (const jar of runtimeJars) {
        copyFileSync(join(libDir, jar), join(targetLibDir, jar));
    }
    copyDirectoryContents(nativeDir, targetNativeDir);
}

function verifyLicenseBundle() {
    const licenseDirStat = assertRealFilesystemEntry(licensesDir, "desktop license bundle");
    if (!licenseDirStat.isDirectory()) {
        throw new Error(`desktop license bundle must be a directory: ${licensesDir}`);
    }
    for (const file of licenseFiles) {
        const path = join(licensesDir, file);
        if (!existsSync(path)) {
            throw new Error(`Missing desktop license file: ${path}`);
        }
        const stat = assertRealFilesystemEntry(path, "desktop license bundle");
        if (!stat.isFile()) {
            throw new Error(`desktop license entry must be a file: ${path}`);
        }
    }
}

function verifyThirdPartySources() {
    const sourceDirStat = assertRealFilesystemEntry(thirdPartySourcesDir, "desktop third-party source bundle");
    if (!sourceDirStat.isDirectory()) {
        throw new Error(`desktop third-party source bundle must be a directory: ${thirdPartySourcesDir}`);
    }
    for (const artifact of thirdPartySourceArtifacts) {
        const path = join(thirdPartySourcesDir, artifact.name);
        if (!existsSync(path)) {
            throw new Error(`Missing desktop third-party source artifact: ${path}`);
        }
        const stat = assertRealFilesystemEntry(path, "desktop third-party source bundle");
        if (!stat.isFile()) {
            throw new Error(`desktop third-party source entry must be a file: ${path}`);
        }
        const actualHash = sha256(path);
        if (actualHash !== artifact.sha256) {
            throw new Error(`Unexpected SHA-256 for ${path}: expected ${artifact.sha256}, got ${actualHash}`);
        }
    }
}

function cleanDesktopTargetDirectory() {
    assertDesktopGeneratedPathSafe(targetDir, "desktop target directory");
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
}

function assertDesktopGeneratedPathSafe(path, label) {
    const resolvedPath = resolve(path);
    const targetRelationship = relative(targetDir, resolvedPath);
    if (targetRelationship !== "" && (targetRelationship.startsWith("..") || isAbsolute(targetRelationship))) {
        throw new Error(`${label} must be inside the desktop target directory: ${path}`);
    }

    const chain = [];
    let current = resolvedPath;
    while (true) {
        chain.unshift(current);
        const parent = dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }

    for (const chainPath of chain) {
        if (!existsSync(chainPath)) {
            continue;
        }

        const stat = lstatSync(chainPath);
        if (stat.isSymbolicLink()) {
            throw new Error(`${label} must not pass through symbolic links or junctions: ${chainPath}`);
        }
        if (!stat.isDirectory()) {
            throw new Error(`${label} must not pass through non-directory filesystem entries: ${chainPath}`);
        }
    }
}

function createDistribution() {
    const distributionDir = join(distributionRoot, distributionName);
    assertDesktopGeneratedPathSafe(distributionRoot, "desktop distribution root");
    rmSync(distributionRoot, { recursive: true, force: true });
    mkdirSync(distributionDir, { recursive: true });
    copyFileSync(stableJarPath, join(distributionDir, `${distributionName}.jar`));
    copyDirectoryContents(targetLibDir, join(distributionDir, "lib"));
    copyDirectoryContents(targetNativeDir, join(distributionDir, "natives"));
    copyDirectoryContents(licensesDir, join(distributionDir, "licenses"));
    copyDirectoryContents(thirdPartySourcesDir, join(distributionDir, "third-party-sources"));

    for (const name of ["run-windows.cmd", "run-windows.ps1", "run-linux.sh", "run-macos.sh", "README.md", "RUNTIME_DEPENDENCIES.md"]) {
        copyFileSync(join(desktopDir, name), join(distributionDir, name));
    }
    copyFileSync(join(rootDir, "LICENSE"), join(distributionDir, "LICENSE"));
    copyFileSync(join(rootDir, "THIRD_PARTY_NOTICES.md"), join(distributionDir, "THIRD_PARTY_NOTICES.md"));

    createStoredZipFromDirectory(distributionRoot, versionedZipPath, getDistributionZipEntryMode);
    copyFileAtomic(versionedZipPath, stableZipPath, { label: "desktop stable ZIP destination" });
}

function normalizeMavenOutputs() {
    const mavenStableJar = join(targetDir, `${distributionName}.jar`);
    if (!existsSync(mavenStableJar)) {
        throw new Error(`Maven did not create ${mavenStableJar}`);
    }
    if (!existsSync(targetLibDir)) {
        throw new Error(`Maven did not create ${targetLibDir}`);
    }
    if (!existsSync(targetNativeDir)) {
        throw new Error(`Maven did not create ${targetNativeDir}`);
    }
    if (resolve(mavenStableJar) !== resolve(stableJarPath)) {
        copyFileAtomic(mavenStableJar, stableJarPath, { label: "desktop stable JAR destination" });
    }
    copyFileAtomic(stableJarPath, versionedJarPath, { label: "desktop versioned JAR destination" });
    createDistribution();
}

function getDistributionZipEntryMode(name) {
    return name.endsWith("/run-linux.sh") || name.endsWith("/run-macos.sh") ? 0o100755 : 0o100644;
}

function quoteSh(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}

function sha256(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function windowsPathToWslPath(path) {
    const normalized = resolve(path).replaceAll("\\", "/");
    const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
    if (!match) {
        return normalized;
    }
    return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

async function tryNativeMaven() {
    const command = process.platform === "win32" ? "mvn.cmd" : "mvn";
    if (!commandExists(command)) {
        return false;
    }
    console.log("Building desktop archive with Maven.");
    await run(command, ["package", `-Drevision=${version.version}`], desktopDir);
    normalizeMavenOutputs();
    return true;
}

async function tryWslMaven() {
    if (process.platform !== "win32" || !commandExists("wsl.exe")) {
        return false;
    }
    const check = spawnSync("wsl.exe", ["sh", "-lc", "command -v mvn >/dev/null 2>&1"], {
        stdio: "ignore"
    });
    if (check.status !== 0) {
        return false;
    }
    console.log("Building desktop archive with WSL2 Maven.");
    await run("wsl.exe", ["sh", "-lc", `cd ${quoteSh(windowsPathToWslPath(desktopDir))} && mvn package -Drevision=${quoteSh(version.version)}`]);
    normalizeMavenOutputs();
    return true;
}

async function buildWithJavacFallback() {
    if (!commandExists("javac")) {
        throw new Error("The desktop build requires Maven, WSL2 Maven, or javac on PATH.");
    }
    if (!commandExists("jar")) {
        throw new Error("The desktop build requires Maven, WSL2 Maven, or jar on PATH.");
    }

    console.log("Building desktop archive with javac fallback.");
    rmSync(classesDir, { recursive: true, force: true });
    mkdirSync(classesDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    copyRuntimeToTarget();

    const sources = collectJavaFiles(join(sourceDir, "stickvania"));
    writeFileSync(sourcesFile, sources.map((source) => source.replaceAll("\\", "/")).join("\n"));

    const classpath = runtimeJars.map((name) => join(libDir, name)).join(process.platform === "win32" ? ";" : ":");
    const javacVersion = getJavacFeatureVersion();
    const releaseArgs = javacVersion !== null && javacVersion >= 9 ? ["--release", "8"] : ["-source", "1.8", "-target", "1.8"];

    await run("javac", ["-encoding", "UTF-8", "-Xlint:-options", ...releaseArgs, "-cp", classpath, "-d", classesDir, `@${sourcesFile}`]);

    copyResources(sourceDir, classesDir);
    writeManifest();
    const tempJarPath = `${versionedJarPath}.tmp-${process.pid}-${Date.now()}`;
    try {
        await run("jar", ["cfm", tempJarPath, manifestPath, "-C", classesDir, "."]);
        copyFileAtomic(tempJarPath, versionedJarPath, { label: "desktop versioned JAR destination" });
    } finally {
        rmSync(tempJarPath, { force: true });
    }
    copyFileAtomic(versionedJarPath, stableJarPath, { label: "desktop stable JAR destination" });
    createDistribution();
}

await withReleaseOperationLock("build-desktop", async () => {
    verifyRuntimeDependencies();
    cleanDesktopTargetDirectory();
    if (!(await tryNativeMaven()) && !(await tryWslMaven())) {
        await buildWithJavacFallback();
    }

    console.log(`Built ${relative(rootDir, stableJarPath)}`);
    console.log(`Built ${relative(rootDir, stableZipPath)}`);
});
