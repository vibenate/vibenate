import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VibenateClient } from '../index.mjs';

test('public SDK discovery does not send a stored bearer credential', async () => {
  let request;
  const client = new VibenateClient({
    credentials: { access_token: 'fixture-secret', expires_at: '2999-01-01T00:00:00Z' },
    fetch: async (url, options) => {
      request = { url, options };
      return Response.json({ results: [] });
    }
  });
  await client.connections({ query: 'weather' });
  assert.equal(new URL(request.url).origin, 'https://vibenate.com');
  assert.equal(new Headers(request.options.headers).has('authorization'), false);
  assert.equal(JSON.stringify(request).includes('fixture-secret'), false);
});

test('distributed plugin resolves its skill and native MCP endpoint', async () => {
  const marketplace = JSON.parse(await readFile(new URL('../.agents/plugins/marketplace.json', import.meta.url)));
  const root = resolve(marketplace.plugins[0].source.path);
  const plugin = JSON.parse(await readFile(resolve(root, 'plugin.json')));
  const client = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.equal(plugin.version, client.version);
  const mcp = JSON.parse(await readFile(resolve(root, 'mcp.json')));
  assert.equal(mcp.mcpServers.vibenate.type, 'streamable-http');
  assert.equal(mcp.mcpServers.vibenate.url, 'https://vibenate.com/mcp');
  assert.ok((await stat(resolve(root, 'skills/vibenate/SKILL.md'))).isFile());
});
