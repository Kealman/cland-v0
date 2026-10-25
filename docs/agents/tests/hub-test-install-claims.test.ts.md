# hub/test/install-claims.test.ts

T1 documentation contract. Run `node --test hub/test/install-claims.test.ts`.
It reads repository files only: the install page, the quickstart, the landing
page source, both READMEs and `docs/`; no CLI, hub, browser or installer runs.

The same three paths must appear on the install page, the quickstart and the
landing install section: `brew install kealman/tap/cland`,
`curl -fsSL https://cland.app/install.sh | sh`, and the source clone with
`npm ci` and `npm link`. Both READMEs keep the Homebrew and install-script
commands, and the install page and READMEs name the published tap
`Kealman/homebrew-tap`.

The stale-claim scan has positive controls before it scans, so a zero-match run
is not vacuous: an unpublished tap, a release named as the current or
latest one, and a `CLAND_VERSION` example naming the previous release fail.
Runtime work that is pending stays allowed. So do UI tap gestures and dated
historical records; the T-783 claims audit is the one version-record exemption
because it quotes the commands it audited on 2026-10-24. The install page must also keep the installer facts it describes:
the `cland-web.tar.gz` and `.sha256` assets, the SHA-256 and source-stamp checks,
the Node/npm/curl/tar/`mktemp`/`readlink` prerequisites, `git ls-remote` tag
discovery, the shared `packaging/build-install.sh` build and the legacy fallback.

This proves the text; the site build is a separate local receipt, and a clean
machine's Brew or install-script run remains E-778's launch demo.
