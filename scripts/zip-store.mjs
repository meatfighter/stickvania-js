import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const CRC32_TABLE = createCrc32Table();

export function createStoredZipFromDirectory(sourceDirectory, zipPath, getEntryMode = defaultEntryMode) {
    const files = collectFiles(sourceDirectory)
        .map((filePath) => ({
            filePath,
            name: relative(sourceDirectory, filePath).replaceAll("\\", "/")
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const chunks = [];
    const centralDirectoryChunks = [];
    let offset = 0;

    for (const file of files) {
        const data = readFileSync(file.filePath);
        const name = Buffer.from(file.name, "utf8");
        const crc = crc32(data);
        const dosDateTime = getDosDateTime(lstatSync(file.filePath).mtime);
        const localHeader = Buffer.alloc(30);

        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(10, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosDateTime.time, 10);
        localHeader.writeUInt16LE(dosDateTime.date, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(data.length, 18);
        localHeader.writeUInt32LE(data.length, 22);
        localHeader.writeUInt16LE(name.length, 26);
        localHeader.writeUInt16LE(0, 28);

        chunks.push(localHeader, name, data);
        centralDirectoryChunks.push(createCentralDirectoryHeader(file.name, name, crc, data.length, dosDateTime, getEntryMode(file.name), offset));
        offset += localHeader.length + name.length + data.length;
    }

    const centralDirectoryOffset = offset;
    for (const chunk of centralDirectoryChunks) {
        chunks.push(chunk);
        offset += chunk.length;
    }

    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(centralDirectoryChunks.length, 8);
    endOfCentralDirectory.writeUInt16LE(centralDirectoryChunks.length, 10);
    endOfCentralDirectory.writeUInt32LE(offset - centralDirectoryOffset, 12);
    endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);
    chunks.push(endOfCentralDirectory);

    writeFileSync(zipPath, Buffer.concat(chunks));
}

export function readZipCentralDirectory(zipPath) {
    const data = readFileSync(zipPath);
    const endOfCentralDirectoryOffset = findEndOfCentralDirectory(data);
    const entryCount = data.readUInt16LE(endOfCentralDirectoryOffset + 10);
    const centralDirectoryOffset = data.readUInt32LE(endOfCentralDirectoryOffset + 16);
    const entries = new Map();
    let offset = centralDirectoryOffset;

    for (let i = 0; i < entryCount; i++) {
        if (data.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error(`Invalid ZIP central directory entry in ${zipPath}`);
        }

        const compressedSize = data.readUInt32LE(offset + 20);
        const uncompressedSize = data.readUInt32LE(offset + 24);
        const fileNameLength = data.readUInt16LE(offset + 28);
        const extraLength = data.readUInt16LE(offset + 30);
        const commentLength = data.readUInt16LE(offset + 32);
        const externalAttributes = data.readUInt32LE(offset + 38);
        const nameStart = offset + 46;
        const name = data.subarray(nameStart, nameStart + fileNameLength).toString("utf8");

        entries.set(name, {
            compressedSize,
            externalAttributes,
            mode: (externalAttributes >>> 16) & 0xffff,
            uncompressedSize
        });

        offset = nameStart + fileNameLength + extraLength + commentLength;
    }

    return entries;
}

function collectFiles(directory, files = []) {
    const rootStat = lstatSync(directory);
    if (rootStat.isSymbolicLink()) {
        throw new Error(`ZIP source tree must not contain symbolic links or junctions: ${directory}`);
    }
    if (!rootStat.isDirectory()) {
        throw new Error(`ZIP source tree must be a directory: ${directory}`);
    }

    for (const entry of readdirSync(directory)) {
        const fullPath = join(directory, entry);
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
            throw new Error(`ZIP source tree must not contain symbolic links or junctions: ${fullPath}`);
        }
        if (stat.isDirectory()) {
            collectFiles(fullPath, files);
        } else if (stat.isFile()) {
            files.push(fullPath);
        } else {
            throw new Error(`ZIP source tree must not contain special filesystem entries: ${fullPath}`);
        }
    }
    return files;
}

function createCentralDirectoryHeader(nameText, name, crc, size, dosDateTime, mode, localHeaderOffset) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE((3 << 8) | 20, 4);
    header.writeUInt16LE(10, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(dosDateTime.time, 12);
    header.writeUInt16LE(dosDateTime.date, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(size, 20);
    header.writeUInt32LE(size, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE((mode << 16) >>> 0, 38);
    header.writeUInt32LE(localHeaderOffset, 42);
    return Buffer.concat([header, name]);
}

function defaultEntryMode(name) {
    return name.endsWith(".sh") ? 0o100755 : 0o100644;
}

function getDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    };
}

function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table() {
    const table = new Uint32Array(256);
    for (let i = 0; i < table.length; i++) {
        let value = i;
        for (let bit = 0; bit < 8; bit++) {
            value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[i] = value >>> 0;
    }
    return table;
}

function findEndOfCentralDirectory(data) {
    const minOffset = Math.max(0, data.length - 0xffff - 22);
    for (let offset = data.length - 22; offset >= minOffset; offset--) {
        if (data.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }
    throw new Error("Unable to find ZIP end of central directory.");
}
