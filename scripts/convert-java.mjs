import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const javaRoot = "C:/NetBeansProjects/stickvania/src/stickvania";
const outRoot = "pwa/src/stickvania";

const slickImports = [
    "AL",
    "AppGameContainer",
    "ApplicationGameContainer",
    "BasicGame",
    "BufferUtils",
    "Color",
    "Cursor",
    "CursorLoader",
    "Display",
    "DisplayMode",
    "FastTrig",
    "GameContainer",
    "Graphics",
    "Image",
    "ImageData",
    "Input",
    "JavaRandom",
    "LWJGLException",
    "Log",
    "Music",
    "PackedSpriteSheet",
    "PixelFormat",
    "Renderer",
    "SlickException",
    "Sound",
    "SoundStore",
    "SpriteSheet",
    "Sys",
    "Mouse",
    "ResourceLoader"
];

const helperImports = ["cc", "chr", "idiv", "makeArray", "make2D", "make3D", "make4D", "readBinaryResource", "readResourceLines", "toInt", "trunc"];

const reserved = new Set([
    "abstract",
    "as",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "constructor",
    "continue",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "null",
    "of",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "undefined",
    "while"
]);

const primitiveDefaults = new Map([
    ["number", "0"],
    ["boolean", "false"],
    ["string", '""']
]);

const javaFiles = readdirSync(javaRoot)
    .filter((name) => name.endsWith(".java"))
    .sort();
const classNames = javaFiles.map((name) => basename(name, ".java"));
const classSet = new Set(classNames);
const sourceByClass = new Map();
const metaByClass = new Map();

for (const file of javaFiles) {
    const className = basename(file, ".java");
    sourceByClass.set(className, readFileSync(join(javaRoot, file), "utf8"));
}

function stripBlockComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeSource(source) {
    return stripBlockComments(source)
        .replace(/\r\n/g, "\n")
        .replace(/^[ \t]*\/\/.*$/gm, "")
        .replace(/@Override\s*/g, "")
        .replace(/^[ \t]*@\w+(?:\([^)]*\))?\s*$/gm, "")
        .replace(/\(\s*\n\s*/g, "(")
        .replace(/,\s*\n\s*/g, ", ")
        .replace(/\)\s*\n\s*throws/g, ") throws");
}

function findMatching(source, openIndex, openChar = "{", closeChar = "}") {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let i = openIndex; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === openChar) {
            depth++;
        } else if (ch === closeChar) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function convertArrayInitializers(source) {
    let result = "";
    let i = 0;
    while (i < source.length) {
        const start = source.indexOf("= {", i);
        if (start < 0) {
            result += source.slice(i);
            break;
        }
        result += source.slice(i, start);
        const braceStart = source.indexOf("{", start);
        const end = findMatching(source, braceStart);
        if (end < 0) {
            result += source.slice(start);
            break;
        }
        let segment = source.slice(start, end + 1);
        let converted = "";
        let quote = null;
        let escaped = false;
        for (const ch of segment) {
            if (quote) {
                converted += ch;
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = null;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                converted += ch;
            } else if (ch === "{") {
                converted += "[";
            } else if (ch === "}") {
                converted += "]";
            } else {
                converted += ch;
            }
        }
        result += converted;
        i = end + 1;
    }
    return result;
}

function javaChar(raw) {
    if (!raw.startsWith("\\")) {
        return raw;
    }
    switch (raw[1]) {
        case "n":
            return "\n";
        case "r":
            return "\r";
        case "t":
            return "\t";
        case "b":
            return "\b";
        case "f":
            return "\f";
        case "\\":
            return "\\";
        case "'":
            return "'";
        case '"':
            return '"';
        default:
            return raw[1] ?? "";
    }
}

