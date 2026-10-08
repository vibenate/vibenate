import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const npm = process.env.npm_execpath;
assert.ok(npm?.endsWith('.js'), 'Run through npm run test:installed or npm run test:live');
const directory = await mkdtemp(join(tmpdir(), 'vibenate-public-package-'));
const root = process.cwd();
async function run(args, cwd = directory) {
  return new Promise((fulfill, reject) => {
    const child = spawn(process.execPath, [npm, '--cache', join(directory, 'cache'), ...args], {
      cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '', err = '';
    child.stdout.on('data', chunk => out += chunk);
    child.stderr.on('data', chunk => err += chunk);
    child.on('error', reject);
    child.on('close', code => code === 0 ? fulfill(out) : reject(Error(`npm command failed (${code}): ${err}`)));
  });
}
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'vibenate-install-verification', private: true, type: 'module' }));
  const [packed] = JSON.parse(await run(['pack', '--json', '--ignore-scripts', '--pack-destination', directory], root));
  const allowed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).files;
  assert.ok(packed.files.some(file => file.path === 'LICENSE'));
  assert.ok(packed.files.some(file => file.path === 'plugins/vibenate/plugin.json'));
  assert.ok(packed.files.every(file => ['README.md', 'package.json', ...allowed].some(path => file.path === path || (path.endsWith('/') && file.path.startsWith(path)))));
  assert.ok(packed.files.every(file => !/(^|\/)(credentials[^/]*\.json|\.env[^/]*|node_modules)(\/|$)/.test(file.path)));
  await run(['install', '--ignore-scripts', '--no-audit', '--no-fund', join(directory, packed.filename)]);
  const configDir = join(directory, 'identity');
  const guide = JSON.parse(await run(['exec', '--offline', '--', 'vibenate', 'guide', '--config-dir', configDir]));
  assert.ok(guide.guide.includes('https://vibenate.com/mcp'));
  const installed = join(directory, 'node_modules/@vibenate/client');
  const { VibenateClient } = await import(pathToFileURL(join(installed, 'index.mjs')));
  const { prepareNativeWorker } = await import(pathToFileURL(join(installed, 'native-worker.mjs')));
  const { assignmentConfig } = await import(pathToFileURL(join(installed, 'assignment.mjs')));
  assert.equal(assignmentConfig().mcp.url, 'https://vibenate.com/mcp');
  assert.equal(typeof VibenateClient, 'function');
  assert.equal(typeof prepareNativeWorker, 'function');
  const report = { ok: true, version: packed.version, files: packed.files.length, installed_cli: true, installed_sdk: true, live: false };
  if (process.argv.includes('--live')) {
    const doctor = JSON.parse(await run(['exec', '--offline', '--', 'vibenate', 'doctor', '--config-dir', configDir]));
    assert.equal(doctor.ok, true);
    assert.equal(doctor.checks.identity.ok, null);
    const work = JSON.parse(await run(['exec', '--offline', '--', 'vibenate', 'work', '--config-dir', configDir]));
    assert.ok(work && typeof work === 'object');
    const worker = await prepareNativeWorker(new VibenateClient(), { task: 'Read the participation guide and work queue', allowedWrites: [] });
    try {
      assert.equal(worker.route, 'mcp');
      assert.equal(worker.browser_provisioned, false);
      assert.ok(worker.tools.some(tool => tool.name === 'get_participation_guide'));
      assert.ok(worker.tools.some(tool => tool.name === 'get_work_queue'));
      assert.ok(worker.tools.every(tool => tool.annotations?.readOnlyHint === true));
      const result = await worker.invoke('get_work_queue');
      assert.equal(Boolean(result.isError), false);
      report.live = true;
      report.read_only_mcp_tools = worker.tools.length;
      report.browser_provisioned = worker.browser_provisioned;
    } finally { await worker.close(); }
  }
  console.log(JSON.stringify(report));
} finally {
  // Only remove the fresh scratch directory created by mkdtemp above.
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
  await rm(directory, { recursive: true, force: true });
}
