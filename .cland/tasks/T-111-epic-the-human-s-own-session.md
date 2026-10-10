---
id: T-111
kind: epic
title: "Epic: The human's own session"
state: closed
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-109
  - T-108
topic: topic-96
branch: null
created: 2026-10-09T21:51:33.788Z
updated: 2026-10-10T17:03:42.283Z
---

## Goal

The human launches sessions of their own, Aides, from the palette or one key, with a brief, and works through them: an Aide edits the tracker and artifacts, messages any session by name and speaks for the human, while broadcasts and asks never reach it. Every session can now start with a brief that the hub delivers right after its role clause. Today the human has no session of their own and types into the Coordinator's or an Implementer's TUI, and a launched session gets its task only in a later message.

## Contents

- **§3.3 The human's own session: the Aide**: a non-exclusive role, addressed by name only and never reached by broadcasts, Agents notices or asks; it holds the tracker in full, artifacts, `send`, `topic.create` and `history`, but cannot launch, merge, hand over, resolve or ask; it speaks for the human, decisions included; it is launched from the palette, `a` or `␣A` with the `aide` role's defaults and an optional brief, and shows in a "yours" group at the top of the sessions panel.
- **Brief at launch** (map T-81, "Settled while charting"): `session.launch` and `cland session launch` take a brief, a text or an artifact, which the hub delivers once, right after the role clause and before the session's first turn. It lives here, not in "Workbench basics", because it changes the hub's first delivery and each adapter's injection order, which "A quiet Coordinator" reworks; the Aide's launch is its first user.

Not in this epic:

- An Aide's rights over criteria: they arrive with whichever of this epic and "Criteria that live" lands second.
- An Aide's approval of plans: "The epic plan". Its edits of `crew.toml`: "Leads and the crew".
- The exemption of an Aide's artifacts from archiving, and folder artifacts: "Visibility and artifacts".

Choices where the spec is silent:

- The spec's `[roles.aide]` is the `aide` table of `.cland/roles.toml` in the file's existing shape: `[aide]`, `[aide.launch]`, `[aide.permissions]`.
- An Aide's claim moves the item's status like an Implementer's.

## Tracer-bullet order

1. **The Aide role in the hub.** The non-exclusive role in `roles.toml` and in `cland init`'s defaults, its permission set and refusals, and routing that keeps Aides out of role broadcasts, `all`, Agents notices and asks. Demo: `cland session launch aide-1 --role aide` connects; a message to every role skips it; it creates and edits an item and is refused on `session.launch`.
2. **The brief at launch.** `session.launch` and the CLI take a brief (text or `A-<n>`); the hub delivers it once, after the clause and before the first turn, on Claude Code, Codex and OpenCode. Demo: an Implementer launched with a brief starts on it with no other message.
3. **Launching an Aide from the workbench.** The palette action, `a` and `␣A` open the launcher filled from the role's defaults with a brief field; the "yours" group at the top of the sessions panel. Demo: `␣A`, a one-line brief, Enter: `aide-1` appears under "yours" and attaches in the centre.
4. **The Aide speaks for the human.** The crew's role clauses say so; its messages show as `aide-1 [Aide]` with the thread's "speaks for you" mark; messages to or from it never fold. Demo: the Aide tells the Coordinator to rank one task above another, and the Coordinator treats it as the human's decision.
5. **An Aide takes an item.** An Aide's claim gives it the item's branch and worktree, and its work goes through review and the merge gate like an Implementer's. Demo: the human tells `aide-1` to take a small ticket; it claims, works in the worktree, and a Reviewer reviews it.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human presses `␣A`, types a brief ("help me plan the v0.2 notes") and gets `aide-1` under "yours", attached in the centre. The Aide creates two items, edits a third, and messages the Coordinator by name with a decision that the Coordinator follows; a message to every role and a pending ask never reach it, and its attempt to launch a session is refused. An Implementer launched with a brief starts on it before any other message reaches it.

- [ ] The `aide` role exists in `roles.toml` and in `cland init`'s defaults; it is non-exclusive and has exactly the tools §3.3 lists.
- [ ] Role broadcasts, `all`, Agents notices and asks never reach an Aide; deliveries by name do.
- [ ] An Aide's attempts to launch, stop or resume sessions, merge, hand over, resolve or ask are refused, each naming the rule.
- [ ] `session.launch` and `cland session launch` take a brief (text or artifact), delivered once, after the clause and before the first turn, on all three adapters, and never again on reconnect.
- [ ] The palette action, `a` and `␣A` launch an Aide with the role's defaults, the project root and an optional brief; it shows under "yours" and attaches like any session.
- [ ] The crew's role clauses say that an Aide speaks for the human, decisions included.
- [ ] An Aide's claim gives it the item's worktree and branch, and its work passes the same gate.
- [ ] `hub/README.md`, `nvim/README.md` and the role clauses describe the Aide and the brief.

## Dogfooding

