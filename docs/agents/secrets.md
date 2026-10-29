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

`cland setup` also offers a missing ElevenLabs key after the messengers, using
the same preflight, hidden question and private writer as
`cland secret set speech.elevenlabs_key`. The provider data-use line precedes the
default-No offer; `--yes` does not accept it. Present resolved keys are `ok`, a
decline is `skip`, accepted input is `done`, and nonterminal missing keys are
`open` with the secret command. Command/off providers ask nothing. Reload a
running hub to apply the key.

`cland setup` offers Telegram then Discord after the hub and before the Aide. Its hidden
question shares `readSecret` and `prepareSecretWrite` with the secret CLI; validate
the Telegram format before storing. A decline is not persisted. `--yes` does not
accept this offer, and `--json` uses nonterminal detection only. An untouched
remote is `skip`, partial configuration is `open`, and a configured paired remote
is `ok`. Without a running hub, `--no-aide` can store and enable locally through
the shared config writer, leaving reload and pairing open. With a running hub,
setup uses the unchanged config-set/reload/status frames, carrying no value.
Discord reads the application after private storage, requires Public Bot off,
Message Content enabled and Interactions Endpoint URL empty before enabling,
and offers a re-check for corrections. The native REST client retains all token
I/O; the invite contains only the application id and permissions 117824.
See [setup's frame receipts](tests/hub-test-setup-remote-component.test.ts.md)
and [scripted setup checks](tests/hub-test-setup-remotes.test.ts.md).

Use [the sealed test seams](tests/hub-test-secrets.test.ts.md) for changes here.
The [CLI import guard](tests/hub-test-cli-imports.test.ts.md) protects that boundary.
The existing role clauses already require secret isolation; this local command
adds no frame, role permission or role-clause line.

For remote configuration, use `cland config set remote.telegram.enabled true`
and `cland hub reload`; activation requires a resolved token. The daemon has a
built-in Telegram fetch client and Discord REST/gateway client. The daemon
environment may select loopback fakes with `CLAND_TELEGRAM_API_ROOT` or
`CLAND_DISCORD_API_ROOT`; production Discord uses API v10 and a known-host
`wss` gateway. Discord status includes the application invite; pairing and
message handling require the corresponding native handlers.
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
`.value` preserves JSON record keys; incoming `redactFrame` preserves frame routing or
disables the remote safely on a credential collision. Plain-function injection
uses the same supplied policy for structured content. Every new remote/speech journal,
artifact, frame and diagnostic producer passes the matching API before writing.
See [registration and output receipts](tests/hub-test-gateway-secrets.test.ts.md).

`cland remote status` reports the hub’s loaded token presence and fingerprint,
including environment overrides; `cland secret list` reports the file only.
`cland doctor` resolves the current file and the same environment overrides for
token presence/fingerprint, reads enabled settings from config, and asks only
the local running hub for connection and pairing. Discord pairing names the numeric user, channel and guild ids. It makes no platform or paid
call; `cland remote test <messenger>` remains the explicit platform check.
Doctor reports `ok` with "speech unused until a remote is set up" when no remote
is enabled, or "transcription off" for an empty provider. With at least one remote
enabled, it reports `speech provider` and the resolved ElevenLabs key's
presence/fingerprint or `cland secret set speech.elevenlabs_key`, and executable
lookup for the command provider without running it. Empty or missing commands
warn with the fix to edit `[speech] command`. Plain `cland remote status` appends
`SPEECH_DATA_USE` for the current local config's provider, including the ElevenLabs
training opt-out and stored transcripts; it points to `[speech]` for changes.
The footer is local, while messenger facts describe loaded hub settings; JSON
and wire replies stay unchanged.
Stopped clients are warnings with the same cause/fix wording as General and
the structured stopped line in `cland remote status`.
The additive optional `remote.status` field `stopCause` preserves the old
`reason`: `token` (401/4004), `message-content` (4014), `blocked` (403), or
`other-consumer` (lasting 409), `interactions-endpoint` (clear the application URL),
`gateway-refused` (gateway configuration/second 4003), or `identify-budget`
(wait for session starts to reset). Discord startup checks Message Content flags
and the empty Interactions Endpoint URL before Identify; fatal codes
4004/4010–4014 and REST 401/40001/50014 stop only Discord. Reload retries it. Older replies without it keep their redacted
reason and a generic repair/reload fix. No hub gives `hub not running`.
Doctor reads current inputs while status describes loaded clients; reload
applies changed tokens/config to those clients. Its test seams are in
[doctor remote diagnostics](tests/hub-test-doctor-remotes.test.ts.md).
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

Public Telegram setup and maintenance are in the site's
[Remote control guide](../../site/src/content/docs/docs/remote-control.md).
Its command blocks have a sealed
[fake-platform walkthrough](tests/hub-test-remote-docs-pairing.test.ts.md);
[site vocabulary checks](tests/hub-test-remote-docs.test.ts.md) keep the documented
commands, config keys and secret names aligned with the build.

Transient Telegram poll/send failures retain a durable outage without disabling
other hub edges. General gets one redacted offline line after three minutes
and one recovery line if that threshold was crossed. Retained human text names
its written/recovery times; after it is handled, the paced native queue sends
one silent gap above zero missed General sources. Only the matching successful
gap send acknowledges its captured ids; uncertainty never permits a new send.
See [catch-up receipts](tests/hub-test-telegram-catchup.test.ts.md).

For Telegram client errors and API-root overrides, use the
[Bot API boundary](tests/hub-test-telegram-api.test.ts.md) and
[native messenger frame receipts](tests/hub-test-telegram-messenger.test.ts.md).
Pass the daemon's environment and project registry to the factory. Token-bearing
URLs stay inside the fetch client; provider errors retain only sanitized facts.
The existing role clauses cover these boundaries without new permissions.

Outgoing gateway hub frames separately mask `harnessId` and `attach` endpoint
metadata, preserving schema keys without exposing native OpenCode URLs or
registered secrets. This output exception never applies to remote input or
correlation ids; inbound routing redaction remains strict. Doctor's local status
and `remote.state` do not include harness endpoints. See the native producer
proof in [OpenCode adapter tests](tests/hub-test-opencode-adapter.test.ts.md)
and the [gateway secret guide](tests/hub-test-gateway-secrets.test.ts.md).

Speech callers construct `ElevenLabsProvider` with the resolved key and the
project-owned `RemoteRedactor` and pass that same redactor to `transcribeNote`.
The provider registers its key before I/O. `SpeechError` redacts diagnostics at
construction; unknown transport/provider errors use fixed messages. Provider
response bodies and auth headers never become logs or request captures. See
[the speech test seam](tests/hub-test-speech.test.ts.md).

For command speech and provider selection, use `speechProvider` from
`hub/src/speech/provider.ts` with the daemon environment, resolved secrets and
project registry. The command uses the shared final credential filter and
redacts stderr before publishing its bounded tail. Cancellation joins native
close after SIGTERM/SIGKILL; commands run once within the note deadline.
See [the command transport seam](tests/hub-test-speech-command.test.ts.md).

An enabled Discord client spaces Identifies by five seconds across restarts and
retains its rolling count/backoff in hub.db. Failed Identifies back off with equal
jitter up to five minutes; READY clears that penalty and resumes spend no start.
Each Identify rereads Discord's remaining session starts: below 100 stops only
Discord with `identify-budget` and a UTC reset time in status and General. Wait
for that reset before `cland hub reload`. General warns at 500 local Identifies,
at most once per rolling day. Keep one bot per project: other hubs consume the
same platform budget and an overrun resets its token.
