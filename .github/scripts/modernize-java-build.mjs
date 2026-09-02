import { readFileSync, rmSync, writeFileSync } from "node:fs";

function read(path) {
    return readFileSync(path, "utf8");
}

function write(path, content) {
    writeFileSync(path, content, "utf8");
}

function replaceExact(path, oldText, newText, expected = 1) {
    const source = read(path);
    const count = source.split(oldText).length - 1;
    if (count !== expected) {
        throw new Error(`Expected ${expected} occurrence(s) in ${path}, found ${count}: ${oldText.slice(0, 120)}`);
    }
    write(path, source.replaceAll(oldText, newText));
}

function removeFunction(source, name) {
    const pattern = new RegExp(`\\n(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}\\n`, "m");
    if (!pattern.test(source)) {
        throw new Error(`Unable to find function ${name}.`);
    }
    return source.replace(pattern, "\n");
}

for (const path of ["desktop/pom.xml", "desktop/assembly.xml", "desktop/build.xml", "desktop/manifest.mf"]) {
    rmSync(path, { force: false });
}
rmSync("desktop/nbproject", { recursive: true, force: false });

const buildPath = "scripts/build-desktop.mjs";
let build = read(buildPath);
for (const name of ["normalizeMavenOutputs", "quoteSh", "windowsPathToWslPath", "tryNativeMaven", "tryWslMaven"]) {
    build = removeFunction(build, name);
}
if (!build.includes("async function buildWithJavacFallback()")) {
    throw new Error("Expected the existing direct-JDK fallback function.");
}
build = build.replace("async function buildWithJavacFallback()", "async function buildWithJdk()");
build = build.replace(
    'throw new Error("The desktop build requires Maven, WSL2 Maven, or javac on PATH.");',
    'throw new Error("The desktop build requires javac on PATH.");'
);
build = build.replace(
    'throw new Error("The desktop build requires Maven, WSL2 Maven, or jar on PATH.");',
    'throw new Error("The desktop build requires jar on PATH.");'
);
const oldDispatch = `    if (!(await tryNativeMaven()) && !(await tryWslMaven())) {\n        await buildWithJavacFallback();\n    }`;
if (!build.includes(oldDispatch)) {
    throw new Error("Expected Maven/direct-JDK desktop build dispatch.");
}
build = build.replace(oldDispatch, "    await buildWithJdk();");
if (/Maven|\bmvn\b|WSL2|buildWithJavacFallback|tryNativeMaven|tryWslMaven|normalizeMavenOutputs/.test(build)) {
    throw new Error("Obsolete Maven/fallback build terminology remains in scripts/build-desktop.mjs.");
}
write(buildPath, build);

const releaseToolingPath = "scripts/verify-release-tooling.mjs";
let releaseTooling = read(releaseToolingPath);
releaseTooling = releaseTooling.replace('const desktopPomPath = join(rootDir, "desktop", "pom.xml");\n', "");
releaseTooling = releaseTooling.replace("verifyDesktopMavenUsesVendoredCompileClasspath();\n", "");
releaseTooling = removeFunction(releaseTooling, "verifyDesktopMavenUsesVendoredCompileClasspath");
if (/desktopPomPath|verifyDesktopMaven|desktop\/pom\.xml/.test(releaseTooling)) {
    throw new Error("Obsolete Maven verification remains in scripts/verify-release-tooling.mjs.");
}
write(releaseToolingPath, releaseTooling);

write(
    "desktop/README.md",
    `# Stickvania Java Reference Implementation\n\nThis directory contains the maintained Java/Slick2D reference implementation of Stickvania. The Java gameplay code is the behavioral and structural reference for the TypeScript browser port and is also built into the downloadable desktop distribution.\n\nThe source and resources remain under \`desktop/src\` in a layout close to the original game. Obsolete project/IDE build metadata is intentionally not retained in the maintained tree; Git history preserves it, while current builds use one supported JDK-based path.\n\n## Build\n\nUse JDK 21 LTS for current development and release validation. The build requires \`javac\` and \`jar\` on \`PATH\` and emits Java 8-compatible bytecode for the legacy Slick2D/LWJGL runtime.\n\nFrom the repository root:\n\n\`\`\`sh\nnpm run build:desktop\n\`\`\`\n\nOn Windows, \`npm.cmd run build:desktop\` is equivalent. The repository build script owns the compile classpath, exact vendored-runtime verification, resource copying, manifest generation, runtime/native packaging, license/corresponding-source checks, and final ZIP construction.\n\nPublic desktop releases should be produced through the root release tooling so the desktop artifact is verified together with the PWA and release candidate.\n\n## Run\n\nFrom the repository root:\n\n\`\`\`sh\nnpm run run:desktop\n\`\`\`\n\nThe generated distribution contains the platform launchers and the vendored runtime/native files they require. See \`RUNTIME_DEPENDENCIES.md\` for the runtime contract and provenance details.\n`
);

