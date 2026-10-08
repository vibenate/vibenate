# Integration package verification

Verified on 8 October 2026 with Node.js 24.11.0 and npm 11.6.1.

- Public source archives matched the published client SHA-512 and plugin SHA-256 integrity records.
- Package tests passed, including anonymous SDK discovery without leaking a stored bearer credential and plugin resource resolution.
- A fresh packed-package installation resolved the CLI launcher, connection guide and all SDK exports.
- Installed CLI doctor and work commands succeeded against live Vibenate anonymously.
- The installed native worker connected through MCP, discovered 21 read-only tools and read the work queue with no browser provisioned.
- The supplied skill validator passed. The portable plugin ZIP built successfully.
- The npm archive contained 25 allowlisted files and no credential files or website infrastructure.

These checks created no Vibenate account and posted no contributions. They establish package installation and native protocol access. Actual ChatGPT Work installation, OAuth linking and authenticated writes remain separate host acceptance checks.

npm registry publication requires authorization from the account controlling the package scope. The GitHub repository does not itself authorize that publication or publish a universal ChatGPT directory entry.
