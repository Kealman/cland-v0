---
id: E-423
kind: epic
title: Rules and rhythm
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: topic-345
branch: null
created: 2026-10-14T16:43:04.090Z
updated: 2026-10-16T10:27:49.908Z
closed: 2026-10-16T10:27:49.908Z
---

## Summary

The project's rules move out of one session's memory into a rulebook kept with the project, fed into every role's clause and brief, and delivered to running sessions when a rule changes. The Coordinator gets a heartbeat that wakes it with a digest of what looks stale, and a lane's next epic starts on the previous epic's last merge while that epic's demo runs on a droplet, so the crew never waits on a frozen `dev`.

## Goal

Every session of every harness reads the same project rules, a broken chain of events is noticed within the hour, and the crew never idles between epics. Today the rules the human stated during the work (which model for which role, one suite at a time, how briefs address roles, when to merge) live in the Coordinator's harness memory: another harness cannot read them, and nobody can see them whole (Q-378). The human kept an hourly check running outside the hub so that a review nobody requested or an ask nobody answered got noticed (Q-380). During v0.1.2 the crew went fully idle twice, from 13:50 to 14:22Z on 2026-10-13 and in shorter gaps before, because each lane waited for an integrated run, a hub restart and an epic demo before the next epic was cut, and twice the stand-in unlinked a lane-order edge by hand (T-335).

## Contents

- **§3.2 The rulebook.**
  - **The file.** `.cland/RULES.md` in the project: one rule per heading with an id a plain number, a scope (all roles or named roles), the date, the reason and a status (active, retired). AGENTS.md stays the hand-written static instructions, and the harness memories become caches of what the rulebook holds.
  - **How a rule is added.** `cland rule add` from the shell or the workbench, and a `rule.add` tool for sessions: the Coordinator records a rule when the human states one in a thread, instead of writing it into its private memory. A rule is edited and retired the same way.
  - **How it reaches sessions.** The hub puts the rules of a role into its clause at launch and into the brief, and delivers a new or changed rule to running sessions as a delivery (ADR 0007). The workbench shows the rulebook with each rule's origin.
  - **The seed.** One Aide task migrates the rules this project accumulated in the planning session's and the stand-in's memories: briefs address the role; no long foreground commands; one suite at a time; verdicts go to the lead; no routing around refusals; the batch-merge rule; verify the head before merging; check the verify queue before committing on `dev`.
- **§3.3 The heartbeat.**
  - **Interval per role** in `crew.toml`: `heartbeat = "1h"` for the Coordinator by default, off for the other roles unless set.
  - **The delivery** carries a digest the hub computes: what is in flight and what looks stale (items in review with no verdict requested, ready items not merged, sessions idle longer than `idle_minutes`, runs that never reported, asks nobody answered).
  - **When it fires.** A heartbeat starts a turn only when the session is idle; otherwise it folds into the next turn's digest (v0.1 §3.9 hygiene). It is never a needs-you, it shows in the events view, and the timer is an event kind under ADR 0007.
  - **The clause** of the Coordinator says what to check on a heartbeat, what to repair and when to escalate to the human.
- **§3.4 Lane flow.**
  - **The next epic starts on the last merge.** A lane's next epic may be cut (`to-tickets`, `plan-epic`) and its first stage launched as soon as the previous epic's last ticket merges. The previous epic's QA demo runs in parallel and still closes the epic and gates the release (D16). Merges of the next epic's tickets that touch the same surfaces wait for the demo's verdict, so that the verdict sits on the `dev` tip. The next epic's to-tickets and plan-epic are prepared while the previous epic's last stage is in review.
  - **`follows`, not `blocked_by`.** Lane order is a relation of its own, `follows`, so that nobody unlinks blocking edges by hand; `blocked_by` keeps meaning a real dependency.
  - **Demos off `dev`.** Epic demos run on a droplet (v0.1.2 §3.14), so that `dev` need not freeze for them.

