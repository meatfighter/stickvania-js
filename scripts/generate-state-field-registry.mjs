import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import ts from "typescript";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const stickvaniaDir = join(rootDir, "pwa", "src", "stickvania");
const registryPath = join(stickvaniaDir, "persistence", "StateFieldRegistry.generated.ts");
const thingRegistryPath = join(stickvaniaDir, "persistence", "ThingTypeRegistry.ts");
const mainPolicyPath = join(stickvaniaDir, "persistence", "MainStateFieldPolicy.ts");
const rehydrationRegistryPath = join(stickvaniaDir, "persistence", "ThingRehydrationRegistry.ts");
const valuePolicyPath = join(stickvaniaDir, "persistence", "StateFieldValuePolicy.ts");
const checkOnly = process.argv.includes("--check");
const RUNTIME_RESOURCE_TYPES = new Set(["Color", "Image", "Music", "Sound"]);
const VALID_MAIN_CLASSIFICATIONS = new Set(["persisted", "runtime", "reconstructed", "special"]);

function collectTypeScriptFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...collectTypeScriptFiles(file));
        else if (entry.isFile() && entry.name.endsWith(".ts") && file !== registryPath) files.push(file);
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
function typeName(member, source) {
    return member.type ? member.type.getText(source).replace(/\s+/g, "") : "";
}
function collectDeclaredInstanceFields(node, source) {
    const fields = [];
    const seen = new Set();
    const add = (name, runtimeResource = false, declaredType = "") => {
        if (name !== null && !seen.has(name)) {
            seen.add(name);
            fields.push({ name, runtimeResource, declaredType });
        }
    };
    for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && !hasModifier(member, ts.SyntaxKind.StaticKeyword)) {
            const declaredType = typeName(member, source);
            add(propertyNameText(member.name), RUNTIME_RESOURCE_TYPES.has(declaredType), declaredType);
            continue;
        }
        if (!ts.isConstructorDeclaration(member)) continue;
        for (const parameter of member.parameters) {
            const parameterProperty =
                hasModifier(parameter, ts.SyntaxKind.PublicKeyword) ||
                hasModifier(parameter, ts.SyntaxKind.PrivateKeyword) ||
                hasModifier(parameter, ts.SyntaxKind.ProtectedKeyword) ||
                hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword);
            if (parameterProperty) add(propertyNameText(parameter.name), false, typeName(parameter, source));
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
            classes.set(name, { name, base: baseClassName(statement), fields: collectDeclaredInstanceFields(statement, source), path: file });
        }
    }
    return classes;
}
function inheritedFieldInfo(classes, name) {
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
            if (seenFields.has(field.name))
                throw new Error(
                    `TypeScript field hiding is not allowed in the Stickvania port: ${className}.${field.name} hides an inherited field (${relative(rootDir, info.path)}).`
                );
            seenFields.add(field.name);
            result.push(field);
        }
        visiting.delete(className);
    };
    visit(name);
    return result;
}
function unwrapExpression(expression) {
    let current = expression;
    while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current))
        current = current.expression;
    return current;
}
function readObjectLiteral(path, variableName) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variableName || declaration.initializer === undefined) continue;
            const initializer = unwrapExpression(declaration.initializer);
            if (!ts.isObjectLiteralExpression(initializer)) throw new Error(`${variableName} must remain an object literal.`);
            return { source, initializer };
        }
    }
    throw new Error(`Unable to find ${variableName}.`);
}
function readStringSet(path, variableName) {
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variableName || declaration.initializer === undefined) continue;
            const initializer = unwrapExpression(declaration.initializer);
            if (!ts.isNewExpression(initializer) || !ts.isIdentifier(initializer.expression) || initializer.expression.text !== "Set") {
                throw new Error(`${variableName} must remain a Set initialized from an array literal.`);
            }
            const argument = initializer.arguments?.[0];
            if (argument === undefined || !ts.isArrayLiteralExpression(argument)) {
                throw new Error(`${variableName} must remain a Set initialized from an array literal.`);
            }
            return new Set(
                argument.elements.map((element) => {
                    const value = unwrapExpression(element);
                    if (!ts.isStringLiteral(value)) throw new Error(`${variableName} entries must be string literals.`);
                    return value.text;
                })
            );
        }
    }
    throw new Error(`Unable to find ${variableName}.`);
}

function readReferencePolicyKeys() {
    const { initializer } = readObjectLiteral(valuePolicyPath, "THING_REFERENCE_FIELD_POLICY");
    const keys = new Set();
    for (const typeProperty of initializer.properties) {
        if (!ts.isPropertyAssignment(typeProperty)) throw new Error("THING_REFERENCE_FIELD_POLICY type entries must be property assignments.");
        const typeId = propertyNameText(typeProperty.name);
        const fields = unwrapExpression(typeProperty.initializer);
        if (typeId === null || !ts.isObjectLiteralExpression(fields)) {
            throw new Error("THING_REFERENCE_FIELD_POLICY type entries must map to object literals.");
        }
        for (const fieldProperty of fields.properties) {
            if (!ts.isPropertyAssignment(fieldProperty)) throw new Error("THING_REFERENCE_FIELD_POLICY field entries must be property assignments.");
            const fieldName = propertyNameText(fieldProperty.name);
            if (fieldName === null) throw new Error("THING_REFERENCE_FIELD_POLICY field names must be literal names.");
            keys.add(`${typeId}.${fieldName}`);
        }
    }
    return keys;
}