const rootReadme = "README.md";
replaceExact(
    rootReadme,
    "The browser version is a TypeScript Progressive Web App (PWA) port of the original Java game and uses `slick2d-ts` as its Slick2D-style runtime layer. The desktop tree preserves the original Java project as a buildable archival artifact and as a behavioral reference for the browser port. A static public project/about page is built and released with both versions.",
    "The browser version is a TypeScript Progressive Web App (PWA) port of the original Java game and uses `slick2d-ts` as its Slick2D-style runtime layer. The desktop tree contains the maintained Java/Slick2D reference implementation used for behavioral and structural comparison with the browser port and for downloadable desktop builds. A static public project/about page is built and released with both versions."
);
replaceExact(
    rootReadme,
    "2. **`desktop/` is the preserved Java game.** It remains buildable for archival use, parity checks, and downloadable desktop releases.",
    "2. **`desktop/` is the Java/Slick2D reference implementation.** It remains buildable for parity checks and downloadable desktop releases."
);
replaceExact(rootReadme, "  desktop/      preserved Java game", "  desktop/      Java/Slick2D reference implementation");
replaceExact(
    rootReadme,
    `### Java desktop toolchain\n\nThe Java desktop source is legacy-style and is compiled to Java 8-compatible bytecode.\n\nThe root desktop builder tries available build routes conservatively:\n\n1. Maven on the host;\n2. Maven in WSL2 when running from Windows and WSL2 Maven is available;\n3. a direct \`javac\`/\`jar\` fallback.\n\nThis allows a developer with a JDK but no Maven installation to build the desktop artifact.\n\nIf Maven is installed, Java-only development can also use:\n\n\`\`\`sh\ncd desktop\nmvn package\n\`\`\`\n\nThat is a developer build path. Public desktop releases should still be produced by the root release tooling, which verifies runtime/source hashes and the final ZIP.\n`,
    `### Java desktop toolchain\n\nUse JDK 21 LTS for current desktop builds and smoke tests. The supported desktop build requires \`javac\` and \`jar\` on \`PATH\`; repository tooling invokes them directly against the verified vendored legacy runtime jars.\n\nThe Java source is compiled as Java 8-compatible bytecode while JDK 21 remains the primary current build and validation environment. Use \`npm run build:desktop\` for Java-only development and the root release commands for public artifacts.\n`
);
replaceExact(
    rootReadme,
    "| `desktop/`                        | Preserved Java project, legacy NetBeans/Maven metadata, launchers, runtime documentation, licenses, and third-party source material. |",
    "| `desktop/`                        | Maintained Java/Slick2D reference implementation, launchers, runtime documentation, licenses, and third-party source material.      |"
);
let readme = read(rootReadme);
const desktopSection = /### `desktop\/` — Preserved Java desktop project[\s\S]*?### `scripts\/` — Build and release system/;
if (!desktopSection.test(readme)) {
    throw new Error("Unable to find the Stickvania desktop README section.");
}
readme = readme.replace(
    desktopSection,
    `### \`desktop/\` — Java/Slick2D reference implementation\n\nThe desktop tree contains the maintained Java implementation used to validate gameplay parity with the TypeScript port and to build the downloadable desktop application.\n\nThe Java and resource layout under \`desktop/src/\` intentionally remains close to the original game. Obsolete project/IDE build metadata is not part of the current tree; Git history retains that historical scaffolding if it is ever needed. Current repository tooling invokes JDK 21 \`javac\` and \`jar\` directly and packages the exact verified Slick2D/LWJGL-era runtime.\n\nThe desktop runtime remains intentionally conservative. Modernizing build orchestration does not mean rewriting the Java gameplay or replacing the runtime stack that defines the reference behavior.\n\n### \`scripts/\` — Build and release system`
);
if (/Maven|\bmvn\b|NetBeans|\bAnt\b|WSL2 Maven/.test(readme)) {
    throw new Error("Obsolete Java build-system documentation remains in README.md.");
}
write(rootReadme, readme);

console.log("Stickvania Java desktop build modernization applied.");
