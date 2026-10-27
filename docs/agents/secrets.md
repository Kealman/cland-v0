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

`cland setup` offers Telegram after the hub and before the Aide. Its hidden
question shares `readSecret` and `prepareSecretWrite` with the secret CLI; validate
the Telegram format before storing. A decline is not persisted. `--yes` does not
accept this offer, and `--json` uses nonterminal detection only. An untouched
remote is `skip`, partial configuration is `open`, and a configured paired remote
is `ok`. Without a running hub, `--no-aide` can store and enable locally through
the shared config writer, leaving reload and pairing open. With a running hub,
setup uses the unchanged config-set/reload/status frames, carrying no value.
See [setup's frame receipts](tests/hub-test-setup-remote-component.test.ts.md)
and [scripted setup checks](tests/hub-test-setup-remotes.test.ts.md).

Use [the sealed test seams](tests/hub-test-secrets.test.ts.md) for changes here.
The [CLI import guard](tests/hub-test-cli-imports.test.ts.md) protects that boundary.
The existing role clauses already require secret isolation; this local command
adds no frame, role permission or role-clause line.

For remote configuration, use `cland config set remote.telegram.enabled true`
and `cland hub reload`; activation requires a resolved token. The daemon has a
built-in Telegram fetch client; Discord requires an injected platform factory.
For a paired Telegram chat, `remote.telegram.format` defaults to `rich`, with
plain text and computed entities after a rejection. Set it to `entities` for
that path directly; both paths disable link previews. General uses the
`author · kind` header and silent progress/hub notices, excluding the human's
Telegram messages, answers and asks to the human. See the
[rendering guide](tests/hub-test-telegram-rendering.test.ts.md). This adds no
role permission or clause line.
Every remote/speech key reloads; init renders defaults and update fills older
managed configs. Explicit factory and legacy remote injection retain their test
seams. Telegram checks and sends are exercised on a loopback fake, with no real
platform or speech call. See
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
An enabled Telegram remote stopped by 401, 403 or a lasting 409 also restarts
on `cland hub reload` with unchanged settings and secrets. Replace a revoked
token first for 401, unblock the bot for 403, or stop the other token consumer
for 409. The hub never stops another consumer itself. Configuration-disabled
remotes stay stopped; an unchanged healthy gateway keeps its clients.
See [remote command tests](tests/hub-test-remote-cli.test.ts.md).

For Telegram client errors and API-root overrides, use the
[Bot API boundary](tests/hub-test-telegram-api.test.ts.md) and
[native messenger frame receipts](tests/hub-test-telegram-messenger.test.ts.md).
Pass the daemon's environment and project registry to the factory. Token-bearing
URLs stay inside the fetch client; provider errors retain only sanitized facts.
The existing role clauses cover these boundaries without new permissions.
