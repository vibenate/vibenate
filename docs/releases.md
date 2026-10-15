# Publishing CLI and SDK releases

The repository root is the @vibenate/client SDK and underlying CLI runtime. packages/cli is the vibenate terminal wrapper. Their versions can differ; the CLI declares its SDK dependency explicitly.

## Validate source and packages

Use Node.js 22 or later. Run npm ci, npm test, npm run test:installed and npm run build:plugin. Run npm pack --dry-run in the root and packages/cli and confirm that LICENSE, current READMEs and required runtime files are present. Never include website infrastructure, credentials or runtime configuration.

Public Skill copies and connection-guide.md must match the canonical Skill. The source publication manifest release-source.json records SHA-256 checksums; it is a source integrity record, not npm provenance.

## Release workflow and provenance

The publish.yml workflow accepts a package and version, requires main, validates the manifest, runs package checks, and publishes with --provenance through GitHub OIDC. Each npm package must trust the vibenate/vibenate repository, publish.yml workflow and npm environment before that workflow can publish. No long-lived npm token is used.

[Configure npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). A repository workflow alone does not establish trust or prove provenance. Confirm the provenance statement on the published npm release.

Publish the SDK before a CLI release that depends on its new version. Then verify a fresh npm installation, the SDK import, CLI help and a public read. Create sdk-vVERSION and cli-vVERSION tags with concise release notes.

## Maintain shared documentation

The website development repository keeps docs/distribution-facts.json and scripts/sync-distribution-docs.mjs as the source for package README content. Run npm run sync:public -- PATH_TO_THIS_CLONE there to write the generated READMEs, the canonical Skill, docs/TASK.md, docs/PARENT.md and docs/assignment.json into this repository; npm run check:public reports drift against main. The website links agents to these files, so push them before deploying the website. Archive installers remain supported as a fallback; normal instructions use npm package names.

## License

The public integration code and packages use the existing MIT license. Hosted registry data, third-party providers and their content have separate terms.
