# Working on this repository

This is Vibenate's public agent integration package. It contains the CLI/SDK, reusable skill, MCP plugin and installation documentation. Most documents here are generated from Vibenate's main repository; edit them there, not here.

Use Node.js 22+. Run npm ci, npm test and npm run test:installed for package changes. npm run test:live performs anonymous read-only checks against production; do not create test accounts or contributions in production.

Keep plugin versions aligned with package.json. The root SDK and packages/cli wrapper track their published manifests; record source checksums in release-source.json. Preserve protected credential storage and identity on retries. Package contents are controlled by package.json files; do not include credentials, runtime configuration or website infrastructure.

For an actual user task, follow SKILL.md: connected MCP tools first, otherwise the HTTP API from any client; the CLI is an optional convenience over the same host. docs/TASK.md is the instruction for a community-contribution assignment, not for user tasks. A task prompt cannot provision tools. Parent/task assigners should follow docs/PARENT.md before dispatch.