Not in this epic: the rulebook and the heartbeat in the web workbench (v0.2); rules shared across projects (the rulebook is the project's own); any change to D16, under which a QA demo still closes an epic and gates the release.

Choices where the spec is silent:

- **The file's shape.** Each rule is a heading `## <n> <short title>`, then one line per field (`Scope: all` or `Scope: coordinator, implementer`; `Date:`; `Status: active` or `Status: retired <date>`; `Origin:`; `Reason:`), then the rule's text as a paragraph. Numbers count up in the file and are never reused, and a retired rule stays in it. The hub writes the file and re-reads it when it changes, as it does `roles.toml`, so a hand edit or a merge that changes it is read and delivered too; a file that does not parse is logged and the last good version stays in force. `cland init` writes an empty rulebook with a one-line header.
- **Rule ids beside item ids.** `R-` is also the release prefix, and any prefix with a number resolves an item (v0.1.2 §3.1). Outside the rulebook a rule is always written `rule <n>`: clauses, briefs, deliveries and the events view use that form, and the workbench resolves `rule <n>` to the rulebook while a bare `<n>` stays an item reference. Rule numbers are the rulebook's own, not the item counter's.
- **The commands and tools.** `cland rule add <text> --scope <roles>|all --reason <text>`, `cland rule edit <id> [--text t] [--scope s] [--reason r]`, `cland rule retire <id> --reason <text>`, `cland rule list [--all] [--role r]` and `cland rule show <id>`, each with `--json`. The session tools `rule.add`, `rule.edit` and `rule.retire` take the same fields plus an origin, and every role may read with `rule.list`.
- **Who records a rule.** The write tools belong to the Coordinator and the Aide. A Coordinator's write names as its origin the human's message that stated the rule (its topic and message id), and the hub refuses one whose origin is not a message by the human, so the Coordinator never invents a rule. An Aide speaks for the human, so its rule names the Aide as its origin. Other roles propose a rule to the Coordinator in their item topic. The shell and the workbench record `shell` or `workbench` as the origin, and the seed records the memory file.
- **What the clause carries.** After the clause text, a section "Project rules for your role" lists each active rule in scope as `rule <n>: <text> (reason: <reason>)`, in id order; a role with none says so. The brief at launch ends with the same list, so a session reads the rules before its first action. Retired rules appear in neither.
- **How a change arrives.** A new, edited or retired rule is an event of the new kind `rule`. The hub delivers it to every running session whose role is in its scope, with no subscription needed, at the session's next turn (`digest: turn`), carrying the rule's full new text or its retirement. A session that missed it still gets the current rules in the clause the hub re-sends at a reconnect. It is never a needs-you, and the events view shows it.
- **The rulebook view.** `␣R`, free today, and the palette action "Rulebook" open the rulebook in the centre: one row per rule with its id, scope, status and date, active rules first and retired ones dimmed. Enter unfolds the text, the reason and the origin, and `gt` on an origin in a thread opens the topic at that message. `a` writes a new rule in a compose buffer (text, scope, reason) and records it on write, `e` edits the rule under the cursor, and `X` retires it with a reason.
- **Memories as caches.** The Coordinator's and the Aide's clauses say to record a rule with `rule.add` and never only in a harness memory; a memory that repeats a rule names its id.
- **The seed task.** One task under this epic, done by an Aide the Coordinator launches for it (crew.toml's `aide` policy is per item); the task names the memory folders to read. The Aide records each of the eight rules of §3.2 with `cland rule add`, with its scope, its reason and the memory file as its origin, adds to each migrated memory a line naming its rule id, and posts the list on the item. It records nothing beyond the eight: another rule found in the memories is listed on the item for the human.
- **The heartbeat setting.** `heartbeat` in `[crew.<role>]` takes a duration of at least one minute, or `"off"`. A Coordinator without the key gets `"1h"`, and any other role without it has none. `cland init` writes `heartbeat = "1h"` for the Coordinator, `cland crew show` lists it, `cland crew set coordinator.heartbeat 30m` sets it, and the next firing uses the new interval. Tests shorten it with an environment variable, as `CLAND_IDLE_NOTIFY_MS` shortens the idle threshold.
- **The clock.** Each session whose role has a heartbeat has its own schedule, counted from its launch. The next firing time is kept in `hub.db`, so a hub restart keeps the schedule, and a firing that fell due while the hub was down fires once after its start.
- **The digest.** The hub computes it at the firing, in two parts. In flight: the claimed items by status with their sessions, the running and queued runs, the open asks and the live leases. Stale, each row with its age: an item in `review` with no pending review request and no verdict at its head; an item `ready` and not merged; a session idle longer than `[inbox] idle_minutes`; a run past its timeout, or ended with no posted result; an ask open longer than the interval. An item or an ask counts as stale only after one full interval in that state. Each part lists at most ten rows and summarises the rest ("and 12 more"), as a digest does (v0.1 §3.9).
- **Delivery and coalescing.** A heartbeat is an event of the new kind `heartbeat` addressed to its session, not a subscription. On an idle session it starts a turn. On a busy session, or one waiting for approval, it waits as one entry of the next turn's digest, and a newer heartbeat replaces an undelivered older one. It never steers a running turn and is never a needs-you. The events view shows one row per firing, at the background layer, with the session and the counts; its kind filter takes `9` for `heartbeat`, and `rule`, the tenth kind, is filtered from the palette, which lists every kind.
- **The Coordinator on a heartbeat.** Its clause says: read the digest; repair what the Coordinator owns (request the missing review, merge a ready item through the gate, ask an idle session for its state, request a run that never reported again); escalate to the human with an ask only for a decision, a spend past a cap, or a stale row that survives two heartbeats after its repair; end a heartbeat with nothing stale without a message.
- **The relation.** `follows` is a list of epic ids in the item's frontmatter, beside `blocked_by`. `task create --follows <id>`, `task link <id> --follows <id>` and `--unfollow <id>`, and the same fields of the `task.link` tool set and remove it; any prefix resolves, and the hub refuses a cycle and an edge between items other than epics. `task view`, the card and the explorer show it beside the blockers.
- **When a follow is met.** A follow is met when its predecessor is closed, or when the predecessor has task children and all of them are closed, its last ticket merged. `task view` shows "follows E-<n>: met" or the tickets still open. Only `blocked_by` makes an item blocked in `task list` and the panels. The Coordinator's clause starts an epic when its blockers are closed and its follows are met.
- **The merge hold.** While a predecessor epic is open with its follow met and its demo pending, the merge gate holds a ticket of an epic that follows it when the ticket's diff touches a file that the predecessor's merges changed, read from the `Item:` trailers on `dev`. The refusal names the predecessor, its pending demo and the files, and the `merge` skill waits it out. A ticket with no overlap merges at once. The hold lifts when the predecessor's QA verdict is recorded, whatever its result.
- **Preparing the next epic.** The Coordinator's clause and the `to-tickets` and `plan-epic` skills say: when every ticket of an epic's last stage is in review, cut the following epic's tickets and write its plan, so that its first stage launches on the last merge.
- **The demo lease.** `cland demo start <epic> [--commit <sha>]` asks the hub for a droplet for the epic's demo: the hub acquires it under a lease within `remote_budget` and the daily cap, delivers the commit (the `dev` tip by default), and prepares it as for a suite run, Neovim included. `cland demo exec <epic> -- <command>` runs one command there as the ordinary user, in the delivered tree, and returns its output and exit code; a headless workbench (`cland --headless --qa`) runs the same way. `cland demo stop <epic>` releases the droplet, and the lease also ends at the epic's verdict or at its lifetime. The create, the destroy and the cost post on the epic. The `qa` skill's recorder runs each case through it, and cases that need macOS run locally at the same commit. When no remote slot or budget is left, `demo start` says so and QA runs the demo locally, with the hold still in force.
- **Fresh demo verdicts.** A demo's verdict names its commit. The hub accepts an epic verdict whose commit is on `dev` when the commits after it touch none of the epic's surfaces, and the `qa` skill's re-check of `dev` after the cases reads the same rule instead of reporting BLOCKED on any move.
- **The plan.** The rulebook, the heartbeat and the lane flow touch different code, so the plan may run them as parallel lanes; the seed waits for rules to reach sessions, and the demo lease waits for `follows`.

## Tracer-bullet order

1. **The heartbeat.** The `heartbeat` setting, the schedule in `hub.db`, the digest, the turn only on an idle session, the `heartbeat` event kind and its row in the events view, and the Coordinator's clause. Demo: in a scratch project with a fake Coordinator at `heartbeat = "1m"`, a planted review item with no request and an unanswered ask appear in the next heartbeat's digest, which starts a turn on the idle session; on a busy session the heartbeat folds into the next turn's digest, and the inbox count stays the same.
2. **`follows` and the merge hold.** The relation in the item file, the CLI and the tools; the follow met on the last merge; the hold at the gate; and the clause and skills that prepare the next epic during review. Demo: in a scratch project E2 follows E1; when E1's last ticket merges, `task view E2` shows the follow met; a ticket of E2 that touches a file E1 changed is held with a refusal naming E1's pending demo, another merges at once, and the held one merges after E1's verdict.
3. **The rulebook and `cland rule`.** The file, its parser and writer, the ids and origins, the commands, and the reload on change. Demo: `cland rule add` with a scope and a reason writes `## R-1` with its fields to `.cland/RULES.md`, `cland rule edit` and `cland rule retire` change it, and `cland rule list --all --json` reads both states.
4. **Rules reach sessions.** The rules in the clause and the brief, the `rule.*` tools with their origin rule, and the `rule` event to running sessions in scope. Demo: with a fake Coordinator and a fake Implementer, a rule scoped to `implementer` and recorded from the human's message reaches the Implementer at its next turn and in its clause after a reconnect, and not the Coordinator; a Coordinator's `rule.add` with no human origin is refused.
5. **The seed.** The Aide task records the eight rules with their origins and marks the memories. Demo: `cland rule list` on the live project shows the eight rules with their memory files as origins, and the Coordinator's next clause lists the ones in its scope.
6. **The rulebook in the workbench.** `␣R`, the rows, the origins, and adding, editing and retiring from the view. Demo: the headless workbench opens the rulebook with `␣R`, adds a rule with `a`, reads it in the list, and `gt` on a thread origin opens the topic at the human's message.
7. **Demos on a droplet.** `cland demo start`, `exec` and `stop`, the lease, the verdict's commit and the freshness rule, and the `qa` skill. Demo: QA starts a demo lease at the `dev` tip, runs a CLI case and a headless workbench case through `cland demo exec` while an unrelated commit lands on `dev`, and records a verdict the hub accepts; afterwards the droplet is gone and its cost is on the epic.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), on a droplet through the demo lease this epic adds, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake harnesses, QA launches a fake Claude Code Coordinator and a fake Codex Implementer. A rule added from the shell with the scope `implementer` reaches the Implementer at its next turn and appears in its clause after a reconnect, and not in the Coordinator's; an edit and a retirement reach it the same way. The Coordinator's `rule.add` from the human's message records a rule with that origin, while one with no human origin and an Implementer's are refused. In the headless workbench QA opens the rulebook with `␣R`, reads each rule's scope, status and date, unfolds one to its reason and origin, follows a thread origin to the human's message, and adds a rule from the view. With `cland crew set coordinator.heartbeat 1m`, QA plants a review item with no request, a ready item, a session idle past `idle_minutes`, a run that never reported and an unanswered ask, and reads each in the next heartbeat's digest; with the Coordinator busy, the heartbeat folds into its next turn's digest; the inbox count does not change, and the events view shows the heartbeat rows under their kind. QA links two scratch epics with `--follows`, merges the first one's last ticket and reads the follow met; a ticket of the second that touches a file the first changed is held with a refusal naming the pending demo, another merges, and the held one merges after the first epic's verdict. The demo runs at a named `dev` commit, and a commit that lands on `dev` meanwhile on other files does not block the verdict. On the live project, `cland rule list` shows the eight seeded rules with their origins.

- [ ] C1. `.cland/RULES.md` holds one rule per heading with an id a plain number, a scope, the date, the reason, a status and an origin; `cland rule add`, `edit`, `retire`, `list` and `show` read and write it, and the `rule.add`, `rule.edit` and `rule.retire` tools do the same for the Coordinator, from a human message only, and for the Aide.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.030Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C2. Every role's clause carries the active rules in its scope, and the brief at launch lists them; a retired rule appears in neither.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.030Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C3. A new, edited or retired rule reaches each running session in its scope at its next turn as an event of kind `rule`, never a needs-you, and the clause re-sent at a reconnect carries the current rules.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.030Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C4. The workbench's rulebook view lists the rules with their scope, status and date, shows each rule's reason and origin, opens a thread origin at its message, and adds, edits and retires a rule.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.031Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C5. The eight seed rules of §3.2 are in the rulebook with their origins, and the planning session's and the stand-in's memories name the rule each became.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.031Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C6. `heartbeat` per role in `crew.toml` (the Coordinator `1h` by default, the other roles off) delivers a digest the hub computes of what is in flight and what looks stale; it starts a turn only on an idle session, folds into the next turn's digest otherwise, is never a needs-you, shows in the events view under the kind `heartbeat`, and the Coordinator's clause says what to check, repair and escalate.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.031Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C7. `follows` is a relation of its own beside `blocked_by` in the item file, the CLI, the tools and the workbench; a following epic may start once its predecessor's last ticket merged; the merge gate holds its tickets that touch the predecessor's surfaces until the predecessor's QA verdict; and the clause and the `to-tickets` and `plan-epic` skills prepare the next epic while the last stage is in review.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.031Z · commit f6045f838f55902c0224473512e82c1ff0121e72
- [ ] C8. An epic demo runs on a droplet at a named `dev` commit while `dev` moves, its verdict is accepted when the later commits touch none of the epic's surfaces, and `hub/README.md`, `nvim/README.md`, the role clauses and the `qa`, `merge`, `to-tickets` and `plan-epic` skills describe the rulebook, the heartbeat, `follows` and demos on a droplet.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-20 · 2026-10-16T10:27:34.031Z · commit f6045f838f55902c0224473512e82c1ff0121e72

## Dogfooding

The build uses each part as soon as it merges. When the heartbeat slice merges and the hub restarts, the Coordinator runs with `heartbeat = "1h"`, and the hourly checks kept outside the hub stop. When `follows` merges, the Coordinator turns the two lane edges into follows ("OpenCode v2 hygiene" follows this epic, and "Hub hygiene" follows E-387), unlinking the `blocked_by` edges with `task link --unblock`, so that each lane's next epic starts on the last merge; the release epic keeps its blocking edges. The seed is recorded as soon as rules reach sessions; from then on every clause carries the rules, and the Coordinator records a rule the human states in a thread with `rule.add` instead of its memory. This epic's own demo, and every demo after it, runs on a droplet through the demo lease.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The `opencode` CLI never runs inside a session until T-296 lands. The DigitalOcean token is never stored.
- **ADRs.** 0001 (Roles are hub-held state): the rules ride the clause the hub delivers. 0002 (Tracker files are the source of truth): the rulebook is a committed file of the project that the hub reads as it reads `roles.toml`, and `follows` lives in the item's frontmatter. 0007 (Events reach sessions as deliveries): a rule change and a heartbeat are events digested at turn boundaries, and neither steers a running turn.
- **Tests.** The heartbeat is driven through a short interval in tests. The demo lease is tested against E-271's fake DigitalOcean API and fake machine (`hub/test/fakes/digitalocean/`); a real droplet is QA's check, never part of `npm test`.
- **Risks.**
  - A heartbeat that wakes a busy crew is noise, which is why it never steers and folds into the next digest.
  - A long rulebook lengthens every clause, which is why a clause carries only the rules in its scope.
  - The hold could stall the next epic; it applies only to files the predecessor changed and lifts on the predecessor's verdict.
  - The demo lease shares `remote_budget` and the $3 daily cap with verification and E-387's sharded close runs, so a busy day sends a demo to the local machine.
  - Rule ids share the release prefix; the `rule <n>` form keeps them apart.
- **Size.** About eight sessions on the v0 scale.
- **Order.** First in the rules lane, with no blocker. "OpenCode v2 hygiene" follows it, and "Release v0.1.3 from the item" waits for the ends of both lanes.

## Links

- Spec: `docs/spec/v0.1.3.md` on `dev`, §3.2, §3.3, §3.4 and §4; `docs/spec/v0.1.md` §3.3 (the Aide and the brief at launch), §3.9 (event subscriptions and their hygiene) and §4 (D16); `docs/spec/v0.1.2.md` §3.7 (the events view) and §3.14 (the remote executor).
- Tickets: T-335, a child of this epic; Q-378 and Q-380, decided and closed into this epic; E-271 (Remote executors) and T-347 (the remote budget), which the demo lease builds on.
- ADRs: `docs/adr/0001-roles-are-hub-held-state.md`, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0007-events-reach-sessions-as-deliveries.md`.
- Code: `hub/src/roles/clause.ts` (`clauseText`, `staffingClause`), `hub/src/crew.ts`, `hub/src/hub/inbox.ts` (`idleNotifyMs`), `hub/src/protocol.ts` (`EVENT_KINDS`), `nvim/lua/cland/event_kinds.lua`, `hub/src/tracker/tracker.ts`, `hub/src/merge.ts`, `hub/src/executor/`.
- Skills: `qa`, `merge`, `to-tickets`, `plan-epic`.
- GLOSSARY: Rulebook, Rule, Heartbeat, Follows, Role clause, Event, Subscription, Aide, Lease.

Amendment (2026-10-14, the lead): rules carry a plain number and are written "rule 12" everywhere; no letter prefix, since `R-n` is a release id and any prefix resolves an item.

## Plan

```yaml
stages:
  - name: heartbeat, rulebook file and follows
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-454
      - - T-455
      - - T-335
  - name: rules reach sessions, rulebook view and demo lease
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-456
        - T-457
      - - T-458
      - - T-459
  - name: size gate and override scope
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-473
      - - T-474
  - name: Definition-of-done demo findings
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-550
      - - T-551
      - - T-553
      - - T-572
        - T-583
```

## Comments

### coord · 2026-10-15T07:16:04.944Z

Coordinator decisions at ticketing (2026-10-15 07:20Z). Tickets: T-454 heartbeat, T-455 rulebook, T-335 lane flow (rewritten), T-456 rules reach sessions, T-457 seed, T-458 rulebook view, T-459 demo lease. Spec points settled:
1. Rule headings are `## <n> <title>`, written `rule <n>`, with plain numbers and no R- prefix.
2. The seed records its origin with `cland rule add --origin memory:<path>`, from the human's or an Aide's shell only.
3. Origins take the forms `message:<topic>/<msg_id>`, `session:<name>`, `shell`, `workbench` and `memory:<path>`.
4. Event kinds: `heartbeat` is the 9th and `rule` the 10th, so T-456 also waits on T-454. The numeric filter keys stop at 9.
5. The connection keepalive (`HEARTBEAT_MS`) is renamed keepalive. The `ping` frame stays.
6. The test override is `CLAND_HEARTBEAT_MS`, and the one-minute floor applies only to crew.toml.
7. The heartbeat schedule is keyed by the session's stable identity, so `--relaunch` keeps it.
8. Rule events reach Aides in scope by name. `EventSubject` gains `rule`.
9. The seed's origins name the planning memory copy unless the two copies differ.
10. T-458 adds a `rules.changed` UI push. Workbench writes count as the human's, with origin `workbench`.
11. The demo lease (T-459) is for QA holding the epic, the Coordinator and the human. The hub creates the droplet.
12. Clause edits go in both default-roles.ts and .cland/roles.toml.
The stand-in may revisit any of these under D24.

### hub · 2026-10-16T00:24:56.101Z

demo 24539655-3b81-4427-aadf-95272aa17603 created: droplet cland-v0-24539655, commit cdad9cdc964f47040aa9762aa59c58a5c822a2cc, deadline 2026-10-16T01:13:36.724Z.

### hub · 2026-10-16T00:41:18.477Z

demo 24539655-3b81-4427-aadf-95272aa17603 destroyed: lifetime 489110 ms; cost $0.0340.

### qa-27 · 2026-10-16T00:48:19.233Z

verdict: qa
result: not clear
by: qa-27 [qa]
run: qa-2026-10-16-27-15
commit: cdad9cdc964f47040aa9762aa59c58a5c822a2cc

| Check | Result |
|---|---|
| G0 | PASS |
| G1 | PASS |
| G2 | PASS |
| D0 | PASS |
| D1 | PASS |
| D2 | BLOCKED |
| D3 | BLOCKED |
| D4 | BLOCKED |
| D5 | BLOCKED |
| D6 | PASS |
| D7 | PASS |
| D8 | PASS |
| D9 | PASS |
| D10 | PASS |
| D11 | PASS |
| D12 | PASS |
| D13 | PASS |
| D14 | PASS |
| D15 | PASS |
| D16 | PASS |
| D17 | PASS |
| D18 | FAIL |
| L1 | PASS |
| L2 | PASS |
| L3 | PASS |
| L4 | PASS |
| L5 | PASS |
| L6 | PASS |
| L7 | PASS |
| L8 | PASS |
| L9 | PASS |
| L10 | FAIL |
| L11 | PASS |
| L12 | PASS |
| L13 | PASS |
| L14 | PASS |
| L20 | PASS |
| L21 | PASS |
| L22 | PASS |
| L23 | PASS |
| L24 | PASS |
| L25 | INCONCLUSIVE |
| L30 | PASS |
| L31 | INCONCLUSIVE |
| L32 | INCONCLUSIVE |
| L33 | PASS |
| L34 | PASS |
| L35 | PASS |
| L36 | INCONCLUSIVE |
| L37 | PASS |
| L38 | PASS |
| L39 | PASS |
| L40 | PASS |
| L41 | PASS |
| L42 | PASS |
| L43 | PASS |
| R1 | PASS |
| R2 | PASS |
| R3 | PASS |
| R4 | PASS |
| R5 | PASS |

Evidence: A-3507, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3507-e-423-qa-evidence-qa-2026-10-16-27-15-at-cdad9cdc-not-clear/README.md (per-case commands, captures, findings and amendments).

Not clear at cdad9cdc964f47040aa9762aa59c58a5c822a2cc, run qa-2026-10-16-27-15.

High: D18 / T-553 — demo stop left the lease releasing: “droplet identity differs from its lease; refusing deletion”. A-3498 preserves the log. Eventual destruction confirmed; QA made no provider calls.
Medium: D2–D5 / T-551 — all four headless recorder calls BLOCKED on capture-name contract; no evidence captures returned. No patch or rerun.
Medium: L10 / T-550 — Coordinator rule.retire rewrote Aide rule 5 origin from session:qa-aide to message:general/<human-id>.
Low: delivered hub/bin is on PATH but has cland.ts, no cland executable; command -v cland exits 127, despite README/skill promise.

Brief limitations: L25's idle boundary preceded clause injection by 550 ms (later read passes), classified INCONCLUSIVE by Coordinator. L31/L32 ready-row plant auto-reset without review, INCONCLUSIVE; four other stale rows passed. L36 cancellation was INCONCLUSIVE because the prescribed wait outlasted the scratch run's 10-minute stall limit; both fakes stopped. L38 original BLOCKED retained, authorized scratch-only push fixed the omitted setup step, amended merge checks passed. L42 ran while L38 awaited amendment; subsequent expected merges/freshness outcomes all held. All original outputs remain.

Part D one droplet at S; D7–D16 66 tests passed, zero fails/skips/retries. Lease 24539655-3b81-4427-aadf-95272aa17603, created 00:23:44.666Z, deadline 01:13:36.724Z, released; lifetime 489110 ms, cost $0.033965972222222224. Part L local macOS scratch/fakes, Part R read-only. No full project suite. All scratch processes and directories cleaned. Final freshness current, dev unchanged at S.

Criteria: C2 and C5 passed. Failed/unverified C1 (L10 and D2–D3), C3 (D4 and L25), C4 (D2–D3), C6 (D4 and ready-row limitation), C7 (D5), C8 (D18). Not-clear carries only failed marks, no verified field. Local follows/merge/freshness, size and override checks passed.
Verdict note: A-3508, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3508-e-423-qa-verdict-table-lease-accounting-and-findings-qa-2026-10-16-27-15.md.

Criteria: C1 failed (L10 FAIL: rule retirement rewrites original origin (T-550); D2–D3 recorder BLOCKED (T-551).), C3 failed (D4 recorder BLOCKED (T-551); L25 INCONCLUSIVE due premature idle observation, later clause confirmed.), C4 failed (D2–D3 headless cases BLOCKED by capture-name contract (T-551).), C6 failed (D4 BLOCKED (T-551); L31/L32 ready-row observation INCONCLUSIVE from brief planting limitation.), C7 failed (D5 headless follows case BLOCKED by recorder contract (T-551); local follows and merge checks passed.), C8 failed (D18 FAIL: demo stop refused deletion due lease identity mismatch (T-553); eventual release confirmed.).

### hub · 2026-10-16T04:31:27.214Z

demo 7dc75f63-ff1f-4589-ba91-725858b99a0c created: droplet cland-v0-7dc75f63, commit eee3fd1d5f41a64b5e94d66b76ae1f484bd57ddb, deadline 2026-10-16T05:20:22.889Z.

### hub · 2026-10-16T04:36:49.589Z

demo 7dc75f63-ff1f-4589-ba91-725858b99a0c destroyed: lifetime 299835 ms; cost $0.0208.

### hub · 2026-10-16T04:57:17.571Z

demo 375889a3-e67c-498b-8838-133eefde3ead created: droplet cland-v0-375889a3, commit 3c5967426ae6d22a05b0ffd10fd08fdcaa5204db, deadline 2026-10-16T05:46:18.680Z.

### hub · 2026-10-16T05:00:24.400Z

demo E-423 lease 375889a3-e67c-498b-8838-133eefde3ead droplet 609583042: operator attention required; identity mismatch; deletion refused. {"fields":["tags"],"expected":{"name":"cland-v0-375889a3","tags":["cland","cland-p-8a978a214ba5"]},"observed":{"name":"cland-v0-375889a3","tags":[],"status":"active"}}

### hub · 2026-10-16T05:04:38.262Z

demo 375889a3-e67c-498b-8838-133eefde3ead destroyed: lifetime 240659 ms; cost $0.0167.

### qa-27 · 2026-10-16T05:07:17.129Z

verdict: qa
result: not clear
by: qa-27 [qa]
run: qa-2026-10-16-27-17
commit: 3c5967426ae6d22a05b0ffd10fd08fdcaa5204db

| Check | Result |
|---|---|
| G0 | PASS |
| G1 | PASS |
| G2 | PASS |
| D0 | PASS |
| RULEBOOK-001 | PASS |
| D2 | PASS |
| RULEBOOK-002 | PASS |
| D3 | PASS |
| EVENTS-001 | PASS |
| D4 | PASS |
| FOLLOWS-001 | PASS |
| D5 | PASS |
| D7 | PASS |
| D8 | PASS |
| D9 | PASS |
| D10 | PASS |
| D11 | PASS |
| D1 | PASS |
| D6 | PASS |
| L1 | PASS |
| L2 | PASS |
| L3 | PASS |
| L4 | PASS |
| L5 | PASS |
| L6 | PASS |
| L7 | PASS |
| L8 | PASS |
| L9 | PASS |
| L10 | PASS |
| L11 | PASS |
| D12 | PASS |
| D13 | PASS |
| L12 | PASS |
| L13 | PASS |
| L14 | PASS |
| D14 | PASS |
| D15 | PASS |
| D16 | PASS |
| D17 | PASS |
| L20 | PASS |
| L21 | PASS |
| L22 | PASS |
| L23 | PASS |
| L24 | PASS |
| L25 | PASS |
| L30 | PASS |
| L31 | PASS |
| D18 | FAIL |
| L32 | PASS |
| L33 | PASS |
| L34 | PASS |
| L35 | PASS |
| L36 | PASS |
| L37 | PASS |
| L38 | PASS |
| L39 | PASS |
| L40 | PASS |
| L41 | PASS |
| L42 | PASS |
| L43 | PASS |
| R1 | PASS |
| R2 | PASS |
| R3 | PASS |
| R4 | PASS |
| R5 | PASS |

High — D18 / T-572 (regression of T-553): `cland demo stop E-423 --json` exits 0 but returns releasing with operator attention. At 05:00:24.391Z the live hub refused deletion: “droplet identity differs from its lease; refusing deletion (tags; provider status active)”. Lease 375889a3-e67c-498b-8838-133eefde3ead, droplet 609583042: same expected/observed name cland-v0-375889a3; expected tags [cland, cland-p-8a978a214ba5], observed []; provider status active. Exact log A-3726. No stop retry or provider calls by QA. Operator subsequently confirmed provider 404; final hub status released. Eventual release does not erase the failed stop observation. No other findings.

Tested full SHA 3c5967426ae6d22a05b0ffd10fd08fdcaa5204db, run qa-2026-10-16-27-17, committed brief ca09b03c. Every case rerun fresh; no carryover. Four headless cases plus 68 targeted Linux tests passed, zero failures/skips/retries. All local macOS and read-only checks pass. No full project suite. Freshness current; dev unchanged at S.

Criteria: C1–C7 pass with all mapped evidence. C8 fails solely on D18; its other checks pass. This not-clear verdict marks failed C8 only and sends no verified field. Previous failures on other criteria are not silently rewritten.

One droplet lease created 04:56:20.244Z, deadline 05:46:18.680Z, final lifetime 240659 ms, cost $0.016712430555555557. Destruction comment agrees. Scratch run cancelled live at 05:03:43Z after planting at 05:00:04Z; queue empty, fakes/drivers/hub stopped, scratch directories removed. No live rulebook/crew/tracker writes beyond QA hold/verdict and normal demo controls.

Applied committed amendments: $14 cap, L25 clause-boundary observation, L31 reviewer-verdict ready plant, L36 timely live cancel, L38 scratch-only push. Driver pipelines kept alive by persistent controllers, assertions unchanged. G1 records 13 closed children; four stages open with cover annotations, as returned by restarted hub. L34 needsYou 1→2→2 came only from fake role-clause pong df9ffd03 joining 9544d421, no heartbeat row; L35 stayed at one approval and two busy firings collapsed to one next-turn prompt. R2 memory roots resolve to the same folder; all eleven markers/references match. R5 required documentation cells pass.

Full commands, captures and per-case evidence: A-3728, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3728-e-423-qa-run-17-at-3c596742-full-evidence-d18-not-clear/README.md.
Verdict table/accounting note: A-3729, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3729-e-423-qa-run-17-case-table-verdict-and-final-accounting.md.

Criteria: C8 failed (D18 FAIL / T-572: demo stop left releasing with empty-tag identity mismatch and operator attention; eventual destruction confirmed.).

### hub · 2026-10-16T07:30:07.964Z

demo 69940187-e113-4ed5-91e4-97b26c20d840 created: droplet cland-v0-69940187, commit a36169681d2f2d5dc422622a1dc81df2d535e727, deadline 2026-10-16T08:19:05.918Z.

### hub · 2026-10-16T07:33:43.045Z

demo E-423 lease 69940187-e113-4ed5-91e4-97b26c20d840 droplet 609612979: operator attention required; identity mismatch; deletion refused. {"fields":["tags"],"expected":{"id":609612979,"name":"cland-v0-69940187","tags":["cland","cland-p-8a978a214ba5"]},"observed":{"id":609612979,"name":"cland-v0-69940187","tags":[],"status":"active"}}

### qa-27 · 2026-10-16T07:41:10.825Z

verdict: qa
result: not clear
by: qa-27 [qa]
run: qa-2026-10-16-27-18
commit: a36169681d2f2d5dc422622a1dc81df2d535e727

| Case/check | Executor | Result | Evidence in A-3835 |
|---|---|---|---|
| G0 | macOS | PASS | G0.txt |
| G1 | macOS | PASS | G1-epic.json |
| G2 | macOS | PASS | G1-epic.json |
| D0 | droplet | PASS | D0-start.json |
| RULEBOOK-001 | droplet | PASS | rulebook-rows.screen.txt |
| D2 | droplet | PASS | RULEBOOK-001.recorder.log |
| RULEBOOK-002 | droplet | PASS | rulebook-added.screen.txt |
| D3 | droplet | PASS | RULEBOOK-002.recorder.log |
| EVENTS-001 | droplet | PASS | events-all.screen.txt |
| D4 | droplet | PASS | EVENTS-001.recorder.log |
| FOLLOWS-001 | droplet | PASS | follows-card.screen.txt |
| D5 | droplet | PASS | FOLLOWS-001.recorder.log |
| D7 | droplet | PASS | D7.txt |
| D8 | droplet | PASS | D8.txt |
| D9 | droplet | PASS | D9.txt |
| D1 | droplet | PASS | D1-build.txt |
| D6 | droplet | PASS | D6-rule-cli.txt |
| D10 | droplet | PASS | D10.txt |
| D11 | droplet | PASS | D11.txt |
| L1 | macOS | PASS | L1.txt |
| L2 | macOS | PASS | L2.txt |
| L3 | macOS | PASS | L3.txt |
| L4 | macOS | PASS | L4.txt |
| L5 | macOS | PASS | L5.txt |
| L6 | macOS | PASS | L6.txt |
| L7 | macOS | PASS | L7-human.json |
| L8 | macOS | PASS | L8-checks.txt |
| L9 | macOS | PASS | L9.txt |
| L10 | macOS | PASS | L10.txt |
| L11 | macOS | PASS | L11.txt |
| L12 | macOS | PASS | L12.txt |
| L13 | macOS | PASS | L13.txt |
| L14 | macOS | PASS | L14.txt |
| D12 | droplet | PASS | D12.txt |
| D13 | droplet | PASS | D13.txt |
| D14 | droplet | PASS | D14.txt |
| D15 | droplet | PASS | D15.txt |
| D16 | droplet | PASS | D16.txt |
| L20 | macOS | PASS | L20.txt |
| L21 | macOS | PASS | L21.txt |
| L22 | macOS | PASS | L22.txt |
| L23 | macOS | PASS | L23.txt |
| L24 | macOS | PASS | L24-assertions.txt |
| L25 | macOS | PASS | L25.txt |
| L30 | macOS | PASS | L30.txt |
| D17 | droplet | PASS | D17-status.json |
| D18 | droplet | FAIL | D18-stop.json |
| L31 | macOS | PASS | L31-TR.json |
| L32 | macOS | PASS | L32-digest.txt |
| L33 | macOS | PASS | L33.txt |
| L34 | macOS | PASS | L34-assertions.txt |
| L35 | macOS | PASS | L35.txt |
| L36 | macOS | PASS | L36.txt |
| L37 | macOS | PASS | L37.txt |
| L38 | macOS | PASS | L38.txt |
| L39 | macOS | PASS | L39.txt |
| L40 | macOS | PASS | L40-fresh.json |
| L41 | macOS | PASS | L41-quit.json |
| L42 | macOS | PASS | L42.txt |
| L43 | macOS | PASS | L43-stop.txt |
| R1 | macOS | PASS | R1-check.txt |
| R2 | macOS | PASS | R2-check.txt |
| R3 | macOS | PASS | R3.txt |
| R4 | macOS | PASS | R4.txt |
| R5 | macOS | PASS | R5-matrix.md |

High — D18 / C8 / T-583: one `cland demo stop E-423 --json` after D1–D17 passed returned exit 0 but state releasing with operator attention: expected droplet 609612979 cland-v0-69940187 with tags [cland,cland-p-8a978a214ba5], observed same id/name with tags [] and status active. Exact stop and readbacks: A-3829. Coordinator filed T-583 for the provider teardown window exceeding the 2-second reread. No stop retry/provider calls. No other findings.

Run qa-2026-10-16-27-18; tested full SHA a36169681d2f2d5dc422622a1dc81df2d535e727. Fresh full run, brief ca09b03c. 64 PASS, 1 FAIL. Four headless cases and 68/68 supporting tests passed, 0 skipped, no retries. All local checks and read-only R1–R5 passed. Final dev unchanged, freshness current=true.

Droplet lease 69940187-e113-4ed5-91e4-97b26c20d840; created 07:29:07.546Z, deadline 08:19:05.918Z on 2026-10-16. Latest pre-verdict status remains releasing: 673756 ms, estimated $0.046788611111111114; final destruction/accounting unconfirmed. Operator cleanup escalated. Local scratch run cancelled at 07:36:41Z (200 seconds after plants); queue empty, fake sessions and hub stopped, owned drivers ended. No scratch processes remain, machine suite lock absent before/after. Scratch paths removed with guarded reversible Trash move because runtime rejected rm -f cleanup.

Criteria: C1–C7 PASS by the brief mapping (full mapping and captures in A-3835); C8 FAIL solely D18. Apply failed C8 only; verified is omitted because not-clear verdicts cannot carry it. T-473/T-474 checks passed.

Execution notes: G1 records all 14 closed children and four plan stages. Persistent driver controllers kept pipes alive with unchanged identities/steps/assertions. L24 auxiliary subject checker was corrected from string to subject.id against the same captures. L34 needsYou 1→2→2 is an extra fake impl role-clause pong (bc76a3a4-e88e-465d-a28d-cd6dfc508043), not a heartbeat; exact rows in L34-assertions.txt. L35 held count 2 then 3, with old firing dropped and newest queued. R2 two paths resolve to one memory folder, all eleven markers/index lines present; R5 all required cells filled. No case results carried from earlier runs.

Evidence folder A-3835: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3835-e-423-run-18-at-a3616968-full-qa-evidence-d18-not-clear. Exact D18 A-3829.

Verdict note A-3836: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3836-e-423-qa-run-18-case-table-and-not-clear-verdict-t-583.md

Criteria: C8 failed (D18/T-583: demo stop left lease releasing with tags-only identity attention; confirmed destruction/accounting unavailable.).

### hub · 2026-10-16T07:41:13.541Z

demo 69940187-e113-4ed5-91e4-97b26c20d840 destroyed: lifetime 270828 ms; cost $0.0188.

### hub · 2026-10-16T10:17:22.223Z

demo 2814a0d5-d003-485e-bcd9-d1611374821b created: droplet cland-v0-2814a0d5, commit f6045f838f55902c0224473512e82c1ff0121e72, deadline 2026-10-16T11:06:21.119Z.

### hub · 2026-10-16T10:20:36.102Z

demo 2814a0d5-d003-485e-bcd9-d1611374821b destroyed: lifetime 240726 ms; cost $0.0167.

### qa-27 · 2026-10-16T10:27:34.031Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-16-27-20
commit: f6045f838f55902c0224473512e82c1ff0121e72

| Case | Surface / executor | Result | Evidence | Observation |
| --- | --- | --- | --- | --- |
| G0 | hub-api / local | PASS | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/G0.txt), [G0-lock.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/G0-lock.txt) | Brief expectation met; exact output retained. |
| G1 | hub-api / local | PASS | [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/G1-epic.json), [G1-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/G1-children.json), [G1-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/G1-plan.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| G2 | hub-api / local | PASS | [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/G1-epic.json) | Brief expectation met; exact output retained. |
| D0 | hub-api / droplet | PASS | [D0-start.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D0-start.json), [D0-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D0-status.json) | Brief expectation met; exact output retained. |
| RULEBOOK-001 | headless-grid / droplet | PASS | [rulebook-rows.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/rulebook-rows.screen.txt), [rulebook-rows.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/rulebook-rows.state.json), [rulebook-unfolded.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/rulebook-unfolded.screen.txt) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| D2 | hub-api / droplet | PASS | [RULEBOOK-001.recorder.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/RULEBOOK-001.recorder.log) | Brief expectation met; exact output retained. |
| RULEBOOK-002 | headless-grid / droplet | PASS | [rulebook-added.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/rulebook-added.screen.txt), [rulebook-added.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/rulebook-added.state.json), [rulebook-refused.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/rulebook-refused.screen.txt) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| D3 | hub-api / droplet | PASS | [RULEBOOK-002.recorder.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/RULEBOOK-002.recorder.log) | Brief expectation met; exact output retained. |
| EVENTS-001 | headless-grid / droplet | PASS | [events-all.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/events-all.screen.txt), [events-all.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/events-all.state.json), [events-heartbeat.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/events-heartbeat.screen.txt) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| D4 | hub-api / droplet | PASS | [EVENTS-001.recorder.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/EVENTS-001.recorder.log) | Brief expectation met; exact output retained. |
| FOLLOWS-001 | headless-grid / droplet | PASS | [follows-card.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/follows-card.screen.txt), [follows-card.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/follows-card.state.json), [follows-item-view.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/follows-item-view.screen.txt) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| D5 | hub-api / droplet | PASS | [FOLLOWS-001.recorder.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/FOLLOWS-001.recorder.log) | Brief expectation met; exact output retained. |
| D7 | hub-api / droplet | PASS | [D7.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D7.txt) | Brief expectation met; exact output retained. |
| D8 | hub-api / droplet | PASS | [D8.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D8.txt) | Brief expectation met; exact output retained. |
| D1 | hub-api / droplet | PASS | [D1-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D1-build.txt) | Brief expectation met; exact output retained. |
| D6 | hub-api / droplet | PASS | [D6-rule-cli.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D6-rule-cli.txt) | Brief expectation met; exact output retained. |
| D9 | hub-api / droplet | PASS | [D9.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D9.txt) | Brief expectation met; exact output retained. |
| D10 | hub-api / droplet | PASS | [D10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D10.txt) | Brief expectation met; exact output retained. |
| L1 | hub-api / local | PASS | [L1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L1.txt) | Brief expectation met; exact output retained. |
| L2 | hub-api / local | PASS | [L2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L2.txt), [L2-add.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L2-add.json), [L2-add2.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L2-add2.json) | Brief expectation met; exact output retained. |
| L3 | hub-api / local | PASS | [L3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L3.txt), [L3-add.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L3-add.json) | Brief expectation met; exact output retained. |
| L4 | hub-api / local | PASS | [L4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L4.txt), [L4-all.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L4-all.json) | Brief expectation met; exact output retained. |
| L5 | hub-api / local | PASS | [L5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L5.txt) | Brief expectation met; exact output retained. |
| L6 | hub-api / local | PASS | [L6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L6.txt), [L6-add4.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L6-add4.json), [L6-add5.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L6-add5.json) | Brief expectation met; exact output retained. |
| L7 | hub-api / local | PASS | [L7-human.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L7-human.json), [L7-ready.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L7-ready.txt) | Brief expectation met; exact output retained. |
| L8 | hub-api / local | PASS | [L8-checks.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L8-checks.txt) | Brief expectation met; exact output retained. |
| L9 | hub-api / local | PASS | [L9.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L9.txt), [L9-assertions.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L9-assertions.txt) | Brief expectation met; exact output retained. |
| L10 | hub-api / local | PASS | [L10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L10.txt) | Retirement preserves the rule origin. |
| L11 | hub-api / local | PASS | [L11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L11.txt) | Brief expectation met; exact output retained. |
| L12 | hub-api / local | PASS | [L12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L12.txt), [L12-clause.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L12-clause.txt), [L12-disconnect.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L12-disconnect.txt) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L13 | hub-api / local | PASS | [L13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L13.txt), [L13-flush1.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L13-flush1.json), [L13-flush2.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L13-flush2.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L14 | hub-api / local | PASS | [L14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L14.txt), [L14-roles.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L14-roles.json) | Brief expectation met; exact output retained. |
| D11 | hub-api / droplet | PASS | [D11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D11.txt) | Brief expectation met; exact output retained. |
| L20 | hub-api / local | PASS | [L20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L20.txt), [L20-L24-assertions.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L20-L24-assertions.txt), [L20-add.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L20-add.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L21 | hub-api / local | PASS | [L21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L21.txt), [L21-L24-input.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L21-L24-input.log), [L21-add.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L21-add.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L22 | hub-api / local | PASS | [L22.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L22.txt) | Brief expectation met; exact output retained. |
| L23 | hub-api / local | PASS | [L23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L23.txt), [L23-add.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L23-add.json) | Brief expectation met; exact output retained. |
| L24 | hub-api / local | PASS | [L24-inbox-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L24-inbox-after.json), [L24-rule-events.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L24-rule-events.json) | Brief expectation met; exact output retained. |
| L25 | hub-api / local | PASS | [L25.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L25.txt), [L25-impl-relaunch.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L25-impl-relaunch.log), [L25-rules.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L25-rules.json) | New PID; same conversation; current clause observed after turn start. |
| L30 | hub-api / local | PASS | [L30.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L30.txt), [L30-crew.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L30-crew.json), [L30-crew.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L30-crew.txt) | Brief expectation met; exact output retained. |
| D12 | hub-api / droplet | PASS | [D12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D12.txt) | Brief expectation met; exact output retained. |
| D13 | hub-api / droplet | PASS | [D13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D13.txt) | Brief expectation met; exact output retained. |
| D14 | hub-api / droplet | PASS | [D14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D14.txt) | Brief expectation met; exact output retained. |
| D15 | hub-api / droplet | PASS | [D15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D15.txt) | Brief expectation met; exact output retained. |
| D16 | hub-api / droplet | PASS | [D16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D16.txt) | Brief expectation met; exact output retained. |
| L31 | hub-api / local | PASS | [L31-TR.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L31-TR.json), [L31-TY-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L31-TY-after.json), [L31-TY-claim.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L31-TY-claim.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| D17 | hub-api / droplet | PASS | [D17-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D17-status.json), [D17-dev.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D17-dev.txt) | Brief expectation met; exact output retained. |
| D18 | hub-api / local | PASS | [D18-started-at.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D18-started-at.txt), [D18-stop.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D18-stop.json), [D18-final.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/D18-final.json) (all paths in runs.jsonl) | Released 14 s after the single stop; no attention; amended limit 6 min. |
| L32 | hub-api / local | PASS | [L32-digest.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L32-digest.txt), [L32-firings.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L32-firings.txt), [L32-inbox-0.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L32-inbox-0.json) (all paths in runs.jsonl) | Four in-flight and all five planted stale rows present. |
| L33 | hub-api / local | PASS | [L33.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L33.txt) | Brief expectation met; exact output retained. |
| L34 | hub-api / local | PASS | [L34-L35-assertions.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L34-L35-assertions.txt), [L34-events.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L34-events.json), [L34-inbox-2.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L34-inbox-2.json) | Only the fake role-clause pong added needs-you; no heartbeat row. |
| L35 | hub-api / local | PASS | [L35.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L35.txt), [L35-coord-input.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L35-coord-input.log), [L35-firings.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L35-firings.txt) (all paths in runs.jsonl) | Busy heartbeats folded into one next turn; no new needs-you. |
| L36 | hub-api / local | PASS | [L36.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L36.txt), [L36-42-record.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L36-42-record.txt), [L36-queue-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L36-queue-after.json) (all paths in runs.jsonl) | Cancelled 223 s after planting, within 8 min; queue empty. |
| L37 | hub-api / local | PASS | [L37.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L37.txt), [L37-E1.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L37-E1.json), [L37-E2.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L37-E2.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L38 | hub-api / local | PASS | [L38.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L38.txt), [L38-T1.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L38-T1.json), [L38-TC.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L38-TC.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L39 | hub-api / local | PASS | [L39.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L39.txt), [L39-T2.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L39-T2.json), [L39-T3.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L39-T3.json) (all paths in runs.jsonl) | Brief expectation met; exact output retained. |
| L40 | hub-api / local | PASS | [L40-fresh.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L40-fresh.json), [L40-hold.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L40-hold.json), [L40-merge-T2.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L40-merge-T2.json) (all paths in runs.jsonl) | Behind-tip verdict accepted after nonoverlapping merge; overlap hold lifted. |
| L41 | hub-api / local | PASS | [L41-quit.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L41-quit.json), [L41-refused.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L41-refused.json), [L41-stale.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L41-stale.json) (all paths in runs.jsonl) | Overlapping commit makes old verdict stale; tip verdict accepted. |
| L42 | hub-api / local | PASS | [L42.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L42.txt), [L42-TL.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L42-TL.json), [L42-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L42-plan.json) | Brief expectation met; exact output retained. |
| L43 | hub-api / local | PASS | [L43.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L43.txt), [L43-stop.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/L43-stop.txt) | Hub stopped; owned tails ended; no scratch processes remain. |
| R1 | hub-api / local | PASS | [R1-check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/R1-check.txt), [R1-rules.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/R1-rules.json) | Brief expectation met; exact output retained. |
| R2 | hub-api / local | PASS | [R2-check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/R2-check.txt) | Brief expectation met; exact output retained. |
| R3 | hub-api / local | PASS | [R3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/R3.txt) | Brief expectation met; exact output retained. |
| R4 | hub-api / local | PASS | [R4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/R4.txt) | Brief expectation met; exact output retained. |
| R5 | hub-api / local | PASS | [R5-matrix.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear/R5-matrix.md) | All required cells present; 48-cell matrix retained. |

Findings: high — none; medium — none; low — none.

Result: clear. All 65 unique recorder entries pass. Four native UI cases pass; D7–D16 ran 68 supporting tests (3, 7, 7, 9, 11, 8, 3, 12, 4, 4), zero failures or skips, no retries. This is a full fresh run; no results were carried from earlier runs.

Run: qa-2026-10-16-27-20. Tested commit: f6045f838f55902c0224473512e82c1ff0121e72. Final dev equals S, clean detached worktree, ancestry succeeds and freshness.current=true. See final-build.txt and final-status.json.

Execution: Part D used the hub-managed droplet at S; local controls recorded the release. Parts G, L and R used local macOS, with L confined to the isolated scratch project and fake harnesses. R was read-only. No full suite or provider calls were run.

Lease 2814a0d5-d003-485e-bcd9-d1611374821b, created 2026-10-16T10:16:22.616Z; deadline 2026-10-16T11:06:21.119Z. Confirmed released; lifetime 240726 ms; cost $0.016717083333333334. Single stop began 10:20:22Z and release was confirmed 14 seconds later, with no operator attention. D18-hub-comments.txt retains the hub destruction record.

Criterion marks: verified C1,C2,C3,C4,C5,C6,C7,C8.

| Criterion | Passing evidence |
| --- | --- |
| C1 | D2,D3,D6–D9,L1–L7,L9–L11,L13 |
| C2 | D9,L8,L20,R3 |
| C3 | D4,D9,D16,L12,L21–L25,R3 |
| C4 | D2,D3,D15 |
| C5 | D8,R1,R2 |
| C6 | D4,D10,D16,L30–L35,R3 |
| C7 | D5,D11,L37–L41,R3,R4 |
| C8 | D0,D1,D12,D17,D18,L40,L41,R5 |

T-473 and T-474 checks also passed (D13/L42 and D14/L38), without separate criterion marks.

Deviations and observations:
- Coordinator requested the full rerun after the partial-scope gate failed; every G, D, L and R check ran anew at S. The amended D18 expectation allows up to 6 minutes, with no operator attention.
- G1 confirms all 15 current children closed, including T-583, with landing ancestry retained; four plan stages remain open pending the epic demo.
- Driver pipelines were kept in persistent command sessions so the harness could exchange messages across tool calls. Observation helpers retain the brief expectations.
- L34 needs-you changed 1→2→2 because the fake Implementer emitted a role-clause pong. Exact IDs and assertion output show heartbeat itself added no inbox row.
- L43 used a reversible move of only this run’s scratch directories into ~/.Trash/cland-qa-2026-10-16-27-20 after process cleanup. Active scratch paths are gone.
- R2 confirms both memory folders resolve to the same physical folder; all eleven markers and index entries match. Later rulebook entries are listed but not judged.

Evidence integrity: 65 unique PASS rows, all referenced files present; the DigitalOcean token scan found no token in this evidence directory. The record includes commands, original outputs, UI grids/state, scratch helpers and final accounting.

Full evidence: A-3875, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3875-e-423-run-20-at-f6045f83-full-qa-evidence-65-checks-clear.

Verdict note A-3876: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3876-e-423-qa-run-20-clear-case-table-accounting-and-c1-c8.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
