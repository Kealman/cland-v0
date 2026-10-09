---
id: T-68
kind: task
title: "Codex redelivery (T-50) fires on every delivery to an idle session: the thread check reads userMessage items only, and hub_event tool outputs never match"
state: open
labels:
  - ready-for-agent
  - hub
  - high
assignee: impl-68
parent: T-19
blocked_by: []
topic: topic-19
branch: t/T-68-codex-redelivery-idle-shape
created: 2026-10-09T10:21:50.136Z
updated: 2026-10-09T10:27:23.159Z
---

## Parent

Part of T-19; a regression from T-50 (merged 7162ee4, live since the hub restart at 10:18Z on 2026-10-09, pid 33252).

## What happened

Since the restart every message delivered to an idle Codex session is redelivered twice and then reported as lost: the journal has `harness-redelivered` three times and `harness-redelivery-failed` once per (message, session) for every message id since 10:18:16Z (ten ids, 27 events for one broadcast to nine sessions), each failure with an Agents notice "the message was still missing after two redeliveries". The sessions did get the message: each redelivery is a `turn/start`, so an idle Codex session runs the same input three times (three turns, three times the tokens) and the Coordinator's Agents topic fills with false alarms.

Cause, in hub/src/adapters/codex.ts: `#redeliver` reads the completed turn with `thread/read` and deletes an owed id only when a `userMessage` item's text carries the envelope id. A delivery into an idle session is sent as `turn/start` with `input: []` and `toolOutput: { name: 'hub_event', namespace: 'cland', output: text }` (the same shape `#redeliver` itself uses when idle), which Codex 0.160 records as a tool output item, not a `userMessage`, so the id is never found and `owed` keeps it. T-50's measurement ("an accepted steer was always taken up") covered steers into an active turn (text input), not idle deliveries; the fake app-server records both shapes alike, so the suite did not see it.

## What to build

- The thread check recognises the shape the delivery was sent in: for an idle delivery, the `hub_event` tool-output item (or whatever item type Codex 0.160 writes for `toolOutput`, measured with the real app-server and recorded on the item); for a steer, the `userMessage` text. Better: the obligation remembers how it was admitted and checks that shape.
- A redelivery never fires for a message whose turn the session visibly acted on; when the check cannot classify an item it reports `harness-turn-unread` once and does not redeliver (a message delivered once and unverified is the lesser harm than three turns and a false alarm; adjust T-50's README text accordingly).
- Tests against the fake app-server where the fake records idle deliveries as tool-output items (as the real one does) and steers as `userMessage`: an idle delivery is never redelivered; a steer missing from its turn still is, twice at most, as T-50 specified. One run against the real Codex 0.160 recorded on the item: a message to an idle session produces exactly one turn and no `harness-redelivered`.

## Acceptance criteria

- [ ] A delivery to an idle Codex session produces one turn, no `harness-redelivered` and no failure notice (fake app-server test with the real item shape; real Codex run recorded on the item)
- [ ] T-50's steer regression still passes (a steer not taken up is redelivered, at most twice)
- [ ] `npm run typecheck && npm test` pass; `hub/README.md`'s redelivery paragraph says which items the check reads

## Notes

Size S. Implementer: Claude Code (the Codex sessions are the ones affected; their own deliveries triple until this lands). Test seam: the fake app-server (hub/test/codex-adapter.test.ts, T-50's cases) and one real-Codex scratch run as T-51's did. The hub restart that carries it also carries T-67.

## Comments

### impl-68 · 2026-10-09T10:23:51.134Z

Measured against the real Codex 0.160.0 app-server (scratch dir, `codex app-server --listen unix://…`, thread/start, a text turn, then `turn/start` with `input: []` and `toolOutput: { name: 'hub_event', namespace: 'cland', output: <envelope> }`). The idle delivery is recorded as a `functionCallOutput` item, both in the `item/completed` notification and in `thread/read`, never as a `userMessage`:

```json
{
  "type": "functionCallOutput",
  "id": "fco_01a12030-9e12-7993-a0a1-03e532b5d85b",
  "name": "hub_event",
  "namespace": "cland",
  "output": "<channel source=\"cland\" msg_id=\"11111111-2222-3333-4444-555555555555\">Probe for T-68: reply with the single word ok.</channel>"
}
```

The rest of that turn is `reasoning`, then `agentMessage` ("ok"). A steer, or a text `turn/start`, stays a `userMessage` with `content: [{ type: 'text', text, text_elements: [] }]`. So both `#attach`'s item handler and `#redeliver`'s thread check missed every idle delivery.

### impl-68 · 2026-10-09T10:27:23.159Z

Stage 1 (hotfix) c55dfd2: `inputText(item)` in hub/src/adapters/codex.ts reads a `userMessage`'s text content or a `functionCallOutput` named `hub_event`'s output. Both the `item/started|completed` handler (`#takenUp`) and `#redeliver`'s `thread/read` check use it. The fake app-server records a `toolOutput` as `functionCallOutput` and text as `userMessage`. New test "a delivery to an idle Codex session runs one turn and is never redelivered": red before the fix (6 `turn/start toolOutput` for 2 deliveries), green after. Typecheck clean; codex-adapter.test.ts 23/23 pass. Next, stage 2: the obligation remembers its admitted shape, an unclassifiable turn logs `harness-turn-unread` once and does not redeliver, README, full suite.
