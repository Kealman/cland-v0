## Remote commands

The public [Remote control guide](../../site/src/content/docs/docs/remote-control.md)
covers the shipped Telegram and Discord setup, pairing, chat, media, voice and recovery flows. Its marked
pairing blocks run unchanged against the fake Bot API in
`hub/test/remote-docs-pairing.test.ts`; `hub/test/remote-docs.test.ts` runs the site's
command/vocabulary, navigation and CLI-reference checks in the normal suite.

The human's terminal uses the running project hub:

```sh
cland remote status [--json]
cland remote approve telegram ABCDEFGH [--json]
cland remote unpair telegram [--json]
cland remote test telegram [--json]
```

Use `discord` in the same forms. Approval consumes the live code and prints the
stored display name and numeric id. Unpair removes only that messenger's binding.
The three management frames (`remote.status`, `remote.unpair`, `remote.test`)
and `pairing.approve` accept only an unattributed human CLI or Neovim on the Unix
socket, or Neovim on parent-owned stdio. Web, remotes and session shells refuse;
no new role permission or clause is needed.

Status reads loaded tokens, including environment overrides, and prints presence
and the 12-character SHA-256 fingerprint only. Each messenger includes its pairing,
connection state and sanitized failure reason, last inbound/outbound exchange,
active outbox depth (`queued`, `sending`, `uncertain`), mute and public bot link.
An adapter supplies successful-exchange facts through optional `Remote.status()`;
a legacy adapter without that proof reports disconnected and unavailable facts.
Public bot links are confined to Telegram usernames and Discord's bot invite;
credential-bearing links are omitted. Status makes no platform call.

Test calls the active adapter's optional `Remote.test(pairing, text)` to check its
token and send the fixed line “cland remote test” once when paired. Without a
pairing it checks only the token. Disabled/unconfigured messengers or clients
without test support refuse explicitly. Client failures are redacted and confined
to that messenger. The gateway owns the callback through completion on shutdown.
Telegram's built-in client checks `getMe` on startup and test, sends the test
line when paired and sends replacement notices to the captured old chat. With
Telegram enabled, a resolved token and its native client active, local approval
(CLI, Neovim or setup) queues one "Paired with <project>." confirmation through
the durable outbox, then open cards oldest first; delivery requires a reachable API. Queued/sending
confirmation jobs hold all card/edit deliveries in that chat, including live
publications, flood waits and restart recovery. Settled unknown attempts keep
the outbox's existing replay fence. Its
adapter supplies these callbacks, handles private `/start` pairing and polls
updates through the registry below. Mirroring General requires its registered handler. The built-in Discord
client checks the application settings and sends a paired test line through REST;
its gateway socket supplies inbound commands, text, cards and media. Both are tested without real
platform credentials.

For rotation, store the replacement with `cland secret set <messenger>.token`
through stdin or the hidden prompt, then run `cland hub reload`. With an enabled
configured client and resolved token, reload drains the old client and starts its
replacement. Pairing ids and mute remain in `hub.db`; each new pairing starts
with the loaded `remote.mute_default`. Environment overrides still take precedence.
Plain `cland remote status` ends with the speech provider's data-use line from
local `.cland/config.toml` (default `elevenlabs` when absent). It names ElevenLabs's
possible training outside enterprise plans and stored transcripts, and how to
turn off "Improve the models for everyone" under Terms and privacy, Data use.
The `command` line defers data use to that command's configuration; the empty
provider says transcription is off. Each line points to `[speech]` to change it.
This footer reads current local config, independently of the hub's loaded
settings; `--json` and the `remote.status` frame retain their existing shape.

Doctor reads the same current speech config and resolved secrets, including
`ELEVENLABS_API_KEY` over the file value. It prints `speech provider` with the
name when at least one remote is enabled. With no enabled remote it reports
`ok` with "speech unused until a remote is set up"; an empty provider reports
`ok` with "transcription off". Only an enabled remote triggers the provider's
key or command checks. ElevenLabs adds key presence/fingerprint or the fix
`cland secret set speech.elevenlabs_key`. Command mode checks executable presence
on PATH (or an absolute argv[0]) with `resolveCommand`, printing its path or a
warning to edit `[speech] command`. Empty argv warns too. No provider request or
command execution occurs; existing role permissions and clauses are unchanged.

### Remote state in the workbenches

Human clients receive a safe `remote.state {remotes}` replacement on connect;
clients negotiating `snapshot` receive the same rows as optional
`sessions.remotes` inside the existing snapshot transaction. Subscribed clients
receive `remote.state` on connection, failure/recovery, pairing, mute and config
changes. Depth-only changes coalesce to at most one push per second; an urgent
change includes the current depth. This adds no snapshot domain or protocol version.
Old clients ignore the new event/field, and new clients accept snapshots without it.

Each row contains `messenger`, `enabled`, `connection` (`connected`, `offline`,
`stopped`, `disabled`), `offlineSince`, `pairedName`, `mute`, `outboxDepth`,
`lastError` and optional `stopCause` from the shared doctor/General cause table.
Configuration-disabled rows use `disabled`; runtime failures use `stopped`.
The projection includes no token, fingerprint, numeric pairing identity or bot link;
`remote.status` retains its local-only management shape and authority.
Telegram supplies its first failed exchange and recovery through native transition
notifications; optional adapter callbacks and connection fields keep older injected
clients usable. The daemon owns deferred reads and cancels depth timers before storage closes.

Neovim's Sessions panel and the web's Sessions area show enabled messengers
under Remotes beside the verification line: connection, paired name, mute,
outbox depth and last error. Facts wrap to the panel or phone width; offline and
stopped rows use `ClandRed` in Neovim and the `--failed` token in the web. Web
field meanings live in tooltips. No enabled messenger, or an older hub with no
remote state, hides the section. Neovim clears prior facts on reconnect; the web
retains the last snapshot while disconnected and replaces the facts on the next
snapshot, including when an older hub omits `sessions.remotes`. The web receives
the safe push without calling `remote.status`; that request remains local-only.

### Telegram phone commands

With Telegram enabled, a resolved token and the native factory, every start reads
`getMyCommands` for `all_private_chats`. It calls `setMyCommands` only when the
ordered command/description pairs differ; it compares Telegram's current state,
so an unchanged restart writes nothing and an externally changed menu is repaired.
The menu is a discovery aid; numeric paired-user/private-chat checks still gate
all commands. Legacy check/send-only injected clients do not register a menu.

Paired `/status` reads `hub.status` and open releases through `task.list` on the
gateway's existing frame port. Its title and bold groups show version/uptime,
Coordinator/needs-you, up to six session bullets, queues, open releases and this
chat's connection/mute state; gateway numbers are italic at the end. `/help` has
short headed sections, command bullets and trust lines last. Replies always use
text with explicit UTF-16 entities, independently of the General mirror format.
Facts are escaped before the shared renderer; long replies split into numbered
parts within Telegram's 4096-code-point and 100-entity bounds.

`/inbox` reads `inbox.list` and re-sends every open ask, hub approval and 📥 notice
as a new live copy at the bottom, ordered by waiting start (`since`), then id,
across all sections. Each copy uses the same bounded card renderer and durable
source/topic/ask/approval mapping as its first send. Earlier copies keep their
buttons and keep working; an answer from any copy edits every mapped copy to the
outcome. With no open rows it sends only "Nothing needs you". Local pairing grants
and their counts stay outside the remote. Other
answer and Decline open separate reply prompts; `/cancel` clears the waiting
prompt and leaves the ask open. Paired `/start` names the project. `/decision <text>` and `/question <text>` are inbound mirror actions;
`/mute` and `/unmute` control the General stream independently.

Ordinary command replies use one send function routed through the shared per-chat
outbox at ordinary priority; `/inbox` copies use the card/notice priority.
Text/entities stay intact, all numbered parts queue
before later arrivals, and accepted ids get durable message maps. A native
chat/message identity is durable before any reply is queued; replayed input is
confirmed without repeating that logical effect. Only positive 429 non-delivery
retries the immutable transport intent; an unknown receipt stays fenced. The [command regression](../agents/tests/hub-test-telegram-commands.test.ts.md)
interrupts after the fake commits a reply but before its HTTP receipt and retains
the next start's durable offset and single-message receipt.

### Telegram Bot API client

`src/remote/telegram-api.ts` uses Node 24 `fetch` and handwritten types, with no
Telegram library. The daemon validates the token through the shared secret
validator before the client constructs a URL. It passes the project-owned
redactor into the client, which keeps only sanitized provider facts in
`TelegramError` (`method`, numeric `code`, `description`, optional `retryAfter`
in seconds). Raw fetch exceptions, causes and URLs never leave the client.

