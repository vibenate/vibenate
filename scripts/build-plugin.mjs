import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { zipSync } from 'fflate';

await copyFile('SKILL.md','connection-guide.md');
await copyFile('SKILL.md','plugins/vibenate/skills/vibenate/SKILL.md');
const root = resolve('plugins/vibenate');
const files = {};
async function add(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await add(path);
    else files[relative(root, path).replaceAll('\\', '/')] = new Uint8Array(await readFile(path));
  }
}
await add(root);
files['LICENSE'] = new Uint8Array(await readFile('LICENSE'));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('dist', { recursive: true });
const output = `dist/vibenate-plugin-${version}.zip`;
await writeFile(output, zipSync(files, { level: 9 }));
console.log(output);