From this epic on, the human plans through an Aide: the remaining epics' tickets, the v0.1 release notes and the v0.2 notes are drafted by an Aide that speaks for them, while the Coordinator keeps the crew. Every Implementer the build launches afterwards gets its ticket as a brief at launch instead of a first message.

## Constraints

- **ADRs.** 0001 (Roles are hub-held state delivered as events): the Aide is a role the hub holds, its clause delivered as an event. 0004 (Agents work on a local git territory): an Aide's claim works in the item's worktree and lands through `cland merge`. 0003 (The hub is a per-project daemon extracted from the BCAS driver hub): the brief rides the same queue and stages as a message.
- **Research.** `research/harness-surfaces` (`docs/research/harness-surfaces.md`): where each adapter puts the role clause, which decides the brief's order (Codex puts the clause in its first turn).
- **References.** `prototype/panels` (the "yours" group and `␣A` stand-ins in `panels.lua` and `palette.lua`), never merged; the mockups `SessionsPanel.dc.html`, `Palette.dc.html` and `Thread.dc.html` (an Aide's message header) in `docs/design/main-screen/`. Where they disagree, the spec's words win, then the prototype's behaviour, then the mockups.
- **Risks** from the sizing: keeping Aides out of `all`, role tags, Agents notices and asks in routing written for four roles; the brief's order after the clause on each adapter, and no redelivery on reconnect.
- **The v0 tail.** T-106 (spoke tools are callable before the hub's welcome: a brief must not race the welcome) and T-79 (the adapters' synchronous filesystem calls while spawning) touch this code. Neither is a prerequisite: the Coordinator takes one first only if it blocks this work; otherwise they carry `tech-debt`.
- **Order.** Third in the Neovim lane, after "Threads that read". It waits for "Workbench basics", whose palette and sessions panel host the Aide, and for "A quiet Coordinator", whose routing it extends. "The task graph" follows it in the lane.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the fake harnesses prove the brief's order after the clause on each adapter.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.3 The human's own session: the Aide; §3.11 (the sessions panel and the palette that host it).
- Map T-81: Notes, "Settled while charting" (a brief at launch); decision T-92.
- GLOSSARY: Aide, Role, Role clause, Session, Claim.
- ADRs: `docs/adr/0001-roles-are-hub-held-state.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- Branches: `prototype/panels`, `research/harness-surfaces`.
- Mockups: `docs/design/main-screen/SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`.

## Comments

### qa-15 · 2026-10-10T17:03:03.513Z

verdict: qa
result: clear
by: qa-15 [qa]
run: qa-2026-10-10-15-111-c
commit: dec872c95e30612b09afb3647c0ad0e6b7c10354

| case | surface | result | evidence |
| --- | --- | --- | --- |
| PANELS-015, PANELS-016 | headless-grid | PASS | .cland/qa/T-111/qa-2026-10-10-15-111/ |
| M1–M3, M6, M8 | hub-api | PASS | .cland/qa/T-111/qa-2026-10-10-15-111/M<n>.txt |
| M4 | hub-api / native fake adapters | PASS | .cland/qa/T-111/qa-2026-10-10-15-111-b/M4.txt and M4-*.log |
| M5 | headless-grid | PASS | .cland/qa/T-111/qa-2026-10-10-15-111-c/M5.txt and M5-*.screen.txt |
| M7 | hub-api | delivery/actions PASS; model behavior BLOCKED and deferred | .cland/qa/T-111/qa-2026-10-10-15-111/M7.txt |

No product findings. The initialized Aide is non-exclusive; its permissions match §3.3 plus criteria management from §3.4, and crew clauses recognize its authority. Named delivery arrived while all/role broadcasts and asks did not. Every forbidden crew operation named the Aide rule; permitted tracker/named-send actions worked. Text and artifact briefs reached each of Claude Code, Codex and OpenCode exactly once, after the clause in the first native input, and were not repeated after hub restart/reconnect. Space-A, sessions a, and the palette launched real fake-backed Aides using role defaults/root, attached them and displayed them under YOURS. An Aide claim provided its branch/worktree; the human's merge of that work refused a missing review (the Aide's own merge permission is separately denied by M3).

verified: C1,C2,C3,C4,C5,C6,C7,C8
failed: none
deferred to the T-117 walkthrough: M7 — whether a real Coordinator model follows the Aide's decision. Two creates, third-item edit, and receipt with from_role=aide all passed. This behavioral check is explicitly outside criteria and does not block the automated scope under Procedure 6b.

Commit: dec872c95e30612b09afb3647c0ad0e6b7c10354. Catalogue cases ran at e3b702e; only T-110 brief/tracker documentation changed before manual checks at dec872c. Product source unchanged and clean outside live .cland metadata. Initial M4 awaited a clause on an additional spoke joining an already connected session; corrected continuation exercises actual hub restart/reconnect. Initial M5 matched the previous attachment too early; the corrected check waits for the specific new Aide before continuing. Earlier driver evidence is retained; no product fixes.