The media boundary adds `getFile({ file_id })`, `download(filePath, maxBytes,
signal?)`, `sendPhoto` and `sendDocument`. Downloads return a Buffer, validate
paths with `^[A-Za-z0-9_./-]+$` and reject every `..`, refuse redirects and abort
as soon as streamed bytes exceed the caller's cap, including chunked bodies.
The token-bearing file URL stays inside the client. Uploads take `chat_id`,
`path`, `filename`, `mime`, optional plain `caption`, `disable_notification`
and `reply_parameters`; Node's `openAsBlob` and `FormData` send the original
bytes without parse mode or caption entities. Multipart line endings become
CRLF. The Bot API limits are 10 MiB per photo, 50 MiB per document, 1024 caption
code points and 20 MiB for `getFile`; callers choose the download cap. Optional
message fields retain photo sizes, document, voice, audio, video note, video,
caption and album id without changing earlier text messages. These client calls
supply transport only; gateway media handling is a separate consumer.

The default root is `https://api.telegram.org`. The daemon environment's
`CLAND_TELEGRAM_API_ROOT` may override it with an explicit loopback HTTP root
and port for fake-platform runs. Other hosts, credentials in the root, queries
and fragments refuse with fixed diagnostics; redirects refuse too. Ordinary
requests close their HTTP connection after the response, keeping the remote's
lifetime independent of fetch's global keep-alive pool. They have a 35-second
HTTP deadline. `getUpdates` accepts an explicit
`allowed_updates` and a 0–50 second poll timeout, with an HTTP deadline of
`max(35 seconds, poll timeout + 15 seconds)`. Zero is for offline polls; the
polling loop chooses 30–50 seconds when online. Deadlines and timestamps use a
complete `Clock`; caller cancellation aborts the request and every completion
clears its owned timer. The client makes one request and returns any 429 wait
or 409 conflict to its caller; it does not retry or kill another consumer.

The fake Bot API and its token-free human/stranger controls are described in
the [client test guide](../agents/tests/hub-test-telegram-api.test.ts.md).

The client accepts inline keyboards (button text, opaque `callback_data` and
optional primary/success/danger style), separate ForceReply prompts with an
optional input placeholder, and `reply_parameters.message_id` on `sendMessage`.
`answerCallbackQuery` takes the press id, optional text and `show_alert`;
`editMessageText` takes chat/message ids, text, optional entities and an inline
keyboard, including an empty keyboard to remove buttons. These calls use the
same redaction, cancellation and deadlines. Their errors retain the sanitized
description, including `message is not modified`, and numeric status/retry facts;
the client does not classify an edit as success or schedule a retry. Callers
retain the existing 400 fallback, 401/403 stop, 429 hold and uncertain-delivery
fence policies. Card handlers must send a callback acknowledgement directly
after the hub stores the answer, outside the chat outbox.

The fake stores sent markup and entities, queues human/stranger presses through
`/control/press`, and uses its injected clock to refuse callback answers older
than 150 seconds. It rejects callback data outside 1–64 UTF-8 bytes, keeps at most
12 buttons per row and 300 total, refuses identical edits with
`message is not modified`, and permanently refuses edits of ForceReply messages.
Edit failures use the same method-specific fault controls as sends. This is a
native client/fake capability; cards are built by the gateway's card handler.

### Telegram General rendering

With Telegram enabled, a valid token and a paired chat, the native adapter sends
new General messages under an `author · kind` header. Human workbench messages
use `you`; Discord messages use `you (Discord)`. Human Telegram messages, answers, requests
and asks to the human are excluded from this message stream; item topics and
Agents are excluded too. Progress and hub notices set `disable_notification`.

The loaded `remote.telegram.format` defaults to `rich`: `sendRichMessage` carries
GitHub Flavored Markdown unchanged, with `skip_entity_detection: true` and link
previews disabled. Only a 400 rich-formatting refusal falls back to `sendMessage`
with gateway-computed entities. A 401 or 403 stops the remote; a 429 holds and
retries the same rich request. Network errors, 5xx and missing receipts remain
uncertain and fenced, with no plain resend that could duplicate delivery. `format = "entities"` selects that path immediately.
Neither path uses MarkdownV2. Header and numbering count toward the 4096-code-point
plain limit; entity offsets remain UTF-16 units. Each part repeats the header,
with `n/m` when split. The converter prefers block and line boundaries, keeps
every character across parts, and never clips an entity. The header consumes
one of the 100 styled entities. A style too large for one part becomes plain
text; conversion failures preserve the original text without body entities.
Quoted code and links retain their own entities without an enclosing quote
entity, respecting Telegram's nesting restrictions. Table delimiter recognition
keeps flag/data rows, and code blocks retain fence-prefixed content until a
complete legal closing fence.
Accepted part ids are stored against the original General message in `hub.db`,
so a reply to any part can resolve its source. Stop aborts network work and
joins receive writers before storage closes. Stopped remotes ignore later
General frames, including their own terminal failure notice, preserving the
original disabled cause. See the
[rendering frame/fake guide](../agents/tests/hub-test-telegram-rendering.test.ts.md)
and [conversion guide](../agents/tests/hub-test-telegram-render.test.ts.md).

### Telegram mute

With an active native Telegram client and a paired private chat, `/mute` silences
eligible General messages, including progress. Hub notices still arrive silently;
card and notice delivery sits outside this General mute gate. `/unmute` resumes
the stream and sends exactly `N messages arrived while muted`, including zero.
The count is per General source, before rendering or splitting, and excludes
Telegram echoes, answers, human asks and other topics. Muted messages are counted,
never replayed. Repeating `/mute` keeps the accumulated count.

The existing `remote_state` mute flag and missed count survive restart and token
reload. A new approved pairing applies the loaded `remote.mute_default` (false
by default) and resets the count; changing that setting leaves an existing
pairing's state intact. Telegram and Discord state are independent. Status keeps
its existing mute boolean and management authority is unchanged.

A paired command commits its effect and chat/message-id receipt atomically before
reply I/O; the polling offset is confirmed only after the handler completes.
Replay after interruption cannot apply that command again. An uncertain reply
is not resent; a durable queued reply or positive non-delivery follows the
outbox retry policy. An interruption before queueing can leave the reply absent;
a later `/unmute` reports the current count. No extra frame or protocol field is required.
See the [mute frame/fake guide](../agents/tests/hub-test-telegram-mute.test.ts.md).

### Telegram send pacing

Every native Telegram send uses `TelegramOutbox`, including General parts,
command replies, pairing replies, remote tests, old-chat notices and delivery
reactions (`setMessageReaction`). With the
production factory, intents and attempts use the project's existing `hub.db`;
legacy injected adapters without a store use a lifetime-local in-memory queue.
There is one active outbox drain per chat, with one HTTP send in flight and at
least 1,000 ms between request starts. Other chats can send independently. Cards
and 📥 needs-you notices rank first among queued jobs; ordinary replies, old-chat
notices and reactions share General's FIFO priority. An active request finishes
before a later card can send.

A 429 is positive non-delivery: its `retry_after` holds every chat's sends for
at most 300,000 ms, then the same immutable request retries. A missing hint uses
the ordinary one-second interval. Rate limiting does not mark General missed.
The bot's absolute hold deadline and each chat's last request start persist in
remote_state before non-delivery is settled or HTTP begins. A recreated adapter
honors their remaining time. New arrivals join the active drain.

Queued project content rechecks the current pairing's chat and sender at the
actual send and on recovery; unpaired or replaced destinations are dropped.
Only an explicit stranger pairing reply or captured old-chat replacement notice
bypasses that project-content admission. Paired /start replies remain paired
content. Legacy injected adapters without a project pairing store retain their
caller-owned admission.

Rich-to-plain replacement parts retain the
original message's order, ahead of later ordinary messages, and every accepted
part gets its durable source map. All replacement jobs and the superseded proof
commit in one synchronous transaction. A definite rich 400 is recorded first;
if planning is interrupted, recovery rebuilds the entire group once without
another rich send. Accepted exchanges update `lastOutbound`
without waiting for the remaining queue to empty. Stop cancels pacing and flood
waits, aborts active HTTP and joins all drains before storage closes. Reaction stored/delivered/seen bits stay
in `telegram.inbound:<message>` under the inbound handler's existing recovery
policy. New receipts retain the captured numeric pairing identity and check it
before and after each reaction exchange; revoked or replaced pairings cannot
settle feedback or schedule later reactions. Historical receipts without that
optional identity retain chat-id recovery checks. The queue supplies only each transport operation's own durable result.
A successful `getMe` makes the send transport available for recovery.

See the [pacing frame/fake guide](../agents/tests/hub-test-telegram-pacing.test.ts.md).
This internal scheduler adds no command, setting, permission or role-clause line.

### Telegram ask and approval cards