function convertCharLiterals(source) {
    let out = "";
    for (let i = 0; i < source.length;) {
        const ch = source[i];
        if (ch === '"') {
            let j = i + 1;
            let escaped = false;
            while (j < source.length) {
                const c = source[j++];
                if (escaped) {
                    escaped = false;
                } else if (c === "\\") {
                    escaped = true;
                } else if (c === '"') {
                    break;
                }
            }
            out += source.slice(i, j);
            i = j;
            continue;
        }
        if (ch === "'") {
            let j = i + 1;
            let raw = "";
            let escaped = false;
            while (j < source.length) {
                const c = source[j++];
                if (!escaped && c === "'") {
                    break;
                }
                raw += c;
                if (!escaped && c === "\\") {
                    escaped = true;
                } else {
                    escaped = false;
                }
            }
            out += `cc(${JSON.stringify(javaChar(raw))})`;
            i = j;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

function prepareSource(source) {
    return convertCharLiterals(convertArrayInitializers(normalizeSource(source)))
        .replace(/(?<![A-Za-z0-9_])([0-9]+(?:\.[0-9]+)?|\.[0-9]+)[fFdD]\b/g, "$1")
        .replace(/\bnew\s+Random\s*\(\s*0xDEADBEEF\s*\)/g, "new JavaRandom(0xDEADBEEF | 0)")
        .replace(/\bnew\s+Random\s*\(/g, "new JavaRandom(")
        .replace(/\bRandom\b/g, "JavaRandom")
        .replace(/\bString\.format\b/g, "formatString")
        .replace(/\bMath\.abs\b/g, "Math.abs")
        .replace(/\bSystem\.out\.println\(([^)]*)\);/g, "console.log($1);")
        .replace(/\bSystem\.out\.format\(([^)]*)\);/g, "console.log($1);")
        .replace(/\bnew\s+RuntimeException\s*\(/g, "new Error(")
        .replace(/\b([A-Za-z0-9_$.]+)\.printStackTrace\(\);/g, "console.error($1);")
        .replace(/\b([A-Za-z0-9_$.]+)\.length\(\)/g, "$1.length")
        .replace(/\.length\(\)/g, ".length")
        .replace(/\b([A-Za-z0-9_$.]+)\.size\(\)/g, "$1.length")
        .replace(/\b([A-Za-z0-9_$.]+)\.add\(/g, "$1.push(")
        .replace(/\b([A-Za-z0-9_$.]+)\.get\(([^)]+)\)/g, "$1[$2]")
        .replace(/\.charAt\(/g, ".charCodeAt(")
        .replace(/\(char\)\s*\(([^)]+)\)/g, "chr($1)")
        .replace(/\btrue\b/g, "true")
        .replace(/\bfalse\b/g, "false");
}

function parseClass(source, expectedName) {
    const prepared = prepareSource(source);
    const classMatch = prepared.match(/\b(public\s+)?(final\s+)?(abstract\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/);
    if (!classMatch) {
        throw new Error(`Unable to parse class header for ${expectedName}`);
    }
    const name = classMatch[4];
    const extendsName = classMatch[5] ?? null;
    const open = prepared.indexOf("{", classMatch.index);
    const close = findMatching(prepared, open);
    const body = prepared.slice(open + 1, close);
    return {
        name,
        extendsName,
        headerPrefix: classMatch[3] ? "abstract " : "",
        body,
        prepared
    };
}

function splitTopLevelMembers(body) {
    const members = [];
    let i = 0;
    while (i < body.length) {
        while (i < body.length && /\s/.test(body[i])) {
            i++;
        }
        if (i >= body.length) {
            break;
        }
        const start = i;
        let quote = null;
        let escaped = false;
        let parenDepth = 0;
        for (; i < body.length; i++) {
            const ch = body[i];
            if (quote) {
                if (escaped) {
                    escaped = false;
                } else if (ch === "\\") {
                    escaped = true;
                } else if (ch === quote) {
                    quote = null;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }
            if (ch === "(") {
                parenDepth++;
            } else if (ch === ")") {
                parenDepth--;
            } else if (ch === ";" && parenDepth === 0) {
                members.push(body.slice(start, i + 1));
                i++;
                break;
            } else if (ch === "{" && parenDepth === 0) {
                const end = findMatching(body, i);
                members.push(body.slice(start, end + 1));
                i = end + 1;
                break;
            }
        }
    }
    return members;
}

function gatherMeta() {
    for (const className of classNames) {
        if (className === "AppletGameContainer2" || className === "ScalableGame2") {
            metaByClass.set(className, {
                name: className,
                extendsName: null,
                headerPrefix: "",
                fields: new Set(),
                staticFields: new Set(),
                methods: new Set(),
                staticMethods: new Set()
            });
            continue;
        }
        const parsed = parseClass(sourceByClass.get(className), className);
        const fields = new Set();
        const staticFields = new Set();
        const methods = new Set();
        const staticMethods = new Set();
        const members = splitTopLevelMembers(parsed.body);
        for (const member of members) {
            const compact = member.replace(/\s+/g, " ").trim();
            if (!compact) {
                continue;
            }
            const beforeEquals = compact.includes("=") ? compact.slice(0, compact.indexOf("=")) : compact;
            const isMethod = beforeEquals.includes("(") && (compact.endsWith("}") || compact.endsWith(";"));
            if (isMethod) {
                const nameMatch = compact.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
                if (nameMatch) {
                    const name = nameMatch[1];
                    if (name !== className) {
                        if (/\bstatic\b/.test(compact)) {
                            staticMethods.add(name);
                        } else {
                            methods.add(name);
                        }
                    }
                }
                continue;
            }
            const fieldMatch = compact.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:=[\s\S]*)?;$/);
            if (fieldMatch) {
                const beforeName = compact.slice(0, fieldMatch.index);
                const name = fieldMatch[1];
                if (/\bstatic\b/.test(beforeName)) {
                    staticFields.add(name);
                } else {
                    fields.add(name);
                }
            }
        }
        metaByClass.set(className, {
            name: parsed.name,
            extendsName: parsed.extendsName,
            headerPrefix: parsed.headerPrefix,
            fields,
            staticFields,
            methods,
            staticMethods
        });
    }
}

function convertType(type) {
    let value = type
        .replace(/\bfinal\b/g, "")
        .replace(/\bstatic\b/g, "")
        .replace(/\bpublic\b|\bprivate\b|\bprotected\b/g, "")
        .trim();
    value = value.replace(/\s+/g, " ");
    value = value.replace(/<\s*/g, "<").replace(/\s*>/g, ">");
    if (value.startsWith("ArrayList<")) {
        const inner = value.slice("ArrayList<".length, -1);
        return `${convertType(inner)}[]`;
    }
    const arraySuffix = (value.match(/\[\]/g) ?? []).length;
    value = value.replace(/\[\]/g, "");
    let base = value;
    switch (base) {
        case "int":
        case "float":
        case "double":
        case "long":
        case "short":
        case "byte":
        case "char":
            base = "number";
            break;
        case "boolean":
            base = "boolean";
            break;
        case "String":
            base = "string";
            break;
        case "Random":
            base = "JavaRandom";
            break;
        default:
            base = base.replace(/\?.*/, "").trim();
            break;
    }
    return `${base}${"[]".repeat(arraySuffix)}`;
}

function defaultExpression(tsType) {
    if (primitiveDefaults.has(tsType)) {
        return primitiveDefaults.get(tsType);
    }
    if (tsType.endsWith("[]")) {
        return "null";
    }
    return "null";
}

function arrayFactory(tsType) {
    const base = tsType.replace(/\[\]$/g, "");
    if (base === "number") {
        return "() => 0";
    }
    if (base === "boolean") {
        return "() => false";
    }
    if (base === "string") {
        return '() => ""';
    }
    return "() => null";
}

function convertNewArray(expr) {
    return expr.replace(/new\s+([A-Za-z0-9_]+)\s*((?:\[[^\]]*\])+)/g, (_match, javaType, dimText) => {
        const dims = Array.from(dimText.matchAll(/\[([^\]]*)\]/g)).map((entry) => entry[1].trim());
        const tsType = convertType(javaType);
        const factory = arrayFactory(tsType);
        if (dims.length === 1) {
            return `makeArray<${tsType}>(${dims[0]}, ${factory})`;
        }
        if (dims.length === 2) {
            return `make2D<${tsType}>(${dims[0]}, ${dims[1]}, ${factory})`;
        }
        if (dims.length === 3) {
            return `make3D<${tsType}>(${dims[0]}, ${dims[1]}, ${dims[2]}, ${factory})`;
        }
        if (dims.length === 4) {
            return `make4D<${tsType}>(${dims[0]}, ${dims[1]}, ${dims[2]}, ${dims[3]}, ${factory})`;
        }
        return `makeArray<${tsType}>(${dims[0]}, ${factory})`;
    });
}

function convertCasts(expr) {
    let out = expr;
    let last;
    do {
        last = out;
        out = out.replace(/\(\s*int\s*\)\s*(Math\.[A-Za-z_][A-Za-z0-9_]*\([^)]*\))/g, "trunc($1)");
        out = out.replace(/\(\s*int\s*\)\s*\(([^()]+)\)/g, "trunc($1)");
        out = out.replace(/\(\s*float\s*\)\s*\(([^()]+)\)/g, "($1)");
        out = out.replace(/\(\s*double\s*\)\s*\(([^()]+)\)/g, "($1)");
        out = out.replace(/\(\s*int\s*\)\s*([A-Za-z_][A-Za-z0-9_$.]*)/g, "trunc($1)");
        out = out.replace(/\(\s*float\s*\)\s*([A-Za-z_][A-Za-z0-9_$.]*)/g, "$1");
        out = out.replace(/\(\s*double\s*\)\s*([A-Za-z_][A-Za-z0-9_$.]*)/g, "$1");
    } while (out !== last);
    return out;
}

