import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkWindowsInstaller(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 0x40 || bytes.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`Not a Windows executable (missing MZ header): ${path}`);
  }

  const peOffset = bytes.readUInt32LE(0x3c);
  if (peOffset < 0x40 || peOffset + 26 > bytes.length ||
      bytes.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
    throw new Error(`Not a valid PE executable (missing PE header): ${path}`);
  }

  const optionalHeaderSize = bytes.readUInt16LE(peOffset + 20);
  const optionalHeaderOffset = peOffset + 24;
  if (optionalHeaderSize < 2 || optionalHeaderOffset + optionalHeaderSize > bytes.length ||
      ![0x10b, 0x20b].includes(bytes.readUInt16LE(optionalHeaderOffset))) {
    throw new Error(`Not a valid PE executable (invalid optional header): ${path}`);
  }

  return {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/check-windows-installer.mjs <installer.exe>");
    process.exitCode = 1;
  } else {
    try {
      const result = checkWindowsInstaller(path);
      console.log(`Valid PE executable: ${result.bytes} bytes, SHA-256 ${result.sha256}`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
