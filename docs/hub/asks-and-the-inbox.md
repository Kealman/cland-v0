## Asks and the inbox

Record a human action, its settlement inputs and its structured outcome (decision, reason, answerer and time) in one durable write, independently of reply-message retention. Relay the structured outcome; an answered or closed ask alone grants no consent. For client-state imports, commit state with its one-time import receipt, acknowledge before removing legacy keys and preserve unrelated preferences; see “Human last looks and read marks” (A-9063 R5; T-1057, T-1059, T-1054).

An **ask** is a question the Coordinator puts to the human inside a topic (spec 4.5, decisions #7 and #10): a message whose text is the question, with a card in the store's `asks` table (the numbered options, whether a free answer is welcome, its state).

- **Only the Coordinator asks.** The spoke tool `ask {topic, question, options?, free?}` (frame `{"type":"ask","topic","question","options":[…],"free"?}`) from a session holding any other role, or none, is refused with the typed shape the permission table (#30) answers with: `{"ok":false,"error":"forbidden: ask (only the Coordinator asks the human: Implementer may not ask; …)","code":"forbidden","permission":"ask","role":"implementer","reason":"…"}`, which the spoke hands the model as it is. The permission table (`ask`, the Coordinator's in the defaults; `roles.toml` may grant it elsewhere) is the one rule: the dispatcher refuses first, as for any tool, and the ask handler applies the same `decide` (with the default table on a hub that has no role definitions).
- **MCP defaults.** Omitted `options` defaults to `[]` at the spoke, preserving free-only asks used by the release skill. Wire frames and `AskManager` retain a concrete string array.
- **The card.** A question (one message, at most the hygiene's size), at most 9 options (one line of at most 200 characters each; the keys 1-9 answer them), `free` true unless given false; options or a free answer are needed. Not in Agents. The result is `{"ask":"<message id>","topic":{"id","title"}}`.
- **Waiting.** An open ask makes its topic `waiting for human` (a `topic` event) and keeps it so: a plain human message, an agent's message, anything but the answer, `resolve` or a close leaves the status there. Several asks may be open in one topic.
- **The answer.** `topic.answer {ask, option?, text?}` (UI): option `n` (1-based) sends that option's text, else `text` is the free answer (refused when the ask takes options only). It is the human's message in the ask's topic, carrying `answerTo` (the ask's id), addressed to the session that asked (or, when that session has since handed over the role it asked as, to the role: its new holder inherits the ask, which `role.state` lists under `asks`) and delivered like any human message (the spoke shows `answer_to` on the channel event). The ask is `answered` with the answer's id and the option; when no ask in the topic stays open the topic opens, without starting a human Question wait. An ask that is not open takes no answer.
- **Declining.** The human frame `topic.answer {ask, declined: true, reason: "<reason>"}` answers with `declined: <reason>`, delivered to the asker with `answerTo` as above. The trimmed reason must be non-empty; an option or free `text` cannot accompany it. Declining also works for options-only asks. The ask's state is `answered`, its outcome is `declined`, and the topic stays open for another ask. A declined ask is a decision and never consent; there is no separate “ask me later”. A lead returning the unchanged declined answer with `ask.answer` preserves the upstream declined outcome on the original ask. The frame accepts the same optional stand-in `as` attribution as other answers.
- **Withdrawn and cancelled.** `resolve` (the Coordinator's tool or the human's `topic.resolve`) withdraws the topic's open asks; when the human withdrew them, each asker gets a hub note in the topic (a notice of kind `ask-closed`, through `noticeInTopic`). Closing the topic (`topic.close`) or its bound item cancels its open asks, and each asker gets a hub note (`cland hub: your ask "…" was cancelled: T-1 was closed`). A note does not reopen the topic.
- **Events.** The `message` event of an ask carries `message.ask` (`AskCard`, below); every change of an ask's state is an `ask` event, `{"type":"ask","topic","ask":"<id>","card":AskCard}`. `topic.history` returns each ask with its card and each answer with `answerTo`. The log and the journal record `ask`, `ask-answered`, `ask-withdrawn`, `ask-cancelled`; Agents records none of it (asks and answers are the human's, not agent-to-agent traffic).

`AskCard` is `{"question","options":[…],"free","state":"open|answered|withdrawn|cancelled","answer"?:"<message id>","option"?:n}`.

### Hub cards

The hub can also raise an ask itself through `core.cards` (`HubCards`):
`raise(kind, topic, question, options, free, payload, secret = false)` returns its
message id; `withdraw(id, reason)` folds it with that reason; and
`onAnswer(kind, handler)` registers its owner. This is an internal service, with
no new remote request or authority. The existing inbox and ask frames show
`from: hub`, with the same options and first-answer gate as Coordinator asks.
Kind and JSON payload stay in the asks store. Secret hub cards additionally
carry optional `secret: true` on InboxAsk so remotes can refuse voice before
acquisition; ordinary cards and older shapes omit the key entirely. The
thread AskCard shape is unchanged.

Register handlers on each startup before admitting answers. A pending card keeps
its kind and payload across restart. A missing handler logs its card id and kind,
refuses the answer and leaves the card open. A handler receives
`(payload, answer, context)` and synchronously returns its immediate outcome line.
The context names the durable card `id`, whether the answer was `declined`, the
chosen `option` if any, and `afterCommit(work)`. A decline is never consent;
handlers must test `context.declined` before accepting an operation. Hub answers
are recorded in the topic with no session recipients. In users mode, both the
answer message and the independent outcome retain the admitted stable user id;
inbox departures preserve it after message retention. Both remote copies fold
with the handler outcome, or the withdrawal reason.

Handlers validate and record their accepted intent in the same Store transaction
as the answer, keyed by the card id. They return an immediate outcome such as
“creating login codex-2…”. Host boot, sign-in and other slow work starts through
`context.afterCommit`; it raises or withdraws the next card or posts an Agents
line. The owning login service must resume its committed intents after restart,
or record one failure line; an accepted card is never replayed as a fresh
answer. A throwing handler rolls back its intent and answer; it must perform no
external effect before commit. A failed after-commit callback is logged by card
id without its exception text; the durable intent remains the owner's recovery
boundary.

A secret free text answer reaches the handler verbatim, including surrounding spaces.
Telegram and Discord voice replies to secret cards are refused before download,
transcription or audio storage with “Use text to answer this card”; there is no
transcript row or voice echo. Non-secret hub cards, ordinary cards and General
retain their existing voice behavior.
The topic answer, stored outcome, inbox archive, journal, log and mirrors contain
only “answered”; even the handler's returned string is suppressed. Native replay
receipts store a SHA-256 digest in place of the answer text. Telegram prompt
snapshots protect all hub-origin cards: they freeze routing and an input digest,
then hydrate text or a decline reason only from the matching native replay.
Ordinary Coordinator prompt snapshots retain their previous representation. The
answer result returns the authoritative stored card in its existing optional
`message.ask` field so Discord interaction updates use the same outcome as hub
closure edits, including deferred interaction updates. Keep payloads and
questions free of secrets. The service's secret marker protects answer retention;
native pasted-message deletion is owned by the login card integration.

### Answered ask outcomes

An answered `AskCard` also carries `outcome`, both in the live `ask` event and on
later `topic.history` pages. Its shape is
`{status: "answered", text: "<full answer>", option?: n, by: "<answerer>", at: "<ISO time>", via?: "<source>"}`.
`option` is 1-based and absent for a free answer; `text` is the chosen option's
text or the trimmed free answer, including every line. `by` is `human`, the
self-declared stand-in name, or the answering agent's name; forwarded decisions
preserve a recorded stand-in and the upstream outcome source. `at` is the answer time.
New human outcomes record `via` as `neovim`, `web`, `telegram` or `discord`;
agent answers record `session`. The field is optional for older rows and hubs. The outcome is stored on
the ask, independently of the reply message, and survives hub restarts. Existing
`answer`, `option` and attribution fields stay available. Legacy rows without a
stored outcome omit it. A declined outcome is
`{status: "declined", reason: "<trimmed full reason>", by, at, via?}`; it omits `text`
and `option` and retains the reason independently of its delivery message.

A human ask records its inbox wait atomically at creation, even before a client
or journal projection first reads the inbox. When an answered ask leaves the inbox, its `InboxDeparture` has
`reason: "answered"` (or `"declined"` for a declined outcome) and the same `outcome`. The next coalesced `inbox` event
includes `inbox.departures`, the rows settled since the preceding publication,
so clients can fold a row in place with its answer before archiving it. Explicit
`inbox.list` reads do not consume these pending departures. Subsequent events
omit `departures` unless more rows settle. Ordinary lists and initial snapshots
contain current rows; `inbox.list {archive: true}` retrieves the durable outcomes
in the seven-day archive, including after reconnect or restart. The client
chooses how long to retain a folded row. Departure outcomes also reach the
`inbox-departure` journal record and survive reply-message retention.

Answer origin is stored on the ask card and answer message as `answered_as: human` or `answered_as: stand-in` with `answered_by: <name>`. `cland topic answer <ask> 2 --as cland-impl` (or `--text "..." --as cland-impl`) declares a named stand-in; without `--as` the human shell records `human`. The trust model is self-declaration in the human's shell, which already has human authority: the label is not an authenticated hub session or a new role. Names use the session-name grammar. Every known hub session, Aides included, remains refused by `topic.answer`; a session's own shell identity takes precedence over `--as` and cannot be relabelled as human. The UI/frame equivalent supplies `as: {name: "cland-impl"}`. Supplied `answered_as` fields are not trusted.

`ask.answer` relays preserve the forwarded answer's `answered_as` and `answered_by`, with `relayed_by` naming the lead returning the decision. Agent decisions without a forwarded human answer have no human/stand-in attribution. The origin survives hub restarts, appears in `topic.history`, spoke/channel answer metadata and `ask-answered` journal entries. `task view` shows answer origins from the bound topic (`item.answers` in JSON, containing `ask`, `answer` and attribution); these are hub state, separate from item frontmatter. Legacy asks without recorded origin stay unattributed.


Sessions use `send` kind `request` with no `to`, a `request` of `review`, `qa` or `handover`, and a `subject` naming an item, artifact or session when they ask the human for that action. Any role may send a request; routine information uses `report`. These instructions live in the default role clauses and the project's `.cland/roles.toml`, which cland never rewrites. Running role sessions adopt changed clauses on their next launch; relaunch them after updating project clauses.

The **inbox** (v0.1.2 §3.7, `InboxNow.dc.html`) carries now sections, newest first within each: asks and command approvals, plan approvals, pairing approvals, requests, then messages. Every row has its waiting start (`since`, also `ts` on asks/messages/requests); the approval carries `command` when the harness reported one.

| Section | What feeds it |
| --- | --- |
| `asks` | The open asks: `{"id","topic":{"id","title","item"?},"question","options","free","from","label","ts"}`. |
| `approvals` | One pending `ApprovalRecord` per harness request, or one TUI-only record per waiting episode for adapters that report only state. Existing `id`, `session`, `label`, `harness`, `since`, `attach` and `command` fields remain. In either Neovim inbox view, `1` approves once, `2` approves always when offered, and `d` opens an optional denial note (Enter sends, Esc cancels). TUI-only rows keep Enter to attach. |
| `plans` | Open epics with a valid plan whose approval is pending under `[plan] approval = "human"`: `{"id","subject","title","since","layer":"now"}`. No row under approval `none`. |
| `pairings` (optional) | Live remote pairing codes, counted as needs-you; see [Pairing codes](gateway-authority.md#pairing-codes). Older hubs omit this section. |
| `requests` | Unsettled explicit request messages: `{"id","from","fromRole"?,"request","subject","topic","text","ts","since","layer":"now"}`. |
| `messages` | One row per now message addressed to the human, excluding progress, hub events, asks and requests. A waiting topic without an open ask contributes its latest eligible message. Each row carries `id`, sender/role, subject, topic, text, `ts`, `since` and layer. |
| `waiting` | Topic metadata for older clients about topics waiting without an open ask; it no longer contributes to needsYou separately. |

An `ApprovalRecord` adds `sessionId`, optional `role` and `topic`, `kind` (`command`, `file change`, `other`), `subject`, `choices` (`once`, `always`, `deny`), `answerIn` (`hub` or `tui`), and `state` (`pending`, `answering`, `closed`). Native record ids are `<sessionId>:<nativeRequestId>`; fallback ids identify the session and waiting episode. Codex and OpenCode native records keep their id across a reconnect. Two requests from one session are two rows, each counted once. Claude Code always uses `answerIn: tui` with no choices. Codex and OpenCode requests are also TUI-only with no choices when they fail the adapter's checks or their complete authorization subject exceeds the serialized 64 KiB UTF-8 cap; any truncated text is informational only.

`AdapterHost.approvalRequested(sessionId, request)` reports a native request and `approvalClosed(sessionId, nativeRequestId, outcome)` reports its close. The hub allowlists the subject's `command`, `cwd`, `reason`, `files` and `change`, limiting the UTF-8 JSON subject to 64 KiB; no other tool input is carried. `command` also stays at the row's top level for existing clients. A request's record travels in the snapshot's inbox and an `approval {approval: ApprovalRecord}` delta on each change, beside the coalesced `inbox` delta. Repeated request/close reports are idempotent. The in-process fake adapter exposes `raiseApproval` and `closeApproval` to drive this boundary.

A closed record carries `outcome: {choice, note?, by, via, at}`, where `choice` is one of the choices above, `answered in the harness`, or `withdrawn`; `via` is `neovim`, `web`, `telegram`, `discord` or `harness`. The closed delta folds the record to its outcome; the pending row leaves for the durable seven-day inbox archive with that outcome and attribution. State-only fallback closes report `answered in the harness`, without inferring consent. Nothing answers an approval on a timer or by default: it waits for the human, the harness's own answer, or withdrawal.

`approval.answer {id, approval, choice, note?}` is a human-only client frame, allowed through the authenticated web edge and local Neovim connection. `approval` is the complete record id; `choice` is `once` (Approve once), `always` (Always for this command), or `deny`. The note is optional, including for Deny. Notes must fit the configured human-message byte cap (8192 bytes by default), checked before reservation or native delivery so the topic fallback can carry them. Every agent session, Aides included, is refused; there is no agent tool or CLI answer command. TUI-only records refuse with `answer in Neovim`; missing records and choices the record does not offer are refused without changing it.

The gate reserves the first valid answer synchronously: its `answering` delta carries the intended `outcome` with `by: human`, `via: neovim|web|telegram|discord` and `at`. A competing or later answer is refused with `approval already answered by <by> via <via> at <at>`, including after the closed outcome has entered the durable archive. Successful delivery returns `{approval: <closed record>}` and broadcasts one closed delta to every subscriber. An adapter confirmation that identifies the same human outcome preserves that attribution; matching only the choice is insufficient.

A harness TUI can win while a hub answer is in flight. A native resolution observed before Codex's response-write receipt, or an OpenCode reply refused as not found after an attached client answered, closes the record with the harness's outcome. The losing hub answer is refused with who answered and when; its attempted choice and note do not replace the winner. OpenCode's HTTP reply receipt distinguishes its own confirmation from another client's event, including when both chose Deny.

Codex's protocol has a limitation: `serverRequest/resolved` carries the request id, without the winning decision or client. If a remote TUI answered first but its resolution reaches the adapter only after the hub's successful socket write, that event cannot be distinguished from the hub answer's echo. The record initially reads the hub's choice. If a later matching thread/turn/item reports execution after Deny, or a declined completion after Approve, the adapter corrects it to `answered in the harness` and logs `approval-execution-reconciled` at warn level. The existing archive departure is amended and a closed approval delta updates subscribed clients. Telegram queues a distinct content-keyed correction after any already-attempted outcome edit, preserving per-chat ordering and unknown-send fences. Matching successful/declined outcomes keep the human choice. Correlation is retained in the running adapter until item or turn completion; absent execution evidence (including after a hub restart), the protocol limit remains. This write receipt does not prove execution or consent by the other client; no unobserved native choice is inferred.

Pending allowlisted record metadata is retained in `hub.db`, with the session-scoped native id or Claude Code waiting-episode id and the original subject and start time. After a hub restart, Codex's pending-request replay and OpenCode's parent and pending child-owner permission snapshots reconcile those records through the same request/close paths. Claude Code's state-only record keeps its id and command while its waiting state is recovered; an unknown startup/disconnect state does not close it. A request missing from a completed native replay/snapshot closes as `answered in the harness`: the disconnected hub did not observe which choice won. An unfinished hub answer returns as pending, never as an approval. OpenCode retains each pending child permission's native owner before admitting its record, rebuilds that child tracker before snapshot reconciliation, and retires the ownership with the close. A later human answer reaches the reconnected native request. The journal's `approval-rebuilt` receipt identifies a restored request admitted after native replay and subject validation; disk-restored metadata alone does not establish that boundary. Persisted metadata does not authorize a native reply: OpenCode refuses delivery until the current command lookup has finished and still permits hub answers. A completed replay replaces the pending record's subject, choices and TUI/hub routing with the current validated fields, preserving its id and original start time. A failed or malformed lookup removes stale hub choices and directs the human to the TUI. Revalidation can refresh these fields while an attempt is answering without releasing its reservation; if that attempt fails, the pending record keeps the newly validated fields. Already closed outcomes and their attribution remain in the inbox archive across restarts.

The optional adapter method `answerApproval(process, nativeRequestId, {choice, note?})` resolves with `{noteDelivered: boolean}` only after confirming delivery, or rejects with the delivery reason. A rejection restores `pending` and clears the attempted outcome unless a native winner has already closed the record, refuses the client with the delivery reason or the recorded winner and journals `approval-answer-failed` at warn level. The hub never converts Deny to consent and never retries by itself. If the native protocol cannot carry a supplied note (`noteDelivered: false`), the hub posts it as a human message addressed to the session in its item's topic, otherwise General. Codex and OpenCode's native relays follow this gate; TUI-only records direct the human to the harness through Neovim.

The Web Inbox's reusable approval card displays the full public subject and
native offered choices. Physical `1` and `2` approve once or always; `d` opens
the optional denial note, Enter sends, and Escape cancels without answering.
Offline, answering and outcome-recovery states disable writes. A refused race
reads only that approval's archived winner, preserving newer rows. A closed card
folds to its attributed outcome until the Inbox visit ends. TUI-only cards show
`Answer in Neovim` without buttons. The drawer reads the session's latest 20
messages across topics with the existing human-only `session.history` frame.

Below 640 CSS px, tapping a relayed approval row opens that same card in the
shared phone bottom sheet. Approve once and Always for this command span the
sheet width; Deny sits on the optional note's label row, with 44 px controls.
Escape, the close button, the scrim and a swipe never answer. A hub or harness
winner closes the sheet and folds the row to its attributed outcome. TUI-only
rows mark the command `answer in Neovim`, have no answer controls and never open
a sheet, including Codex/OpenCode validation or payload-cap fallbacks.

`needsYou` is the sum of now asks, command approvals, pending plans, live pairing codes, open requests and now messages. Remote reads exclude pairing codes. `inbox.list`, pushed `inbox` events and `hub.status` agree. The workbench chip uses this count; the CLI lists pairing rows with their id and copyable approve command. Workbench pairing rows show the messenger, user and numeric identity; approval is available in Neovim or the terminal, with a local-only instruction in the web. Informational notifications appear only in the events view and never count, even when a project override raises them to `now`. A not-clear verdict and a session death appear there as warnings (D17). See [visibility classification](../visibility.md). Human pin/mute choices use `visibility.set` (`surface: topics|sessions|artifacts`, `target`, `mode: pin|mute`), persist under `visibility` in `.cland/ui.json`, and publish a `visibility` invalidation event. They apply in the shared classifier to history, snapshots, live frames and now counts; session callers cannot set them. Preference writes are async and serialized with resumed-request measurement. Hub and Neovim share a nonempty directory lock at `ui.json.lock`; recovery removes only the dead owner's unique file, so a replacement writer is preserved. Uncertain PID owners remain held. Retention never removes an open ask or its message, or a waiting inbox request/message, whatever its age; an answered, withdrawn or cancelled ask goes with its message. Deleting a topic (its asks go with it) and a prune both publish the inbox again. `hub.status` carries it as `needsYou`, so the top bar shows it without computing.

Rows leave by these rules:

- Ask: answered, withdrawn or cancelled (`answered`, `withdrawn`, `cancelled`).
- Command approval: its adapter reports a close (`answered` or `withdrawn`), or a state-only session leaves its waiting episode (`answered`, with `answered in the harness` as the outcome).
- Plan: approval in the plan view or `task plan approve` (`approved`), epic closure (`closed`), or a plan that stops being valid (`invalidated`).
- Request: a human reply to it, any later human message in its topic, or a human review/QA verdict on its subject item (`replied`); `inbox.decline` settles it as `declined` and sends its author one hub notice naming the request. An agent verdict does not settle it; reading the topic does not settle it either.
- Message: `inbox.read` for that single id or `topic.read` past its id (`read`), or a later human message in the topic (`answered`).

Each departure passes through the existing log tap as `{"event":"inbox-departure","kind","id","subject","since","ts","reason","text"}`; `text` is its first line. `hub.db` stores departures, individual read marks and topic read watermarks, so restarts keep settled rows gone, waiting requests counted and offline decline notices queued. Even a request answered before the first coalesced tick receives one `replied` departure. `inbox.list` always includes `archiveToday` (rows left since local midnight); with `archive: true` it also includes `archive`, departures in the last seven days, newest first (insertion order breaks equal timestamps). The timestamp-indexed range query reads the stored departures rather than scanning the journal; saved first lines survive message retention. Earlier departures fall back to retained message text when available. `cland hub journal --json` also exposes the leave reasons. The browser's Inbox keeps settled rows folded for its active visit, clears them and its selection when focus moves to a different area (including another pane), and reads this seven-day archive on `A`. Its selected-row drawer follows the topic message without taking row focus; `r` focuses a one-line reply carrying the original `replyTo`, so the hub resolves the sender. Successful web read/decline actions retain their receipt-backed label until the departure push supplies its reason and timestamp. Archive replies are read-only and cannot replace current inbox rows or counts. Full inbox recomputes stay coalesced; live events projection shares one snapshot per tick.

| Request | Result `value` |
| --- | --- |
| `{"type":"topic.answer","id":…,"ask":"<ask id>","option":2}` or `"text":"…"` | `{"message":TopicMessage,"outcomes":[…]}` |
| `{"type":"inbox.list","id":…}` | `Inbox`: `{"asks","approvals","plans","requests","messages","waiting","needsYou"}`. Response rows carry their classified layers before the hub compares inbox publications, so a pin/mute publishes new placement even when `needsYou` stays unchanged (T-235). |
| `{"type":"inbox.list","id":…, "archive":true}` | `Inbox` with `archive`: rows carry `kind`, `id`, `subject`, first-line `text`, wait start `since`, departure time `ts`, `reason`, and the ask or approval’s `outcome`. |
| `{"type":"inbox.decline","id":…, "request":"<message id>"}` | `Inbox`; human-only. Declines one waiting request and queues a named hub notice to its sender, including an offline sender. An unknown or already-left id is refused by name. |
| `{"type":"inbox.read","id":…, "message":"<message id>"}` | `Inbox`; human-only. Marks only that waiting message read; other messages in its topic keep their rows and unread counts. An unknown or already-left id is refused by name. |

| Command | What it does |
| --- | --- |
| `cland inbox [--json]` | Four now-layer sections, in order: asks and approvals, plan approvals, requests to you, messages to you. Nonempty headers carry counts; rows are newest first, uncapped, with id, subject/topic, first line, sender and waiting age. Approvals show state and offered choices or `answer in Neovim`; plans show their title and stage/lane/item counts. The final line is `needs you: <n>`. `--json` prints the unchanged hub frame. |
| `cland inbox --archive [--json]` | One line per departure in the last seven days: time, kind/id, subject, first line and reason, newest first. A closed approval includes its outcome, who answered, via, time and optional note. `--json` prints the full archive frame. |
| `cland topic create <title> [--item T-n] [--json] [--as <name>]` | Opens a topic through `topic.create`, optionally binding it to the item. Prints `created <topic id>: <title>`; `--json` prints `{topic: Topic}`. The shell retains its session identity and role permissions: an Implementer may open only its own item's topic. Refusals print `cland: <error>` with exit code 1. |
| `cland topic answer <ask id> <option number> [--as <name>]` | Answers an ask with its option n (1-based): prints `answered <ask id> in <topic title>: <the answer>`. |
| `cland topic answer <ask id> --text "<free answer>" [--as <name>]` | Answers an ask with a free answer (refused when the ask takes options only). The hub's refusals (an ask that is not open, an option out of range, a free answer to an options-only ask) print `cland: <error>` with exit code 1. |

Inbox asks include optional `fromRole`; command approvals include optional `role` and `command`. Pending plan rows include `title`, `stages` (number of stages), `lanes` (total lanes across stages), and `items` (total planned item entries). Requests and messages carry their sender's `fromRole` and `topic` reference (id, title and optional bound item), plus `since`, the persisted beginning of the wait. Clients use `since` for waiting ages and retain unknown metadata from older hubs as unknown. The Neovim client caps each section at five rows with an explicit fold; the CLI prints every row. `waiting` remains as topic metadata for older clients. Notifications are journal records in the [events view](the-projects-hub.md#events-view), outside the inbox. Legacy `inbox.dismiss` and `inbox.dismiss_all` requests are refused with a pointer to `events.list`.

Subscribers get `{"type":"inbox","inbox":Inbox}` whenever a response section or archive count changes (an ask, a command approval, a pending plan, a request or a message), coalesced to one per turn of the event loop and only when it differs from the last one sent. Informational idle records go to the events view. The idle threshold is `[inbox] idle_minutes` in `.cland/config.toml` (default 30; `CLAND_IDLE_NOTIFY_MS` overrides it, for tests); the clock starts at each transition to `idle`.