function validatePersistedValuePolicy(mainInfo, mainPolicy, thingTypeMappings, classes) {
    const mainBooleanFields = readStringSet(valuePolicyPath, "MAIN_BOOLEAN_PERSISTED_STATE_FIELDS");
    const thingBooleanFields = readStringSet(valuePolicyPath, "THING_BOOLEAN_PERSISTED_STATE_FIELDS");
    const thingNumericFieldOverrides = readStringSet(valuePolicyPath, "THING_NUMERIC_PERSISTED_STATE_FIELD_KEYS");
    const referenceFields = readReferencePolicyKeys();

    const expectedMainBooleanFields = new Set();
    for (const field of mainInfo.fields) {
        if (mainPolicy.get(field.name) !== "persisted") continue;
        if (field.declaredType === "boolean") {
            expectedMainBooleanFields.add(field.name);
            if (!mainBooleanFields.has(field.name))
                throw new Error(`Persisted Main boolean ${field.name} is missing from MAIN_BOOLEAN_PERSISTED_STATE_FIELDS.`);
        } else if (field.declaredType === "number") {
            if (mainBooleanFields.has(field.name)) throw new Error(`Persisted Main numeric field ${field.name} is incorrectly classified as boolean.`);
        } else {
            throw new Error(`Persisted Main field ${field.name} has unsupported value-policy type ${field.declaredType || "(inferred)"}.`);
        }
    }
    for (const field of mainBooleanFields) {
        if (!expectedMainBooleanFields.has(field)) throw new Error(`MAIN_BOOLEAN_PERSISTED_STATE_FIELDS contains stale/non-persisted field ${field}.`);
    }

    const expectedThingBooleanFields = new Set();
    const expectedThingNumericFieldOverrides = new Set();
    const expectedReferenceFields = new Set();
    for (const { id, className } of thingTypeMappings) {
        const fields = inheritedFieldInfo(classes, className);
        for (const field of fields) {
            if (field.name === "main" || field.runtimeResource) continue;
            const key = `${id}.${field.name}`;
            if (field.declaredType === "boolean") {
                expectedThingBooleanFields.add(field.name);
                if (!thingBooleanFields.has(field.name))
                    throw new Error(`Persisted Thing boolean ${key} is missing from THING_BOOLEAN_PERSISTED_STATE_FIELDS.`);
                if (thingNumericFieldOverrides.has(key))
                    throw new Error(`Persisted Thing boolean ${key} is incorrectly classified as a numeric type override.`);
                if (referenceFields.has(key)) throw new Error(`Persisted Thing boolean ${key} is incorrectly classified as a reference.`);
            } else if (field.declaredType === "number") {
                if (thingBooleanFields.has(field.name)) {
                    expectedThingNumericFieldOverrides.add(key);
                    if (!thingNumericFieldOverrides.has(key))
                        throw new Error(
                            `Persisted Thing numeric field ${key} collides with THING_BOOLEAN_PERSISTED_STATE_FIELDS without a type-qualified override.`
                        );
                } else if (thingNumericFieldOverrides.has(key)) {
                    throw new Error(`Persisted Thing numeric field ${key} has an unnecessary type-qualified override.`);
                }
                if (referenceFields.has(key)) throw new Error(`Persisted Thing numeric field ${key} is incorrectly classified as a reference.`);
            } else {
                expectedReferenceFields.add(key);
                if (!referenceFields.has(key)) {
                    throw new Error(
                        `Persisted Thing reference/collection ${key} (${field.declaredType || "inferred"}) is missing from THING_REFERENCE_FIELD_POLICY.`
                    );
                }
            }
        }
    }
    for (const field of thingBooleanFields) {
        if (!expectedThingBooleanFields.has(field)) throw new Error(`THING_BOOLEAN_PERSISTED_STATE_FIELDS contains stale/non-persisted field ${field}.`);
    }
    for (const key of thingNumericFieldOverrides) {
        if (!expectedThingNumericFieldOverrides.has(key)) throw new Error(`THING_NUMERIC_PERSISTED_STATE_FIELD_KEYS contains stale/unnecessary field ${key}.`);
    }
    for (const key of referenceFields) {
        if (!expectedReferenceFields.has(key)) throw new Error(`THING_REFERENCE_FIELD_POLICY contains stale/non-persisted field ${key}.`);
    }
}

