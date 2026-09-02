import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import ts from "typescript";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const stickvaniaDir = join(rootDir, "pwa", "src", "stickvania");
const registryPath = join(stickvaniaDir, "persistence", "StateFieldRegistry.generated.ts");
const thingRegistryPath = join(stickvaniaDir, "persistence", "ThingTypeRegistry.ts");
const checkOnly = process.argv.includes("--check");

function collectTypeScriptFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectTypeScriptFiles(file));
        } else if (entry.isFile() && entry.name.endsWith(".ts") && file !== registryPath) {
            files.push(file);
        }
    }
    return files;
}

function hasModifier(node, kind) {
    return node.modifiers?.some((modifier) => modifier.kind === kind) === true;
}

function propertyNameText(name) {
    return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : null;
}

function baseClassName(node) {
    const clause = node.heritageClauses?.find((item) => item.token === ts.SyntaxKind.ExtendsKeyword);
    const expression = clause?.types[0]?.expression;
    if (!expression) return null;
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return null;
}

function collectDeclaredInstanceFields(node) {
    const fields = [];
    const seen = new Set();
    const add = (name) => {
        if (name !== null && !seen.has(name)) {
            seen.add(name);
            fields.push(name);
        }
    };
    for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && !hasModifier(member, ts.SyntaxKind.StaticKeyword)) {
            add(propertyNameText(member.name));
            continue;
        }
        if (!ts.isConstructorDeclaration(member)) continue;
        for (const parameter of member.parameters) {
            const parameterProperty =
                hasModifier(parameter, ts.SyntaxKind.PublicKeyword) ||
                hasModifier(parameter, ts.SyntaxKind.PrivateKeyword) ||
                hasModifier(parameter, ts.SyntaxKind.ProtectedKeyword) ||
                hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword);
            if (parameterProperty) add(propertyNameText(parameter.name));
        }
    }
    return fields;
}

function collectClasses(sourcePaths) {
    const classes = new Map();
    for (const file of sourcePaths) {
        const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const statement of source.statements) {
            if (!ts.isClassDeclaration(statement) || statement.name === undefined) continue;
            const name = statement.name.text;
            if (classes.has(name)) throw new Error(`Duplicate TypeScript class name in Stickvania source: ${name}`);
            classes.set(name, { name, base: baseClassName(statement), fields: collectDeclaredInstanceFields(statement), path: file });
        }
    }
    return classes;
}

function inheritedFields(classes, name) {
    const result = [];
    const seenFields = new Set();
    const visiting = new Set();
    const visit = (className) => {
        if (visiting.has(className)) throw new Error(`Inheritance cycle while generating state fields: ${className}`);
        const info = classes.get(className);
        if (!info) return;
        visiting.add(className);
        if (info.base && classes.has(info.base)) visit(info.base);
        for (const field of info.fields) {
            if (seenFields.has(field)) {
                throw new Error(
                    `TypeScript field hiding is not allowed in the Stickvania port: ${className}.${field} hides an inherited field (${relative(rootDir, info.path)}).`
                );
            }
            seenFields.add(field);
            result.push(field);
        }
        visiting.delete(className);
    };
    visit(name);
    return result;
}

function unwrapExpression(expression) {
    let current = expression;
    while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current)) {
        current = current.expression;
    }
    return current;
}

function readThingTypeMappings() {
    const source = ts.createSourceFile(thingRegistryPath, readFileSync(thingRegistryPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "THING_TYPES" || declaration.initializer === undefined) continue;
            const initializer = unwrapExpression(declaration.initializer);
            if (!ts.isObjectLiteralExpression(initializer)) throw new Error("THING_TYPES must remain an object literal.");
            return initializer.properties.map((property) => {
                if (ts.isShorthandPropertyAssignment(property)) return { id: property.name.text, className: property.name.text };
                if (!ts.isPropertyAssignment(property)) throw new Error("THING_TYPES contains an unsupported property form.");
                const id = propertyNameText(property.name);
                const value = unwrapExpression(property.initializer);
                if (id === null || !ts.isIdentifier(value)) throw new Error("THING_TYPES entries must map a stable ID directly to a constructor.");
                return { id, className: value.text };
            });
        }
    }
    throw new Error("Unable to find THING_TYPES while generating state fields.");
}

async function formatGeneratedSource(mainFields, thingFields) {
    const raw = `// Generated by scripts/generate-state-field-registry.mjs. Do not edit by hand.\n\nexport const MAIN_STATE_FIELD_NAMES = ${JSON.stringify(mainFields, null, 4)} as const;\n\nexport const THING_STATE_FIELD_NAMES = ${JSON.stringify(thingFields, null, 4)} as const;\n`;
    const config = (await prettier.resolveConfig(registryPath)) ?? {};
    return prettier.format(raw, { ...config, parser: "typescript" });
}

const classes = collectClasses(collectTypeScriptFiles(stickvaniaDir));
const mainInfo = classes.get("Main");
if (!mainInfo) throw new Error("Unable to find Stickvania Main class.");
const thingFields = {};
for (const { id, className } of readThingTypeMappings()) {
    const info = classes.get(className);
    if (!info) throw new Error(`THING_TYPES refers to missing TypeScript class: ${className}`);
    const fields = inheritedFields(classes, className);
    if (!fields.includes("main")) throw new Error(`Registered Thing class ${className} does not inherit Thing.main.`);
    thingFields[id] = fields;
}
const generated = await formatGeneratedSource(mainInfo.fields, thingFields);
if (checkOnly) {
    if (!existsSync(registryPath) || readFileSync(registryPath, "utf8") !== generated) {
        throw new Error("StateFieldRegistry.generated.ts is stale. Run npm run generate:state-fields and review the save-schema change.");
    }
    console.log("State field registry is current.");
} else {
    writeFileSync(registryPath, generated);
    console.log(`Updated ${relative(rootDir, registryPath)}.`);
}