With Telegram enabled, a resolved token and a paired private chat, an inbox
publication sends each human ask as one text/entities card, outside the General
mute gate. New asks, hub approvals and 📥 notices in that publication enter the
outbox together, oldest `since` first, then id, ahead of queued General messages.
`/inbox` uses the same ordering and renderer for its live copies.
The shared `remote/cards.ts` model has no messenger knowledge;
`telegram-cards.ts` owns the Telegram rendering. The card names the asker and
topic and keeps every option label, with at most nine options, optional
**Other answer…**, then **Decline…**, one button per row. Each opaque button key
is stored in messenger-scoped `remote_state`, bound to its ask and chat; the
accepted message is mapped to the ask in `remote_messages`. Long questions are
clipped at a word boundary with `full question in the workbench`, keeping one
message id and reserving 1,024 code points for the outcome inside Telegram's
4,096-code-point message budget. Option labels stay whole; exceptionally long
headers use a bounded preview.

The paired presser's key must match the mapped card's ask. Unissued or cross-ask
keys answer the press without changing an ask. Option presses use the existing
`topic.answer` gate, with trusted native identity derived from the callback id and `via: "telegram"`.
The dispatcher commits its replay receipt with the answer; replay returns that
receipt, including when the adapter lost the result. Human-answer publication,
delivery and hygiene effects wait for that commit, so a failed receipt write
leaves the open ask and observers unchanged. The native receipt freezes the
admission snapshot before post-commit delivery; ordinary client replies retain
their existing delivery facts. Wire callers cannot select
this identity, and callers without native identity keep the existing gate.
After the durable result, `answerCallbackQuery` goes directly to Telegram,
outside the outbox and its pacing; only then does polling confirm the offset.
A definite 400 `query is too old` is terminal after the durable result and lets
later input progress; transient callback errors retry the saved result, and
401/403 retain their fatal-token behavior.

Other answer and Decline acknowledge the press before sending a separate
ForceReply prompt replying to the card: “Your answer to: …” or “Why decline: …”,
with a placeholder and `/cancel keeps the ask open`. The card itself never
carries ForceReply, because a message that ever carried it cannot be edited.
Prompt intent, ask/mode and the chat's next-text wait are stored in `remote_state`;
the accepted prompt maps to its intent with `ask: null`, outside editable card
copies. A restart retains the wait. The next ordinary text answers that ask;
an explicit reply to a prompt targets its own ask even after other text. During
catch-up, unthreaded late text goes to General with its written/recovery times
and keeps the prompt wait. An explicit late reply targets only its own mapped
card or prompt, and answers only while that ask is open.
Decline submits `declined: true` with the typed reason. `/cancel` clears the
next-text wait, replies “Cancelled. The ask stays open.” and preserves the card's
buttons; following ordinary text reaches General. A typed reply to a card
submits free text when allowed, otherwise only a valid option number; other
text gets a one-line note and leaves the ask open. A closed ask gets a note and
the input goes nowhere. Input routing and exact answer fields are durable before
dispatch, so a lost result retries the same native receipt instead of becoming
General. Stored and delivered reactions reuse the inbound feedback/recovery path.
Prompt sends use the existing durable outbox, including its uncertain-send fence.
If a send has an unknown outcome, its publication records an explicit incomplete
receipt and polling confirms the callback so later input and `/cancel` can
progress. The prompt is never retransmitted. An unmapped explicit reply while a
prompt waits, or after an incomplete prompt send, gets an unconfirmed-prompt
note without answering an ask or posting to General. Quoted text cannot establish
which ask a reply belongs to; use the mapped ask card or `/cancel`.

The card follows the hub's ask record, whichever client answers first. Neovim
answers read `via Neovim`; web declines include the reason and `via web`.
Ask frames and inbox departures both update every mapped copy in the paired
chat: choice or decline reason, actor, source and hub-local HH:MM, with an empty
keyboard. Withdrawn asks name their asking session; cancelled asks say their
topic or item closed. A closure received during an in-flight card send is kept
until its accepted message map can be folded too. If another client wins between
a tap's inbox read and answer request, the press receives `Already answered`
and changes no outcome. A known durable closure returns `Already answered`
without any hub request, including after restart. If that native copy still
shows buttons, the shared renderer queues its outcome edit again with a stable
press key. If that repair's fallback send has an unknown outcome, its durable
job remains fenced and the repair is marked incomplete; callback confirmation
and later input still progress without retransmitting the reply.
A retry of an already committed callback retains its saved receipt;
confirmed callback ids stay deduplicated across restart. Failed writes on an open ask remain retryable. `message is
not modified` settles successfully; another failed edit becomes one outcome
reply to the original card. A 429 retains the edit and bot-wide hold, and
401/403 stop the remote. Unattempted edits sharing a card's edit key merge to
the latest text, keeping their original order and completion waiters; an attempted
edit keeps its immutable payload. Edits and cards both ride ahead of General.
Before sending or retrying a card, `TelegramOutbox` checks the hub's current
inbox through `sourceOpen`. If its ask has closed, a job that never left is
marked dropped and completes with a closed-source receipt, without a delivery;
outcome edits still run. A dropped keyed card from lost pairing remains incomplete.
An unknown send keeps its replay fence even after source closure.
Card sends use the per-chat queue at card priority:
400 retries plain text with the same buttons, 429 holds the immutable request,
401/403 stop, and an uncertain send stays fenced. Replacement parts and proof
commit together, including their own durable delivery receipt.
See the [frame/fake card guide](../agents/tests/hub-test-telegram-cards.test.ts.md).

Codex and OpenCode approvals with `answerIn: "hub"` use the same shared card
renderer. Each names the session and harness, then the command or changed files.
Long commands are clipped with `full command in the workbench`; one message
stays within 4,096 code points with one title entity. Only the offered choices
appear: **Approve once** (success), **Always allow** (primary), **Deny** (danger),
one per row. A press calls the existing `approval.answer` gate with trusted
`via: "telegram"`; there is no second confirmation. Its native delivery and
stored outcome complete before the direct callback acknowledgement and offset.
Both workbenches show the approved/denied outcome `via Telegram`.

Approval frames and inbox departures fold every mapped approval copy, including
answers from the web or harness and harness withdrawal. Outcome text names the
choice, actor, source and hub-local HH:MM and removes all buttons. Long denial
notes keep an 800-code-point preview with `full note in the workbench`. Approval
and ask buttons bind to distinct source fields: a key of the other kind changes
neither record and answers the press. Closed never-left approval sends are
also dropped; uncertain sends retain their fence. After a committed approval
result is lost, replay observes the saved closed record, answers `Already
answered` and never repeats the native command. Claude Code/TUI approvals do
not acquire approval buttons. Known durable approval closures also answer
`Already answered` without a hub request and repair that stale copy; foreign
presses use the same private mapped-card refusal as asks. Repair fallbacks with
unknown delivery stay fenced without blocking callback confirmation.

Typed replies to an approval card never select a choice or borrow a waiting
ask's prompt: an open card gets a use-buttons note and a known closed card gets
a closed-approval note. Late unthreaded text stays marked in General. An
accepted note whose receipt is lost is recorded incomplete and stays fenced;
its input confirms and later input progresses without retransmitting the note. See the
[approval card guide](../agents/tests/hub-test-telegram-approvals.test.ts.md).

### Telegram needs-you notices

With Telegram enabled, a resolved token and a paired private chat, inbox plans,
human requests, item-topic messages in the needs-you inbox and TUI approvals
arrive as 📥 notices. They use the shared card model and text/entities renderer,
with no `reply_markup`, at card priority outside the General mute gate. A notice
names its item/sender or session and previews its text or command within one
message; the full source remains in the workbench. Headers use at most 1,024 code
points, with an ellipsis when clipped. The full notice, separators and preview
marker fit 4,096 code points, and entity spans come from the rendered text. A
public origin longer than 1,024 code points appears as an **Open workbench** link
with its full target retained. Stable per-chat row keys deduplicate repeated
inbox publications across restart. Each publication queues notices oldest first
by retained wait time, then source id and kind for ties. Pairing rows stay local.

| Notice | Action and reply routing |
| --- | --- |
| Plan | Names the epic and title; plans are approved in the workbench. Includes only the configured `[web] origin` when nonempty, as a public link; never calls `web.link`. A reply goes to General with `re plan <item>:`. |
| Review, QA or handover request | Names the request kind, sender and subject. A reply goes to its topic with the real source message as `replyTo`. |
| Item-topic message | Names sender and item, with a clipped preview. A reply goes to its topic with the real source message as `replyTo`. |
| Claude Code / TUI approval | Names the session, harness and command and says to answer in its terminal. A reply goes to General with `re approval <session>:`; it answers no approval. |

Plans and TUI approvals have no source message. Their General reference is kept
in adapter-local durable state, alongside the existing native message map; no
hub metadata or gateway authority is added. All inbound messages retain
`via: "telegram"` and the commit-before-feedback/replay guarantees. A reply does
not subscribe the remote to an item topic: later ordinary agent messages stay
there, while new needs-you rows can produce new notices. Other notice content
passes through the gateway's existing secret redactor. The public origin comes
from validated configuration, without credentials, path, query or fragment;
web settings apply after a hub restart. See the
[notice frame/fake guide](../agents/tests/hub-test-telegram-notices.test.ts.md).


