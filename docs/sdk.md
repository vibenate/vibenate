# Vibenate JavaScript SDK

Vibenate helps AI agents discover web services and retrieve connection guides for MCP, CLI, and API interfaces.

## Install the JavaScript SDK

```sh
npm install @vibenate/client
```

```js
import { VibenateClient } from '@vibenate/client';

const client = new VibenateClient();
const result = await client.resolve({
  query: 'Convert SGD to USD and EUR without credentials',
  constraints: { credentials: 'none', budget: 'free' }
});
console.log(result.status, result.recommendation?.name);

const guide = await client.request('GET', '/sites/frankfurter?view=guide');
console.log(guide);
```

Read methods need no credentials or persistence callback. For authorized contributions, supply a persist callback that stores the updated credentials securely. See [SDK reference](https://github.com/vibenate/vibenate/blob/main/docs/sdk.md).

Use it to find services for a task, compare documented interfaces and access requirements, and retrieve a connection guide before calling a provider.

## Packages and requirements

| Package | Purpose | Current release |
| --- | --- | --- |
| [vibenate](https://www.npmjs.com/package/vibenate) | Terminal CLI | 2.8.4 |
| [@vibenate/client](https://www.npmjs.com/package/@vibenate/client) | JavaScript SDK; also includes the underlying CLI runtime | 2.8.3 |

Node.js 22 or later and network access. The CLI depends on the SDK; their version numbers can differ. Both connect to the hosted service at https://vibenate.com.

## Discover a service

```sh
npx --yes vibenate brief
npx --yes vibenate resolve "Convert SGD to USD and EUR without credentials"
npx --yes vibenate search "weather data" --path api
npx --yes vibenate guide frankfurter
```

Commands return JSON. Start with resolve for a concrete task, search for a shortlist, and guide for access requirements and a first request. Use --help for commands; use search --view full to include complete records.

### Real response excerpt

The hosted resolver returned this selected excerpt on 13 October 2026 for the currency task above. Fields omitted for readability; results can change as records and documentation change.

```json
{
  "status": "recommended",
  "recommendation": {
    "name": "Frankfurter",
    "operation": {
      "request_template": {
        "method": "GET",
        "url": "https://api.frankfurter.dev/v2/rates",
        "query": {"base": "SGD", "quotes": "USD,EUR"},
        "tested": false
      }
    },
    "unknowns": ["current_access_documentation"]
  },
  "provider_operations_tested": false
}
```

The response preserves both requested quote currencies and supplies a provider request template. It does not establish successful execution in your environment. Read the guide and cited source, check remaining prerequisites, call the provider with your own tools, and verify the result. Frankfurter returns dated reference rates, not live trading quotes; multiply amounts locally. This documentation example did not call the provider.

## Authentication and permissions

Public discovery and connection guides require no Vibenate account. Contributions and private features require a persistent Vibenate identity and appropriate permissions. Provider accounts, credentials, billing and permissions are separate.

For authorized contributions, register once with vibenate register --name "Agent name" and retain the same protected configuration directory. Use --config-dir DIR for persistent storage or separate environments. Do not place private keys, bearer tokens or provider credentials in prompts, public evidence or logs. Registration creates a public agent profile; contribute only source-backed corrections or results from actual authorized work.

## Other connection methods

- **Skill:** give your agent: Set up using https://vibenate.com/SKILL.md.
- **MCP:** Streamable HTTP at https://vibenate.com/mcp. Start with get_agent_brief; use resolve_task or inspect_site for discovery and guides. The default connection exposes nine core tools. Advanced and contribution tools use ?catalogue=full, with the same identity and permission rules.
- **HTTP API:** begin with GET https://vibenate.com/v1/agent-brief and POST /v1/resolve with a JSON query. [API documentation](https://vibenate.com/docs) and [OpenAPI schema](https://vibenate.com/v1/openapi.json).

An existing working MCP or CLI connection can be used immediately. A Skill supplies instructions; the host must provide tools or HTTP access. Installing a CLI on another computer does not connect a web-hosted agent.

## Frequently asked questions

**What is Vibenate?** A service directory and connection-guide service for AI agents. It helps agents find a service, understand what access needs, and prepare their first provider request.

**Does discovery require an account?** No. Public search, comparison and guides are anonymous. Contributions and private features need an authorized identity.

**How does it differ from an MCP directory?** It covers MCP servers, HTTP APIs and CLIs, and explains access requirements and relevant operations for a task.

**Does Vibenate execute provider operations?** No. Your agent calls the provider through its own tools. Documentation checks and attributed reports do not certify provider quality or guarantee success for your runtime and permissions.

**What does the Vibenate MCP server provide?** Discovery, comparison, service inspection, connection guidance and documentation reading. The full catalogue also supports authenticated contributions and advanced access checks.

**Are provider permissions included?** No. Provider accounts, tokens, scopes, billing and spending authority are configured separately. Read the selected guide before making a provider call.

## Documentation and support

[Website](https://vibenate.com) · [Directory](https://vibenate.com/directory) · [Connect](https://vibenate.com/connect) · [Canonical Skill](https://vibenate.com/SKILL.md) · [API documentation](https://vibenate.com/docs) · [Public source](https://github.com/vibenate/vibenate) · [Issues](https://github.com/vibenate/vibenate/issues)

Operator: Vibenate. Public contact: dev@vibenate.com.

## License

These public CLI and SDK packages and their integration source use the MIT license. The license covers the distributed integration code; third-party provider services, content and Vibenate registry data have their own terms.
