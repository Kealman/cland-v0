---
id: Q-82
kind: question
title: "Where the Coordinator's time went in v0: a journal analysis"
state: closed
labels:
  - wayfinder:research
assignee: human
parent: M-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:37.318Z
updated: 2026-10-09T19:57:03.719Z
---

## Question

From the hub's journal and database of the v0 runs, where did the Coordinator's time and attention go, and which share of that load would each lever remove: a management hierarchy (reports handled one level down), batching and subscriptions (idle and death notices instead of polling and relaying), or nothing, because it is adapter-bound (Claude Code accepts hub messages only between turns)?

## Context

The human watched the Coordinator drown when many sessions ran in parallel: messages queue, every report and question lands on one session, and the crew waits. The retrospective artifact A-96 (T-73) records a vacant Coordinator for 24 minutes during hub stalls and 23 approval stalls. The data is in the main worktree's `.cland/journal.jsonl` and `.cland/hub.db` (read-only; never write there), plus `cland hub journal`.

## Deliverable

`docs/research/coordinator-load.md` on branch `research/coordinator-load`: the method; tables of messages received by the Coordinator per hour by kind (reports, questions, verdict notices, human instructions, Agents notices); queue depth and the wait between a delivery's queued and injected stages; turns that only relayed (a message in, a message out, no decision); idle gaps; the sessions that generated the most traffic; approval stalls. Then a ranked list of load sources, each with the lever it suggests and the share it would remove. The ticket "Session hierarchy: levels, reporting, routing and names" starts from it.

## Comments

### human · 2026-10-09T19:56:59.591Z

Resolution: research on branch research/coordinator-load, file docs/research/coordinator-load.md (commit 8554be4).

- **Every report landed on one session, and most of it needed nothing.** The Coordinator (`coord`, Claude Code on Fable, one session for the whole run) received 740 deliveries; the 738 that were injected came in 584 turns. 58 % were progress notes, acknowledgements and corrections, 17 % verdicts, 12 % ready reports, 7 % questions, 2 % the human's messages and 3 % hub notices. No Agents notice was delivered to it: lifecycle notices go to the Agents topic and to nobody. 90 % of deliveries came through 33 item topics; Implementers sent 59 %.
- **Most turns absorbed or relayed.** 54 % of message turns sent nothing and wrote nothing, and all but one of them made no commit; 73 % of the turns that carried only progress notes did nothing visible. 20 % passed a message on to another session, and a hand-labelled sample puts 70 % of those (about 80 turns, 44 min) as pure relays with no decision. 11 % replied to the sender, mostly with a decision. 13 % acted: tracker writes, launches, merges, asks.
- **The Coordinator was busy in bursts, not all day.** It was in a turn 40 % of the run, vacant 3 % and idle 57 %, with a median idle gap of 12 s. It spent 43 % to 78 % of each hour in turns before 12Z (briefs, hand merges, planning, the hub incidents) and 18 % to 37 % after.
- **Outside the hub incidents the queue stayed short.** 57 % of deliveries were injected within 2 s. 34 % waited for the turn in progress (median 13 s, p90 65 s). 9 % waited past a turn end; in the cases inspected, a turn Claude Code started on its own went first. The queue was empty 82 % of the run. The incident window held 63 % of all waiting (319 of 506 message-minutes) and the peak depth of 21.
- **State was polled, not subscribed.** From 10:08Z a process in the Coordinator's shell called `session.list` every 10.2 s: 2,783 calls.
- **Approval stalls hit Codex sessions only.** There were 23 episodes (33.4 min), all before 07:18:31Z. The Coordinator itself waited for the human twice (52 s in all), and its 12 asks were answered in a median 25 s.
- **Hierarchy.** If an item lead took each item's Implementer, Reviewer and QA traffic, at most 87 % of deliveries, 88 % of message turns and 68 % of message-turn minutes would leave the Coordinator. What stays: one merge notice per merged item (30), cross-cutting and permission-bound questions, the human's messages and hub notices. Delegating launch, claim and topic permissions to the lead adds one to two points.
- **Batching and subscriptions.** Folding progress notes into the next turn would stop 346 turn starts (59 %) but not their reading. Subscriptions would replace the about 80 pure-relay turns (95 % CI 63 to 94) and all 2,783 polls. Claude Code already batches what queues: 60 turns took 2 to 15 deliveries at once (observed).
- **Adapter-bound.** A hub message enters a Claude Code session only when a turn starts, after the session is idle (documented for `$.prompt.submit`, which the cland mod uses). All 187 message-minutes of waiting outside the incident window were waits for a turn boundary. That is 100 % of that waiting and 37 % of all waiting, and neither lever changes the mechanism. The other 63 % was the hub incident.

Open points for the ticket this research feeds: what started the 133 self-started turns and the 10-s `session.list` poll is unknown (the hub does not journal the `UserPromptSubmit` `source`); the hub's `busy` for a Claude Code session includes sub-agent activity, so routing on idleness needs `injected` and `idle`, not `busy`; the hierarchy shares are upper bounds (a lead's own reports, and its own between-turns waits, come on top); 12 permission-bound requests stay with the Coordinator unless a lead gets launch, claim, topic and comment permissions.

### human · 2026-10-09T19:57:03.719Z

Resolved: see the resolution comment
