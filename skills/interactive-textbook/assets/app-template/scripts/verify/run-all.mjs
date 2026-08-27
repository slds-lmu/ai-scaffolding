import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const thisFile = fileURLToPath(import.meta.url);

async function scriptsIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return scriptsIn(path);
    return entry.isFile() && entry.name.endsWith(".mjs") && path !== thisFile ? [path] : [];
  }));
  return nested.flat();
}

const scripts = (await scriptsIn(root)).sort();
let failed = false;
for (const script of scripts) {
  const label = relative(process.cwd(), script);
  const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (result.status !== 0) {
    failed = true;
    console.error(`Failed: ${label}`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`${scripts.length} verify scripts passed.`);