function readThingTypeMappings() {
    const { initializer } = readObjectLiteral(thingRegistryPath, "THING_TYPES");
    return initializer.properties.map((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return { id: property.name.text, className: property.name.text };
        if (!ts.isPropertyAssignment(property)) throw new Error("THING_TYPES contains an unsupported property form.");
        const id = propertyNameText(property.name);
        const value = unwrapExpression(property.initializer);
        if (id === null || !ts.isIdentifier(value)) throw new Error("THING_TYPES entries must map a stable ID directly to a constructor.");
        return { id, className: value.text };
    });
}
function readMainPolicy() {
    const { initializer } = readObjectLiteral(mainPolicyPath, "MAIN_STATE_FIELD_POLICY");
    const result = new Map();
    for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) throw new Error("MAIN_STATE_FIELD_POLICY entries must be explicit property assignments.");
        const name = propertyNameText(property.name);
        const value = unwrapExpression(property.initializer);
        if (name === null || !ts.isStringLiteral(value) || !VALID_MAIN_CLASSIFICATIONS.has(value.text))
            throw new Error("MAIN_STATE_FIELD_POLICY contains an invalid classification.");
        result.set(name, value.text);
    }
    return result;
}
function readRehydratorIds() {
    const source = ts.createSourceFile(rehydrationRegistryPath, readFileSync(rehydrationRegistryPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "THING_REHYDRATOR_TYPE_IDS" || declaration.initializer === undefined) continue;
            let initializer = unwrapExpression(declaration.initializer);
            if (!ts.isArrayLiteralExpression(initializer)) throw new Error("THING_REHYDRATOR_TYPE_IDS must remain an array literal.");
            return new Set(
                initializer.elements.map((element) => {
                    if (!ts.isStringLiteral(element)) throw new Error("THING_REHYDRATOR_TYPE_IDS entries must be string literals.");
                    return element.text;
                })
            );
        }
    }
    throw new Error("Unable to find THING_REHYDRATOR_TYPE_IDS.");
}
async function formatGeneratedSource(mainFields, persistedMainFields, thingFields, persistedThingFields) {
    const raw = `// Generated by scripts/generate-state-field-registry.mjs. Do not edit by hand.\n\nexport const MAIN_STATE_FIELD_NAMES = ${JSON.stringify(mainFields, null, 4)} as const;\n\nexport const MAIN_PERSISTED_STATE_FIELD_NAMES = ${JSON.stringify(persistedMainFields, null, 4)} as const;\n\nexport const THING_STATE_FIELD_NAMES = ${JSON.stringify(thingFields, null, 4)} as const;\n\nexport const THING_PERSISTED_STATE_FIELD_NAMES = ${JSON.stringify(persistedThingFields, null, 4)} as const;\n`;
    const config = (await prettier.resolveConfig(registryPath)) ?? {};
    return prettier.format(raw, { ...config, parser: "typescript" });
}

const classes = collectClasses(collectTypeScriptFiles(stickvaniaDir));
const mainInfo = classes.get("Main");
if (!mainInfo) throw new Error("Unable to find Stickvania Main class.");
const mainFields = mainInfo.fields.map((field) => field.name);
const mainPolicy = readMainPolicy();
for (const field of mainFields)
    if (!mainPolicy.has(field)) throw new Error(`Main field ${field} is unclassified. Add it to MAIN_STATE_FIELD_POLICY before changing save behavior.`);
for (const field of mainPolicy.keys()) if (!mainFields.includes(field)) throw new Error(`MAIN_STATE_FIELD_POLICY contains stale field ${field}.`);
const persistedMainFields = mainFields.filter((field) => mainPolicy.get(field) === "persisted");
const rehydratorIds = readRehydratorIds();
const thingTypeMappings = readThingTypeMappings();
validatePersistedValuePolicy(mainInfo, mainPolicy, thingTypeMappings, classes);
const knownThingIds = new Set(thingTypeMappings.map(({ id }) => id));
const thingFields = {};
const persistedThingFields = {};
const requiredRehydrators = new Set();
for (const { id, className } of thingTypeMappings) {
    const info = classes.get(className);
    if (!info) throw new Error(`THING_TYPES refers to missing TypeScript class: ${className}`);
    const fields = inheritedFieldInfo(classes, className);
    if (!fields.some((field) => field.name === "main")) throw new Error(`Registered Thing class ${className} does not inherit Thing.main.`);
    thingFields[id] = fields.map((field) => field.name);
    persistedThingFields[id] = fields.filter((field) => field.name !== "main" && !field.runtimeResource).map((field) => field.name);
    if (fields.some((field) => field.runtimeResource)) requiredRehydrators.add(id);
}
for (const id of requiredRehydrators)
    if (!rehydratorIds.has(id)) throw new Error(`Thing type ${id} owns runtime resource fields and requires an explicit state rehydrator.`);
for (const id of rehydratorIds) if (!knownThingIds.has(id)) throw new Error(`THING_REHYDRATOR_TYPE_IDS contains unknown Thing type ${id}.`);
const generated = await formatGeneratedSource(mainFields, persistedMainFields, thingFields, persistedThingFields);
if (checkOnly) {
    if (!existsSync(registryPath) || readFileSync(registryPath, "utf8") !== generated)
        throw new Error("StateFieldRegistry.generated.ts is stale. Run npm run generate:state-fields and review the save-schema change.");
    console.log("State field registry and explicit field policy are current.");
} else {
    writeFileSync(registryPath, generated);
    console.log(`Updated ${relative(rootDir, registryPath)}.`);
}
