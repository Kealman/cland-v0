# hub/test/discord-messenger.test.ts

T2, Node v24.21.0, sealed tempProject/projectHub and Unix frames, production
Discord factory plus loopback REST/ws fakes. Run this file alone:
`node --test hub/test/discord-messenger.test.ts`. No browser or real platform.
Made-up credentials enter only through syntheticRemoteSecrets (the harness
installs them in the daemon environment after credential filtering).

The factory case retains the fake's validated Identify receipt (v10 JSON,
33281, no compression/shard/presence), READY plus heartbeat ACK status, the
exact invite and actual sealed `cland remote status` output. It injects a
credential-bearing dispatch and requires the safe UNKNOWN log receipt before
checking frame/log/status/CLI and drained log/journal files for token absence.
The separate credential-echo REST refusal retains the disabled status, actual
CLI error wording and positive remote-disabled log before scanning all sinks.
A direct no-I/O production-validator control retains the wss host allowlist
and rejects foreign/lookalike hosts, credentials, query strings and plain ws.
The heartbeat case injects 0.25 jitter and FakeClock: 249/250ms, 1249/1250ms,
immediate opcode 1, acknowledgement expiry and recovery. It retains final
status assertions and observes actual fake heartbeat receipts between advances.

Two refused-host cases require a disabled Discord status, exactly one General
notice, zero identifies and continued native Telegram mirroring on the same
hub. Their fabricated URLs never receive a connection. Shared until waits for receipts are
bounded real-I/O observers (including asynchronous predicate time), never substitute elapsed time for completion.
Fixture cleanup owns gateway clients before server/socket/handler drainage.
Existing remote-cli previous-hub and optional callback tests remain the old-wire
regression; the public status schema and safe workbench projections are unchanged.

The fake's `configure` also accepts interval, acknowledge, resumeWindow and gatewayUrl;
`dispatch` sends an opcode frame, and state.gateway exposes only safe counts
and validIdentify. Identify credentials and arbitrary payloads are never captured.
Identify budgets and restart catch-up are outside these tests.
Application controls set flags and endpoint URL. `close` takes a numeric code;
state.gateway.closes records completed close handshakes without reasons.
Application failures prove zero Identifies and continued Telegram mirroring.
Fatal-code cases require persisted stopCause, one General cause/fix, real CLI
status, continued Telegram delivery and no Identify after a clock advance.
The 4003 case observes a second Identify before the second close. REST tests
cover 401/40001/50014, secret echo redaction, and the test command reads one
application and posts one paired line. A REST stop observes close 1000.

The two distinct-callback factory regressions force Telegram getMe 401 and a
Discord gateway refusal on the same sealed hub. With discordNotice present and
absent, Telegram must invoke its original notice once; only Discord may invoke
discordNotice. Both rows must reach disabled before the final callback assertions.

At the periodic 1250ms tick only ACK can supply the observed lastInbound; await
that exact timestamp before advancing past expiry. With ACKs then withheld, an
immediate opcode 1 must leave status disconnected until the explicitly injected
opcode 11 is consumed. This removes the previous same-timestamp ambiguity.

Replacement-notification authentication regression uses actual CLI approval into
another channel. Fake `configure { holdClose: true }` pauses the native gateway
transport before the old-channel POST 401; `holdClose: false` releases it in a
finally block. Require token cause/fix in CLI while held, then the gateway's
remote-disabled receipt, structured status, native close 1000, one General line
and persisted stopCause after hub disposal. Terminal callers share one close
promise; outward auth rejections preserve that structured error.

Resume regressions retain native close 1006 for a zombie, RESUME validation,
exactly one General input after duplicate replay, twelve resumes (ten drops,
opcode 7 and opcode 9 true) with one Identify, and opcode 9 false's 1999/2000ms
boundary under deterministic 0.25 jitter. `drop` terminates the fake transport;
dispatches are sequenced and buffered for replay inside the injected-clock
resume window (90 seconds by default). Safe state adds resumes/validResume;
credentials stay out of receipts. The three-minute production-factory case
observes disconnected immediately, zero notices at 179999ms, one at 180000ms,
no repeat, then an actual ACK and one General recovery notice. Shutdown leaves
zero injected timers. The optional Discord notice transition flag retains
compatibility with two-argument callbacks and unchanged public status frames.

The settled REST health case keeps a long fake heartbeat interval so socket
liveness is independent of the send outage. Four sanitized 500 responses exhaust
the paced request at injected 1/2/4-second waits; the first native failure leaves
status connected while retries remain. Observe durable missed settlement before
asserting disconnected, inject an ACK, then require zero notices at 179999ms and
one at 180000ms. Arm the fake hold observer before the offline notice's mirrored
send, retain the disconnected assertion while held, and recover only after that
paired send's native release and durable sent settlement. Keep frame/notice
credential scans and zero timers after stop.

Source1 corrections: `fakes/discord/hub.ts` builds on discordExchangeOwner before
acquiring a fake, root, Store or hub. Its stop barrier joins hub acquisition and
shutdown; afterDrain closes injected storage only after native/observer joins.
Owned run promises catch rejection immediately, bound operations independently
of behaviour time, and cancel/drain a held observer and request on any exit.
Omitted/aborted setup and held-receipt controls use that same disposer and retain
native closed, zero writer/handler/observer/timer and Store-closed assertions.

REST retry time starts after each exact client `discord-rest-refused` diagnostic
(route, status and ordinal), in addition to the server request count. From
onError through the request rejection and retry pause registration, only promise
continuations intervene; FakeClock.advance's pre-time-change setImmediate drains
those continuations before advancing. Preserve that ordering if the retry path
changes. The diagnostic uses the existing log sink and contains no message body
or provider error text. A separate acknowledged live-native edit-404 control
keeps connected status past 180000ms and observes neither outage nor recovery,
including after a successful send; a missing edit never changes exchange health.
