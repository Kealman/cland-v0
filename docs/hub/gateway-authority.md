## Gateway authority

The shared remote decisions live in `src/remote/mirror.ts` (General eligibility,
authors and silent delivery), `gap.ts` (captured missed-source receipts),
`replies.ts` (phone reply facts), `cards.ts` (`inboxPublication` order) and
`RemoteStore.applyMute` (idempotent command receipts). Telegram keeps its native
rendering, job matcher and `telegram.gap` / `telegram.mute:<chat>:<message>` keys.
These internal helpers change no frame or persisted record shape.

`src/remote/gateway.ts` is an edge inside the hub process. When `serveProject`
receives active `gatewayRemotes`, it starts one remote per messenger and opens
one dispatcher conversation for all of them as `human`. Client model frames
(messages, asks, approvals, inbox and delivery stages) fan out to the remotes;
request ids are correlated per remote. The gateway stops accepting requests
and closes its conversation before awaiting remote shutdown, ahead of store
teardown. A stop during startup fences later remote acquisition and joins any
held start before disposing its resources. `Remote.start` accepts an optional
third lifetime `AbortSignal`, aborted before that join; native clients use it
to cancel startup network calls. Older clients may retain their existing
zero/two-argument start methods. The dispatcher conversation and its
hello deadline begin only after remote setup completes. With neither injected
remotes nor an enabled, credentialed messenger, there is no gateway conversation. Telegram uses the built-in fetch client; an explicit `gatewayMessenger` replaces the native factory. The configuration
conditions are described under [Reloading project configuration](roles.md#reloading-project-configuration).
The gateway adds no listener, socket, protocol frame or hub credential.

Each remote's startup, optional `run()` lifetime promise and synchronous or
promise-returning `receive` are isolated. A failure fences only that remote's
requests and frame deliveries, clears its pending correlations, records
`{disabled: true, reason}` through the gateway's `state.forMessenger(id)` sink
and logs `remote-disabled`. Its partially acquired resources stop once, while
the hub, web edge and other remotes continue serving even during that cleanup.
Shutdown joins all run/receive work and remote stop receipts; a failed cleanup
remains a shutdown error. A directly constructed gateway defaults to a memory
sink; the daemon supplies hub.db storage, overridable through `gatewayState`.
Sinks expose `status()` and `setStatus()`. A new start resets that remote's
status before setup.
An unchanged `cland hub reload` retains healthy configured clients. If a
configured gateway has disabled a client, reload first joins its stop and
recreates the enabled, credentialed clients even when configuration and secrets
are unchanged. A configuration-disabled messenger remains stopped.
Discord reports its current outage time and gateway/REST error through the existing optional connection facts; both workbenches render failure immediately and clear it after acknowledged recovery. Doctor reads local status only, including Discord user, channel and guild ids and structured 4004/new-token and 4014/Message Content fixes.
Native Telegram membership kicks and HTTP 403 failures stop that remote and
post one redacted hub notice in General with the cause and recovery instruction.
`src/remote/notices.ts` owns that diagnostic boundary; it does not grant remote
frame authority. Disabled status retains known bot links and successful traffic
times while reporting disconnected. A fatal membership update records its cause
and notice before consuming its cursor, so restart does not replay the kick.
`src/remote/redact.ts` exports `remoteRedactor(secrets)`, a project-owned mutable
registry. Its callable form masks registered values and conservative URL, Bearer
and token/key contexts, flattens diagnostics and caps them at 500 characters.
`.text(text)` masks full documents while preserving whitespace and length apart
from replacements; `.value(record)` masks nested JSON string values for journal records while
preserving schema keys. `redactFrame(frame, policy)` masks content fields and
refuses a credential collision with routing or correlation values before dispatch
or delivery, disabling only that remote. It never rewrites protocol identities. Repeated masking preserves inserted markers. `.register(values)`
adds credentials and retains rotated values for late errors from old consumers.
The daemon resolves and validates secrets before opening logs or listeners, then
calls `validateAndRegisterSecrets(secrets, remoteOutput)` and supplies that registry
to both gateway startup paths. The same closure uses the daemon
environment and registers the final resolution on reload before gateway replacement. Gateway inbound/outbound frames, status reasons,
logs and cleanup errors pass this boundary. Existing plain-function redaction
injection supplies the same policy to diagnostics and structured content. Reload
reuses the project registry, so old and new credential values are masked during
replacement construction and cleanup. Each in-process project owns a separate registry.

Every new remote or speech write must use this API before its sink: `.text` for
artifact contents, `.value` for journal records and `redactFrame` for frames; use the callable
form for diagnostic errors. Native edges can upload human files through `artifact.upload`; other artifact actions remain refused. The native journal and artifact sink
regressions exercise the shared API for media/speech producers. Legacy `start(send)` implementations remain valid;
pairing-capable adapters accept the optional trusted `pair` callback described below.

`src/remote/authority.ts` permits exactly these existing requests:

- `topic.send` into `general`, or with `replyTo` naming a stored message in the
  requested topic. Cross-topic or missing-message replies are refused, including
  in General. Sends carrying `artifacts` are refused.
- `artifact.upload` under the same General/reply rule as `topic.send`, creating human files and one message.
- `topic.answer` and `approval.answer`, through their existing human handlers,
  excluding ids in the local `pairing:` namespace.
- `hub.status`, `task.list` and `inbox.list`.

The dispatcher checks this deny-by-default policy before replay, validation or
actor resolution. Every other request, including session lifecycle, release,
push, sync, configuration, other artifact actions, pairing approval and unknown frame
names, returns `ok: false`, `code: "forbidden"` and a reason naming the request.
Any own `as` field is refused. The gateway owns the client hello and subscribes
to model frames; a remote cannot open another identity or subscription. Local,
web and spoke clients retain their existing policies. Pairing rows are removed
from remote inbox broadcasts, snapshots and `inbox.list` results, and excluded
from remote inbox/status needs-you counts.

Each remote supplies its trusted `via` (`telegram` or `discord`) to the gateway.
The gateway passes it as in-process request metadata on the shared conversation,
never as a client-controlled frame field. Human messages and answer messages
record that value; ask and approval outcomes carry it into live cards, history
and the durable inbox archive. Denial notes sent as human messages when a
harness cannot carry them retain it too. Both workbenches show `via Telegram`
or `via Discord` on remote messages and outcomes. Local messages keep `hub`;
local approval sources remain `neovim`, `web` and `harness`. No new feature
negotiation or protocol version is required: old hello and request shapes work,
and clients accept ask outcomes without `via` from an older hub or stored row.

Outgoing hub frames mask harness endpoint/display fields (`harnessId` and
`attach`) without treating them as remote routing. This keeps a launched
OpenCode session's native server endpoint private while the remote serves.
Incoming remote requests still use strict routing redaction: a credential or
URL that would change an identifier or other routing field refuses and disables
that remote before dispatch. This grants no remote lifecycle authority.

### Remote storage and poller ownership

`Store.remotes` uses Store's existing `hub.db` connection. The additive
`remote_*` tables hold per-messenger status (`disabled`, already-redacted
`reason`), pairings, waiting codes, stranger reply counts, cursor/resume/identify
scalars, chat-message maps, outbox jobs and attempts. User, chat, guild and
message ids are TEXT, including Telegram ids; Discord snowflakes must never
pass through a JavaScript number. Outbox behaviour is separate from these
storage primitives. Tokens and keys never belong in these tables.

An active daemon gateway acquires the singleton `remote_poller_lease` before
starting any remote. It records a unique owner id, PID, process start time and
precise native birth identity. A second gateway checks for release or proven
death for at most 60 seconds. A reused PID with a different native birth can be
reclaimed; unreadable birth preserves the holder, and the ps timestamp alone
never proves reuse. Native probes are capped by the remaining wait. Nothing
signals or stops the holder. The lease is released after every owned remote's
successful stop receipt; incomplete shutdown retains ownership for recovery.
With no active remotes, no poller lease is taken. There is no separate remote
state file or new CLI setting for this internal edge.

The daemon supplies `Store.remotes` as the gateway's status sink unless a test
injects `gatewayState`. Lease acquisition errors, including the 60-second
conflict, disable all of that gateway's remotes through the shared redactor,
persist their reasons and log `remote-disabled`. No remote has started, so none
is stopped; the existing poller owner, hub and web edge remain serving. A stop
requested while waiting cancels startup instead of recording a remote failure.

### Pairing codes

`src/remote/pairing.ts` owns waiting requests and stranger reply counts on the
existing `Store.remotes` tables in `hub.db`. A pairing-capable platform adapter
receives `pair(identity)` as the optional second argument to `Remote.start`.
It calls this trusted in-process callback for a stranger's pairing gesture,
after validating the platform's private-chat/interaction identity. The callback
uses the adapter's trusted `via`; it is not a remotely callable protocol frame.
A string is one reply to send privately (ephemerally on Discord); `null` means
silence. The adapter, not the callback, performs the platform send.
The native Telegram client registers a private `/start` handler after explicit
injected handlers. Before approval it sends the callback's code/id/command
reply; in the paired chat it names the loaded project instead. Start at the
public `https://t.me/<bot>` link printed by `cland remote status` after the
enabled client successfully checks its resolved token. Identity is the private
chat and numeric sender, never the username in a command or display name.
The gateway applies its shared registered-secret policy to display names before
persistence and to private reply text; numeric identity values keep the same
refuse-on-routing-collision rule as frames.

Each code has eight cryptographically random characters from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The reply includes the numeric user id,
`cland remote approve <messenger> <code>` and the instruction to ask the project's
owner to approve. Telegram requests expire after one hour; Discord requests after
15 minutes. The hub's injected clock governs both the exact expiry and the next
expiry timer, which is drained on shutdown. Startup also removes expired requests.
Each messenger has at most three waiting codes. A sender gets at most two replies
per messenger, including capacity refusals, then silence. Counts survive restart;
a repeated live request reuses its code and original expiry. Names never identify.

Local `inbox.list`, snapshots and pushed `inbox` frames carry optional `pairings`
rows with `id = pairing:<messenger>:<code>`, numeric ids as strings, name, text,
command, `since`, `expires` and `layer = now`. They count toward needs-you.
No remote receives those rows or their count. Pairing ids are refused by the
gateway's ordinary answer handlers before dispatch, as are all pairing-approval
frame names. Existing inbox sections and departure kinds stay unchanged; pairing
expiry removes the waiting record rather than making a remote-visible archive row.

Both workbenches list waiting pairing rows in **Asks and approvals**, included
in that section's count. In Neovim, Enter opens the pairing card with messenger,
numeric user id, name, code and expiry; `1` approves through `pairing.approve`,
while `q` or Escape closes it. The card reports the paired name or the hub's
refusal. Desktop and phone web rows say "approve in the terminal or Neovim";
their detail offers the approval command as selectable, read-only text, with no
approval control or key. Approval, replacement and expiry remove the rows on
the next inbox snapshot, including during an active visit. Older hubs omitting
`pairings` continue to render the existing inbox sections.

`InboxBoard.pairingCodes.get(id)` resolves only a live request for the local
approval handler; `clear(messenger)` clears that messenger's waiting requests
without changing its stranger counts. `pairing.approve {messenger, code}` returns
`{pairing: {userId, chatId, guildId, name}}`. Only a human `nvim` or `cli` client
on the local Unix socket, or Neovim on parent-owned stdio, may call it; any own
`as` field is refused. The web
authority explicitly refuses this grant and the gateway's table excludes it,
even if a remote or browser claims a Neovim client name. Invalid, expired,
consumed and wrong-messenger codes grant no access. Identity comes from the
stored request, never from extra caller fields. Binding and removal of all that
messenger's waiting codes commit together in `hub.db`, preserving TEXT ids.

After approval commits, the gateway calls optional `pairingApproved(pairing)`
through ConfiguredGateway and the daemon control. Older adapters and Telegram
may omit it. Discord uses it to edit the private pairing interaction to
"Approved: this channel is paired with <project>". Tokens remain only in adapter
memory, keyed to waiting codes, for at most 15 minutes, and are cleared on stop
or approval. Callback failure cannot roll back the binding.

After replacement, the gateway calls the adapter's optional
`pairingReplaced(previous, text)` with the captured old numeric destination and
one line: "This project is now paired with another chat." The adapter sends it
to that destination, not its current pairing. The gateway redacts the callback
and owns its asynchronous work through shutdown. A failed send cannot roll back
the committed grant; it follows ordinary remote failure isolation. A missing or
disabled adapter reports `remote-pairing-notice-unavailable`; old adapters without
this callback remain compatible. Native adapters must implement the callback
and use their platform delivery policy. Manage bindings with the
[remote commands](remote-commands.md#remote-commands); issuing a code grants no remote access.
The service's change notification invalidates dispatcher read replay immediately at
persistence, independently of the coalesced inbox delta. Platform factories remain
injectable; native Telegram connects the callback to `/start`, and no real messenger is needed
for the [component regression](../agents/tests/hub-test-pairing-codes.test.ts.md).

