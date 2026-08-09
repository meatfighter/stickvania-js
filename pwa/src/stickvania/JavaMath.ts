import { ResourceLoader } from "slick2d-ts";

export function toInt(value: number): number {
    return value | 0;
}

export function trunc(value: number): number {
    return Math.trunc(value);
}

export function idiv(a: number, b: number): number {
    return Math.trunc(a / b);
}

export function irem(a: number, b: number): number {
    return toInt(a) % toInt(b);
}

export function cc(value: string): number {
    return value.charCodeAt(0);
}

export function chr(value: number): string {
    return String.fromCharCode(value);
}

export function makeArray<T>(length: number, factory: () => T): T[] {
    const result = new Array<T>(length);
    for (let i = 0; i < length; i++) {
        result[i] = factory();
    }
    return result;
}

export function make2D<T>(rows: number, columns: number, factory: () => T): T[][] {
    return makeArray(rows, () => makeArray(columns, factory));
}

export function make3D<T>(a: number, b: number, c: number, factory: () => T): T[][][] {
    return makeArray(a, () => make2D(b, c, factory));
}

export function make4D<T>(a: number, b: number, c: number, d: number, factory: () => T): T[][][][] {
    return makeArray(a, () => make3D(b, c, d, factory));
}

export function defaultValueForType(typeName: string): () => unknown {
    switch (typeName) {
        case "number":
            return () => 0;
        case "boolean":
            return () => false;
        default:
            return () => null;
    }
}

export function readBinaryResource(ref: string): number[] {
    const bytes = ResourceLoader.getResourceAsStream(ref);
    if (!bytes) {
        throw new Error(`Resource not loaded: ${ref}`);
    }
    return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

export function readTextResource(ref: string): string {
    const bytes = ResourceLoader.getResourceAsStream(ref);
    if (!bytes) {
        throw new Error(`Resource not loaded: ${ref}`);
    }
    return new TextDecoder().decode(bytes);
}

export function readResourceLines(ref: string): string[] {
    return readTextResource(ref).split(/\r?\n/g);
}
