/**
 * Runs Node's test runner on every *.test.mjs file under the folders given, e.g.
 *
 *   node scripts/run-tests.mjs test/unit
 *
 * Node expands glob patterns such as "test/unit/**\/*.test.mjs" itself only from version 21; this works on every
 * supported version (18 and later). Exits with the test runner's own exit code.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function testFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith('.test.mjs') ? [path] : [];
  });
}

const files = process.argv.slice(2).flatMap(testFiles).sort();
if (files.length === 0) {
  console.error(`No *.test.mjs files under: ${process.argv.slice(2).join(', ') || '(no folder given)'}`);
  process.exit(1);
}
const { status } = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(status ?? 1);
