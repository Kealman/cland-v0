# hub/test/gateway-secrets.test.ts

T2 uses sealed `tempProject`/`projectHub`, public frame clients and the fake
messenger. Values are made up and enter through the local storage API; no
platform, URL parser, real credential or credential-bearing argv is used.

`hub refuses a malformed Telegram token before starting any messenger and
releases its lock` observes the startup refusal and absent messenger setup,
then replaces the malformed value and observes successful startup.
`daemon registers every resolved secret before gateway status and logs are written` checks all four values in status/log receipts. A separate
direct gateway owner exercises the retained cleanup error, with an explicit
caught shutdown failure so the surrounding hub still drains normally.

`gateway masks inbound and outbound frames while preserving message structure
and long text` observes the exact inbound message in history and arms the
outbound frame observer before sending. Keep long multiline text intact and
retain existing previous-wire-shape gateway regressions.

`shared remote output API masks journal and artifact writes after rotation
without truncating documents` calls the same validated registration function
used at startup, then registers a replacement. Native journal close and the
successful artifact creation reply are the persistence receipts before reading
bytes. Register the journal owner before acquisition with shared cleanup and the
pre-directory barrier. The cancellation control holds an actual append, triggers
shared cleanup through an AbortController, observes the retained root, then checks
the drained write and native close receipts before root removal. Its raw-after-hook
negative control failed with ENOENT reading the file during close. This proves the shared API at actual sinks; it does not claim the gateway
can create artifacts or that a speech producer exists.

The registry is per project and keeps rotated values for old consumers.
Reload owners call `validateAndRegisterSecrets(secrets, remoteOutput)` before
provider activation. Use `.text` for full artifact contents and `.value` for
JSON journal records and `redactFrame` for frames; the callable diagnostic form flattens and caps.
No extra role-clause lines or permission changes are needed.

Short opaque credential cases (`id`, `result`, `general`) use the actual frame
client and wait for the exact result or disabled-state receipt. Schema keys stay
unchanged; content is masked, and a collision in a routing/correlation value
fences that remote before dispatch/delivery. The previous plain-function shape
wraps a registered redactor in a closure and must still mask structured payloads.

## Configured reload and explicit environment

`startup and reload resolve the explicit daemon environment without changing
process.env` uses `projectHub`'s optional `syntheticRemoteSecrets` input. The
fixture seals inherited HOME/XDG/Git/provider state first and then copies only
the four declared fabricated credential fields into the in-process subject hub.
It does not change process.env or a child launcher; child environments still use
the shared final credential filter. Existing callers omit this additive option.
Factory token receipts prove the injected override wins at startup and after a
file rotation; the exact reload result follows old-stop and replacement-start.

`reload registers every rotated secret before constructing a replacement
messenger` rotates all four file credentials, throws from replacement factory
construction and checks actual masked status/log receipts for old and new values.
`an invalid injected Telegram override is refused before the configured messenger
is constructed` asserts a fixed refusal, no provider construction and a released
hub lock. These complement the file-only malformed-token and direct registry
controls; no real platform or credential is used.

Outgoing hub frames may mask the display-only `harnessId` and `attach` metadata
without disabling the remote. Incoming frames continue through strict
`redactFrame`; the endpoint/credential input regression observes the exact
routing refusal, no written human message, and the other hub edge still serving.
The native producer regression is in `opencode-adapter.test.ts`, and
`remote/redact.test.ts` preserves secret masking and strict correlation ids.
Doctor's local status diagnostics and the allowlisted `remote.state` rows carry
no harness endpoint; these use the existing daemon registry and safe projection.