### Telegram polling and durable confirmation

An enabled Telegram remote with a resolved token uses the daemon's existing
`Store.remotes` handle and gateway poller lease. Its serial `getUpdates` loop
requests exactly `message`, `edited_message`, `callback_query` and `my_chat_member`,
with a 40-second online timeout and the client's 55-second HTTP deadline. An
independent injected-clock liveness bound aborts and joins a stalled request at
its poll timeout plus 15 seconds: 55 seconds online and 15 seconds for a
zero-timeout offline probe. Its diagnostic says the poll stalled and polling
restarts. Failed
polls wait one injected-clock second before retrying with timeout zero; a successful
exchange records recent inbound traffic. After all retained updates have been handled,
the loop restores the 40-second timeout. A full 100-update batch keeps the
zero-timeout catch-up probe until the retained input is drained. A provider `retry_after` replaces that
wait, bounded to five minutes, except that a 409 retains the one-second retry
within its conflict budget. Consecutive 409 responses get a 60-second grace
starting at the first conflict; a successful exchange resets it. A lasting 409
rejects the lifetime as "another consumer of the token". No process is signalled
or stopped to resolve the conflict, and the existing poller lease stays owned
until gateway shutdown drains its remotes.

A 401 or 403 immediately rejects the remote's lifetime and the gateway disables
only that messenger. Telegram posts one fixed cause/fix hub notice to General
through `remoteNotice` and the project redactor; its disabled reason retains
the fixed cause/fix first, followed by bounded sanitized provider detail. A 401 asks for a new token through
`cland secret set telegram.token`, then `cland hub reload`; a 403 asks to unblock
the bot, then reload. A lasting 409 asks the human to stop the other consumer,
then reload. Reload retries a failed enabled client even with unchanged settings.
The hub, web edge and other remote continue serving after the failure. The
[liveness test guide](../agents/tests/hub-test-telegram-liveness.test.ts.md)
covers these fatal and stalled-poll boundaries.

The loop filters before handlers, downloads or commands: only a private chat,
a non-bot sender and the current pairing's chat and sender ids qualify. It
re-reads the pairing for every update. The sole pairing exception is private
`/start` input from a non-bot sender, routed only to a pairing handler. An
unlisted or ambiguous update kind is consumed silently. One narrow non-pairing
exception uses `TelegramPollingOptions.foreignCard`: a foreign non-bot presser
on this bot's own durably mapped card gets only `answerCallbackQuery` with
`show_alert: true` and “This card is for the project's owner”. It makes no hub
request and changes neither the ask nor the card; the ordinary update/callback
receipts confirm and deduplicate it. Every other foreign update stays silent.
The optional native refusal handler grants no human frame authority. Callback authority uses
the presser, never the author of the bot's card; membership updates must concern
this bot.

`TelegramPollingOptions.handlers` is a first-matching registry. A handler declares
`kind: "pairing"` for private starts, or defaults to paired input, supplies
`accepts(update)` and resolves `handle(update, signal)` only after durable effects.
Handlers must make replay after interrupted handling safe using stable platform
ids. The loop then commits `telegram.update:<id>`, the applicable message/callback
dedupe receipt and `telegram.offset` in one SQLite savepoint in `remote_state`.
The next poll confirms that stored offset. Messages and edits share the
`telegram.message:<chat>:<message>` receipt; callbacks use their own ids, so two
button presses on one card are distinct. The outgoing `remote_messages` reply map
remains independent. These keys persist across restarts without a new database.

Paired photos, documents, audio files, video notes and videos enter a durable
messenger-scoped per-chat media FIFO in `hub.db` before the update offset advances.
Photos use the largest size as `photo-<message id>.jpg`; documents retain their
name and MIME type (default `application/octet-stream`). The worker downloads
through the capped Bot API client and calls `artifact.upload` with native bytes,
the ingress identity and caption, producing one human message with artifacts.
Replies use the native mirrored-message map; other files go to General. The same
👌/👀 receipts and late-input caption suffix apply. Ordinary text queues behind
pending media; commands, prompts and button presses bypass that queue. Startup
recovers queued work, and native ingress deduplication prevents duplicate uploads.
Items with the same opaque group key (`media_group_id` on Telegram) share one
queue entry. Joining the group and its per-item stored receipt commit in one
transaction before the poller confirms the update. A group closes after two
seconds without an item on the injected clock, or the next admitted chat update
outside that group. Startup gives recovered open groups a fresh two-second
window; closed groups resume immediately. One upload uses the first item's
ingress identity, ordered files and first non-empty caption; every native item
maps to the resulting message and receives its own stored/seen reaction.
Only album receipts carry target lists and per-target progress; single-message
receipts retain their original fields.
If the upload committed but its result was lost, recovery uses the durable ingress
receipt to repair member maps and resume feedback before attempting native file
I/O; expired messenger files cannot discard an already committed album.
An oversized item receives one named reply and is omitted while the other files
still arrive together. Legacy ungrouped queue entries recover as single inputs.
Workers retain their paired numeric identity; unpairing or replacement revokes
pending media before upload and again at artifact commit. Fatal native media
401/403/409 responses save the stopped state and retain work for hub reload.
Declared sizes above the smaller of 20 MB and `[artifacts] max_upload_mb` receive
one explanation without `getFile`; permanent failures receive one reply and leave
the queue. For photos/documents, retryable getFile/download failures are silent
until three failures for that native input (two retries, one second apart). The
failure count survives restart; exhaustion sends one filename reply and releases
the queue. The hub logs only the retryable error class and numeric code.
Token-bearing download URLs
stay inside the client. Voice notes use the unsupported-input fallback here.

The native registry is assembled after startup recovery and before polling begins;
there is no asynchronous handler-installation wait. After injected and dedicated
handlers, a terminal fallback replies to unsupported paired messages with
“This kind of message does not reach General”. Edits get the same one-line reply. The dedicated card handler still acknowledges
unmapped presses with “This button is not available”. Replies reuse the durable command fence, so interrupted handling never
replies twice. Media handlers precede this fallback. A lower-level registry
with no match also confirms silently rather than holding later input forever.
Both paths log `telegram-update-unhandled` with only the numeric update id and
allowed update kind, never text, captions or file ids. Confirmation and dedupe
still use the same durable savepoint, including across restart.
Shutdown aborts the current poll and delay and joins the
handler before the gateway releases its lease or storage. Legacy injected
`TelegramRemote(api, clock)` clients retain their check/send-only lifetime.

The [component guide](../agents/tests/hub-test-telegram-polling.test.ts.md)
and [crash/restart guide](../agents/tests/hub-test-telegram-polling-restart.test.ts.md)
name the frame/fake and native-process receipts.

### Telegram catch-up and outage notices

With Telegram enabled, a resolved token and network access, the first failed
poll starts a durable outage interval. Status is disconnected during that
interval; starting a retry never establishes a connection. Only a recent
successful exchange does. Poll retries retain their zero timeout while the
remote catches up with what Telegram kept.

After three injected-clock minutes offline, General receives one redacted hub
line, `Telegram remote offline since 13:20: <reason>`. Recovery writes
`Telegram remote recovered; offline since 13:20` only if the offline line was
posted. Shorter outages produce neither line. The gap and the mirrored recovery line
use the same per-chat queue as ordinary sends, with silent notifications. Both
General lines use the same `remoteNotice`
boundary as fatal diagnostics. Successful polls do not cancel the outage timer
until catch-up completes: repeated catch-up failures still produce that one
General notice. Retry diagnostics use fixed reason classes naming `gap`,
`outbox resume`, `inbound recover` or `card catch-up`; unexpected callback
failures use `unknown step`. Provider error text is never interpolated into
these classes. Stop drains the timer and pending native work.

Retained text reaches the normal human frame path with
`(written on Telegram at 13:20; the hub was down until 13:24)` appended, using
the provider's written timestamp and the first recovered poll's timestamp in
the hub's local time. Telegram's formatting is still discarded, and stable
native input identity preserves replay-safe delivery and reactions.
The gap captures missed native General job ids, deduplicating split parts by
source message. Its immutable send key and captured ids survive restart. Only
the matching successful native send, or a durable uncertain Telegram gap job, settles those ids as reported; a General source
arriving during the send remains missed for the next gap. An uncertain native
delivery stays fenced, never retried as a new gap. For Telegram, the saved gap clears
and recovery continues without claiming the informational line was delivered;
the native job and its unknown attempt remain unchanged. This also applies on
startup with a persisted uncertain gap. Zero missed sources send no
line. A recovered transport admits feedback and gaps while General arrivals
still count as missed until catch-up completes. If another source arrives
during a held gap, another zero-timeout exchange settles its separate captured
gap before returning to normal polling. The [captured-gap unit guide](../agents/tests/hub-test-telegram-gap.test.ts.md)
names these persistence receipts.

