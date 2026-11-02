## Coordinator subscription procedure

- Default subscriptions: tree outside active leads; topmost Lead death/long idle. Extras: `subscribe`/`subscriptions`. Events digest; `ready` starts merging.

### Web verification phase

New Web files also receive a separate report-only check when load gating is
selected: ten fresh file processes, two workers, under an owned CPU load worker.
Host selection compares changed Web tests with the merge-base tree of HEAD and
freshly fetched dev, carrying new paths as `selection.webRepetitionFiles`.
The runner intersects that list with admitted phase files and performs no Git
lookup. A checked empty array means none new; an absent field means missing
proof, including hubs started before this capability. Cache identity preserves
the distinction. The check preserves the machine lease and runs after ordinary
Web timing ends. Existing files get no repetitions.
Verify retains the exact N/10 count, diagnostics and extra wall time; missing
baselines, incomplete summaries, failures and skips supply no passing proof.
This rollout does not block ready and does not change ordinary Web failure
handling or the T1–T3 identity load gate. T0's shared Web AST scan refuses raw
viewport changes outside `resizePage` and root-negated inline wait predicates.
See [Web load-race guards](../agents/tests.md#web-load-race-guards).
Before restart #54 the missing-field report is expected. The Coordinator records
the post-restart droplet count as C2 landing evidence, outside the pre-merge gate.

The Web phase is outside T0–T3 and runs after hub phases: machine resource, two
local workers, four droplet workers. Task verification includes it, even under
the ordinary T0–T2 plan; merge batches add it after T1 when the candidate diff
touches web/ (after configured tiers if T1 is absent). Other batches keep their
existing tiers. Periodic dev and integrated/occasion
runs include it. Reduced hub/Neovim modes include the Web smoke. Close shards
carry Web with Neovim once. Tier commands infer Web only for candidates declaring
`supportsWebPhase` in the cland runner; pinned commands and result/cache identity
retain its coverage. Root check builds the browser bundle; hand-run package suites
check its source receipt and build once before workers if needed.

Shards containing an installation-bundle reader also build before workers, even
without Web or an available browser. The named `installedBundleReaders` list in
`hub/test/run-suite.ts` covers `web-auth.test.ts` and all tests invoking the real
doctor bundle check, including `doctor-cli.test.ts`. Standalone `web-auth.test.ts`
runs use the same helper; targeted doctor CLI runs require a current build.
Delivery cleans ignored `web/dist`; matching prepared dependencies skip
`npm ci`, and a matching host gate skips the remote check. A warm image therefore
does not guarantee a bundle. Cold installs and the Web-owning shard can mask this.
Build failures name `npm run build --workspace web` as the prerequisite command.

`npm install` prepares the bundle and pinned Chrome Headless Shell in node_modules.
`npm run test:web:install -- --with-deps` repairs the shell and Linux libraries.
`npm run test:web` queues selected Web files; `node --test web/test/smoke.test.ts`
runs one browser file after a build. Fixtures use isolated Headless Shell profiles,
scratch HOME/XDG/Git and a `web.link` frame on a scratch `projectHub`. They retain
CSP, poll through page evaluation, close each context, save failure traces and
prove the browser process group and hub edges are gone before deleting roots.
The 4 s/test and 40 s/phase budgets follow duration report/enforce mode; a separate
hang guard reaps owned processes after 60 s without runner test start/finish
receipts, or at a total ceiling of three times projected Web wall (minimum
300 s). Projection uses selected file baselines and actual phase workers;
unbaselined files use the configured Web file budget (default 40 s).
Guard enforcement is independent of budget report/enforce mode. Web gets no
T1–T3 identity load-gate repetitions. See
[the Web phase](../agents/tests.md#web-phase) and
[browser fixture usage](../../web/README.md#browser-tests).

Missing browser executables or libraries produce "Web unavailable on this machine"
with the reason and `webPhase: {status: "not-run", reason}` in the durable job and
result receipt. Other phases continue. This supplies no passing Web receipt and
is ineligible for cache reuse. The candidate prerequisite module resolves the pinned Headless Shell and checks
Linux shared libraries without launching a browser. Prepared snapshots carry these
libraries; missing image libraries require the human or Coordinator to rebuild the
snapshot as described under [Controls and the prepared snapshot](running.md#controls-and-the-prepared-snapshot).
A broken probe remains an error.


### Startup replies

Default `hub.status` is compact for every client. `suites` retains queued and
running receipts in full. `recentSuites` holds only the latest completed result
per `(kind, occasion)`, at most 20: `{id, kind, occasion, head, exit, finishedAt,
artifact}`. Kind is `task` or `integrated`; an absent occasion is `null`.
Completed summaries omit selection maps and output tails. Historical `covers`
and duplicated `harnesses` are absent. `history: true` (CLI: `cland hub status
--history [--json]`) restores full historical diagnostics. Neovim consumes only
presence, crew, verification, keys, tracker, coordinator and needsYou; the CLI's
root lookup also uses compact status. The web client has no history consumer.
The copied-state status target is 64 KiB.

Startup indexing validates each plan once after all item files are indexed;
unchanged child reads do not revalidate the entire parent plan. Restoring stopped
sessions writes only their affected queued suites, rather than rewriting retained
suite history. The daemon awaits that scan's durable migrations without scanning
the folder again, and one journal prefix supplies plan, Agents and subagent restore.
A single text scan selects those startup records before JSON decoding unrelated
retained history. Existing role policy skips installation discovery. Terminal
process recovery commits its checkpoints together and publishes observers after
that commit; retained suite history reuses its original serialized snapshots.
Inbox status considers latest addressed reports only in topics waiting for the
human; unread direct messages and pending requests remain current. Status reuses
the current inbox count until a section changes or a message crosses its seven-day
age boundary. Non-approval process metadata and journal event projections do not
invalidate that count; ordinary coalesced inbox publications still refresh details.
`hub-startup-step` records identify tracker, journal, store, suite and session
restore phases. Each phase ends with `hub-startup-step-completed`, naming its
monotonic `durationMs` through the next phase or serving. The listening-to-serving
window names listener binding, web listener binding, session restoration and
discovery publication separately. Executor lease recovery is admitted only after
serving (`executor-recovery-started`); neither startup nor ordinary status and
bridge traffic waits for its provider calls. Recovery keeps its existing bounded
completion/deferred receipts and periodic retries. To profile a disposable copy, use
`node hub/scripts/measure-startup.ts /absolute/project/.cland`; add `--cli` to
measure the real `cland hub start` through the first status socket reply against
the five-second target. The default run measures dispatcher composition separately
against a 50 ms target. See [copied-state measurement](../agents/tests.md#startup-reply-byte-budgets-t-1038)
for isolation, timing boundaries and cover-quiet requirements.
The generated T3 fixture guards startup work through the first completed status
socket reply: one checkpoint over 1,645 retained jobs, at most four explorer
recomputation batches, and at most two reads per durable item file. The
`verification-checkpoint` completion log includes `jobs`, the number visited
including unchanged retained snapshots; it is emitted after the checkpoint
transaction and in-memory publication, and does not mean that many rows changed.
The historical per-stopped-session suite-history rewrite must fail the checkpoint
count. CPU, wall time and named startup-step durations are diagnostic; a gross
30-second completed-status hang guard and 120-second whole-test watchdog remain.
These counts guard known repeated work, not arbitrary CPU or I/O inside a work
unit. Reply byte limits remain exact; the copied-state CLI measurement retains
its five-second end-to-end limit.

`topic.history` returns complete messages in byte-capped pages below 256 KiB,
including envelope space. `more`, `before` (exclusive message id) and `after`
(exclusive sequence) identify continuation. The page always contains at least
one available message, even if that message alone exceeds the cap; bodies are
never truncated. In Neovim, `A` in the thread reads older pages on demand,
including pages shorter than the requested row limit.

`artifact.list` returns at most 100 entries, newest first, byte-capped below
256 KiB with envelope space. When more remain, `{more:true,before:"A-n"}` names
an exclusive numeric-id cursor; pass `before` on the next request. A single
oversized entry remains whole. The one-id detail/folder read is unchanged.
`cland artifact list --before A-n [--topic topic] [--json]` and the spoke tool
accept the same cursor. Neovim reads one page on startup; opening the artifact
browser or palette reads the next page, and scrolling or selecting More artifacts
reads another. Page snapshots replay concurrent artifact events over received
rows, without automatically draining the archive at startup.


### Discord REST boundary

`remote/discord-api.ts` is the fetch-only API v10 client. The production root is
`https://discord.com/api/v10`. For fake-server tests, the constructor's `apiRoot`
or `CLAND_DISCORD_API_ROOT` may override it with an explicit numeric loopback HTTP
URL and port (127.0.0.1 or [::1]); credentials, queries, fragments, hostnames and
redirects are refused. Tokens travel only in the Bot Authorization header.
The User-Agent uses the project URL and reported cland version.

The client reads application, gateway, channel and history facts; snowflakes
remain strings. Creates require a 1–25 character nonce and enforce it, and both
creates and edits always suppress mention parsing. Each call has a 35-second
deadline and accepts an AbortSignal. Errors retain only route templates, status,
numeric JSON code, retry_after seconds and a redacted description; no native
fetch cause escapes. This boundary makes one attempt per call; pacing and retry
decisions belong to its caller. This module provides the REST boundary; remote
lifecycle and gateway connections belong to their callers.

The in-process fake at `hub/test/fakes/discord/fake-api.ts` uses fabricated
credentials and IDs above 2^53. Its control API supports `configure`, `say`,
`fault`, `release` and `state`. See the
[Discord REST test notes](../agents/tests/hub-test-discord-api.test.ts.md).

### Discord cards and notices

With Discord enabled and paired, inbox publications enqueue open asks, hub approvals and needs-you notices as durable
card jobs ahead of queued General messages, oldest first. General mute does not
mute cards. A legacy card has a bold title, its question and at most three action
rows: options five per row, then Other answer… (when free answers are allowed)
and Decline…. Options use text labels if all fit 34 code points, otherwise numbered
buttons and an option list. Large questions are clipped with a workbench marker
within Discord's 2000-code-point content budget.

Component ids are checked against the stored ask model and mapped native message.
Only the paired guild/channel/user can act. An option click commits topic.answer
through the gateway with Discord provenance and interaction ingress before a
single type-7 update removes its components and shows the shared outcome line.
At two seconds pending hub work is acknowledged with type 6; completion then
uses a durable outbox edit. Native callbacks bypass message pacing. Other answer…
and Decline… open a type-9 modal with the question, a required paragraph field
(maximum 4000 characters), and the title Your answer or Why decline. Paired-user
submissions use the same topic.answer gate, storing the text or decline reason
before the type-7 outcome update (type 6 after two seconds).

Known closed Discord asks receive an ephemeral “Already answered” without an
answer frame, and their durable outcome edits repair every mapped copy. Foreign
clicks and modal submissions receive “This card is for the project's owner”
privately before any hub frame; unissued and cross-ask custom ids are refused.
`/cland inbox` re-sends open ask and approval cards plus notices oldest first with an interaction-scoped key
separate from live publication, returning the count privately or “Nothing needs
you”. Earlier copies remain usable and all copies close together.

Codex and OpenCode approvals use the shared approval model: session and harness,
a fenced command/files preview within 2000 code points, and “full command in the
workbench”. Offered choices are Approve once (Success), Always allow (Primary)
and Deny (Danger), with `approval:<id>:<choice>` ids checked against the stored
model and native approval mapping. `approval.answer` commits with Discord
provenance before its type-7 callback; pending work defers at two seconds.
Closed, withdrawn and harness-answered approvals edit every mapped copy through
the same durable queue and original nonce reconciliation window as asks.
Ask and approval ids cannot substitute for each other.

Plans, review/QA/handover requests, item-topic messages and Claude Code approvals
are 📥 notices without components. Plans carry only the configured `[web] origin`
when set, never a credential link; plan approval stays in the workbench. Long
plan titles are clipped with an ellipsis while preserving the instruction and
configured origin within the native content budget.
Request and item-message replies use the stored topic and message reference.
Plan and terminal-approval replies go to General prefixed with their plan or
session reference. General mute leaves notices and approvals enabled.

Ask state changes and inbox departures enqueue REST edits for every mapped
Discord copy, removing all components. This includes Telegram, Neovim and web
answers, withdrawal and topic/item cancellation. Identical edits coalesce per
card and run ahead of General. Closure is durable: sourceOpen drops unsent
closed cards. Already-attempted uncertain cards reconcile their receipt or the
unchanged enforced nonce within the original two-minute window; settlement stores
the mapping and queues its outcome edit ahead of General, including after restart.
Startup also folds closed mapped cards before draining any General job, recovering
a crash after mapping commit but before the owed edit was enqueued.
A replacement POST used for reconciliation carries the closed outcome without
buttons. Attempts past the window remain fenced. Historical
outbox payloads remain readable; no additional wire field is required. No new terminal
command, hub frame or role permission is required. See the
[card test guide](../agents/tests/hub-test-discord-cards.test.ts.md).

### Discord gateway connection

With `remote.discord.enabled` and a resolved `discord.token`, the default
messenger factory reads the application and connects using the pinned `ws`
client. REST defaults to `https://discord.com/api/v10`;
`CLAND_DISCORD_API_ROOT` accepts only an explicit loopback HTTP fake with a port.
The production gateway must use `wss` on `discord.gg` or its subdomains; when
using the fake REST root it must instead use `ws` on explicit loopback with a
port. Credentials, query strings, fragments and redirects are refused before
Identify. The socket requests API v10 JSON, without compression or sharding,
and identifies with intents 33281 and no presence.

Hello schedules the first heartbeat at its interval multiplied by random jitter;
subsequent heartbeats follow the interval, and opcode 1 sends immediately.
`cland remote status` reports connected only after READY or RESUMED and an acknowledgement
within the last interval, with successful inbound/outbound timestamps and the
application's invite (`scope=bot&permissions=117824`). On hub stop, Discord closes
with 4000 and stores the session id, validated resume URL, bot id, handled sequence
and stop time under `discord.session` in hub.db. The next enabled start attempts
RESUME before Identify. Disabling Discord (or removing/replacing its token) through
configuration and reload closes with 1000 and forgets the session.
Optional adapter `disable()` marks configuration removal before the normal stop;
older injected adapters can omit it. Discord pairing interactions use the native command router described below;
message handlers use its optional native dispatch extension point.
A missed heartbeat ACK terminates the transport (no 1000/1001 close frame).
Drops, opcode 7 and resumable opcode 9 reconnect to the validated resume URL
with session id and sequence. A successful resume spends no Identify. A working session resumes immediately; resume attempts spend no Identify budget. Opcode 9 false clears the session and waits a
random 1–5 seconds before the next Identify admission check. Message ids are durably deduplicated;
interaction ids are also durably deduplicated. During RESUME replay, ordinary
paired input carries its written time and the hub return time. Replayed commands
are dropped. Component presses receive no callback and answer no ask; only their
mapped open cards are re-sent with the lost-button warning, and the old copy is
edited to “↓ Re-sent below” without components. Owed resends use durable intents
and stable outbox keys; unpressed cards stay in place. No interaction token enters
these records. Every RESUME start closes card recovery admission, including resumes with no new
presses; RESUMED joins all replay input before card recovery; live callbacks
retain independent deadlines. Each RESUME captures its own return time. Replay
dispatches settle in order before their sequence is saved. A terminal inbound
refusal is durably deduplicated without stopping Discord; cancelled input stays
unconfirmed for replay. A terminal 1000 close clears in-memory session facts too,
so a later owner stop cannot restore that session. Replay warnings consume fixed
rendering budget before variable text, preserving fences and option explanations.
Every Identify waits at least five seconds after the previous one, including
across hub restarts. The Discord-scoped `discord.identify` record in `hub.db`
retains rolling 24-hour timestamps, failed-attempt backoff and the warning time.
Attempts are reserved before socket I/O; a crash can conservatively overcount.
Only an Identify that closes before READY grows backoff: 5 seconds doubled to
5 minutes, with equal jitter (half to all of that delay), also subject to the
five-second spacing. READY clears backoff; an established session's drop adds none.
Before each Identify, a fresh `GET /gateway/bot` must report at least 100 remaining
session starts. Below 100, Discord stops with `identify-budget` and the UTC reset
time derived from `reset_after`; wait until then and reload. General receives one
warning at 500 local Identifies in 24 hours, at most once per rolling day. Other
sessions of the same bot consume Discord's budget too; use one bot per project.
Injected clients without a Store retain this budget only for their lifetime.
Connection loss changes status to disconnected immediately; after three minutes
General gets one `Discord remote offline since HH:MM: <reason>` line and one
recovery line after a recent ACK. A settled paired-channel POST/PATCH failure
also makes status disconnected (a missing-message PATCH 404 stays job-local);
it stays so across socket ACKs until a paired
send succeeds. Health is reported after REST pacing and retries, through an
optional native subscription carrying only channel id and success. Native
message refusals log `discord-rest-refused` with an allowlisted route and numeric
status/code; payloads, provider error messages and credentials stay private. A new send
intent probes an unavailable outbox lane; prior missed jobs remain fenced.
Transient socket loss keeps reconnecting.
A terminal connection failure disables only Discord with cause and reload guidance. Before connecting it requires either Message Content
application flag (1<<18 or 1<<19) and an empty Interactions Endpoint URL.
A wrong setting stops before Identify. Close 4004 means `token`, 4014 means
`message-content`, and 4010–4013 mean `gateway-refused` with the numeric code.
A 4003 gets one fresh Identify; a second stops with `gateway-refused`.
REST 401, 40001 and 50014 mean `token` across all request paths.
Each stop writes one General cause/fix and structured status; `cland hub reload`
retries the stopped client. `cland remote test discord` reads the application
and posts exactly one fixed line when paired (no message when unpaired).
Terminal stop closes with 1000 and joins the socket; ordinary stop terminates
resumably. Both clear heartbeat, Identify admission, reconnect and offline-notice timers. The existing role and frame authority remain unchanged.

The token is private to the REST authorization header and gateway Identify/Resume;
dispatch logs retain only validated event types and numeric ids. Native socket
exceptions never become status or General text. See the
[Discord connection test guide](../agents/tests/hub-test-discord-messenger.test.ts.md).


### Discord command registration and pairing

When enabled with a resolved token and reachable API, Discord compares its global
command list at startup and bulk-overwrites only a missing or changed definition.
`/cland` is guild-only (`contexts [0]`, `integration_types [0]`), administrator
visible (`default_member_permissions "0"`), with pair, status, inbox, mute, unmute,
decision, question and help; decision and question require text. The stored
guild/channel/user identity gates every command. Status, help, mute, unmute,
decision and question are implemented alongside pairing; inbox retains its private
availability note until card publication is available.

Run `/cland pair` in a guild text channel, then approve the private code locally
with `cland remote approve discord <code>` or Neovim. The code lives 15 minutes;
its private reply includes the numeric user id and approve command. Null pairing
callback means silence. The paired user's pair in that channel names the project;
in another channel it issues a code to move the remote on approval. A different
user or a status in another channel gets a private refusal before any hub frame.
The captured previous channel receives one replacement line. All snowflakes
remain strings and TEXT through restarts. Native callbacks are type 4/flag 64,
bypass outbound message lanes, and suppress mentions on sends and edits.
Interaction tokens never enter frames, logs, journals or the database. See the
[Discord pairing test guide](../agents/tests/hub-test-discord-pairing.test.ts.md).

### Discord phone commands

With an enabled, paired remote and reachable REST/gateway, `/cland status` and
`/cland help` render the neutral phone reply model as Discord Markdown: a bold
title, bold group labels, one fact per line and session/command bullets. Status
ends its groups with **This channel** and appends small-text outbox depth,
identifies reserved in the rolling last 24 hours and platform remaining session
starts. Reservations may conservatively overcount an interrupted Identify;
remaining starts are fetched from `/gateway/bot`, never inferred from the local
count. Help ends with the pairing and workbench trust lines.

`/cland mute` and `/cland unmute` apply the durable
`discord.mute:<interaction id>` receipt once. Only eligible General sources are
suppressed and counted, before splitting; hub notices remain eligible. Unmute
says “N messages arrived while muted”. Telegram's mute state is independent.
`/cland decision` and `/cland question` send their text field to General with that
kind and Discord provenance, using the interaction id as ingress identity. The
private “Sent” reply follows the hub's stored result.

Commands acknowledge privately with type 4/flag 64. If work is pending after two
injected-clock seconds, a type 5/flag 64 callback defers the response before the
three-second deadline; completion joins that callback before editing `@original`.
Status/help pages are packed within 2000 Unicode code points, preserving escaped
literal atoms and all facts. The first page uses the callback or original edit;
remaining pages use private webhook followups (flag 64 and empty allowed_mentions)
in order, with the gateway/trust footer on the final page. These interaction
responses bypass message lanes and the outbox; no failed or unknown followup is
replayed. Shutdown
cancels deadline timers, pending frame requests and native I/O before storage
closes. Interaction tokens remain adapter memory only. Existing role clauses
cover these human actions without additional permissions. See the
[Discord command test guide](../agents/tests/hub-test-discord-commands.test.ts.md).

### Discord General delivery

With Discord enabled, a loaded token, reachable REST/gateway and an approved
pairing, General uses the shared mirror filter and an `author · kind` header.
The renderer aligns Markdown tables in code blocks, turns headings deeper than
level three into bold lines, rules into ─ lines and task boxes into ☐/☑, and
escapes literal `||` outside code blocks. Parts fit 2000 Unicode code points,
including the repeated header and `n/m` suffix; split code blocks close and
reopen with their language. Conversion failures fall back to the plain source.
The complete rendered group is enqueued in one synchronous transaction before
any part starts delivery, so later sources cannot interleave and crash replay
uses identical bytes.
Workbench authors show “you”; Telegram authors show “you (Telegram)”. Progress
and hub notices add `SUPPRESS_NOTIFICATIONS`; other messages notify normally.
Every create and edit disables parsed mentions.
The durable Discord outbox owns one lane per channel over
the neutral Outbox. Creates carry a job-derived nonce of at most 25 characters,
`enforce_nonce`, `SUPPRESS_EMBEDS` and an empty `allowed_mentions`. The attempt
precedes I/O; the returned message id and sent state commit together. Recovery
uses an observed own-message nonce first, otherwise the same nonce strictly
within two minutes of its original attempt. Each recovery POST records a new
attempt without renewing that window; eligibility is checked again before I/O.
Startup cancellation aborts and joins replay I/O before shutdown. Older unknown deliveries are fenced (General
uses the neutral missed/gap classification). Discord promises only “the past few
minutes”; this conservative local window is not a guaranteed platform TTL.

Paired-user replies resolve `message_reference.message_id` through the durable
native message map, retaining the topic and `replyTo`. Outbound General replies resolve that source in the current paired chat, including the human’s own input and cross-remote copies. Telegram sends `reply_parameters` with `allow_sending_without_reply: true`; Discord sends `message_reference` with `fail_if_not_exists: false`. Unmapped or deleted targets deliver once as plain messages. An explicit General reply also takes precedence over a reused artifact’s default sent-above reference; the artifact remains uploaded only once. Unknown references and explicit deleted-target markers become
plain General messages. Other members, bots and webhooks receive no feedback.
After storage, `discord.inbound:<native-id>` records the native identity and hub
message id. The outbox adds 👌 after that result and 👀 after delivered/injected;
startup reconciles missed delivery frames against the hub's durable receipt once
the conversation port is open. Each emoji has one durable job, and replay of an
uncertain reaction uses the idempotent PUT `@me` endpoint. Legacy `1` input
tombstones continue to deduplicate. Reaction jobs retain the input
receipt's user identity, rechecking the pairing after I/O before later feedback.
These reactions replace a message echo.

REST requests serialize by method, route template and channel until a response
names `X-RateLimit-Bucket`, then share that bucket/channel lane. Learning or
changing a bucket adopts the current request until its response body completes. Remaining zero
waits for `X-RateLimit-Reset-After`; limits are learned rather than configured.
A 429 follows decimal `retry_after`, capped at five minutes; a global 429 holds
all ordinary lanes. 5xx and code 130000 receive at most three retries with
1/2/4-second backoff. Interaction callbacks and `@original` edits bypass both
the lanes and outbox. A transport failure on a create gets at most one retry
with the unchanged enforced nonce, strictly within the original attempt’s two-minute window;
the immutable absolute deadline is rechecked after every queue/rate/backoff wait,
immediately before each POST. Direct client creates use their call time when no
durable attempt is supplied. An expired create stays uncertain and performs no
late I/O. Other transport errors remain uncertain. The native retries remain inside the
persisted attempt; crash recovery creates a distinct attempt as described above.
401/403/404 never retry. A definite refused create is durably dropped; a 401
stops Discord, and a paired-channel 403/404 stops it as blocked. A missing edit
or reaction (404) drops only that operation. Restoring credentials or channel
access requires `cland hub reload`. No command syntax or role grant changes.

Only the paired channel and user may send ordinary text or replies (types 0 and
19). Bots, webhooks, other authors/channels and system events receive silence.
Accepted input uses the gateway's existing chat/message ingress identity to
store a human General message addressed to the Coordinator with `via: discord`.
The cursor `discord.lastMessageId` advances after the successful hub result;
message-id deduplication survives restart. Discord does not echo ordinary text input, and
Telegram uses the shared `you (Discord)` author label. Injected handlers and old
frame shapes retain their current interfaces; no role permission changes apply.
See the [Discord message test guide](../agents/tests/hub-test-discord-messages.test.ts.md).

### Discord outbound artifacts

When Discord is enabled, has a token, is paired and can reach its API, eligible
General messages deliver files up to 20 MiB each, at most ten per message and
25 MiB per request (including multipart overhead). HTML and diagrams remain
files. Larger files become lines naming the artifact and its project-relative
path. Each group has the author/kind header; a single file with short text uses
both as its caption. Telegram-origin files use `you (Telegram)`.

Discord uses the shared artifact planner and descriptor-bound no-follow reader.
The durable messenger ledger reserves artifact ids before I/O, across pairing
changes. Later attachments reference the earlier file, replying only within the
same channel. The later message keeps its own text before the reference line,
including short text that would otherwise be the file's caption.
Only native attachment receipts count as uploaded; a partial or
text-only fallback is labelled not uploaded on a later attachment. Queued or
unconfirmed sends retain their once fence. Complete
publications commit before draining; started publications stay contiguous ahead
of new cards. File jobs contain ids and captions, never file bytes or absolute
paths. Multipart requests retain empty `allowed_mentions`, suppressed embeds,
and the original enforced nonce. A timed-out accepted send can reconcile inside
the original two-minute nonce window; old unknown sends stay fenced. Existing
JSON callers, persisted jobs and wire frames remain supported. See the
[artifact test guide](../agents/tests/hub-test-discord-artifacts.test.ts.md).

### Telegram outbound artifacts

When Telegram is enabled, configured with a token and paired, General's eligible
messages include their artifacts. PNG, JPEG, GIF and WebP files up to 10 MiB go
as photos; other files, including larger images, HTML and diagrams, go as
documents up to 50 MiB. Larger, missing or folder artifacts get a line with their
id, title, available byte size and project-relative `.cland/artifacts/…` path.
A single file and short text share a plain caption; otherwise the text precedes
files captioned with the author/kind header. Captions carry no entities and fit
1024 code points after multipart newline expansion.

`remote/artifact-plan.ts` selects files without messenger transport knowledge.
Telegram durably queues one complete publication before draining it; once its
first send starts, a persisted batch marker keeps the remaining parts ahead of
new cards/edits and General publications. Before a batch starts, urgent cards
retain priority. File jobs
contain an artifact id and caption and resolve the current artifact at delivery,
opening through the shared descriptor-based no-follow reader and confining files
to the project's artifact directory. The file type and byte cap are checked on
the descriptor, bounded contents are read under cancellation, and the descriptor
is closed before the API consumes that Blob; no checked pathname is reopened. No bytes or absolute
file paths live in those queue payloads.
Each file goes once ever per messenger remote, across pairing replacements:
a later attachment replies to its earlier native message with “sent above” in
the same chat, or names the previous delivery without an old-chat reply id in
a new chat. The reference keeps the later message's own text, including a short
caption. A queued or unknown upload
retains its fence after restart. An unattempted outage-missed job does not consume
the artifact's delivery. File jobs use General's outage/gap policy and source id;
a timeout records a missed job with an unknown attempt and never retries it.
Mute and Telegram-origin echo exclusion apply to attachments with their message.
Existing remote authority and frame shapes are unchanged.

#### Discord history after a fresh Identify

With a paired channel and a stored `discord.lastMessageId`, READY compares the
channel's `last_message_id` before paging history, newest first, 100 per page,
using string snowflakes and `before`. It retains the newest 500 admissible
paired-human messages and forwards them oldest first with written and return
HH:MM annotations. A silent channel line reports omitted older messages.
A bounded history batch is persisted before forwarding; interruption retries that
batch through the existing native ingress deduplication boundary. Ordinary text inputs commit
in groups of at most twenty through the gateway's optional synchronous transaction
port. Frame results publish after commit; adapter mappings and cursors commit as
one separate group, so an interruption between those commits reuses the native
message identity. Replies run serially so earlier native mappings exist before
reply routing; media keeps its awaited FIFO path. No transaction spans native
I/O. Reaction attempts and settlements keep their existing per-operation fences.
Source-key, last-row and outbox-depth queries avoid decoding historical payloads
on every new input; existing persisted jobs and nonunique source keys remain valid.
Older injected adapters or conversations may omit the batch port and retain
individual commits. Live text waits
behind history, while interaction deadlines stay independent.

Recovery then flushes the neutral, source-counted silent gap above zero, recovers
owed cards and outcome edits, and replaces open ask and approval cards. Every
previous mapped copy is marked “↓ Re-sent below” only after the new native map.
Automatic publication waits behind recovery; previous single-message fake controls,
remote frames and outbox payloads retain their shapes.

A saved Discord history batch also drains when the next connection resumes, and
a live resume joins an already active history owner before opening recovery.
Gap and overflow warning completion requires the exact durable native `sent`
settlement. Refused or unknown warnings retain their captured source count or
batch and stop card recovery; accepted sends retain the original nonce fence
across restart rather than gaining a new send window.


### Discord inbound attachments and voice

With Discord enabled, a resolved token, reachable API/gateway and a paired
channel/user, ordinary messages and replies may carry attachments without text.
The native downloader checks each declared size against `[artifacts] max_upload_mb`
before I/O and bounds the response bytes. It accepts only HTTPS Discord CDN hosts
(`cdn.discordapp.com`, `media.discordapp.net`), or the explicit fake API root's
loopback `/cdn/` subtree. GET uses no Authorization header and refuses redirects.
An expired URL (403/404) refreshes once through authenticated GET message before
retrying the signed URL. Terminal download/limit refusals receive a channel line.
All accepted files share one human `artifact.upload` message in General, with the
original caption and `via: discord`; the existing per-remote artifact fence sends
them to Telegram once under `you (Discord)` when Telegram is enabled and paired.

Flag 8192 with one audio attachment is a voice note. `[speech] max_seconds` is
checked before download. The shared speech seam receives original bytes,
filename and content type (`audio/ogg` when absent), using the configured provider,
key, language and whole-note deadline. The General message has the 🎤 transcript
and audio attached. Missing/off/failed speech retains audio and a readable outcome.
The channel receives the transcript, duration, download/transcription times and
provider as a reply with `fail_if_not_exists: false`; long echoes split into bounded
numbered parts. Echo intents persist before hub submission and recover from the
durable ingress receipt, while native sends use the ordinary nonce/outbox fences.
A voice reply to a mapped ask submits the recognised text through `topic.answer`;
options-only asks accept a spoken option number or label (ignoring case and trailing punctuation). A successful answer keeps no recording, and a refused answer falls back to General. Replayed/history notes carry written/return metadata and do not answer old cards. Cancelled native work stays unconfirmed for resume.
No new command, configuration key, dependency, frame or role permission is added.
See the [inbound media test guide](../agents/tests/hub-test-discord-inbound-media.test.ts.md).


### Sealed fixture remote endpoints

`test-support/fixture-environment.ts` supplies invalid missing-root sentinels for
Discord and Telegram, whose client construction refuses before I/O. ElevenLabs
uses loopback port zero: the default provider can construct without a key, but
transcription fails locally with a sanitized speech transport error.
A fixture that enables a remote or the cloud speech provider must supply its
`CLAND_DISCORD_API_ROOT`, `CLAND_TELEGRAM_API_ROOT` or
`CLAND_ELEVENLABS_API_ROOT` in the builder's third (`extra`) argument: an explicit
HTTP URL on `127.0.0.1` or `[::1]` with a nonzero port (apart from the reserved speech refusal sentinel), without credentials,
query or fragment. A root in `base` is stripped and takes the refusal path.
Explicit external roots are refused without echoing the value. Production
client defaults outside sealed fixtures remain unchanged. See
[fixture tests](../agents/tests/hub-test-fixture-endpoints.test.ts.md).


### Inherited stdio writer ownership

The local command supervisor duplicates its two live read streams into descriptors
3 and 4 of a bounded `/usr/bin/perl` inspector using Node's public spawn API. The
held endpoints prevent reuse during the census; closed channels use ignored
descriptor slots, so one EOF cannot invalidate its live sibling. The inspector
never reads command output. Streams resume after inspection so EOF remains an observed receipt.

On macOS arm64/x64, `proc_info` syscall 336 enumerates `PROC_PIDLISTFDS` and reads
`PROC_PIDFDSOCKETINFO` / `PROC_PIDFDPIPEINFO`. The validated 792-byte socket layout
requires AF_UNIX, SOCK_STREAM and SOCKINFO_UN. A candidate's opaque socket handle
must equal the reader's connected handle, and its connected handle must equal the
reader's own handle. Pipes use the equivalent reciprocal handles in the 184-byte
pipe layout. Layout definitions are in Apple's
[`proc_info.h`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info.h).
No lsof display address or Node private handle grants ownership.

On Linux, a NETLINK_SOCK_DIAG UNIX_DIAG_SHOW_PEER dump maps the held socket inodes
to their peer inodes. Reciprocal peer mappings and `/proc/<pid>/fd` identify holders.
For pipes, the same held inode plus writable `/proc/<pid>/fdinfo` flags proves a
writer. These are the kernel's
[UNIX diagnostics UAPI](https://github.com/torvalds/linux/blob/master/include/uapi/linux/unix_diag.h).

Both methods bracket inspection with coherent native process birth and recheck
birth before each signal through the existing process-tree termination owner.
Cwd, command text and process groups never substitute for endpoint evidence.
The helper has a three-second deadline and a 1 MiB output bound. Missing Perl,
unsupported ABI/platform, permission denial, unavailable Linux UNIX diagnostics,
malformed/truncated replies, disappeared descriptors and deadline expiry grant no
new ownership. The existing incomplete-cleanup warning remains if EOF is absent;
unidentifiable processes survive and the queue moves on. This is local worker
cleanup; droplet cancellation retains its executor-owned release path.


### Claude Code launch generations

Each Claude Code launch/relaunch writes private settings and MCP files under its
stable session run directory in a fresh UUID subdirectory. `CLAND_SESSION_ID`
continues to identify the cland session; `CLAND_LAUNCH_ID` identifies this native
launch. Hooks and the mod bridge carry that generation in `--launch`; spokes
carry the optional `hello.launchId`. The current generation and its stable owner
are persisted in adapter state before native launch. An earlier generation is
refused with “belongs to an earlier launch”, including omitted generation fields
and credential-bound anonymous hellos after their stable identity is resolved.
Rotation revokes already admitted spokes synchronously and removes bridge ownership;
spoke authority, outbound delivery and bridge use also check the captured generation. Legacy rows without a recorded generation keep the previous
session-id hook/bridge and hello shapes until their next launch.

A mismatching native `session_id` triggers a shared native job query. Two distinct
listed job ids produce one `duplicate-harness` log and Agents notice naming both
job ids and PIDs (unreported PIDs say unknown); the foreign hook cannot overwrite
the row. A conversation change is accepted as `/clear` only when a successful native query
positively identifies the captured job with that conversation. Unavailable queries
remain fenced. Deferred inspections capture the job, PID, generation, row lifecycle
and hook revision; newer facts or lifecycle work supersede them, and shutdown joins
all inspections before storage closes. Native observation freshness has one
owner: `#hookRevision`/`#activity` and the directory observation revision/launch
witnesses. An unproven conversation hint sets a pending marker on that activity
record; positive same-job or duplicate inspection clears it, including stateless
hooks. Ordinary same-conversation activity still permits independently verified
PID acquisition.
Relaunch always uses native stop for the previous Claude job, even if its recorded
PID is gone, while OS termination retains native identity and descendant checks.
A failed stop permits replacement only after a fresh successful listing confirms
the captured job absent; that query must be invoked after the failed stop. Any
earlier in-flight query drains first and cannot supply this absence proof.
Failed/unavailable confirmation retains supervision. Adapter-owned relaunch
reports its positive stop through `ResumeOptions.stopped`; Sessions persists that
stopped row before replacement and returns the latest row to the adapter. An
error before this receipt preserves the prior row, role and claim.

Claude native re-exec keeps its generation: cland supplies immutable settings and
MCP paths on every spawn/fresh/relaunch/account-selected launch, while plain
resume only re-finds that job. The mod resolves generation from its environment,
then saved settings, before falling back to a legacy session id. Thus a partially
restored environment cannot mask a settings generation. Generated launches set
`DISABLE_AUTOUPDATER=1`; a supported native re-exec restores the same launch
files and generation. A native process that loses those files must be relaunched
through cland before it can claim a generated session. A hub upgrade does not mint a generation for
an already-running legacy row. `session retry` resends on the admitted bridge
and starts no process; account usage probes strip all CLAND variables and do not
join as sessions.

### Suite archive startup memory

Finished suite receipts stay in `meta` under `suite-job:<id>` in the previous
JSON shape. A SQLite summary index holds scheduler facts, compact selection
flags and shard outcomes without execution plans, identity lists or lease
resources. Startup reads this index, loading full records only for unfinished
reporting, cleanup or accounting recovery. The first read backfills legacy
records inside SQLite; later starts reuse the checkpoint. Persistent triggers
maintain summaries even when an older hub writes the original records.
Explicit history/status and receipt requests read full records by id; compact
status, queue durations, recent covers and heartbeat digests use summaries.
Automatic merge-batch and dev-T3 probe searches use `Suites.findRun` summary
facts, then request a full receipt only for the selected id. Legacy admission
and completion estimates are repaired from summary/message facts and patched
inside SQLite without decoding plans; the timing repair survives reopening.
Original JSON strings are not retained alongside decoded scheduler records.

`node hub/scripts/measure-suite-history.ts` reports a short synthetic startup
measurement in a disposable fixture; `--help` describes its scope. It is report
mode only and supplies no suite or live-scale memory evidence. Live-scale memory
comparisons use the T-1467 memory probe with a Coordinator measurement slot.
No archive retention or deletion policy is introduced.

### Offline memory measurement

`node hub/test/measure-memory.ts --help` describes the manual Mac startup probe.
`--plan --source PROJECT` inventories a read-only copy plan; `--run` requires a
Coordinator measurement slot and about 1–2 minutes. It measures a sealed embedded
hub on disposable live-scale state, with sparse artifact bodies, generated config,
fake adapters/probes and no clients. Preparation runs in the supervisor before
launching the measured child with coarse Node heap sampling. It records one-second
memory/RSS, startup-stage checkpoints/counts and sampled source stacks, then stops
at readiness. No rest phase or full snapshots run. Load/swap preflight and a
30-second swap supervisor request graceful stop over IPC; the worker persists
its stop outcome and the supervisor records native exit/pipe close. Shared
owners cancel and join setup, profile/write work and bounded IPC drainage; a
captured-process fallback records an incomplete outcome if graceful stop stalls.
The final supervisor receipt follows all owned writes; a refused final system
reading remains explicitly unavailable without suppressing the stop receipt. Sampling estimates are
report-only; this sets no memory budget. The SQL-only companion
`node hub/test/measure-history-storage.ts --help` describes disposable-copy row
and payload-size inspection without starting a hub. See [measurement controls and analysis](../agents/tests/hub-test-measure-memory.test.ts.md).

### Sealed rest memory probe

The manual `hub/test/measure-memory.ts` probe defaults to startup only. Within a
Coordinator-granted Mac measurement slot, `--rest-seconds 600` adds a diagnostic
idle phase; `--rest-seconds 1800` records the final 30-minute phase. It uses a
sealed disposable project copy, fake adapters and independent swap supervision;
no live hub or connected crew is measured. Ten-second rest samples record heap,
RSS and native physical footprint, with missing native readings unavailable.
Sampling profiles estimate surviving allocations by site, not exact retained size.
`--heap-budget-mib N --rss-budget-mib N` prints readiness, completed-rest endpoint
and observed interval maximum comparisons and writes them to `memory-budget.json`
in report mode only; omitted CLI limits use human-agreed 256 MiB heap/768 MiB RSS.
Limits govern readiness and rest endpoints; interval maxima are informational.
Each heap/RSS reading is marked within/over (or unavailable/unconfigured).
Maxima cover persisted samples from readiness through the rest endpoint, including
streaming when selected, excluding earlier startup and shutdown. They are sampled
maxima, not continuous peaks; interrupted runs retain observed maxima with their
partial outcome and no completed-rest endpoint. An unexecuted rest has no interval maximum. Limits require human agreement for budget evidence. See
[the probe guide](../agents/tests/hub-test-measure-memory.test.ts.md) for
exclusions, guard stops and required disposal receipts.

The separate `--stream-runs 6 --rest-seconds 600` diagnostic drives synthetic
log/status/release receipts through production suite persistence and collection,
after sealed-copy preparation. It creates no droplets or workers and uses no
network. Its streaming samples/results remain separate from idle evidence.


### Copied probe suite recovery isolation

The memory probe seals its SQLite backup before starting the embedded hub:
absolute suite strings and relative path fields become scratch placeholders; execution/recovery capabilities
(PIDs, leases, shards, locks, commands, host gates and config) and pending executor
metadata and suite artifact IDs are excluded. Copied artifact index paths become scratch placeholders and redirects/entries are removed, preserving index rows. Finished archive rows remain one-for-one, with active and
archive counts in manifest.sealing. Unfinished copied runs (including code 0 awaiting reporting, cleanup or accounting) are unavailable, never passing evidence; completed historical outcomes are retained. This changes copied execution-plan payload attribution.
Fixture hubs identified by CLAND_TEST_ORPHAN_ROOT refuse stored suite paths outside their project and the sealed builder’s CLAND_TEST_OWNED_ROOT scratch allocation before restoration, including nested lease/shard paths and symlink escapes,
with verification-recovery-refused naming the job. Full archive hydration is also
sealed. Final resolved artifact evidence paths are fenced before native reads. Live recovered PIDs require a stable native birth and owned cwd. Legacy ps-start receipts bind to that observation before restoration and persist the native birth. An observed dead worker may recover its pending report; it gains no live signal authority. Before each LocalExecutor signal phase, the optional endProcess owner-scope callback validates every recovered live tree/group member against native birth and owned cwd. Other termination callers keep the prior behaviour. Outside log/result/gate capabilities remain refused: a terminal pending report (including the legacy state-omitted shape) publishes “log unavailable (outside isolated root)” from newly created hub-owned files as unavailable infrastructure evidence. The shared fixture-roots policy grants no generic system temp directory and older environments grant only the project. Cancellation waits only for the requested job’s isolated admission, not unrelated constructor reaping. Production recovery without that fixture isolation is unchanged. See
[the memory controls](../agents/tests/hub-test-measure-memory.test.ts.md).


Isolated recovery thaw (`SIGCONT`) also requires the captured native birth and
fresh owner scope. Unknown or outside proof retains the frozen target and reports
incomplete cleanup; a proven exited/reused identity receives no recovery signal.
Callers without the optional owner-scope callback keep their previous thaw policy.

Fresh local launches keep a nonpersisted authority bound to the exact lease and
captured native leader birth. The signal fence can extend that authority only
through positively observed native ancestry, retaining captured child births
across leader exit so owned detached children in nested phase roots can drain.
Restore, copied/replaced leases, PID reuse and a group number alone grant none
of that authority; those targets still require the recovery cwd/birth fence.
Lease binding is rechecked after awaited scope proof and at the native signal
boundary. No generic temporary-directory grant is added. The original cancellation and
setup-failure cleanup controls and native no-inherited-authority cases must pass
alongside outside-group refusal and ordinary restart recovery.
### Executor lifecycle interface

All nine operations, including `prepare` and `reap`, are declared on `Executor`.
Preparation accepts optional progress reporting; reaping accepts an optional
authorization callback. The backend owns image keys and resource identifiers.
Local preparation and provider reaping return typed `not-applicable` results;
local restored-worker recovery runs separately through `reconcile`.
The droplet backend retains its captured-key and callback overloads and concrete
result fields. `cland executor prepare|reap` uses the existing hub jobs and keeps
its command arguments, help, JSON and plain output unchanged.

