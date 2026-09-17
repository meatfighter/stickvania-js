import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const javaDir = join(rootDir, "desktop", "src", "stickvania");
const tsDir = join(rootDir, "pwa", "src", "stickvania");
const outputPath = join(rootDir, "scripts", "generated", "java-parity-metadata.json");
const checkOnly = process.argv.includes("--check");

function javaFiles() {
    return readdirSync(javaDir)
        .filter((name) => name.endsWith(".java"))
        .sort();
}

function classInfo(source, file) {
    const declaration = /\b(?:public\s+)?(?:final\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/.exec(source);
    if (!declaration) return null;
    const className = declaration[1];
    const baseClass = declaration[2] ?? null;
    const floatFields = [];
    // This metadata tracks fields only. Exclude float-returning methods such as
    // `private float shieldX()` from the field scan.
    const fieldPattern = /^\s*(?:public|protected|private)\s+(?!static\b)(?:final\s+)?float\s+(\w+)\b(?!\s*\()/gm;
    for (const match of source.matchAll(fieldPattern)) floatFields.push(match[1]);
    const publicMethods = [];
    const methodPattern = /^\s*(?:public|protected)\s+(?!static\b)(?:final\s+)?[\w<>\[\].?]+\s+(\w+)\s*\(/gm;
    for (const match of source.matchAll(methodPattern)) {
        if (match[1] !== className && !publicMethods.includes(match[1])) publicMethods.push(match[1]);
    }
    return { file, className, baseClass, floatFields: floatFields.sort(), publicMethods: publicMethods.sort() };
}

const all = new Map();
for (const file of javaFiles()) {
    const info = classInfo(readFileSync(join(javaDir, file), "utf8"), file);
    if (info !== null) all.set(info.className, info);
}
function extendsThing(name) {
    const seen = new Set();
    let current = name;
    while (current !== null && !seen.has(current)) {
        if (current === "Thing") return true;
        seen.add(current);
        current = all.get(current)?.baseClass ?? null;
    }
    return false;
}
const classes = [];
for (const info of all.values()) {
    if (!extendsThing(info.className)) continue;
    const tsPath = join(tsDir, `${info.className}.ts`);
    if (!existsSync(tsPath)) throw new Error(`Java Thing class has no TypeScript counterpart: ${info.className}`);
    classes.push(info);
}
classes.sort((a, b) => a.className.localeCompare(b.className));
const rawOutput = `${JSON.stringify({ version: 1, classes }, null, 4)}\n`;
const prettierConfig = (await prettier.resolveConfig(outputPath)) ?? {};
const output = await prettier.format(rawOutput, { ...prettierConfig, parser: "json" });
mkdirSync(dirname(outputPath), { recursive: true });
if (checkOnly) {
    if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== output) {
        throw new Error(`${relative(rootDir, outputPath)} is stale. Run npm run generate:java-parity-metadata.`);
    }
    console.log("Java parity metadata is current.");
} else {
    writeFileSync(outputPath, output);
    console.log(`Updated ${relative(rootDir, outputPath)}.`);
}
