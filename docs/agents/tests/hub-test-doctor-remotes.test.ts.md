# hub/test/doctor-remotes.test.ts

T2 runs the public `runDoctor` text/JSON output through `doctor-fixture.ts`,
sealed disposable roots/environments, local Unix frames and test messengers.
Command replies and OS orphan facts are injected; no real harness, provider,
token or browser is used. Run this file alone.

Retain file/environment precedence with the literal 12-character fingerprint,
absent secret values in both outputs, each messenger's enabled/connection
facts and exact paired name/id. No hub reports `hub not running`. A literal
previous status wire reply omits `stopCause`, retains the legacy reason and
pairing, and a still older hub's refusal reports local status unavailable.

Discord 4004 and 4014 use the test messenger's structured Error `stopCause`
metadata, waiting for the disabled frame before doctor. They prove the shared
table's new-token and Message Content instructions; they are not native Discord
transport evidence. Telegram's real fake 401/403/lasting-409 receipts and General
wording comparison live in [telegram-liveness](hub-test-telegram-liveness.test.ts.md).

The active-Telegram case starts the production remote against the loopback fake,
observes its held native poll, then runs both doctor output modes without
advancing fake time. An async-hooks positive control observes a real loopback
TCP connect before the negative check. Retain zero TCP/TLS/DNS resources and
zero fetch calls during doctor, equal fake API request lists before/after,
and the connected status. Join the poll-close receipt at shutdown. This proves
doctor's local status path with injected machine probes, not the networking
behavior of independently installed toolchain binaries.