function convertExpression(expr) {
    return convertCasts(convertNewArray(expr))
        .replace(/\bnew\s+ArrayList<([^>]+)>\s*\(\s*\)/g, "[]")
        .replace(/\bnew\s+JavaRandom\s*\(\s*\)/g, "new JavaRandom()")
        .replace(/\bvalue\s*\/=\s*10\b/g, "value = idiv(value, 10)")
        .replace(/\bSys\.getTimerResolution\(\)\s*\/\s*91\b/g, "idiv(Sys.getTimerResolution(), 91)");
}

function splitParams(paramsText) {
    const trimmed = paramsText.trim();
    if (!trimmed) {
        return [];
    }
    return trimmed
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

function convertParams(paramsText) {
    const paramNames = [];
    const converted = splitParams(paramsText).map((param) => {
        const clean = param.replace(/\bfinal\b/g, "").trim();
        const match = clean.match(/^(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (!match) {
            return clean;
        }
        const type = convertType(match[1]);
        const name = match[2];
        paramNames.push(name);
        return `${name}: ${type}`;
    });
    return {
        text: converted.join(", "),
        names: paramNames
    };
}

function collectLocals(body) {
    const locals = new Set();
    for (const match of body.matchAll(/\blet\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
        locals.add(match[1]);
    }
    for (const match of body.matchAll(/\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
        locals.add(match[1]);
    }
    for (const match of body.matchAll(/\bcatch\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) {
        locals.add(match[1]);
    }
    return locals;
}

function collectInherited(meta) {
    const instance = new Set([...meta.fields, ...meta.methods]);
    const statics = new Set([...meta.staticFields, ...meta.staticMethods]);
    let parent = meta.extendsName;
    while (parent && metaByClass.has(parent)) {
        const parentMeta = metaByClass.get(parent);
        for (const value of parentMeta.fields) {
            instance.add(value);
        }
        for (const value of parentMeta.methods) {
            instance.add(value);
        }
        parent = parentMeta.extendsName;
    }
    return { instance, statics };
}

function previousNonSpace(code, index) {
    for (let i = index - 1; i >= 0; i--) {
        if (!/\s/.test(code[i])) {
            return code[i];
        }
    }
    return "";
}

function nextNonSpace(code, index) {
    for (let i = index; i < code.length; i++) {
        if (!/\s/.test(code[i])) {
            return code[i];
        }
    }
    return "";
}

function prefixIdentifiers(code, meta, paramNames, options = {}) {
    const { instance, statics } = collectInherited(meta);
    const locals = new Set([...collectLocals(code), ...paramNames]);
    const className = meta.name;
    const skipInstance = options.staticMethod === true;
    let out = "";
    for (let i = 0; i < code.length;) {
        const ch = code[i];
        if (ch === '"' || ch === "'" || ch === "`") {
            const quote = ch;
            let j = i + 1;
            let escaped = false;
            while (j < code.length) {
                const c = code[j++];
                if (escaped) {
                    escaped = false;
                } else if (c === "\\") {
                    escaped = true;
                } else if (c === quote) {
                    break;
                }
            }
            out += code.slice(i, j);
            i = j;
            continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i + 1;
            while (j < code.length && /[A-Za-z0-9_]/.test(code[j])) {
                j++;
            }
            const token = code.slice(i, j);
            const prev = previousNonSpace(out, out.length);
            const next = nextNonSpace(code, j);
            const isProperty = prev === "." || prev === "#";
            const isDeclarationName = false;
            if (
                !isProperty &&
                !isDeclarationName &&
                !reserved.has(token) &&
                !classSet.has(token) &&
                !slickImports.includes(token) &&
                !helperImports.includes(token) &&
                !locals.has(token)
            ) {
                if (statics.has(token)) {
                    out += `${className}.${token}`;
                } else if (!skipInstance && instance.has(token)) {
                    out += `this.${token}`;
                } else {
                    out += token;
                }
            } else {
                out += token;
            }
            i = j;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

function convertLocalDeclarations(body) {
    let out = body;
    out = out.replace(
        /\bfor\s*\(\s*([A-Za-z0-9_<>\[\]]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^)]+)\)/g,
        (_match, _type, name, iterable) => `for (const ${name} of ${iterable})`
    );
    out = out.replace(/\bfor\s*\(\s*([A-Za-z0-9_<>\[\]]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g, (_match, type, name) => `for (let ${name}: ${convertType(type)} =`);
    out = out.replace(
        /^(\s*)(ArrayList<[^>]+>|[A-Za-z_][A-Za-z0-9_]*(?:<[^>]+>)?(?:\[\])*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/gm,
        (match, indent, type, name, expr) => {
            if (reserved.has(type) || type === "return" || type === "case") {
                return match;
            }
            return `${indent}let ${name}: ${convertType(type)} = ${convertExpression(expr)};`;
        }
    );
    out = out.replace(/^(\s*)(ArrayList<[^>]+>|[A-Za-z_][A-Za-z0-9_]*(?:<[^>]+>)?(?:\[\])*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/gm, (match, indent, type, name) => {
        if (reserved.has(type) || type === "return" || type === "case") {
            return match;
        }
        return `${indent}let ${name}: ${convertType(type)};`;
    });
    out = out.replace(/\bcatch\s*\(\s*(?:Throwable|Exception|Error)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\)/g, "catch ($1)");
    out = out.replace(/\b([A-Za-z0-9_$.]+)\.toArray\(([^)]+)\);/g, "$2 = $1.slice();");
    return convertExpression(out);
}

function convertField(member, meta) {
    const compact = member.replace(/\s+/g, " ").trim();
    const match = compact.match(/^(public|private|protected)?\s*(static\s+)?(final\s+)?(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*([\s\S]*))?;$/);
    if (!match) {
        return `    // TODO: Unconverted field: ${compact}\n`;
    }
    const access = match[1] ?? "public";
    const isStatic = !!match[2];
    const isFinal = !!match[3];
    const type = convertType(match[4]);
    const name = match[5];
    const initRaw = match[6]?.trim();
    let init = initRaw ? convertExpression(initRaw) : defaultExpression(type);
    if (!isStatic) {
        init = prefixIdentifiers(init, meta, [], { fieldInitializer: true });
    } else {
        init = prefixIdentifiers(init, meta, [], { staticMethod: true, fieldInitializer: true });
    }
    const staticText = isStatic ? " static" : "";
    const readonlyText = isFinal ? " readonly" : "";
    return `    ${access}${staticText}${readonlyText} ${name}: ${type} = ${init};\n`;
}

function convertAbstractMethod(member, meta) {
    const compact = member
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s+throws\s+[^;]+/, "");
    const match = compact.match(/^(public|private|protected)?\s*abstract\s+(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\);$/);
    if (!match) {
        return `    // TODO: Unconverted abstract method: ${compact}\n`;
    }
    const access = match[1] ?? "public";
    const returnType = convertType(match[2]) === "void" ? "void" : convertType(match[2]);
    const params = convertParams(match[4]);
    return `    ${access} abstract ${match[3]}(${params.text}): ${returnType};\n`;
}

function convertMethod(member, meta) {
    const headerEnd = member.indexOf("{");
    let header = member.slice(0, headerEnd).replace(/\s+/g, " ").trim();
    let body = member.slice(headerEnd + 1, -1);
    header = header.replace(/\s+throws\s+[A-Za-z0-9_.,\s]+$/, "");
    const ctorRe = new RegExp(`^(public|private|protected)?\\s*${meta.name}\\s*\\((.*)\\)$`);
    const ctorMatch = header.match(ctorRe);
    if (ctorMatch) {
        const params = convertParams(ctorMatch[2]);
        body = convertLocalDeclarations(body);
        body = prefixIdentifiers(body, meta, params.names);
        return `    public constructor(${params.text}) {${body}\n    }\n`;
    }
    const match = header.match(/^(public|private|protected)?\s*(static\s+)?(final\s+)?(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/);
    if (!match) {
        return `    // TODO: Unconverted method: ${header}\n`;
    }
    const access = match[1] ?? "public";
    const isStatic = !!match[2];
    const returnType = convertType(match[4]) === "void" ? "void" : convertType(match[4]);
    const name = match[5];
    const params = convertParams(match[6]);
    body = convertLocalDeclarations(body);
    body = prefixIdentifiers(body, meta, params.names, { staticMethod: isStatic });
    const staticText = isStatic ? " static" : "";
    return `    ${access}${staticText} ${name}(${params.text}): ${returnType} {${body}\n    }\n`;
}

function importsFor(className) {
    const locals = classNames
        .filter((name) => name !== className)
        .map((name) => `import { ${name} } from "./${name}.js";`)
        .join("\n");
    return [`import { ${slickImports.join(", ")} } from "slick2d-ts";`, `import { ${helperImports.join(", ")} } from "./JavaMath.js";`, locals]
        .filter(Boolean)
        .join("\n");
}

function convertClass(className) {
    if (className === "AppletGameContainer2") {
        return appletStub();
    }
    if (className === "ScalableGame2") {
        return scalableStub();
    }
    const parsed = parseClass(sourceByClass.get(className), className);
    const meta = metaByClass.get(className);
    const members = splitTopLevelMembers(parsed.body);
    const classHeader = `export ${parsed.headerPrefix}class ${className}${parsed.extendsName ? ` extends ${parsed.extendsName}` : ""}`;
    let out = `${importsFor(className)}\n\n${classHeader} {\n`;
    const convertedConstructors = [];
    for (const member of members) {
        const compact = member.replace(/\s+/g, " ").trim();
        if (!compact) {
            continue;
        }
        const beforeEquals = compact.includes("=") ? compact.slice(0, compact.indexOf("=")) : compact;
        if (beforeEquals.includes("(") && compact.endsWith(";")) {
            out += convertAbstractMethod(member, meta);
        } else if (beforeEquals.includes("(") && compact.endsWith("}")) {
            const converted = convertMethod(member, meta);
            if (converted.includes("constructor(")) {
                convertedConstructors.push(converted);
                if (convertedConstructors.length === 1) {
                    out += converted;
                }
            } else {
                out += converted;
            }
        } else {
            out += convertField(member, meta);
        }
    }
    out += "}\n";
    out = postProcessClass(className, out);
    return out;
}

function appletStub() {
    return `import { GameContainer, SlickException } from "slick2d-ts";

export class AppletGameContainer2 {
    public getContainer(): GameContainer {
        throw new SlickException("AppletGameContainer2 is not available in the browser PWA shell.");
    }
}
`;
}

function scalableStub() {
    return `import { Game, ScalableGame2 as SlickScalableGame2 } from "slick2d-ts";

export class ScalableGame2 extends SlickScalableGame2 {
    public constructor(held: Game, normalWidth: number, normalHeight: number, maintainAspect: boolean = true) {
        super(held, normalWidth, normalHeight, maintainAspect);
    }
}
`;
}

function replaceThingConstructor(out) {
    return out.replace(
        /public constructor\(main: Main\) \{[\s\S]*?\n    \}/,
        `public constructor(main: Main, a?: number, b?: number, c?: number, d?: number) {
        this.main = main;
        if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
            this.rx1 = a;
            this.ry1 = b;
            this.rx2 = a + c - 1;
            this.ry2 = b + d - 1;
        } else if (a !== undefined && b !== undefined) {
            this.rx2 = a - 1;
            this.ry2 = b - 1;
        }
    }`
    );
}

function postProcessClass(className, out) {
    out = out
        .replace(/\bthis\.super\(/g, "super(")
        .replace(/\(float\)/g, "")
        .replace(/\(double\)/g, "")
        .replace(/\(int\)\(([^;\n]+)\)/g, "trunc($1)")
        .replace(/\bthis\.console\./g, "console.")
        .replace(/\bthis\.Math\./g, "Math.")
        .replace(/\bthis\.String\./g, "String.")
        .replace(/\bthis\.Array\./g, "Array.")
        .replace(/\bthis\.ResourceLoader\./g, "ResourceLoader.")
        .replace(/\bthis\.Sys\./g, "Sys.")
        .replace(/\bthis\.Display\./g, "Display.")
        .replace(/\bthis\.Mouse\./g, "Mouse.")
        .replace(/\bthis\.CursorLoader\./g, "CursorLoader.")
        .replace(/\bthis\.BufferUtils\./g, "BufferUtils.")
        .replace(/\bthis\.SoundStore\./g, "SoundStore.")
        .replace(/\bthis\.FastTrig\./g, "FastTrig.")
        .replace(/\bthis\.Log\./g, "Log.")
        .replace(/\b([A-Za-z0-9_$.]+)\.toArray\(([^)]+)\);/g, "$2 = $1.slice();")
        .replace(/\bthis\.idiv\(/g, "idiv(")
        .replace(/\bthis\.trunc\(/g, "trunc(")
        .replace(/\bthis\.cc\(/g, "cc(")
        .replace(/\bthis\.chr\(/g, "chr(");
    if (className === "Thing") {
        out = replaceThingConstructor(out);
    }
    if (className === "ThingStack") {
        out = thingStackManual();
    }
    if (className === "Song") {
        out = songManual();
    }
    if (className === "Spark") {
        out = sparkManual();
    }
    if (className === "DraculaBat") {
        out = draculaBatManual();
    }
    if (className === "Dracula" || className === "Frankenstein") {
        out = out.replace(/\bMain\.GRAVITY\b/g, "0.21");
    }
    if (className === "MermanSpawner") {
        out = out.replace(/\bprivate vy: number = 0;/, "public vy: number = 0;");
    }
    if (className === "Main") {
        out = postProcessMain(out);
    }
    return out;
}

function replaceBetween(source, startNeedle, endNeedle, replacement) {
    const start = source.indexOf(startNeedle);
    if (start < 0) {
        throw new Error(`Unable to find replacement start: ${startNeedle}`);
    }
    const end = source.indexOf(endNeedle, start);
    if (end < 0) {
        throw new Error(`Unable to find replacement end: ${endNeedle}`);
    }
    return source.slice(0, start) + replacement + source.slice(end + endNeedle.length);
}

function songManual() {
    return `import { Music } from "slick2d-ts";

export class Song {
    private intro: Music = null;
    private loop: Music = null;
    private playing = false;

    public constructor(intro: string | null, loop?: string) {
        if (loop === undefined) {
            this.intro = new Music(intro as string);
            return;
        }
        if (intro !== null) {
            this.intro = new Music(intro);
        }
        this.loop = new Music(loop);
    }

    public stop(): void {
        if (this.intro !== null && this.intro.playing()) {
            this.intro.stop();
        }
        if (this.loop !== null && this.loop.playing()) {
            this.loop.stop();
        }
        this.playing = false;
    }

    public play(): void {
        if (this.playing) {
            return;
        }
        this.stop();
        if (this.intro === null) {
            this.loop.loop();
        } else {
            this.intro.play();
        }
        this.playing = true;
    }

    public update(): void {
        if (this.playing) {
            if ((this.intro === null || !this.intro.playing())
                    && this.loop !== null && !this.loop.playing()) {
                this.loop.loop();
            }
        }
    }
}
`;
}

function sparkManual() {
    return `${importsFor("Spark")}

export class Spark extends Thing {
    private counter = 0;

    public constructor(main: Main, xOrThing: number | Thing, y?: number, width?: number, height?: number) {
        super(main, 32, 32);
        if (xOrThing instanceof Thing) {
            const thingThatSparked = xOrThing;
            const sparkWidth = thingThatSparked.rx2 - thingThatSparked.rx1 + 1;
            const sparkHeight = thingThatSparked.ry2 - thingThatSparked.ry1 + 1;
            this.x = thingThatSparked.x + thingThatSparked.rx1 + main.random.nextInt(sparkWidth) - 16;
            this.y = thingThatSparked.y + thingThatSparked.ry1 + main.random.nextInt(sparkHeight) - 16;
        } else {
            this.x = xOrThing + main.random.nextInt(width as number) - 16;
            this.y = (y as number) + main.random.nextInt(height as number) - 16;
        }
    }

    public update(_gc: GameContainer): boolean {
        if (++this.counter === 10) {
            return false;
        }
        return true;
    }

    public render(_gc: GameContainer, _g: Graphics): void {
        this.main.draw(this.main.spark, this.x, this.y);
    }
}
`;
}

function thingStackManual() {
    return `import { makeArray } from "./JavaMath.js";
import { Thing } from "./Thing.js";

export class ThingStack {
    public things: Thing[] = makeArray<Thing>(32, () => null);
    public top: number = -1;

    public push(thing: Thing): void {
        this.top++;
        if (this.top === this.things.length) {
            const things2: Thing[] = makeArray<Thing>(this.things.length + 16, () => null);
            for (let i = 0; i < this.things.length; i++) {
                things2[i] = this.things[i];
            }
            this.things = things2;
        }
        this.things[this.top] = thing;
    }

    public pop(): Thing {
        if (this.top === -1) {
            return null;
        }
        const thing: Thing = this.things[this.top];
        this.things[this.top] = null;
        this.top--;
        return thing;
    }

    public clear(): void {
        while (this.pop() !== null) {
        }
    }

    public moveAll(thingStack: ThingStack): void {
        let thing: Thing = null;
        while ((thing = thingStack.pop()) !== null) {
            this.push(thing);
        }
    }

    public addAll(thingStack: ThingStack): void {
        const stackThings: Thing[] = thingStack.things;
        for (let i: number = thingStack.top; i >= 0; i--) {
            this.push(stackThings[i]);
        }
    }
}
`;
}

function draculaBatManual() {
    return `${importsFor("DraculaBat")}

export class DraculaBat extends Thing {
    private static readonly spriteSequence: number[] = [1, 2, 3, 2];
    public direction: number = 0;
    private spriteIndex: number = 0;
    private spriteDelay: number = 0;
    public amplitude: number = 0;
    public Y: number = 0;

    public constructor(main: Main) {
        super(main, 32, 32);
        this.spriteDelay = main.random.nextInt(11);
        this.spriteIndex = main.random.nextInt(4);
    }

    public update(_gc: GameContainer): boolean {
        if (this.spriteDelay === 0) {
            this.spriteDelay = 10;
            if (this.spriteIndex === 0) {
                this.spriteIndex = 3;
            } else {
                this.spriteIndex--;
            }
        } else {
            this.spriteDelay--;
        }

        return true;
    }

    public render(_gc: GameContainer, _g: Graphics, fade?: number): void {
        const image = this.main.bats[this.direction][DraculaBat.spriteSequence[this.spriteIndex]];
        if (fade === undefined) {
            this.main.draw(image, this.x, this.y);
        } else {
            this.main.drawFaded(image, this.x, this.y, fade);
        }
    }
}
`;
}

function postProcessMain(out) {
    out = out
        .replace(
            /public constructor\(\) \{[\s\S]*?\n    \}\n    public init/,
            `public constructor() {
        super("Stickvania");
        for (let i = 0; i < 3; i++) {
            this.demoKeyRecordings[i] = readBinaryResource("recordings/demo_" + (i + 1) + ".dat");
        }
        for (let i = 0; i < 12; i++) {
            this.endingKeyRecordings[i] = readBinaryResource("recordings/ending_" + (i + 1) + ".dat");
        }
    }
    public init`
        )
        .replace(/\(255 \* i\) \/ this\.fades\.length/g, "idiv(255 * i, this.fades.length)")
        .replace(/\bthis\.loadedSegments = make2D<StageSegment>\(6, 0, \(\) => null\);/g, "this.loadedSegments = makeArray<StageSegment[]>(6, () => []);")
        .replace(/\blet buffer: ByteBuffer = BufferUtils\.createByteBuffer/g, "let buffer: Uint8Array = BufferUtils.createByteBuffer")
        .replace(/\bthis\.appletGameContainer\.getContainer\(\)\.setDisplayMode\(true\);/g, "this.appletGameContainer.getContainer().setFullscreen(true);")
        .replace(/\bInteger\.MAX_VALUE\b/g, "Number.MAX_SAFE_INTEGER")
        .replace(/\bthis\.update\(gc\);/g, "this.updateFrame(gc);")
        .replace(/\bprivate update\(gc: GameContainer\): void/g, "private updateFrame(gc: GameContainer): void")
        .replace(
            /public draw\(image: Image, x: number, y: number, angle: number\): void \{([\s\S]*?)\n    \}\n    public draw\(image: Image, x: number, y: number\): void \{([\s\S]*?)\n    \}/,
            `public draw(image: Image, x: number, y: number, angle?: number): void {
        if (angle !== undefined) {$1
            return;
        }$2
    }`
        )
        .replace(
            /public static main\(args: string\[\]\): void \{[\s\S]*?\n    \}\n/,
            `public static main(_args: string[]): void {
        throw new Error("Use the PWA bootstrap in src/main.ts instead of Main.main().");
    }\n`
        );
    out = out
        .replace(
            /\bcase (MODE_[A-Z0-9_]+|FADE_[A-Z0-9_]+|FADE_REASON_[A-Z0-9_]+|CANDLE_ITEM_[A-Z0-9_]+|TILE_[A-Z0-9_]+|WEAPON_[A-Z0-9_]+|BLOCK_[A-Z0-9_]+|WALL_[A-Z0-9_]+|WHIP_[A-Z0-9_]+):/g,
            "case Main.$1:"
        )
        .replace(/\bpublic title: Image = null;/g, "public titleImage: Image = null;")
        .replace(/\bthis\.title\b/g, "this.titleImage")
        .replace(/\bpublic killAll: boolean = false;/g, "public killAllFlag: boolean = false;")
        .replace(/\bthis\.killAll\b(?!\s*\()/g, "this.killAllFlag")
        .replace(/\bpublic beatStage: boolean = false;/g, "public beatStageFlag: boolean = false;")
        .replace(/\bthis\.beatStage\b(?!\s*\()/g, "this.beatStageFlag")
        .replace(/\bthis\.CREDITS([234])\b/g, "Main.CREDITS$1")
        .replace(/\bthis\.stageNumbers\b/g, "Main.stageNumbers")
        .replace(/\bthis\.whipSizes\b/g, "Main.whipSizes")
        .replace(/\bthis\.whipOffsets\b/g, "Main.whipOffsets")
        .replace(/\bthis\.mapBats\b/g, "Main.mapBats")
        .replace(/\bthis\.titleBatSequence\b/g, "Main.titleBatSequence");
    out = replaceBetween(out, "    private loadStageSegment", "    private drawNumber", `${manualLoadStageSegment()}\n\n    private drawNumber`);
    out = replaceBetween(out, "    public addPoints(dropItem: DropItem): void", "    public hurtSimon", `${manualAddPoints()}\n    public hurtSimon`);
    out = replaceBetween(out, "    private drawString(string: string, x: number, y: number", "    public getWall", `${manualDrawString()}\n    public getWall`);
    out = replaceBetween(out, "    public pushWeapon", "    public removeBlock", `${manualPushThings()}\n    public removeBlock`);
    out = replaceBetween(
        out,
        "    public intersectsWeapon",
        "    private static readonly credits",
        `${manualIntersections()}\n    private static readonly credits`
    );
    return out;
}

function manualLoadStageSegment() {
    return `private loadStageSegment(a: number, b: number): void {
        this.loadedSegments[a][b] = new StageSegment();
        this.loadedSegments[a][b].stageSegmentIndex = b;

        const fileName = "stages/stage_" + a + "_" + b + ".txt";
        const lines = readResourceLines(fileName);
        let index = 0;
        this.loadedSegments[a][b].direction = lines[index].trim().charCodeAt(0) === cc("l")
            ? Main.LEFT : Main.RIGHT;
        index++;
        this.loadedSegments[a][b].candleItems = lines[index].trim();
        index += 2;

        const level: string[] = [];
        for (; index < lines.length; index++) {
            const line = lines[index];
            if (line.trim().length === 0) {
                continue;
            }
            level.push(line);
        }

        this.loadedSegments[a][b].stage = make2D<number>(11, idiv(level.length, 11) << 4, () => 0);

        let x = 0;
        let y = 0;
        for (let i = 0; i < level.length; i++) {
            const line = level[i];
            for (let j = 0; j < 16; j++) {
                this.loadedSegments[a][b].stage[y][j + x] = line.charCodeAt(j);
            }
            if (++y === 11) {
                y = 0;
                x += 16;
            }
        }
    }`;
}

function manualDrawString() {
    return `    private drawString(string: string, x: number, y: number, length: number = string.length): void {
        for (let i: number = 0; i < string.length && i < length; i++, x += 16) {
            this.symbols[string.charCodeAt(i)].draw(x, y);
        }
    }`;
}

function manualAddPoints() {
    return `    public addPoints(dropItemOrPoints: DropItem | number): void {
        if (dropItemOrPoints instanceof DropItem) {
            const dropItem = dropItemOrPoints;
            switch (dropItem.type) {
                case DropItem.TYPE_MONEY_BAG:
                    switch (this.random.nextInt(3)) {
                        case 0:
                            this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_100));
                            this.addPoints(100);
                            break;
                        case 1:
                            this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_400));
                            this.addPoints(400);
                            break;
                        case 2:
                            this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_700));
                            this.addPoints(700);
                            break;
                    }
                    break;
                case DropItem.TYPE_CHEST:
                    this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_1000));
                    this.addPoints(1000);
                    break;
                case DropItem.TYPE_CROWN:
                    this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_2000));
                    this.addPoints(2000);
                    break;
            }
            return;
        }

        const points = dropItemOrPoints;
        const bucket1: number = idiv(this.score + 20000, 50000);
        this.score += points;
        const bucket2: number = idiv(this.score + 20000, 50000);
        if (bucket1 !== bucket2) {
            this.addPlayers(1);
        }
    }`;
}

function manualPushThings() {
    return `    public pushWeapon(weapon: Thing): void {
        this.weaponsStack.push(weapon);
    }

    public pushThing(thingStacks: ThingStack[], thing: Thing): void;
    public pushThing(thing: Thing): void;
    public pushThing(thingOrStacks: ThingStack[] | Thing, maybeThing?: Thing): void {
        if (Array.isArray(thingOrStacks)) {
            const thingStacks = thingOrStacks;
            const thing = maybeThing;
            if (thing === null || thing === undefined) {
                return;
            }
            let index: number = trunc(thing.x) >> 8;
            if (index < 0) {
                index = 0;
            } else if (index >= thingStacks.length) {
                index = thingStacks.length - 1;
            }
            thingStacks[index].push(thing);
            return;
        }
        this.regionThingStack.push(thingOrStacks);
    }`;
}

function manualIntersections() {
    return `    public intersectsWeapon(thingOrX1: Thing | number, y1?: number, x2?: number, y2?: number): boolean {
        if (thingOrX1 instanceof Thing) {
            const thing = thingOrX1;
            return this.intersectsWeapon(
                thing.rx1 + trunc(thing.x),
                thing.ry1 + trunc(thing.y),
                thing.rx2 + trunc(thing.x),
                thing.ry2 + trunc(thing.y));
        }

        const x1 = thingOrX1;
        if (this.playerPower === 0) {
            return false;
        }
        const weapons: Thing[] = this.weaponsStack.things;
        for (let j: number = this.weaponsStack.top; j >= 0; j--) {
            const weapon: Thing = weapons[j];
            if (this.intersects(
                    weapon.rx1 + trunc(weapon.x),
                    weapon.ry1 + trunc(weapon.y),
                    weapon.rx2 + trunc(weapon.x),
                    weapon.ry2 + trunc(weapon.y),
                    x1, y1 as number, x2 as number, y2 as number)) {
                weapon.intersected = true;
                return true;
            }
        }
        return false;
    }

    public intersectsWhip(thingOrX1: Thing | number, y1?: number, x2?: number, y2?: number): boolean {
        if (thingOrX1 instanceof Thing) {
            const thing = thingOrX1;
            return this.intersectsWhip(
                thing.rx1 + trunc(thing.x),
                thing.ry1 + trunc(thing.y),
                thing.rx2 + trunc(thing.x),
                thing.ry2 + trunc(thing.y));
        }

        const x1 = thingOrX1;
        if (!this.simon.whipping || this.simon.whipIndex !== 2 || this.simon.throwing
                || this.playerPower === 0) {
            return false;
        }

        const whipSize: number[] = Main.whipSizes[this.simon.whipType];
        const whipOffset: number[] = Main.whipOffsets[this.simon.whipType][this.simon.direction];
        let p: number[] = null;
        if (this.simon.onStairs) {
            if (this.simon.up) {
                p = Simon.upWhipTable[this.simon.whipType][2][this.simon.direction];
            } else {
                p = Simon.downWhipTable[this.simon.whipType][2][this.simon.direction];
            }
        } else if (this.simon.kneeling) {
            p = Simon.kneelingWhipTable[this.simon.whipType][2][this.simon.direction];
        } else {
            p = Simon.standingWhipTable[this.simon.whipType][2][this.simon.direction];
        }

        const lastX: number = trunc(this.simon.lastX);
        const lastY: number = trunc(this.simon.lastY);
        const x: number = trunc(this.simon.x);
        const y: number = trunc(this.simon.y);

        const wx1: number = whipOffset[0] + p[0];
        const wy1: number = whipOffset[1] + p[1];

        const ax1: number = lastX + wx1;
        const ay1: number = lastY + wy1;
        const ax2: number = ax1 + whipSize[0];
        const ay2: number = ay1 + whipSize[1];

        const bx1: number = x + wx1;
        const by1: number = y + wy1;
        const bx2: number = bx1 + whipSize[0];
        const by2: number = by1 + whipSize[1];

        let rx1: number = Math.min(ax1, bx1);
        const ry1: number = Math.min(ay1, by1);
        let rx2: number = Math.max(ax2, bx2);
        const ry2: number = Math.max(ay2, by2);

        if (this.simon.direction === Main.LEFT) {
            rx2 += 16;
        } else {
            rx1 -= 16;
        }

        return this.intersects(rx1, ry1, rx2, ry2, x1, y1 as number, x2 as number, y2 as number);
    }

    public intersectsSimon(thingOrX1: Thing | number, y1?: number, x2?: number, y2?: number): boolean {
        if (thingOrX1 instanceof Thing) {
            const thing = thingOrX1;
            const x: number = trunc(thing.x);
            const y: number = trunc(thing.y);
            return this.intersectsSimon(
                x + thing.rx1, y + thing.ry1, x + thing.rx2, y + thing.ry2);
        }

        const x1 = thingOrX1;
        if (this.playerPower === 0) {
            return false;
        }
        return this.intersects(
            trunc(this.simon.x) + this.simon.rx1, trunc(this.simon.y) + this.simon.ry1,
            trunc(this.simon.x) + this.simon.rx2, trunc(this.simon.y) + this.simon.ry2,
            x1, y1 as number, x2 as number, y2 as number);
    }

    public intersects(thing1: Thing, thing2: Thing): boolean;
    public intersects(ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number): boolean;
    public intersects(first: Thing | number, second: Thing | number, third?: number, fourth?: number, fifth?: number, sixth?: number, seventh?: number, eighth?: number): boolean {
        if (first instanceof Thing && second instanceof Thing) {
            const thing1 = first;
            const thing2 = second;
            const x1: number = trunc(thing1.x);
            const x2: number = trunc(thing2.x);
            const y1: number = trunc(thing1.y);
            const y2: number = trunc(thing2.y);
            return this.intersects(
                x1 + thing1.rx1, y1 + thing1.ry1, x1 + thing1.rx2, y1 + thing1.ry2,
                x2 + thing2.rx1, y2 + thing2.ry1, x2 + thing2.rx2, y2 + thing2.ry2);
        }

        const ax1 = first as number;
        const ay1 = second as number;
        const ax2 = third as number;
        const ay2 = fourth as number;
        const bx1 = fifth as number;
        const by1 = sixth as number;
        const bx2 = seventh as number;
        const by2 = eighth as number;
        return ax2 >= bx1 && ax1 <= bx2 && ay2 >= by1 && ay1 <= by2;
    }`;
}

function writeGenerated() {
    const javaMath = readFileSync("pwa/src/stickvania/JavaMath.ts", "utf8");
    rmSync(outRoot, { recursive: true, force: true });
    mkdirSync(outRoot, { recursive: true });
    writeFileSync(join(outRoot, "JavaMath.ts"), javaMath);
    for (const className of classNames) {
        writeFileSync(join(outRoot, `${className}.ts`), convertClass(className));
    }
}

gatherMeta();
writeGenerated();
