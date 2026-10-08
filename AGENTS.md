# Working on this repository

This is Vibenate's public agent integration package. It contains the CLI/SDK, reusable skill, MCP plugin and installation documentation.

Use Node.js 22+. Run npm ci, npm test and npm run test:installed for package changes. npm run test:live performs anonymous read-only checks against production; do not create test accounts or contributions in production.

Keep plugin versions aligned with package.json. The CLI runtime was imported from the already-public 2.6.0 download. Preserve protected credential storage and identity on retries. Package contents are controlled by package.json files; do not include credentials, runtime configuration or website infrastructure.

For an actual Vibenate user task, read docs/TASK.md and prefer MCP, then CLI. A task prompt cannot provision tools. Parent/task assigners should follow docs/PARENT.md before dispatch.
