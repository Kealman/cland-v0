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

The fake's `configure` also accepts interval, acknowledge and gatewayUrl;
`dispatch` sends an opcode frame, and state.gateway exposes only safe counts
and validIdentify. Identify credentials and arbitrary payloads are never captured.
Resume, identify budgets, close-code classification and Discord message handling
are outside these connection tests.

The two distinct-callback factory regressions force Telegram getMe 401 and a
Discord gateway refusal on the same sealed hub. With discordNotice present and
absent, Telegram must invoke its original notice once; only Discord may invoke
discordNotice. Both rows must reach disabled before the final callback assertions.

At the periodic 1250ms tick only ACK can supply the observed lastInbound; await
that exact timestamp before advancing past expiry. With ACKs then withheld, an
immediate opcode 1 must leave status disconnected until the explicitly injected
opcode 11 is consumed. This removes the previous same-timestamp ambiguity.
