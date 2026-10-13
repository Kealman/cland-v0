---
id: E-270
kind: epic
title: Status, fields and instrumentation
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-269
topic: null
branch: null
created: 2026-10-12T11:35:13.788Z
updated: 2026-10-12T11:35:19.392Z
---

## Goal

The hub derives `planned` from the epic plans, gives the card the fields it needs without a request per row, and records enough about each task to compare models later. Today `planned` is set by hand and goes stale, the explorer prototype made one `task.view` per visible task, and the journal keeps neither session usage nor a task's size, so the v0.1 runs could not rank models (T-255).

## Contents

- **§3.2 Planned derives from the plan**, whole: with a plan, the items of the epic's current stage are `planned` and the rest of the epic stays `backlog`; when the stage completes, the hub moves the next stage to `planned`, as it moves the other statuses on events; without a plan, `planned` is set by hand by the Coordinator or the human, as before; the release scope shows only the release's own items, and other containers and unscheduled items are reached through the `all` filter and the count line at the bottom.
- **The hub's fields for the card** (§3.9, the prototype's answers): the closing time on the item summary; verified/total in the `task.list` summary; the latest `cland verify` result per task; closing an epic closes its plan's stages.
- **§3.12 Per-model task performance: the instrumentation**, whole: session usage in the journal at each `session.usage` publication and at stop (tokens and cost or rate-limit share per session, hence per role and per item); a required `size` field on tasks, an ex-ante size class set by whoever files the ticket, which the skills and the clauses ask for; a `regression_of` link from a task to the task it reworks, set by the author or the Coordinator when filing; the model of every launch, sub-agents included, in the launch record, never empty when the harness knows it; the scope of a review verdict (full, delta, evidence-only) on the verdict record.

Not in this epic: the `request` send kind and the inbox ("Inbox and the events view"); the card that shows these fields ("The explorer and the card"); the account on each session ("Accounts and limits"); the retrospective that reads the records ("Release v0.1.2 from the item"); model rotation, which §3.12 leaves out of this build.

Choices where the spec is silent:

- A stage completes when the hub's stage state says so: its items landed or closed, and its after-stage QA clear where the plan asks for one. On a plan set or changed, the backlog items of the current stage become `planned`. The hub never moves an item back to `backlog`, and a status the Coordinator or the human set by hand stays.
- The closing time is a `closed` field in frontmatter, written by close and by merge and cleared by reopen. The items closed before it existed get theirs once, from the journal's close records and the landing receipts, through `cland task migrate` with its dry run.
- `task.list` summaries carry `criteria` (total, done, verified) and, for a task, `verify`: the latest `cland verify` job for its branch, with its result, head, finish time and artifact; a change sends the usual `task` event.
- The size classes are `XS`, `S`, `M`, `L` and `XL`. `cland task create --kind task` and MCP `task.create` refuse a task without `--size`, naming the classes; `cland task edit --size` changes it; other kinds take no size. When the field lands, the Coordinator backfills the open tasks of the current release and the categories in one pass.
- `regression_of` is a frontmatter field set with `--regression-of T-n` on `create` and `link`, pointing at a landed task; the clauses set it when a ticket reworks landed work.
- A review verdict needs `--scope full|delta|evidence` on `cland task comment --verdict review` and MCP `task.comment`; a QA verdict carries none. The Reviewer clause and the `code-review` skill say which: full for a first review or a reworked design, delta after `dev` moved under a branch already reviewed, evidence for suite evidence alone.
- The usage record is a `session-usage` journal line with the session, its id, role, item, harness, model, the totals and the cost or rate-limit share; a publication equal to the last one writes nothing, and the stop writes the final totals.
- When a launch names no model, the hub records the one the harness reports on its first turn on the launch; a sub-agent's model is recorded where the harness reports one, and recorded as unknown otherwise.
- The skills and the clauses that now ask for `size` also ask for a `## Summary` of one to three sentences (§3.9), so the tickets cut from here on carry one before the card reads it.

## Tracer-bullet order

