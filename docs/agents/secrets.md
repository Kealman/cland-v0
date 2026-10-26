# Project secrets

Use the [local secret commands](../../hub/README.md#project-secrets) to manage
the project's messenger tokens and speech keys. Values enter through stdin or
a hidden terminal prompt. Only names and SHA-256 fingerprint prefixes belong in
reports; never share the file, parser input or a credential-bearing command.
The file store is separate from `.cland/secret`, which authenticates local clients.

Remote and speech code share `resolveSecrets(root)` in
`hub/src/remote/secrets.ts`. It resolves the four supported dotted keys from the file, then overlays
`CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`, `ELEVENLABS_API_KEY` and
`XAI_API_KEY`, respectively. Missing variables fall back to file values; present
variables override them, including when no file exists. File safety checks still
apply. `readSecretsFile(root)` serves file-only CLI list/preflight and mutations,
so editing one stored value cannot persist unrelated environment credentials.
The loader refuses symlinks and tightens permissions; errors contain fixed diagnostics. Keep values
inside the process and pass them only to the intended provider boundary.
Hub startup checks this store before opening logs and listeners. Local secret
commands require an initialized project, but no running hub or platform call.
The daemon imports the resolver at that startup boundary, inside its held lock.
Keep the shared `project.ts` module free of the loader and fingerprint helpers:
read-only CLI commands use it without loading the credential implementation.
For a custom unmarked `.cland/.gitignore`, put `/secrets.toml` last among its
non-comment rules. Writes refuse before requesting input until that protection
exists; the command preserves the file's bytes.

Use [the sealed test seams](tests/hub-test-secrets.test.ts.md) for changes here.
The [CLI import guard](tests/hub-test-cli-imports.test.ts.md) protects that boundary.
The existing role clauses already require secret isolation; this local command
adds no frame, role permission or role-clause line.

For remote configuration, use `cland config set remote.telegram.enabled true`
and `cland hub reload`; activation requires a resolved token and an installed
platform factory. Every remote/speech key reloads; init renders defaults and update
fills older managed configs. The current injectable messenger factory is exercised
with fakes, with no platform or speech call. See
[configuration tests](tests/hub-test-config-set.test.ts.md) for its receipt and
shutdown seams. Existing role clauses cover reload and secret isolation; no role
permission changes.

Every session/worker child filters remote tokens and speech keys alongside
`DIGITALOCEAN_TOKEN` with `withoutExecutorCredentials` from
`shared/executor-credentials.ts` after its last environment overlay. Keep the
hub's provider environment intact. E-1311's speech command launcher must use
this same final filter; the generic command stand-in and actual fake-harness
receipts are documented in [child environment tests](tests/hub-test-secrets-environment.test.ts.md).
