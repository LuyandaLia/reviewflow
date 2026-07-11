import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(extensionRoot, '..', 'backend');
const dest = join(extensionRoot, 'backend');
const SKIP = new Set(['.venv', '__pycache__', '.pytest_cache']);

if (!existsSync(join(src, 'app', 'main.py'))) {
  console.error(`Source backend not found at ${src}`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, {
  recursive: true,
  filter: (srcPath) => !srcPath.split(/[/\\]/).some((part) => SKIP.has(part)),
});

if (!existsSync(join(dest, 'app', 'main.py'))) {
  console.error(`Staged backend is missing app/main.py at ${dest}`);
  process.exit(1);
}

console.log(`Staged backend at ${dest}`);
