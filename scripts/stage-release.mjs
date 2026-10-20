import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("Usage: node scripts/stage-release.mjs X.Y.Z");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauri = JSON.parse(readFileSync(resolve(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
if (tauri.version !== version) {
  throw new Error(`Tauri version ${tauri.version} does not match ${version}`);
}

const target = resolve(root, "apps/desktop/src-tauri/target");
const release = resolve(root, `releases/v${version}`);
const artifacts = resolve(release, "artifacts");
const bundles = [
  {
    from: resolve(target, `release/bundle/dmg/Bookmarktivity_${version}_aarch64.dmg`),
    name: `Bookmarktivity-v${version}-macos-arm64.dmg`
  },
  {
    from: resolve(target, `x86_64-pc-windows-msvc/release/bundle/nsis/Bookmarktivity_${version}_x64-setup.exe`),
    name: `Bookmarktivity-v${version}-windows-x64-setup.exe`
  }
];

for (const bundle of bundles) {
  if (!existsSync(bundle.from)) throw new Error(`Missing bundle: ${bundle.from}`);
}
mkdirSync(artifacts, { recursive: true });

async function sha256(path) {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  stream.on("data", chunk => hash.update(chunk));
  await once(stream, "end");
  return hash.digest("hex");
}

const sums = [];
for (const bundle of bundles) {
  const to = resolve(artifacts, bundle.name);
  if (existsSync(to)) {
    const [oldHash, newHash] = await Promise.all([sha256(to), sha256(bundle.from)]);
    if (oldHash !== newHash) throw new Error(`Refusing to replace different artifact: ${to}`);
  } else {
    copyFileSync(bundle.from, to);
  }
  const hash = await sha256(to);
  sums.push(`${hash}  ${bundle.name}`);
  console.log(`${bundle.name}: ${hash}`);
}
writeFileSync(resolve(release, "SHA256SUMS.txt"), `${sums.join("\n")}\n`);
