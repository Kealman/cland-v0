## Identity and delivery

The Implementer holding an item's claim leads that item. Send a report to `@lead T-n` with `send {to: ["lead T-n"], text: "…"}`; human topic messages may mention `@lead T-n` in their text. The hub resolves this address from committed tracker facts immediately before recording: to the nearest node lead up the item's parent chain, then the Coordinator. When the sender leads that node, the address skips its own claims and reaches the next lead; an Implementer reports blocked with `to: ["lead T-n"]` for its own item. Stopped or dead Leads are skipped, while disconnected living Leads retain queued delivery. Explicit session names and role addresses, including `coordinator`, keep their ordinary meaning. The recorded addressee is the resolved session; a later claim change cannot move its queued report or progress note, including across a restart. Unknown items are refused with an error naming the item and telling the sender to address `coordinator` instead. A closed item has no lead left to address: its `lead T-n` address resolves to the Coordinator, so a report from the item's own topic is never refused. A human's claim does not become an agent addressee. Ordinary agent-send permissions still apply.

Default subscriptions partition the item tree by its nearest active lead: each node lead gets status, verdict and closure events for its subtree outside descendants with their own lead. The Coordinator covers the remainder. A lead's death or long idle goes one level up, so an Implementer's notice reaches its epic Lead, the epic Lead's reaches its release Lead, and the release Lead's reaches the Coordinator. Pooled verifiers' lifecycle notices follow their held items. Explicit subscriptions widen coverage. The `ready` event is an action delivery to the nearest supervising lead (the item's parent Lead, or the Coordinator); it starts one turn there, while the item lead retains its digested event. For an unclaimed ready item the nearest inherited lead receives the action.

Reviewer and QA default clauses report to `@lead T-n`. Item events and verdict events reach their lead through default subscriptions on the existing event delivery path; explicit subscriptions widen that coverage. A message with no item keeps its existing Coordinator route. While durable identity adoption has failed, a renamed claimant's provisional alias is preserved across restart, reserves its old name, and retains the task-write fence until adoption succeeds; completing adoption removes the alias.

Every name allocation follows one reservation invariant: a different identity cannot take a live session's name or a durable alias, whether through generated hello, explicit hello, rename or launch. A pending alias stays reserved until adoption succeeds, even for its owner. Generated names also avoid all retained traffic; explicit hello, rename and launch keep their existing rules for reconnects and reuse of settled historic names.

A session's identity is the session id in its hello (`CLAND_SESSION_ID`; a spoke started without one makes up a random id). A name is what others address it by.

- A generated `session-<n>` name is never one the store knows: a session's row, live or offline, or a name any stored message or delivery carries (so a name a session renamed away from stays retired while its traffic is kept). A new session therefore never inherits another session's queued messages, history or status line. History is still looked up by name: a session that explicitly claims a retired name sees that name's traffic.
- A hello with no name from a session the hub already knows gets that session's previous name back, unless another session has claimed it by name since. The spoke also remembers the name it was welcomed under and asks for it on every reconnect, so it keeps it even when the hub lost its store.
- A requested name is a claim. A live holder of another session refuses it. A status line is inherited only by the same session id.
<!-- cland-allow-closed-wording: historical explanation of the replaced-spoke defect fixed by T-51 -->
- **A session may have more than one spoke.** A hello for a session that is connected, under the session's name (or asking for none), joins it: there is still one session, every one of its spokes is answered as the session, and deliveries go to the newest. When a spoke's socket closes the session stays while another stands, and deliveries go to the newest that is left; the session is offline when the last one goes. Nothing of a hello happens again on a join: no role is resolved and no clause is sent. The journal records the join as `replaced` with the session and `spokes`, the count (the name is historical: the newest spoke replaces the older one as the target of deliveries, and nothing else), a spoke's leaving as `spoke-left` in the hub log, and Agents shows the join (`spoke-joined`). Why: Codex starts its MCP servers again for every thread on an app-server, so any further thread there (a helper's, a sub-agent's, an attached client's) brings a second spoke with the session's identity while the session's own thread goes on calling its tools through the first, and those extra spokes leave about a minute after their thread ends. Until T-51 the hub closed the older spoke with code 4002 and that spoke stopped for good: the session's every tool call then answered `this spoke was replaced`, no call reached the hub, and after the newer spoke left the session was offline while its harness ran. What this trusts: a spoke is taken for a session by the project's secret and the session id it gives, as it always was, so a second spoke carrying a connected session's id is that session by construction. Every socket of it acts as the session, an older or half-open one included; the earlier rule, that a socket lost the name to a newer one and could act no more, is gone with the eviction. A spoke that asks for another name with a connected session's id is taken for another session, as before; so a session that renamed itself and whose harness then starts a second spoke under the old name gets a second connection.
- Hygiene (rate windows, pair counts, mutes) is keyed by the session id, so a rename moves nothing.

A delivery row is `queued` until the spoke accepts it, then `delivered`, then `injected` once the session's adapter confirmed the turn (spec 4.2).