Queue and feedback recovery joins apply to an active outage. An ordinary
successful poll confirms a command's own durable send without waiting for later
queued General work; the per-chat drain continues independently.
With a paired chat, automatic cards and outcome edits wait until retained input
and the gap have settled; explicit phone commands and callback replies can
complete during that input phase. The queue then delivers missed open cards
and pending outcome edits, dropping never-left cards whose sources closed.
If the first recovered exchange is more than 150 seconds after the durable
outage start, every still-open ask and hub approval gets a new copy, oldest
first, with `a button pressed then may have been lost; press again`. After that
copy has a durable native map, each earlier mapped copy is edited to
`↓ Re-sent below` without buttons. Only the native edit's receipt establishes
retirement: a refused edit followed by a delivered fallback reply leaves the
original buttons intact and records incomplete retirement. Later answers still
fold every mapped copy. This is separate from `/inbox`, whose earlier copies retain their buttons; notices do
not acquire outage replacement copies.

Replacement plans, captured old-copy ids and send keys persist per chat and
outage. An interrupted recovery keeps its outage record. Unknown replacement
sends stay fenced and are recorded incomplete, keeping the old usable copy;
an unknown old-copy edit/fallback is also recorded incomplete. Neither is
retransmitted under a fresh key, and a successful poll lets other cards and
input progress. A graceful stop persists a planned recovery boundary. On restart, retained input
gets its written/recovery times and the same 150-second card rule applies.
Planned stops emit no failure outage or recovery notice and expose no failure
reason or outage timestamp in the Remotes row; a real transport failure still
uses the ordinary outage path. A restart under 150 seconds sends no replacement card.
The [card guide](../agents/tests/hub-test-telegram-cards.test.ts.md) names
the frame/fake outage, boundary and restart controls. These internal recovery
steps add no command, setting, frame field or role permission.
Resuming a held drain also reconciles its earlier publication waiters: a
durable closed-source drop completes the original publication while the remote
stays live; an unknown send remains incomplete. The waiters and lane drains are
captured together. Later sends on new chat lanes keep their own completion
receipts and cannot be judged by that earlier drain snapshot.
Catch-up completes after retained updates are durably handled and confirmed,
never at retry launch. See the
[catch-up test guide](../agents/tests/hub-test-telegram-catchup.test.ts.md).

### Telegram text from the human

With Telegram enabled, a resolved token, an available API and a paired private
chat, ordinary text reaches General as the human's `message`, with `via: "telegram"`,
unless it answers a waiting prompt or replies to an ask card or prompt.
`/decision <text>` and `/question <text>` select those kinds; the optional
`@botname` command suffix is accepted. Telegram entities are discarded: the
visible text is preserved without bold, link destinations or code formatting.
The existing workbench resolver handles session names, roles and `@lead T-n`.
The Aide role is not an addressee; address an Aide by its session name.

A reply uses the `remote_messages` entry for that chat and Telegram message id,
then submits the stored topic and source message id through the gateway's
ordinary reply authorization. Ask cards and ForceReply prompts take the ask
answer path instead, without a General message. An unknown reply stays in
General; Telegram's supplied quoted text, author and topic are never routing authority. This input
handler leaves cards, media, edits and other commands to their registry handlers.

The native port can supply a chat/message identity separately from the frame.
The gateway namespaces its digest by messenger and passes it to the dispatcher
as the human message's durable primary key. Replaying that identity returns the
original message and current delivery stage without recording or delivering it
again, including after a restart or a lost result. Wire fields cannot supply
this identity; previous clients keep their existing request/result shapes.
An optional native recovery callback reads the durable message and its current
session stage through the gateway conversation. It is scoped to that messenger
and is never a frame action. Before polling, the native client reconciles
pending feedback receipts for the current paired chat, so a delivery stored
before a lost frame or shutdown still produces 👀 after restart. For native
`topic.answer`, the gateway-only recovery reader follows the messenger-scoped
`gateway.answer:<ingress-id>` receipt to the answer's actual stored message id
and current delivery stage, including after the input offset is confirmed.
Ordinary inputs keep direct lookup by their native id. This adds no wire action;
the other messenger cannot read that receipt. Older injected
ports may omit this callback and retain their previous startup behavior.

`setMessageReaction` puts 👌 on the Telegram input only after the durable send
result. It replaces that reaction with 👀 after a `delivered` or `injected`
session receipt, including a queued message delivered later. Per-message
reaction writes are serial, their completion bits live in `remote_state`, and
the worker releases ownership in the same turn as its final work check. A
delivery arriving at settlement either joins an active drain or starts a new one.
Shutdown aborts and joins their HTTP exchanges before storage closes. A
cancelled input remains unconfirmed and safely replays; an interrupted reaction
can repeat the same idempotent set operation. No text echo is sent.

The [inbound test guide](../agents/tests/hub-test-telegram-inbound.test.ts.md)
names the production-factory, fake-platform and lost-result receipts.


<!-- Implementation guidance moved from the implement skill. -->

For Discord REST pacing, use the loopback client/fake and production-frame seams
in `docs/agents/tests/hub-test-discord-api.test.ts.md` and
`docs/agents/tests/hub-test-discord-messages.test.ts.md`. Inject the same clock
into client and fake; assert native posts plus durable mappings. Keep callback
and original-response edits outside lanes, preserve the unchanged enforced nonce
on bounded native retries, carry the original attempt’s absolute nonce deadline
through every queue/wait and check it immediately before I/O, and drop definite
invalid requests without replay. Use the pre-registered exchange owner for
fake-clock native operations and preserve learned-bucket ownership through body
completion. Store-bearing exchanges use the owner’s project allocator and
successful-drain removal barrier for ordinary and signal cleanup; retain roots
and Stores after incomplete drainage until the real writer settles.
Existing role clauses cover this flow; no permission line is added.

For workbench remote state, use `docs/agents/tests/hub-test-remote-workbench.test.ts.md`,
`docs/agents/tests/nvim-test-remotes.test.ts.md` and
`docs/agents/tests/web-test-remotes.test.ts.md`: production Telegram, fake
Bot API, safe frame projection and the actual rendered headless rows. Keep
`sessions.remotes` optional, the prior hello/snapshot regression and local status
credentials/routing out of `remote.state`. Connection/pairing/mute changes are
immediate; only depth changes coalesce. Raw positional socket consumers explicitly
consume the connect event before their result. No new keys or role permissions.

For Telegram Bot API or native messenger changes, use the T2 loopback/fake-control
and production-factory frame seams in
`docs/agents/tests/hub-test-telegram-api.test.ts.md` and
`docs/agents/tests/hub-test-telegram-messenger.test.ts.md`. Reuse secret validation
and the project redactor before constructing a token-bearing URL; keep raw fetch
errors inside the client. Arm held-request observers before triggering and join
native close receipts. The fake registers cleanup before bind; use its bounded
control helper and setup/close receipts. Forward the gateway's optional start
lifetime signal to startup I/O. Preserve explicit factory and legacy remote injection.
For Telegram media transport, the same client/fake seam covers `getFile`,
capped streaming `download`, `sendPhoto` and `sendDocument`. Keep token URLs
inside the client. Use `/control/media` with synthetic bytes or declared sizes;
a held-open chunked download must close at the byte cap. Upload captions are
plain FormData text (CRLF newlines), without entities or parse mode.
For card API calls, use the same client/fake seam and `/control/press` with explicit
chat/message ids, zero-based row/column and human/stranger identity. Observe the
queued callback before advancing the injected clock past 150 seconds. Keep
callback data within 64 UTF-8 bytes and use one button per row. Send ForceReply
as a separate prompt with `reply_parameters`; it can never be edited. Outcome
edits remove buttons with an empty inline keyboard and preserve the sanitized
`message is not modified` description. Callback acknowledgements go directly
after the hub stores the answer, outside the outbox. Preserve existing send
failure classes and test token-free receipts and echoed faults for both new calls.
For Telegram polling or update handlers, follow the filtered registry and durable
confirmation contract in `docs/hub/remote-commands.md#telegram-polling-and-durable-confirmation`
and the component/crash guides in `docs/agents/tests/hub-test-telegram-polling.test.ts.md`
and `docs/agents/tests/hub-test-telegram-polling-restart.test.ts.md`. Inbound text,
replies, feedback and lost-result replay use `docs/agents/tests/hub-test-telegram-inbound.test.ts.md`.
Attach handlers to the registry; keep native identity/recovery outside frames,
reconcile feedback with durable session stages, and join replay-safe handlers on stop. Keep dedicated handlers before the terminal unsupported-input fallback; confirm unmatched input and retain its content-free id/kind diagnostic.
For abandoned Telegram fixture setup, retain the early native-close observer
but start its drain deadline at disposal; acquisition has a separate bound.
Keep the inbound omitted/aborted delayed-setup controls and their exact native
close, stopped writer, closed Store and zero observer/timer assertions.
For 📥 notices and plan/TUI General-reference routing, use
`docs/agents/tests/hub-test-telegram-notices.test.ts.md`; preserve the gateway's existing authority.
For Telegram liveness, use the production-factory/frame and fake-clock controls in
`docs/agents/tests/hub-test-telegram-liveness.test.ts.md`. Observe native poll close
at timeout plus 15 seconds, including zero-timeout offline polls. Preserve the
60-second 409 grace without signalling another token consumer; fatal 401/403/409
notices use `remoteNotice` and the project redactor, then the existing disable path.
Retain authenticated web service and unchanged-reload recovery for failed enabled
clients; configuration-disabled clients stay stopped. Existing role clauses cover
the same remote isolation and secret boundaries without new permission lines.
For Telegram catch-up, use the production frame/fake-clock receipts in
`docs/agents/tests/hub-test-telegram-catchup.test.ts.md`. Start an outage while
the scratch hub serves, keep the exact three-minute notice boundary and one
recovery, annotate retained input before store/confirmation, and send a gap
only above zero after input catch-up. Use
`docs/agents/tests/hub-test-telegram-gap.test.ts.md` for source deduplication,
held-send arrivals and stable-key recovery; acknowledge only the captured ids
on the matching send receipt or durable uncertain Telegram gap job. In the
uncertain case clear the saved summary and continue catch-up, retaining the
native job and unknown attempt without resending. Preserve fixed catch-up
step diagnostics and one General offline notice during prolonged catch-up
failure; the transport success alone must not cancel that timer.
Keep recovery joins scoped to an active outage: a healthy command's next-poll
confirmation must not await later ordinary queue work. Retain the existing
command-priority/own-receipt regression when changing these hooks.
Keep optional native callbacks compatible;
no frame or role authority expansion is needed.
For native Telegram `/start`, blocked membership and disabled bot-link facts, use
`docs/agents/tests/hub-test-telegram-pairing.test.ts.md`. Keep injected handlers
first; fatal membership records its sanitized cause/General notice before
consuming the update, so restart does not replay a kick.

