import { ResourceLoader } from "slick2d-ts";

/** Reproduces a Java float conversion without allocating a wrapper object. */
export const javaFloat: (value: number) => number = Math.fround;

const JAVA_INT_MIN = -0x80000000;
const JAVA_INT_MAX = 0x7fffffff;

/** Reproduces Java's floating-point-to-int narrowing conversion. */
export function toInt(value: number): number {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value <= JAVA_INT_MIN) {
        return JAVA_INT_MIN;
    }
    if (value >= JAVA_INT_MAX) {
        return JAVA_INT_MAX;
    }
    const result = Math.trunc(value);
    return result === 0 ? 0 : result;
}

/** Alias used at translated Java `(int)` cast sites. */
export function trunc(value: number): number {
    return toInt(value);
}

/** Reproduces Java int division, including the MIN_VALUE / -1 overflow case. */
export function idiv(a: number, b: number): number {
    const dividend = toInt(a);
    const divisor = toInt(b);
    if (divisor === 0) {
        throw new RangeError("Java integer division by zero");
    }
    if (dividend === JAVA_INT_MIN && divisor === -1) {
        return JAVA_INT_MIN;
    }
    return toInt(dividend / divisor);
}

/** Reproduces Java int remainder. */
export function irem(a: number, b: number): number {
    const dividend = toInt(a);
    const divisor = toInt(b);
    if (divisor === 0) {
        throw new RangeError("Java integer division by zero");
    }
    const result = dividend % divisor;
    return result === 0 ? 0 : result;
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
