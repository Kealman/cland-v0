## Negotiated connection snapshot

A human client can add `features: ["snapshot", "numbered-deltas", "slim-frames"]`
to its existing protocol-2 hello. Unknown feature names are ignored. The welcome
includes `features`, the accepted subset; `snapshot`, `numbered-deltas` and
`slim-frames` are supported independently.
A local hello without `features` keeps its existing welcome and receives no snapshot;
its additive `remote.state` frame follows the welcome. Unknown events are ignored.
An empty list receives `features: []`. Spoke hellos are unchanged.

### Liveness, version skew and terminal reservations

A client marks the hub live after an authenticated reply. Keep version-mismatch reloads bounded per build, including when a late valid reply arrives after a watchdog or retry (A-8634 R8; T-984, T-985, T-986, T-989, T-992, T-1046, T-1055).

The web edge sends a WebSocket ping every 30 seconds and terminates a socket
at the first sweep with 60 seconds of silence. Pongs and incoming bytes refresh
that deadline; an application frame still arriving is live traffic too.

Every web welcome includes the negotiated `features` list (empty without opt-in)
and `buildStamp`: the served bundle's source digest from `build-stamp.json`, or
`null` when that receipt is absent or invalid. The digest is read at each welcome,
so rebuilding the bundle needs no hub restart. Vite embeds the same digest in
the entry HTML's `cland-build-stamp` meta tag. A page with a different stamp
reloads once per target build per tab; the guard prevents repeated reloads if a
proxy keeps serving old HTML. With storage unavailable it keeps the page usable.
A protocol-refused web hello gets error code `version`, `action: "restart-hub"`
and an instruction to restart the hub. The page shows **Restart hub** and stops
retrying. The web edge cannot perform the restart itself.

The eight reservations for a later terminal are:

1. Text messages carry JSON. Binary messages are reserved for streams and are
   refused with close code **4003**, reason `binary frames reserved for streams`.
2. Streams stay outside the live model: no snapshot, journal or catch-up payload
   carries terminal bytes; no stream is admitted yet.
3. Sequence numbers count committed model deltas. Welcome, results, snapshots,
   pings and future stream frames do not consume them.
4. Each connection's model queue must have a resync boundary; the 4 MiB queue
   and resume ring are owned by the resume slice (T-986).
5. The present socket carries model/control traffic only. A terminal extension
   must preserve model priority or use a separate socket before admitting streams.
6. Upgrade routing admits only `/ws`, with a fresh Host, Origin and cookie check
   on every socket. One cookie can authenticate several sockets.
7. `FRAME_LIMITS_BYTES` separates JSON (**1,048,576 UTF-8 bytes**) from binary
   (**0 bytes admitted**). Oversize JSON closes with **1009** before parsing;
   even an empty binary message is refused. WebSocket control frames retain
   their RFC 6455 125-byte cap. Snapshot domains have their own smaller caps below.
8. Hello/welcome negotiate features. Every adapter must declare `terminal`,
   currently `"none"`, in its capability table, readable in `session.list.adapters`.