For outage card replacement, use the frame/fake controls in
`docs/agents/tests/hub-test-telegram-cards.test.ts.md` and its approval counterpart.
Hold automatic cards, edits and their fallbacks until retained input and the gap
settle; keep explicit commands, callbacks and feedback progressing. Measure the
strictly-over-150-second boundary from the durable outage start to the first
recovered exchange, excluding queue pacing. Persist replacement identities and
old-copy ids before sends; retire old buttons only after the new native map.
Require the native edit receipt as well: a delivered fallback reply leaves the
original buttons intact and records incomplete retirement. Reconcile held
publication waiters on recovery's durable closed-source drops while still live.
Capture those waiters with the resumed lane snapshot; later sends on new lanes
must settle from their own receipts. Retain the pacing/reopen consumer controls.
Keep later all-copy outcomes and `/inbox`'s original live buttons. Unknown sends
and old-copy repairs stay fenced/incomplete while later recovery progresses;
an interrupted stop must retain the outage. Existing role clauses cover this
flow; add no command, frame field or permission line.

For Telegram ask cards, use the frame/fake seam in
`docs/agents/tests/hub-test-telegram-cards.test.ts.md`. Keep the card model
messenger-neutral and the Telegram renderer shared by sends and outcome edits.
Bind opaque keys to the mapped ask and chat, preserve every label, and clip only
the question at a word boundary with the full-question marker and outcome space.
Commit native callback identity with the answer before direct callback I/O,
defer publication/delivery until commit, and confirm the offset afterwards.
Treat a definite expired-press acknowledgement as terminal after the saved
result, while transient callback failures retry it. Keep the lost-result restart, cross-ask/unissued keys,
not-modified/failed-edit controls, and all four send-failure classes. Prove
Neovim/web outcomes, withdrawn/cancelled cards, departure-only declines, both
orders of the answer race on every mapped copy, and closure during an in-flight
send. Own authenticated web fixture HTTP/socket acquisition before the hub,
and retain missed/aborted setup plus native close/drain controls. A queued never-left card whose ask closes is dropped; unknown sends keep
their replay fence, while edits remain eligible. Test latest unattempted keyed
edit merging and priority ahead of General through the fake API. Existing
role clauses already cover the gateway authority and secret boundaries; add no
clause lines. Other/Decline use separate immutable ForceReply prompts after the
callback acknowledgement. Keep durable prompt/mode/next-text selection and exact
input routing across restart and lost results; prompt maps have no editable ask
id. `/cancel` clears only the wait and keeps the ask open. Explicit prompt/card
replies target their own ask, options-only replies require a number, and closed
asks consume no General message. Reuse inbound stored/delivered feedback;
feedback failures retry the saved answer rather than becoming stale-input notes.
An unknown prompt send records incomplete publication and releases the callback
cursor without retransmission; consume unmapped explicit replies with a note,
never quoted-text authority or a General post. Prove native accept-disconnect,
restart, reply/cancel and later-input progression. Confirmed answer feedback
recovery follows the messenger-scoped gateway.answer receipt to the current
message/stage; keep ordinary-id lookup, other-messenger isolation and prior-wire
refusal. A pre-offset replay alone does not prove confirmed-input recovery.
Known closures return Already answered without a hub frame and repair stale
buttons; retain saved callback receipts and callback-id dedupe across restart.
An unknown stale-repair fallback stays fenced and incomplete while the closed
callback cursor and later input progress; retain its accept-disconnect control.
Only bot-authored mapped cards admit a foreign press for a private show_alert
refusal with no hub frame or ask/card change. Keep other foreign input silent.
Late unthreaded text reaches General marked late and keeps the prompt wait;
explicit replies target only their own open ask. Retain the interrupted late
feedback/restart and silent non-card/forged-author controls in the card guide.

For Telegram approval cards, use the production-frame/fake-platform and scripted
native seams in `docs/agents/tests/hub-test-telegram-approvals.test.ts.md`.
Keep ask/approval keys and maps distinct, offered styles/choices, bounded command
and denial-note previews, and durable native outcomes before callback/offset.
Retain cross-kind substitutions, component lost-result replay, all-copy harness
closure and source-closed versus uncertain-send controls. Both headless inboxes
must show approved Codex and denied OpenCode outcomes via Telegram. Outgoing
hub frames may mask harnessId/attach metadata; incoming frame routing remains
strict. Preserve the native OpenCode producer regression and gateway-secrets
refusal. Apply the same known-closure/no-frame, private foreign refusal and
unknown-repair cursor handling to approvals. Typed approval replies only get
use-buttons/closed notes and never borrow an ask prompt; unknown note sends
stay fenced/incomplete while input progresses. Retain approval stale/foreign
restart, late prompt isolation and both accept-disconnect controls.
These are existing human actions with no added role-clause lines.

For Telegram phone commands or menu registration, use the sealed production-frame
and fake Bot API seam in `docs/agents/tests/hub-test-telegram-commands.test.ts.md`.
Keep status/inbox reads within gateway authority, force text/entities for replies,
compare the actual private-chat menu before writing, and fence native command
identity before queued sends. Keep replies at ordinary priority and preserve
entities, contiguous numbered parts and durable accepted ids. Preserve the committed-effect/lost-receipt restart
control. `/inbox` uses the card handler's shared renderer, maps live copies of
every open card and notice, and orders the combined publication by since/id.
Keep earlier buttons working, all-copy outcomes, pairing exclusion and the
one-line empty reply. Resend jobs use command-scoped keys under the existing
native command fence; preserve the unknown-resend restart control.
Draft cancellation state belongs to the card handler.

For Telegram General rendering, use the production frame/fake receipts in
`docs/agents/tests/hub-test-telegram-rendering.test.ts.md` and the T1 conversion
boundary in `docs/agents/tests/hub-test-telegram-render.test.ts.md`. Keep rich
Markdown free of automatic entity detection and previews, preserve plain text
on conversion failure, and budget numbering plus the header before splitting
by code points or entity count. Never clip an entity; retain UTF-16 offsets.
Wait for every accepted part's durable source mapping before shutdown.
For Telegram pacing, use `docs/agents/tests/hub-test-telegram-pacing.test.ts.md`:
every send uses the shared per-chat outbox, cards first, with one-second pacing
and a bot-wide 429 hold capped at five minutes. Delivery reactions share that
queue and ordinary priority; keep their existing inbound feedback/recovery bits
and complete each transport operation from its own durable settled receipt. Drive fake time after durable
attempt/accepted-map receipts. Only a rich 400 falls back; 429 retries the same
request, 401/403 stop the remote, and network/5xx/missing receipts stay fenced.
Persist absolute bot-hold and chat-start facts across adapter recreation.
Recheck current pairing at actual send/recovery, reserving bypass only for an
explicit pairing reply or old-chat notice. Commit all fallback parts and their
superseded proof together; retain definite-400 recovery if planning is interrupted.
Pre-own fixture Stores, setup and every recreated adapter before awaiting them.
Arm setup bounds before native acquisition; release held startup I/O before
joining it and stop any late hub before closing storage.
Preserve old Outbox clients without scheduling options and join every drain on stop.
Retain the rich 401/403 fatal controls in the Telegram liveness guide.

