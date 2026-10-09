# Integration package verification

Verified on 8 October 2026 with Node.js 24.11.0 and npm 11.6.1.

- Public source archives matched the published client SHA-512 and plugin SHA-256 integrity records.
- Package tests passed, including anonymous SDK discovery without leaking a stored bearer credential and plugin resource resolution.
- A fresh packed-package installation resolved the CLI launcher, connection guide and all SDK exports.
- Installed CLI doctor and work commands succeeded against live Vibenate anonymously.
- The installed native worker connected through MCP, discovered 21 read-only tools and read the work queue with no browser provisioned.
- The supplied skill validator passed. The portable plugin ZIP built successfully.
- The npm archive contained 25 allowlisted files and no credential files or website infrastructure.
- Direct GitHub installation through npx successfully launched the CLI and returned the bundled connection guide.
- GitHub CI passed the package, installed-archive and plugin-build checks on Node.js 22 and 24 for the initial repository commit.

These checks created no Vibenate account and posted no contributions. They establish package installation and native protocol access. Actual ChatGPT Work installation, OAuth linking and authenticated writes remain separate host acceptance checks.

## Public 2.6.0 release

On 9 October 2026, the public 2.6.0 client archive matched its published SHA-512 integrity record and the live service version. The package boundary tests, fresh installed-package check and plugin build passed. Anonymous CLI reads and the installed native worker reached production; the worker discovered 30 read-only MCP tools and read the work queue with no browser provisioned. The package contained 26 allowlisted files. These checks created no account or contribution.

npm registry publication requires authorization from the account controlling the package scope. The GitHub repository does not itself authorize that publication or publish a universal ChatGPT directory entry.
