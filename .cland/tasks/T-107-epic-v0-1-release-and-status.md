---
id: T-107
kind: epic
title: "Epic: v0.1 release and status"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by: []
topic: null
branch: null
created: 2026-10-09T21:51:33.080Z
updated: 2026-10-10T16:43:37.538Z
---

## Goal

The human plans and follows v0.1 as a release item whose tasks carry an explicit status and rank that the hub moves as the work happens. The board and the items panel show only the current release, in status columns and filters, with the next item at the top of its siblings, and a release or an epic with open children cannot be closed. Today items have only open or closed, a parent and blocking edges; the board shows every item, 72 cards of them in done; and the "in work" filter hides items under review (T-80).

## Contents

- **§3.1 Item hierarchy: a release above epics**, all but `cland release --item`: container kinds from `[tracker] levels`, a parenting rule the hub enforces on create and link, the `release` kind with `version` and `## Notes`, containers that cannot close over open children, `cland task list --under` and the path header of `cland task view`, the items panel folded by level with the unscheduled group last, and the current release by its default rule (the open release with the lowest version) named in the top bar.
- **§3.2 Item status and order**: the `status` field moved by hub events and set by hand only by the Coordinator and the human (and by the Implementer, to `review`), `rank` with `cland task rank` and the Coordinator's next-item rule, the filters and the board's columns in status terms, an unchanged merge gate, and T-80 closed.
- **Board scoping** (map T-81, "Settled while charting"): the board shows the items of open parents only, with a parent filter in its header, and the closed items of a closed epic leave it.
- **Migration** (§3.1): the first ticket creates the v0.1 release item and re-parents the epics labelled `v0.1` under it; no release item is made for v0.0.1, and T-19 stays open as the parent of the v0 follow-ups.

Not in this epic:

- `cland release --item` and closing the release item when it ships: "Release from the item".
- The human's pick of another current release (`e` and `E`) and its persistence in `.cland/ui.json`: "Workbench basics", which owns `ui.json`. This epic ships the default rule only.
- The vertical board in the items panel, the rank keys `K`, `J` and `T`, and the "next" mark (§3.11): "Workbench basics", which reads this epic's fields.
- Criteria in `ready` and the gate: "Criteria that live". The plan's QA policy in `ready` and the gate, and the retirement of `qa-required`: "The epic plan". The task graph scoped to the current release: "The task graph".

Open point the status tickets settle. §3.2 lets a Reviewer's or QA's claim set `review` or `qa`, but in v0 a claim is exclusive, Reviewers and QA hold no `task.claim`, and the gate refuses a verdict from a session that claims the item; §3.7 meanwhile keeps the claiming Implementer as the item's lead. Suggested: a verifier's claim is a second hold, tagged with its role, that sits beside the Implementer's and does not change the item's lead; the gate refuses a verdict from the session that holds the Implementer's claim. A verdict that goes stale (new commits after it) moves the task from `ready` back to `in progress`.

Decided on 2026-10-09 (with T-98): a Reviewer or QA does not claim; it takes a verifier hold beside the Implementer's claim, tagged with its role; the hold sets `review` or `qa`; the merge gate refuses a verdict only from the holder of the Implementer's claim (spec §3.2). The board-scoping slice stands: the board keeps `␣b`.

## Tracer-bullet order

1. **The v0.1 release item.** The `release` kind with `version` and `## Notes`, the parenting rule on create and link, `cland task list --under`, and the path header of `cland task view`, with the MCP tools; then the ticket creates the v0.1 release item and re-parents the `v0.1` epics under it. Demo: `cland task view` on any v0.1 epic shows the path from v0.1, and `cland task list --under T-<release>` lists the tree.
2. **Containers from config.** `[tracker] levels` replaces the hard-coded container kinds in the hub, the item parser and the CLI; a file with an unknown kind is refused with a notice; closing a container with open children is refused. Demo: closing the v0.1 release item is refused while its epics are open; a scratch project with a third container level accepts it and enforces its parenting rule.
3. **Status on events.** The `status` field (default `backlog`), moved by claims, a not-clear verdict, a merge, a close and a reopen; `--status` for the Coordinator and the human; the Implementer's narrow right to set `review` on its own item; the status in the `task` event the UI already takes. Demo: an Implementer claims a planned task and `cland task view` shows `in progress`.
4. **Ready, and the verifiers' claims.** `ready` set when every verdict the gate needs is clear, computed off the merge path with the gate's provenance and freshness rules, and withdrawn when a verdict goes stale; Reviewer and QA claims settled as the open point above. Demo: a clear review on a task that needs no QA moves it to `ready`; a new commit on its branch takes it back to `in progress`.
5. **Rank.** The `rank` field on tasks and epics, `cland task rank` and its MCP tool, lists sorted by rank then id, the Coordinator's clause picking the next item by rank and status, and the `high` label retired from the tracker and the clauses. Demo: `cland task rank T-n --top` and the Coordinator's next pick follows it.
6. **The surfaces read status.** The items panel's filters in status terms, its tree folded by level with the unscheduled group last, the current release named in the top bar; the board's columns are the statuses, scoped to the open parents of the current release with a parent filter in its header. Demo: the board shows v0.1's tasks moving between columns as claims and verdicts land, and T-80 closes.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human starts cland on the cland repository. The top bar names release v0.1, and the board shows only v0.1's tasks, in status columns, with a parent filter naming its epics. An Implementer claims the top-ranked planned task and its card moves to in progress; the Implementer hands it over and it moves to review; a not-clear verdict sends it back to in progress, and the clear verdicts the gate needs move it to ready; `cland merge` moves it to done and out of the "in work" filter. `cland task rank` puts another task on top, and the Coordinator takes it next. Closing the release item while its epics are open is refused.