- The hub sends `{"type":"deliver","id":"<message id>","message":{…}}`. The spoke answers `{"type":"ack","id":"<message id>"}`, and only that marks the row delivered.
- On each hello the hub sends everything still queued for the session, including messages a previous socket received but never acked. A spoke may therefore see a message twice. It acks both copies and hands the message to the session once.
- A send's outcome `delivered` means the frame went out on an open socket to a live session. A socket that is closing gets `queued`.
- A message's stage, as the UI shows it, is `queued` while any of its deliveries is, then `delivered`, then `injected` once every delivery that was not dropped is; `dropped` when every one waited past the TTL.
- A delivery whose inject reached the harness and got no answer (Codex: a `turn/start` or `turn/steer` sent, its result lost or late) is `uncertain`: the turn may or may not have started. It shows as `delivered`, is logged (`inject-uncertain`) and noted in the inbox (`delivery-uncertain`), and is never sent again on its own (no idle, no reconnect replays it); the human sends it again with `session.retry` or `cland session retry <name> <message id>`.
- Uncertain operational traffic does not reserve an idle session against new work. A received review or QA request for an open item keeps its pending verification reservation until a hold or verdict replaces it, or the item closes, lands or is removed; both role routing and pool reuse respect that reservation, including across restart. Clearing it retries queued role requests immediately. An operational injection becoming uncertain also retries the queue, even if the session was already idle.
- Each delivery keeps the session id its addressee had when it was recorded (or when a role's queue was claimed), and an agent's message the session id it was sent from: a grant tied to a delivery (the mention rule) and a reply to a message follow the session, never a name another session may take later.
- A session no adapter launched (a spoke started by hand) has no native turn confirmation: its messages stay `delivered` unless it supplies an answer receipt below.

A persisted `reply_to` from the admitted recipient also confirms that exact
delivery and its held progress digest once injection has started. A recorded
review or QA verdict confirms its accepted request when recipient identity,
item, kind and admitted head match (or the verdict covers that head). Taking a
verifier hold does not discard this receipt. Other recipients and other queued
requests cannot replace it: verdict settlement selects each attempted pending
root through its persisted acceptance and admitted delivery identity in bounded
pages, independently of the latest item-level routing receipt. Other
notes remain pending; an answer never confirms a sequence range. Confirmed
requests and their progress notes leave automatic idle retry together.

Before retrying an already-attempted pending root, the hub also reconciles
persisted replies and authenticated verdicts, so an answered row restored from
an older hub needs no new answer. Reply lookup uses its indexed exact reference
and captured sender identity. Verdict lookup uses its accepted item/kind/head
and admitted recipient, with a later authenticated receipt. Ancestry candidates
are checkpointed in pages of 32 outside liveness replies; unknown ancestry holds
replay until the tracker settles it. Queued/unattempted input and missing
historical authority gain no confirmation from names or prose.

Claude mod submissions whose envelope-bearing turn receipt times out become
`uncertain` too. Submission acceptance alone cannot prove that the model received
the content. The mod remembers submitted IDs across bridge reconnects, so replay
cannot manufacture the missing turn receipt. These rows remain counted and
queryable, leave automatic pending work across hub restart, and accept a late
exact receipt or an explicit `cland session retry <name> <id>`.
Claude timeout notifications coalesce for 250 ms per session into a count with
the oldest/newest message IDs. Individual `inject-uncertain` log records retain
every ID and reason; the summary names that listing and explicit retry command.
Definite failures before submission retain normal retry/backoff. Other adapters'
uncertainty reports keep their existing individual notification behavior.


<!-- Implementation guidance moved from the implement skill. -->

In users mode ordinary queued messages can be withdrawn only by their persisted
user id's author. The authenticated connection supplies the caller id; names and
`userDisplayName` never grant ownership. Legacy null-user messages retain the
first-user display projection and carry optional `legacyUser: true`; any admin
may withdraw them. `withdrawable` describes delivery eligibility, while the web
applies the shared ownership predicate with `web.session.user.id` and `role`.
The existing `userAuthorityRefusal` role check runs before dispatch on web and
local withdrawal requests; local withdrawal uses the first user without `--as`.
Single mode and older hubs without user attribution retain the `from: human`
fence. No new role permission or keyboard binding applies.

Human message attribution uses the trusted connection user in users mode:
`messages.user_id`, optional wire `userId`, and the existing delivery `from`
attribute. Legacy null-user human rows read as the first user only while users
mode is active; single-mode writes remain `human` with no user id. Keep the
message/spoke regression in `hub/test/message-users.test.ts` and the unedited
single-mode routing and Store controls. See its per-test guide.

Ask/approval outcomes use the authenticated user's name in by and optional userId; capture identity before asynchronous approval delivery. Carry that same user id through the ask's sendFromHuman port and core callback to the posted answer message. Keep previous-wire outcomes and single-mode stand-ins. See `docs/agents/tests/hub-test-answer-users.test.ts.md`.

Withdrawal eligibility reads the optional authoritative `withdrawable` fact; preserve aggregate stages and queued-only fallback for older hubs. Test one injected broadcast recipient with another still queued through hub frames and Web. If a newer send is pending when older text returns, hold its actual success/refusal and uncertain reload to prove older/pending/newer draft order without losing the restored text.

## Held-delivery supervision

## Deaf delivery supervision (T-1472)