After the welcome, an accepted snapshot produces seven ordered frames:
`{type: "snapshot", epoch, seq, domain, value}`, then
`{type: "snapshot.end", epoch, seq}`. All eight share one core-lifetime UUID
epoch and the current model delta number. Composing another snapshot does not
advance that number. A client commits the replacement model only at the matching
end marker. With `numbered-deltas`, the live model stream begins immediately
after that marker; `subscribe` is idempotent. With `snapshot` alone the existing
subscription request still enables subsequent events. The [connection events filter](connection-events-filter.md#connection-events-filter) can be replaced on the same connection. A `subscribe` received
during snapshot preparation takes effect after the snapshot transaction finishes.

Unnumbered local clients receive current `presence`, `remote.state` and
`hosts.state` replacements when their first model subscription is registered.
This closes the gap between the facts sent with hello and a later `subscribe`:
a publication in that gap must not leave the client with an older projection.
Registration and capture are synchronous; publications triggered while sending
the replacements are held and drained afterwards. Repeated subscriptions do not
replay those facts. Numbered and host-scoped clients keep their existing flow.
Other model domains are initialized by explicit reads or the negotiated snapshot;
subscription does not replay messages or retained event history.

| Domain | Value | Maximum UTF-8 JSON frame bytes |
| --- | --- | --- |
| `tracker` | `levels`, `ladder`, kind `prefixes` | 65,536 |
| `items` | `items`: explorer summaries, latest verdict of each kind and its original round | 1,048,576 |
| `sessions` | merged `rows`, compatibility `processes` and `presence`, `archived`, `roles`, `crew`, `coordinator`, `verification` queue | 1,048,576 |
| `topics` | `topics`: open/waiting plus closed topics updated within the last seven days (inclusive) | 1,048,576 |
| `inbox` | current inbox sections, including `needsYou` | 1,048,576 |
| `events` | first `events.list` page: `rows`, `before`, `more` | 1,048,576 |
| `accounts` | registry path/error and accounts with current limits | 262,144 |

`SNAPSHOT_LIMITS` in `hub/src/protocol.ts` owns the domain caps; byte counts include
the envelope. Suite history, covers and full item verdict histories stay out;
`task.view` retains verdict history. Accounts and the journal page are prepared
asynchronously before composition. Journal revisions detect writes during the
read and retry up to three times. All model gathering, frame-size validation and
snapshot writes then run synchronously in one loop turn, without an intervening
frame on that connection.

Overflow is checked for every domain before the first snapshot frame is sent.
The hub logs it and sends
`{type: "snapshot.refused", code: "frame-too-large", domain, bytes, limit}`.
Preparation errors or repeated journal changes instead send
`{type: "snapshot.refused", code: "unavailable", message}`. Both keep the
connection usable; the client falls back to individual reads. An accepted
feature in the welcome alone does not prove a completed snapshot.

### Numbered model deltas

The hub computes item status, glyphs, blocked/next facts, roll-ups and progress over the complete tracker index; clients retain presentation ordering and folds. Label counts derived from fetched rows as “loaded”, and keep group metadata complete when a page begins inside a group (A-8634 R4; T-979, T-1044, T-1061, T-1053, T-1052, T-1072, T-1058, T-1071; A-9063 R7 sources T-1075, T-1076, T-1056).

Use one committed publication order and frame-write boundary for live, cached and replayed bytes; connection filters apply to replay too. Snapshots and control frames consume no delta numbers; pagination uses durable monotonic ids and resume uses the client's last applied cursor (A-8634 R8; T-984, T-985, T-986, T-989, T-992, T-1046, T-1055).

Every committed model publication, including tracker `task` changes, passes
through the core's single emit point. A client accepting `numbered-deltas`
receives the usual event fields plus `{epoch, seq}`: the first delta after its
snapshot is `snapshot.seq + 1`, then each following delta increments by one.
All clients share the same sequence within that epoch. The epoch changes when
the core restarts. Request results, welcome, snapshot frames and keepalives do
not consume numbers; future binary streams stay outside the model sequence too.
Without `snapshot`, `numbered-deltas` starts at the current live stream.
A reconnecting client adds `resume: {epoch, seq}` to its hello, where `seq` is
its last **applied** model delta (or completed snapshot). This requires
`numbered-deltas`. The welcome still accepts `snapshot` and `numbered-deltas`.
A covered cursor in the current epoch suppresses the initial snapshot: the hub
replays exactly `seq + 1` through its current number in the negotiated full or
slim shape, then sends live deltas. The subscription is established before
catch-up writes; live changes are held until replay finishes.

The in-memory ring retains at most **15 minutes** of deltas and **4 MiB** of
UTF-8 JSON across its distinct full and slim representations. It records deltas
while no clients are connected too. The oldest entries are evicted at either
bound; a cursor immediately before the oldest retained number is still covered.
An empty interval at the current number is covered. A future number, an evicted
interval or a different epoch requires a fresh snapshot. A hub restart creates a
new epoch and an empty ring, so a resume across a restart takes a fresh snapshot.
Only model deltas enter the ring: results, welcome, snapshot, `resync`, keepalive
and future binary stream frames stay outside it.

An existing connection can send `{type: "resume", id, epoch, seq}` with the same
rules. It replaces that connection's model subscription, completes replay or the
fallback snapshot, then answers with a normal result containing `{replayed,
epoch, seq}`. Wait for the current snapshot/replay transaction before requesting
another resume. If catch-up is unavailable and `snapshot` was not negotiated,
the hub sends `{type: "resync", reason: "snapshot-required"}` and holds model
output; reconnect with both features to obtain a snapshot. Snapshot refusals
retain their documented fallback to individual reads.

A featured connection whose next model frame would take its unsent transport
queue past **4 MiB** gets `{type: "resync", reason: "queue-limit"}` instead.
The transport queue is also checked after writes to account for framing overhead.
That ends its model stream, leaving the socket and request/reply path open. It
emits only one resync until the client explicitly resumes. Model output remains
paused even after the queued bytes drain. After draining, the client sends
`resume` with its own last applied number, or reconnects with `hello.resume`.
It may receive catch-up or a fresh snapshot if retention no longer covers it.
Unsent bytes come from the WebSocket's `bufferedAmount` or the Unix/stdio
writable queue; snapshots and replay share the same model output limit.
Neovim's hello has no features and its existing frames are unchanged.

`inbox`, `presence` and `verification.queue` replace their whole domain.
`message`, `delivery` and `event` append (an event's `replaces` retains its existing
coalescing semantics). Item, topic, process, account and artifact rows update by
their stable identities. A `task` with `item: null` removes that item.
The verification queue is pushed when its holder, remote holders, waiters or
other queue facts change, never for elapsed run/wait time or a decreasing ETA.
`suite.queue` reads still return current timing.
An optional `localBlocked: { reason }` exposes failed local compatibility
inspection or release recovery until its successful retry. The CLI shows `local: blocked · <reason>`;
local waiter ETAs are unknown. Existing holder and waiter fields stay present.

The hub shares immutable layer encodings within a publication chunk, including
the full legacy encoding; unchanged maps require no repeated entry comparison.

With `slim-frames`, `task` carries the changed item and a `layers` map containing
only entries that changed since the preceding model state. Changes in the active
release can update other items' layers; a null layer removes a deleted entry.
A title-only edit normally has `layers: {}`. The all-items layer map remains on
legacy `task` frames. A pin or mute on a featured connection sends a `visibility`
frame with `rows`: affected topics, presence (`sessions`), processes, retained
thread messages and artifacts (including artifacts inheriting a topic choice).
Replace these rows by id,
including messages already loaded from older history pages; do not append them.
Affected history is selected through indexed keyset pages before attachment
resolution. Topic choices also follow artifact references across threads when a
file has moved into a folder in that topic. Message keys are deduplicated and
limited before their bodies are decoded. Each chunk carries at most 100 rows, targets 256 KiB and always stays
within the 1 MiB wire cap; a single oversized row refuses the request. The hub
yields between pages and flushes current projections before yielding, so a
concurrent choice cannot be followed by buffered rows with an older projection.
The request result follows the final chunk. Inbox replacement continues on its
ordinary coalesced publication. Legacy-only choices do not traverse history.
Unfeatured clients retain their bare `visibility` notification and existing
frame shapes. Each model frame is projected once and its JSON serialization is
shared by every receiving connection with the same negotiated feature set on
the Unix socket, stdio and both WebSocket edges.

`node hub/scripts/measure-snapshot.ts /path/to/project/.cland/tasks` copies the
tracker into a disposable root, seals HOME/XDG/Git and provider/account variables,
and reports bytes per domain plus five compose/framing samples. It never opens
the source tracker database or runs Git. Other domains use empty/default scratch
state and are labelled accordingly. Setup, copying and transport are excluded.

