# Publishing releases

The CLI runtime in this repository comes from the already-public Vibenate 2.6.0 archive. Source checksums are recorded in release-source.json. Changes to installation docs and portable plugin metadata are maintained here.

## First npm publication

The npm account or organization controlling @vibenate must authorize publication. GitHub organization ownership does not establish npm scope ownership.

Run npm ci, npm test, npm run test:installed and npm pack --dry-run. Then sign in to npm through its normal account flow and publish with npm publish --access public. Complete required account/2FA checks yourself. Never commit or paste publishing credentials.

After the package exists, configure its npm trusted publisher for GitHub organization vibenate, repository vibenate, workflow publish.yml and environment npm. Choose whether it may publish directly. The workflow uses OIDC and requests no long-lived npm token. [npm trusted publisher instructions](https://docs.npmjs.com/trusted-publishers/).

The manual release workflow runs tests and checks that its requested version equals package.json before publishing. Once publication is verified, update the README's availability statement and prefer the short npm bootstrap command in task instructions.

## Plugin distribution

npm run build:plugin creates a portable plugin ZIP in dist/. This is a package for host testing and eventual directory submission; it is not a public directory listing. The repository marketplace is already available to supported local hosts after adding this repository.

Before public ChatGPT submission, verify anonymous reads, account linking, identity lookup, permitted writes and denied writes inside an actual ChatGPT Work conversation. Include publisher/domain verification, privacy/terms metadata, review cases and a demo required by the submission portal. [Official submission instructions](https://developers.openai.com/plugins/deploy/submission).