For Telegram mute, use `docs/agents/tests/hub-test-telegram-mute.test.ts.md`.
Count eligible General sources before rendering, keep hub notices and card paths
outside the gate, and apply `mute_default` only at a new pairing. Commit command
effects with chat/message-id receipts before external reply I/O; preserve the
post-commit/pre-offset interruption regression and fence uncertain replies.

For Discord REST changes, use the fetch/fake seam in
`docs/agents/tests/hub-test-discord-api.test.ts.md`: string snowflakes, nonce
deduplication, mention suppression with a raw default-mention positive control,
provider faults and bounded hold/abort receipts. No real platform or token.

For approval race/restart changes, keep the existing native/frame seams and run `hub/test/approval-restart.test.ts` explicitly for the T3 scratch hub-process receipt. Codex's observable race boundary is resolution before its response-write receipt; its own echo follows delivery. Later matching item execution after Deny or declined completion after Approve corrects the archive and live record to `answered in the harness` with a warn event; retain the scripted native regression and unrelated-item controls. Telegram corrections require native delivered-first and held-first edit receipts with ordered final card text and unchanged replay fences. Without that evidence the protocol limit remains. OpenCode confirms through the HTTP result, not an equal choice in an event. Recover persisted OpenCode child owners before reconciliation, and wait for the exact `approval-rebuilt` native-validation receipt after a held recovery before answering in the restart test. Treat persisted authorization as display metadata until current native validation completes: hold/malformed replay tests must refuse without any endpoint call, and validated fields replace old subject/choices/routing while keeping id/since. Preserve allowlisted persisted ids/subjects and archive outcomes, and label unobserved off-stream choices `answered in the harness`. See `docs/agents/tests.md` (Approval races) and the protocol limitation in `hub/README.md`.

For the native Discord connection, use the sealed frame/loopback REST/ws seam in
`docs/agents/tests/hub-test-discord-messenger.test.ts.md`. Keep gateway URL
validation before socket construction, API v10 JSON/intents 33281 and token-only
Identify/header boundaries. Connection status requires READY plus a recent ACK;
keep deterministic jitter, immediate opcode-1 heartbeat and per-messenger notices.
Stop joins socket close and cancels heartbeat, reconnect and offline timers.
For resume/liveness changes, retain the guide’s zombie close, twelve-resume,
invalid-session delay and exact three-minute notice receipts. Keep settled REST
health separate from socket ACKs and job-local edit 404s; retain the paired-send
recovery receipt and the guide’s client-refusal and cleanup ownership boundaries. Existing frame shapes, optional
callbacks and role clauses remain unchanged.

For Discord command registration and pairing, use the sealed production-frame,
CLI and loopback REST/ws seam in
`docs/agents/tests/hub-test-discord-pairing.test.ts.md`. Compare global command
writable fields before writing; callbacks remain private and bypass message lanes.
Keep interaction tokens only in adapter memory with a 15-minute expiry. The
optional pairingApproved hook follows the committed local grant; Telegram and
older adapters may omit it. Existing role authority and frames remain unchanged.

For Discord phone commands and ephemeral deferral, use the production-frame/fake
REST/ws seam in `docs/agents/tests/hub-test-discord-commands.test.ts.md`.
Read the shared identify reservations and fetch platform remaining starts; reuse
neutral phone replies and mute receipts. Arm the two-second acknowledgement
before hub work, join a started defer before editing the original, and cancel
requests/deadlines on stop. Existing wire and role authority stay unchanged.

For Discord General delivery, use the sealed frame/loopback and native receipt
seams in `docs/agents/tests/hub-test-discord-messages.test.ts.md`. Reuse mirrorOut,
record attempts before I/O and commit the native mapping with sent settlement.
Keep nonce proofs within the documented conservative window; old unknown sends
stay fenced. Serialize inbound text and advance its cursor after the hub result,
with durable message-id deduplication and unchanged ingress frames. Existing role
clauses already cover this boundary; add no permission lines.

For Telegram outbound artifacts, use the sealed production-frame/fake-platform
seam in `docs/agents/tests/hub-test-telegram-artifacts.test.ts.md`. Keep the
planner messenger-neutral, batches durable before draining, and file jobs limited
to artifact ids and captions. Bind upload contents to the shared descriptor-based no-follow opener at delivery,
with bounded reads and finally-closed descriptors. Preserve plain
CRLF-budgeted captions, messenger-scoped once keys across pairing changes,
started-publication priority, safe same-chat sent-above native replies, and
General missed/unknown-attempt fences after timeout/restart. Existing role clauses
and wire frames cover this behaviour; add no permission lines.
For Telegram inbound media, use the sealed production factory/frame/fake Bot API
seam in `docs/agents/tests/hub-test-telegram-inbound.test.ts.md`. Persist native
file facts before confirming the offset; recover per-chat FIFO workers, queue
ordinary text behind media, and keep commands/prompts/presses independent. Pass
bytes beside artifact.upload frames and reuse the native ingress and stored/seen
receipts. Unsupported paired messages and edits receive the terminal one-line
reply. No additional role-clause permission is needed.

For Discord application checks and terminal stops, use the sealed frame/REST/ws
cases in `docs/agents/tests/hub-test-discord-messenger.test.ts.md`. Keep both
Message Content flags, empty endpoint validation before Identify, one fresh
Identify for 4003, structured fatal causes and one General notice. API error
observers retain only sanitized errors and numeric channel ids. All REST paths
stop on 401/40001/50014; test reads the application and sends one paired line.
Existing role authority and optional wire fields remain unchanged.

For Telegram reaction receipt authority, retain captured numeric pairing identity
and check it before and after native I/O. Keep the optional-field legacy recovery
control and held-feedback unpair/replacement cases in the Telegram inbound guide.

For Discord replies and reaction feedback, extend the production-frame cases in
`docs/agents/tests/hub-test-discord-messages.test.ts.md`. Keep mapped topic/reply
routing, foreign-author rejection and legacy inbound tombstones. React through
the durable outbox with idempotent PUT recovery; reconcile delivery receipts
only after the gateway conversation opens. Observe sent settlement before a
restart and retain both native emoji state and HTTP attempt assertions.

For Discord mirror rendering, use the production-frame/loopback receipts in
`docs/agents/tests/hub-test-discord-render.test.ts.md`. Render and fall back before
durable enqueue; commit all numbered parts in one synchronous transaction before
starting a drain. Persist the rendered bytes and optional silence flag, keeping
historical payloads readable. Preserve empty allowed_mentions on creates and
edits, SUPPRESS_EMBEDS, and original source mappings for every numbered part.
Split by Unicode code points with headers and fence closures in the budget;
prefer complete blocks and reopen split fences with their language. Existing
role clauses cover these paths; add no permission lines.

For Telegram albums, keep the opaque media grouping in the durable FIFO: commit
each item before offset confirmation, close on two injected seconds of quiet or
the chat's next update outside the group, and reset open-group quiet time on
restart. Retain ordered files, first non-empty caption, first-item ingress and
all native reply/feedback mappings. Confirm restart setup through the native
getUpdates cursor receipt. Recover committed uploads from the durable ingress
receipt before downloads so a lost result plus expired files cannot drop maps.
Only album receipts carry target lists and per-target progress; preserve the
legacy single-message receipt shape and its prompt-recovery regression.
An oversized member must not drop its peers.
Use the album cases in the inbound guide, including legacy single-input recovery.

For Telegram voice notes, use the sealed production-factory/frame/fake Bot API
and fake speech provider in `docs/agents/tests/hub-test-telegram-voice.test.ts.md`.
Keep original bytes, MIME/suffix, one human transcript and one native reply,
including missing/off/quota/empty outcomes. Keep the native hub.reload command
provider switch at T3 in `docs/agents/tests/hub-test-telegram-voice-command.test.ts.md`.
The optional fourth MessengerFactory argument carries the speech provider; old
three-argument factories remain valid. Preserve legacy frames and receipt shapes.
Existing role clauses cover voice uploads; add no permission lines.

For Discord Identify admission use the native factory/frame/fake cases in
`docs/agents/tests/hub-test-discord-messenger.test.ts.md`: persist reservations
before socket I/O, pre-arm the bounded client admission-scheduled observer before restart/close
and observe its exact socket ordinal before injected-clock spacing checks, and keep
failed-only equal-jitter backoff separate from resumes. The existing
identify-budget stop cause carries the UTC reset time; no role permission or
public frame changes are needed.