1. **Planned from the plan.** The hub sets the current stage's backlog items to `planned`, moves the next stage when a stage completes, and closes a plan's stages when its epic closes. Demo: in a scratch project an epic with a two-stage plan shows stage one `planned` and stage two `backlog`, and merging stage one's items turns stage two `planned`.
2. **The release scope.** The items panel at release scope lists only the release's own items, with other containers and unscheduled items under the `all` filter and the count line. Demo: the headless workbench at the current release shows no Tech debt row and no unscheduled fold, and the `all` filter shows both.
3. **The card's fields.** The `closed` time with its backfill, the criteria counts and the latest verify result reach `task.list` and `task.view`. Demo: `cland task list --under T-228 --json` gives each task its `closed`, `criteria` and `verify` without a `task view`.
4. **Size and regressions.** The `size` and `regression_of` fields with their CLI and MCP flags, the refusal of a task without a size, and the skills and clauses that ask for both and for a `## Summary`. Demo: `cland task create "x" --kind task` is refused naming the classes, and `--size S --regression-of T-254` lands both fields in `task view`.
5. **The verdict scope and the launch's model.** Review verdicts carry their scope, and the launch record names the model the harness reports when the launch named none, with sub-agents' models where the harness reports them. Demo: a review verdict without `--scope` is refused, and a fake Claude launch with no model journals the model of its first turn.
6. **Usage in the journal.** `session-usage` records at each changed publication and at stop, on the three adapters. Demo: a fake Codex session's publications and stop leave records whose sums per role and item a `jq` line prints from `cland hub journal --kind session-usage --json`.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake harnesses, QA plans an epic in two stages with `cland task plan set`, reads stage one `planned` and stage two `backlog` in `cland task list`, lands stage one's items and reads stage two `planned`; closing the epic closes its stages in `cland task plan show`. QA files a task without a size and reads the refusal, then files one with a size and a `regression_of`; records a review verdict with and without `--scope`; launches a fake session without a model; and reads the usage, the launch's model and the verdict's scope back from `cland hub journal --json`. On `dev`, `cland task list --under T-228 --json` carries the closing times, the criteria counts and the latest verify results, and the headless workbench at release scope shows only the release's own items.

- [ ] With a plan, the current stage's items are `planned` and the rest `backlog`, and the hub moves the next stage when a stage completes; without a plan, `planned` is set by hand as before.
- [ ] The items panel at release scope shows only the release's own items; other containers and unscheduled items are under the `all` filter and the count line.
- [ ] `task.list` summaries carry the closing time, verified/total and a task's latest `cland verify` result; closing an epic closes its plan's stages.
- [ ] Tasks carry a required `size` (`XS` to `XL`) and an optional `regression_of` through the CLI and MCP; the skills and clauses ask for the size and a `## Summary`.
- [ ] Review verdicts record their scope (full, delta, evidence); the launch record names the model for every launch where the harness knows it, sub-agents included.
- [ ] The journal holds a `session-usage` record for each changed publication and one at stop, on all three adapters.
- [ ] `hub/README.md`, `docs/agents/issue-tracker.md`, `docs/review-and-qa.md`, the role clauses and the `to-tickets`, `plan-epic` and `code-review` skills describe the fields and the records.

## Dogfooding

The build's own epics run on plans, so from this epic on `planned` in the panels and on the board follows those plans instead of the Coordinator's hand. The Coordinator backfills the size of the open tasks when the field lands, and every ticket cut after it carries a size, a `## Summary` and, where it reworks landed work, a `regression_of`; the run's usage, models and verdict scopes collect in the journal for the retrospective of "Release v0.1.2 from the item".

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **ADRs.** 0002 (Tracker files are the source of truth): `size`, `regression_of` and `closed` live in the item files. 0007 (Events reach sessions as deliveries): the status moves reach sessions as the `task` events they already subscribe to.
- **Risks.** Status moves from the plan must not fight the gate's `ready` or a hand edit, which is why only `backlog` items move. The journal grows with usage records, which is why equal publications write nothing. A required size must not touch the kinds that have none.
- **References.** `docs/research/model-performance.md` on `research/model-performance` (section 7, the gaps; section 8, the metric set) with `extract.py`; `nvim/EXPLORER-PROTOTYPE.md` on `prototype/explorer` (points 13 to 17: the data the card needs from the hub).
- **Order.** Third in the hub lane, after "Prefixes and categories"; "Remote executors" waits for it, and "The explorer and the card" reads its fields.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.2 Planned derives from the plan, §3.9 (the prototype's answers: the hub's fields), §3.12 Per-model task performance.
- Tickets: T-238 and T-255 (decided, closed into this epic); T-262 (the prototype that named the fields).
- GLOSSARY: Status, Plan, Stage, Verdict, Criterion.
- ADRs: `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0007-events-reach-sessions-as-deliveries.md`.
- Branches: `research/model-performance`, `prototype/explorer`.
- Mockups: `docs/design/main-screen/CardTask.dc.html`, `CardEpic.dc.html` (where the fields show).
