---
id: T-108
kind: epic
title: "Epic: A quiet Coordinator"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-107
topic: topic-137
branch: null
created: 2026-10-09T21:51:33.253Z
updated: 2026-10-11T15:30:16.745Z
---

## Goal

Progress notes stop starting the Coordinator's turns, and the session that claims an item leads it: the item's verdicts and reports go to that session, which runs its own review loop until the hub marks the item ready. Sessions subscribe to events about sessions, items, topics, usage and artifacts and receive them as hub deliveries digested at their next turn, instead of polling or waiting for a relay. In the v0 run, 740 deliveries landed on one Coordinator, 58% of them progress notes and acknowledgements, and about 80 of its turns were pure relays (T-82).

## Contents

- **§3.9 Event subscriptions**, whole: `subscribe`, `unsubscribe` and `subscriptions` over sessions, items, topics, roles and subtrees; the `session.state`, `task`, `topic`, `usage` and `artifact` events delivered as one-line hub messages, digested at the next turn by default or steered `now`; `send` kinds, with `progress` notes that never start a turn; the leads' default subscriptions; the hygiene rules; and `cland hub subscriptions` for the human.
- **§3.7 The hierarchy of sessions, the item lead**: the Implementer that claims an item leads it; events, reports and verdicts about the item go to it, then to the Coordinator, then to the human; `@lead T-n` resolves to the claimant or the Coordinator; the item's lead requests its own review and QA and reports when it is blocked; idle and death notices reach the lead. This takes the "Regardless of hierarchy" bullet of §3.7 whole.

Not in this epic:

- Lead sessions for epics and releases, the `Lead` role, permissions by level, asks forwarded up the chain, the handover of a node, and `crew.toml`: "Leads and the crew", which extends this epic's routing and default subscriptions to Lead sessions.
- How the thread shows a message's kind: "Threads that read".
- The Aide's place in routing (by name only, no broadcasts): "The human's own session".
- The event sources later epics add: "criterion marked" comes with "Criteria that live".

Choices where the spec is silent:

- A `send` without a kind is a `report`, so it starts a turn as today.
- Reports about an item are addressed to `@lead T-n`; the role clauses say so, and the hub resolves the address when it records the message.
- The hub's `ready` status event stands for the item lead's ready report, so the Coordinator receives one delivery; the lead reports blocked itself.
- When an item's lead itself dies or stays idle, the notice goes to the next lead up the chain.
- A `usage` subscription names its own threshold (a cost or a token count); the events' limit is a key of its own in `[hygiene]`.
- The QA brief stays the Coordinator's: it writes it with the `qa` skill when it hands out an item that needs QA, and the item's lead names it in its request.

## Tracer-bullet order

1. **Progress notes ride the next turn.** `send` gains `kind`; the hub holds a session's `progress` deliveries and injects them as one digest with its next turn-starting delivery, on all three adapters, and keeps them across a hub restart; the clauses mark progress notes. Demo: an Implementer's three progress notes reach the Coordinator together with its report, and none of them started a turn.
2. **Subscriptions to sessions and items.** `subscribe`, `unsubscribe` and `subscriptions` with the `session.state` and `task` events, delivered as one-line hub deliveries digested at the next turn. Demo: the Coordinator subscribes to an Implementer instead of polling `who`; the Implementer's death arrives at its next turn as one line.
3. **The other events and the hygiene.** The `topic`, `usage` and `artifact` events, subtree subjects, `digest = "now"` by steering where the adapter can and the turn elsewhere, coalescing, the digest cap, the lifetimes, the events' own limit, `cland hub subscriptions` and the journal. Demo: a burst of equal events arrives as one line with a count, and `cland hub subscriptions` lists what each session holds.
4. **The item's lead.** The claimant leads its item; events and reports about the item route to it; `@lead T-n` resolves to it, else to the Coordinator; the Reviewer and QA clauses report to `@lead T-n`. Demo: a Reviewer's "review not clear T-n" reaches the Implementer, not the Coordinator.
5. **Default subscriptions of leads.** The Coordinator holds the tree less the claimed items; an item's lead holds its item; death and long idle reach the node's lead, or the next lead up when the lead itself is gone. Demo: a Reviewer stopped mid-review is reported to the item's lead; a killed Implementer is reported to the Coordinator.
6. **The item runs its own loop.** The Implementer clause requests review and QA itself and reports blocked; the Coordinator clause merges on the `ready` event and stops relaying; the `merge`, `qa` and `code-review` skills follow. Demo: a real v0.1 ticket goes from claim to ready with one delivery about it at the Coordinator, then one merge.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The Coordinator launches an Implementer for a real v0.1 ticket. The Implementer marks its progress notes, which start none of the Coordinator's turns; it sends `review request T-n` to the Reviewer itself; the not-clear verdict and the re-review pass between those two sessions; when the gate's verdicts are clear the hub sets `ready`, the Coordinator receives that one event, and it merges. On another ticket the human stops the Reviewer mid-review: the item's lead hears of it at its next turn, not only through the Agents log. The analysis script of T-82 (`docs/research/coordinator-load/analyse.py` on `research/coordinator-load`), run on the journal, counts the Coordinator's deliveries for the item and the turns progress notes started.