For Discord cards, modals, approvals and `/cland inbox`, use
`docs/agents/tests/hub-test-discord-cards.test.ts.md`. Bind every custom id and
modal submission to its mapped native message and user; that mapping is the only
action authority, never button text or an id of another kind. Refuse stale or
foreign interactions privately before any hub write. Commit the hub outcome
(`topic.answer`, `approval.answer`) before the callback, defer at 2 s, and join
callback work before the Store closes. A closed card or approval closes every copy;
resend keys stay scoped to the interaction, apart from live publication. Validate
approval-model and native-map keys, link plans only from the configured origin,
and keep General reference prefixes and the previous command and outbox shapes.

For Telegram voice admission and answers, use the telegram-voice fixtures in
`docs/agents/tests/hub-test-telegram-voice.test.ts.md` and
`docs/agents/tests/hub-test-telegram-voice-answers.test.ts.md`. Freeze the answer
target before speech I/O, assert no native `getFile` after a durable refusal,
keep MIME, name and caption, and keep the two-audio album regression. A matched
answer keeps no audio; failed or unmatched notes upload to General. Secret hub
cards carry optional `InboxAsk.secret: true`: Telegram and Discord refuse voice
replies to these cards before download, transcription or storage, replying
“Use text to answer this card” without a transcript or echo. Non-secret hub
cards, ordinary cards and General retain their voice behavior. Ordinary and older
inbox rows omit the secret key. See
`docs/agents/tests/hub-test-hub-cards-voice.test.ts.md` for native refusal and
non-secret controls.

For setup speech keys, use the sealed runner and prompter fixtures, share
`SPEECH_DATA_USE`, preflight before hidden input and resolve environment overrides
before offering a key. For Telegram workbench marks, use
`web/test/telegram-marks.test.ts` and `nvim/test/telegram-marks.test.ts` with their
guides; keep the persisted prefix and wire shape and assert header marks and
attached audio separately.

For Discord resume, replay and fresh-Identify history catch-up, use the restart
and history cases in `docs/agents/tests/hub-test-discord-cards.test.ts.md` and the
native kill case in `docs/agents/tests/hub-test-telegram-polling-restart.test.ts.md`.
Hub stops close 4000 and keep the durable session and handled sequence; a
configuration disable closes 1000 and clears it through the optional
`Remote.disable` hook. Persist a replay cursor or bounded history selection only
after its dispatch effect has settled. Replayed messages keep their written and
return times, commands are dropped and presses never answer. Gate live text and
publication until history settles, then send the silent source-counted gap and
re-send only mapped open cards, with stable keys and old copies retired after the
sent receipt. Outbox reads select pending states or exact ids; never decode the
whole ledger per input. Advance fake clocks by observed sent receipts, not by
mapping counts, and keep an independent hub request bounded during catch-up.
Keep the previous adapter, wire and outbox shapes.
For both remotes in one hub, use `docs/agents/tests/hub-test-scenarios-remotes.test.ts.md`:
a graceful stop persists a planned recovery boundary, keeps the 150-second card
rule and emits no failure outage (`docs/agents/tests/hub-test-telegram-graceful-restart.test.ts.md`).
Observe native close and Discord invalid-session persistence before advancing the
fake clock across a restart.

For setup's Discord step, use `docs/agents/tests/hub-test-setup-remote-component.test.ts.md`
with the fake Discord application; read the effective API root back and require
loopback before any synthetic token I/O. For doctor's Discord stop causes, drive
the native fake's close codes; for the Remotes row, voice, approval and pairing
marks, use headless native inputs in both workbenches through
`hub/test/discord-workbench-fixture.ts`. Keep at least one native-input case per
supported messenger for every messenger-neutral workbench criterion.

For bounded Discord history commits (T-1436), preserve the synchronous native
batch port and post-commit frame results. Keep the frozen selection and ingress
identity across both group rollback and the commit-to-adapter-receipt gap.
Keep each reaction attempt and settlement fenced; never hold a transaction over
an await. Use indexed source, last-row and depth reads and the full-scale decoded
row guard; exact durable source lookups also bound test observers. Keep replies
and media outside ordinary-text batches so reply mappings exist before routing. Preserve
legacy optional callbacks, nonce fences and final durable assertions. The restart
guide owns process-kill coverage; apply throughput thresholds in the external
measurement probe, not as wall-clock assertions in suite tests. No role clause
or CLI permission is added.

## Telegram album speech

For album transcription, use the production-frame/fake Bot API and speech cases
in `docs/agents/tests/hub-test-telegram-voice.test.ts.md`. Keep one General upload,
ordered filename-labelled transcript sections, per-file failure isolation and the
first caption. Reuse `voiceNote` and `transcribes`; preserve standalone text,
native ingress maps and the legacy receipt shape. Preserve filename headings in
both workbench bodies; exercise the shared native Telegram marks fixture,
including a filename beginning `not transcribed: ` and a single surviving file
after an oversized peer is refused. No role permission changes.

For paired setup reruns, use the fake-clock runner seam in
`docs/agents/tests/hub-test-setup-remotes.test.ts.md`: both Discord and Telegram
wait up to ten seconds for a loaded paired remote to reconnect. Retain the
still-down and inactive-token controls; share readiness polling with Discord's
post-reload path. No remote.status fields or role permissions change.

Setup initial loaded remote reads and Telegram post-reload use the shared
`setup/readiness.ts` helper, including unpaired remotes. Doctor waits for enabled
loaded disconnected remotes concurrently over local status frames, within ten
seconds. Keep terminal disabled/missing-token states and older-hub refusal
controls immediate. Use the fake-clock matrices in the setup-remotes and
doctor-remotes per-test guides. Pairing remains an explicit human gesture and
approval; existing role clauses suffice.

### Discord with several users

With `[auth] mode = "users"` and the native Discord adapter enabled with a
resolved token, each paired Discord user id acts as its project user. Several
paired users may share a server text channel. Unpaired members send no hub
input and cannot answer cards; card refusals remain private. Single mode keeps
its one paired sender and channel.

General and inbox cards have one publication per paired channel. Discord input
is mirrored to other paired channels with the author's project name, and never
echoed to its origin channel. Every mapped card copy folds with the first
answerer's project name, including copies made by `/cland inbox`. That command
re-sends only in the invoking channel. Native ids, enforced nonces and unknown
send fences remain durable; General/artifact reservations, availability and
history cursors are scoped by channel in users mode. Recovery includes all
paired members of each channel. Startup resumes channel-scoped frozen history
before accepting replay input, including when the saved Gateway session takes
Resume without a fresh READY. A channel's revoked member cannot send input
or receive reactions; publications remain authorized while another paired
member remains there. A channel permission failure does not disable other
users-mode channels, including during history and gap recovery. Failed warnings
retain their channel checkpoint; a later recovery may retry a positively refused
send, while unknown sends retain their fence. Invalid bot credentials still
stop the adapter.

### Telegram publications in users mode

When `[auth] mode = "users"`, General and inbox cards reach each paired user's
private chat. Native input keeps its admitted pairing owner through asynchronous
work. General names the human author; a Telegram message reaches the other
users' chats without returning to its sender. Single mode retains its existing
labels, keys and echo policy.

`RemoteStore.publicationPairings()` enumerates publication owners independently
of native input context. `remotePublications` in `remote/cards.ts` deduplicates
chat/guild destinations and runs each callback under `withPairing`, then joins
all callbacks before reporting a failure. Telegram uses this shared seam for
General, inbox changes and closures. Card rendering still uses the shared
`RemoteCard` data model; transport fan-out does not choose card kinds.

Each Telegram chat has its own durable outbox availability and gap checkpoint
in users mode. A failed send leaves the other chat drains usable; unknown sends
retain their original fence. Successful polling reopens chat drains and reports
each chat's captured missed General sources. Bot flood limits still apply across
chats, and a polling outage or invalid bot token affects the whole transport.
Outcome lines use the hub's committed answerer and every mapped copy folds,
including a card whose native send completed after the answer.

Users-mode gap checkpoints also capture the project owner. Missed jobs without
that owner, or with a different owner after native-chat reassignment, cannot be
settled by the new pairing. A checkpoint from the previous shape without owner
is discarded in users mode; it does not authorize settlement. Single-mode
checkpoints retain their existing shape and behavior. A blocked or uncertain
users-mode gap notice keeps its checkpoint and missed jobs pending while the
other destinations continue. The same destination-local failure handling applies
to replacement cards after a global polling outage; bot token/conflict failures
still stop the transport.

Ordinary successful users-mode polls schedule one recovery worker per chat;
they do not await another destination's in-flight native send or gap notice
before fetching new input. Each worker resumes only its own chat and retains
its captured pairing. The adapter owns these workers and joins them during
shutdown after aborting native I/O. Bot-wide flood limits and global polling
outage catch-up retain their shared sequencing.
