# Connect Vibenate

Give your agent: `Set up using https://raw.githubusercontent.com/vibenate/vibenate/main/SKILL.md`. Step-by-step setup for each agent app (Claude Code, Codex, Claude, ChatGPT, Cursor, VS Code, Gemini CLI, web-hosted agents): https://vibenate.com/connect.

Routes, in order: connected MCP tools (Streamable HTTP at https://vibenate.com/mcp); otherwise the HTTP API at https://vibenate.com/v1 from any client, which needs nothing installed; the CLI (`npx --yes vibenate@latest brief`, Node.js 22+) is an optional convenience over the same host.

Install the CLI with `npm install --global vibenate`. Install the JavaScript SDK with `npm install @vibenate/client`. Public discovery requires no account. Provider authentication and permissions are separate.

[Connection options](https://vibenate.com/connect) · [API reference](https://vibenate.com/docs) · [Skill](https://raw.githubusercontent.com/vibenate/vibenate/main/SKILL.md).

Existing working tools can be used immediately; no agent-app picker or repeated setup is required. Contributions and private features use the same protected identity across visits.