- [ ] The v0.1 release item exists with version `0.1.0`, and every epic labelled `v0.1` is its child; the v0 epics stay unscheduled.
- [ ] Container kinds come from `[tracker] levels`; the parenting rule holds on create and on link; a container with open children cannot close.
- [ ] `cland task list --under T-n` lists a subtree, `cland task view` shows the path from the release in its header, and the MCP task tools mirror the CLI.
- [ ] Status moves on every event §3.2 lists, `ready` included, and leaves `ready` when a verdict goes stale; a manual status edit is refused for every session but the Coordinator, the human and the Implementer's `review`.
- [ ] Rank orders siblings; `cland task rank` renumbers only what it must; every list sorts by rank, then id; the `high` label is gone.
- [ ] The items panel and the board show the current release, with filters and columns in status terms and the unscheduled group last; T-80 is closed.
- [ ] The merge gate accepts and refuses exactly what it did before, for every item in flight.
- [ ] `hub/README.md`, `nvim/README.md`, `docs/agents/issue-tracker.md`, the role clauses in `.cland/roles.toml` and `cland init`'s defaults describe the release kind, the levels, status and rank.

## Dogfooding

From the first ticket on, every v0.1 epic and every ticket `/to-tickets` cuts from it sit under the v0.1 release item, so the human follows the build in the release's tree. New tickets enter as `backlog`, and the Coordinator moves them to `planned` when they are ready to take. Once status and rank land, the Coordinator picks the next ticket by its clause (the lowest-ranked unblocked planned task of v0.1) and raises a priority with `cland task rank` instead of a label; the board and the panel show the build in status terms. "Release from the item" ships this release item.

## Constraints

- **ADRs.** 0002 (Task tracker: Markdown files are the source of truth, the hub keeps the index): `status`, `rank`, `version` and the container kinds live in the item files and the hub indexes them. 0004 (Agents work on a local git territory): the merge gate does not change. 0001 (Roles are hub-held state delivered as events): the next-item rule and the Implementer's `review` reach sessions through their role clauses. 0006 (The hierarchy is the item tree; leads are hub-held claims on nodes): the tree this epic builds is the one later epics route on.
- **References.** The derived-status rules this field replaces: `nvim/lua/cland/vboard.lua` (`M.status`) on `prototype/panels` and `nvim/lua/cland/graph.lua` (`M.status`) on `prototype/graph`; prototypes are references, never merged. The mockups `ItemsBoard.dc.html` and `Item.dc.html` in `docs/design/main-screen/` give the glyphs and the item header. Where sources disagree, the spec's words win, then a prototype's behaviour, then the mockups (the precedence rule in `docs/design/main-screen/README.md`).
- **Risks** from the sizing: about twenty hub sites and the item parser assume a fixed list of container kinds; setting `ready` by the gate's verdict rules off the merge path, and withdrawing it when a verdict goes stale.
- **The v0 tail.** T-78 (merge, worktree and release checks read the tracker's synchronous view) and T-103 (the tracker's storage queue has no deadline) touch this code. They are not prerequisites: the Coordinator takes one first only if it blocks this epic's work; otherwise they carry `tech-debt` and wait for the v0.1 tail.
- **Order.** First in the hub lane; "A quiet Coordinator", "Criteria that live" and "The task graph" wait for it, and the vertical board of "Workbench basics" reads its fields.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.1 Item hierarchy: a release above epics, §3.2 Item status and order; §3.11 The workbench panels for the board that reads them.
- Map T-81: Notes, "Settled while charting" (board, dogfooding); decisions T-87 and T-88; bug T-80.
- GLOSSARY: Item, Release, Unscheduled, Status, Rank, Claim, Verdict.
- ADRs: `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0001-roles-are-hub-held-state.md`, `docs/adr/0006-the-hierarchy-is-the-item-tree.md`.
- Branches: `prototype/panels` (`vboard.lua`, `rank.lua`), `prototype/graph` (`graph.lua`).
- Mockups: `docs/design/main-screen/ItemsBoard.dc.html`, `Item.dc.html`, `Main.dc.html` (the v0 board); `screens/v01-items-board.png`.

## Comments

### coord · 2026-10-09T21:58:31.890Z

Tickets cut with /to-tickets on 2026-10-09 at 21:57Z, following the epic's tracer-bullet order: T-118 (release item; no blockers), T-119 (levels; T-118), T-120 (status; T-118), T-121 (ready and verifier holds; T-120), T-122 (rank; T-118), T-123 (surfaces; T-119, T-121, T-122). The human's stand-in approved them as filed at 21:59Z. Across lanes, T-128 (T-109's vertical board) is blocked by T-123. T-118 started with impl-118. The migration that creates the v0.1 release runs after T-118 merges and the hub restarts.