- [ ] A `progress` message starts no turn on Claude Code, Codex or OpenCode, arrives with the next turn in one digest, and survives a hub restart.
- [ ] `subscribe`, `unsubscribe` and `subscriptions` cover every subject and event §3.9 lists; an event arrives as a one-line delivery from `hub` through the usual stages.
- [ ] `digest = "turn"` is the default; `digest = "now"` steers where the harness can and falls back to the turn elsewhere.
- [ ] Equal events coalesce within 60 seconds; a digest holds at most 10 events and summarises the rest; subscriptions end with their subscriber; a subject's death sends a final event; events never count against the messages limit.
- [ ] The claimant leads its item: events, reports and verdicts about it reach it, and `@lead T-n` resolves to it, else to the Coordinator.
- [ ] Leads hold their default subscriptions; a death or a long idle reaches the node's lead, or the next lead up when the lead itself is gone.
- [ ] The inbox shows nothing of subscriptions; `cland hub subscriptions` lists them; the journal records event deliveries.
- [ ] One v0.1 ticket reaches `ready` with one delivery about it at the Coordinator after its launch, measured from the journal.
- [ ] The role clauses, the `merge`, `qa` and `code-review` skills, `hub/README.md` and `docs/review-and-qa.md` describe the kinds, subscriptions and item leads.

## Dogfooding

From this epic on, every Implementer of the build leads its item: it requests its own reviews and QA, the Coordinator merges on `ready` events, and progress notes go out as `progress`. The Coordinator subscribes to the sessions and items it watches instead of polling `who` or waiting for relays. "The human's own session" waits for this routing, and "Leads and the crew" extends it to Lead sessions.

## Constraints

- **ADRs.** 0007 (Events reach sessions as deliveries, digested at turn boundaries): one queue, no second channel into a session, digested by default. 0006 (The hierarchy is the item tree; leads are hub-held claims on nodes): routing by the item chain and a lead's default subscription. 0001 (Roles are hub-held state delivered as events): the new clauses reach sessions as events. 0003 (The hub is a per-project daemon extracted from the BCAS driver hub): store-and-forward, the delivery stages and hygiene stay the BCAS core's.
- **Research.** `research/coordinator-load` (`docs/research/coordinator-load.md`, T-82: where the deliveries went, with the script to measure the demo); `research/harness-surfaces` (`docs/research/harness-surfaces.md`: what each harness accepts between turns and where steering exists); `research/harness-teams` (`docs/research/harness-teams.md`, T-83); `research/bcas-hub` (`docs/research/bcas-hub.md`: the queue and hygiene).
- **Risk** from the sizing: the turn digest on Claude Code, which takes input only between turns; held notes must ride the next turn without starting one and must not be lost on a restart. Routing and delivery changes ran at v0's slowest pace (about 110 minutes and 2.75 not-clear reviews per ticket).
- **Mockup.** `docs/design/main-screen/Thread.dc.html` shows the kind on a message's header ("Coordinator · report"); the rendering belongs to "Threads that read".
- **The v0 tail.** T-106 (spoke tools are callable before the hub's welcome) touches the spoke's delivery path. It is not a prerequisite: the Coordinator takes it first only if it blocks this work; otherwise it carries `tech-debt`.
- **Order.** Second in the hub lane, after "v0.1 release and status", whose `review`, `qa` and `ready` it routes; "The human's own session" and "Leads and the crew" wait for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the fake harnesses prove the digest and the steering on each adapter.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.9 Event subscriptions; §3.7 The hierarchy of sessions (Routing, the item lead, Regardless of hierarchy); §3.2 for the statuses it routes.
- Map T-81: decisions T-91 and T-89; research T-82 and T-83.
- GLOSSARY: Event, Subscription, Lead, Coordinator, Implementer, Claim, Verdict.
- ADRs: `docs/adr/0007-events-reach-sessions-as-deliveries.md`, `docs/adr/0006-the-hierarchy-is-the-item-tree.md`, `docs/adr/0001-roles-are-hub-held-state.md`, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- Branches: `research/coordinator-load`, `research/harness-surfaces`, `research/harness-teams`, `research/bcas-hub`.
- Mockup: `docs/design/main-screen/Thread.dc.html`.
