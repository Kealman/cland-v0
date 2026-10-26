# Project secrets

Use the [local secret commands](../../hub/README.md#project-secrets) to manage
the project's messenger tokens and speech keys. Values enter through stdin or
a hidden terminal prompt. Only names and SHA-256 fingerprint prefixes belong in
reports; never share the file, parser input or a credential-bearing command.
The file store is separate from `.cland/secret`, which authenticates local clients.

Remote and speech code share `resolveSecrets(root, env)` in
`hub/src/remote/secrets.ts`. It resolves the four supported dotted keys from the file, then overlays
`CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`, `ELEVENLABS_API_KEY` and
`XAI_API_KEY`, respectively. Missing variables fall back to file values; present
variables override them, including when no file exists. File safety checks still
apply. `readSecretsFile(root)` serves file-only CLI list/preflight and mutations,
so editing one stored value cannot persist unrelated environment credentials.
The loader refuses symlinks and tightens permissions, then validates the final
file/environment resolution before provider setup. Telegram requires
`^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$`, at most 80 characters; Discord remains
opaque. Errors contain fixed diagnostics. Storage-only reads let CLI edits repair
malformed provider values without activating them. Keep values
inside the process and pass them only to the intended provider boundary.
Hub startup checks this store before opening logs and listeners. Local secret
commands require an initialized project, but no running hub or platform call.
The daemon imports the resolver at that startup boundary, inside its held lock,
and passes its explicit environment on startup and reload.
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

Keep one `remoteRedactor()` per project hub. Startup and reload call
`validateAndRegisterSecrets(secrets, remoteOutput)` before provider setup;
reuse that registry across rotation so old in-flight errors remain masked.
The callable form bounds diagnostics; `.text` preserves full artifact text and
`.value` preserves JSON record keys; `redactFrame` preserves frame routing or
disables the remote safely on a credential collision. Plain-function injection
uses the same supplied policy for structured content. Every new remote/speech journal,
artifact, frame and diagnostic producer passes the matching API before writing.
See [registration and output receipts](tests/hub-test-gateway-secrets.test.ts.md).

`cland remote status` reports the hub’s loaded token presence and fingerprint,
including environment overrides; `cland secret list` reports the file only.
After storing a rotated token, run `cland hub reload`: it drains and replaces the
configured client while retaining the numeric pairing and mute. An unchanged
environment override still wins. `cland remote test <messenger>` uses the active
client’s test callback; no installed client means an explicit unavailable refusal.
See [remote command tests](tests/hub-test-remote-cli.test.ts.md).
