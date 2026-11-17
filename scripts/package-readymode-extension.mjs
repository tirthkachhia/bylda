import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "manifest.json",
  "background.js",
  "collector.js",
  "core.js",
  "importer.html",
  "importer.css",
  "importer.js",
  "README.md",
];
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Deterministic ZIP (stored entries), with no build dependencies or bundled credentials.
const parts = [],
  central = [];
let offset = 0;
for (const filename of files) {
  const bytes = await readFile(path.join(root, "extensions/readymode", filename));
  const name = Buffer.from(filename),
    crc = crc32(bytes);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(bytes.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(name.length, 26);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(33, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(bytes.length, 20);
  entry.writeUInt32LE(bytes.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  parts.push(local, name, bytes);
  central.push(entry, name);
  offset += local.length + name.length + bytes.length;
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
await mkdir(path.join(root, "public/downloads"), { recursive: true });
await writeFile(
  path.join(root, "public/downloads/bylda-readymode-extension.zip"),
  Buffer.concat([...parts, directory, end]),
);
console.log(`Packaged ReadyMode extension (${files.length} files).`);
