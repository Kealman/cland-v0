---
id: E-112
kind: epic
title: "Criteria that live"
state: closed
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: R-130
blocked_by:
  - E-107
topic: topic-97
branch: null
created: 2026-10-09T21:51:33.968Z
updated: 2026-10-10T17:09:55.398Z
---

## Goal

Acceptance criteria get stable ids and marks that the hub writes, and the merge gate refuses an item until every criterion is done and verified. The human sees in the item view which criteria are open, done, verified or failed and by whom, and a verified/total fraction on every task in work. Today criteria are loose checkboxes that the gate ignores, and nothing records who checked what.

## Contents

- **§3.4 Acceptance criteria that live**: criteria under `## Acceptance criteria` with stable ids and marks the hub writes (done, verified, failed with a note), returned as `criteria` by `task view --json`; verification on its own or inside a verdict; a merge gate that refuses until every criterion is done and verified; glyphs in the item view and verified/total on rows and cards; old checkboxes read as criteria and given ids on first touch.
- **Around it**: `ready` (§3.2) waits for the criteria as the gate does; subscribers get the "criterion marked" task event (§3.9); a verdict's message in the thread lists the criteria it marked, as the thread mockup shows.

Not in this epic: criteria that a plan marks for QA, which only QA may verify (§3.10): "The epic plan".

Choices where the spec is silent:

- An item with no criteria passes the criteria check, since there is nothing to refuse; tickets keep being written with criteria.
- The tool's other operations (add, edit, remove, done, fail) follow the shape the spec gives for `task.criterion verify`, and the CLI mirrors them as `cland task criterion`.
- An Aide's rights here arrive with whichever of this epic and "The human's own session" lands second.

## Tracer-bullet order

1. **Criteria in the view.** The hub parses `## Acceptance criteria` and returns `criteria` in `task view --json` and `task.view`; old checkboxes read as criteria without marks; hand edits keep ids and marks. Demo: `cland task view T-n --json | jq .item.criteria` lists C1 to C4 for a v0.1 ticket.
2. **Marks the hub writes.** `task.criterion` and `cland task criterion` for done, verify and fail, each limited to the parties §3.4 names; the hub writes the sub-items and the checkbox; ids assigned at the first touch and never reused; a failure returns the task to `in progress`; the `task` event "criterion marked". Demo: the Implementer marks C1 done and the item file shows the mark under C1.
3. **Verdicts verify.** `--verified` with ids or `all` on a verdict; the Reviewer and QA clauses and the `code-review` and `qa` skills verify by id and fail with a note. Demo: a clear review with `--verified all` marks every criterion verified.
4. **The gate and ready.** `cland merge` refuses while a criterion is not done or not verified and names them; `ready` waits for the same; items in flight migrate without being stranded. Demo: a merge refused for C3, then accepted after the fix and a new verification.
5. **Criteria on screen.** The item view's glyphs and marks; verified/total on the vertical board's rows and the board's cards, replacing the checkbox count; add, edit and remove from the item view for the human; a verdict's criteria in the thread. Demo: the board row reads 3/4, then 4/4 in green.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human opens a v0.1 ticket's item view: four criteria, all ○. The Implementer marks them done (◐); the Reviewer's clear verdict with `--verified all` turns them ●, and the board row shows 4/4 in green. QA then fails C3 with a note: the task returns to in progress and C3 shows ✗ with the note. `cland merge` refuses and names C3; after the fix and a new verification the merge goes through.

- [ ] `task view --json` returns `criteria` with ids and marks; old checkboxes read as criteria; hand edits keep the ids and marks.
- [ ] Each mark can be set only by the parties §3.4 names; `failed` removes `done`, carries a note and returns the task to `in progress`.
- [ ] Verdicts take `--verified` with ids or `all`.
- [ ] The merge gate refuses while any criterion is not done or not verified, and names those criteria; `ready` waits for the same.
- [ ] A removed criterion's id is never reused.
- [ ] The item view shows the glyphs and marks; panel rows and board cards show verified/total for tasks in work.
- [ ] Subscribers receive "criterion marked" task events.
- [ ] `hub/README.md`, `docs/review-and-qa.md`, `docs/agents/issue-tracker.md` and the Reviewer and QA clauses describe criteria and their marks.

## Dogfooding

From this epic on, the build's tickets carry structured criteria, Reviewers and QA verify them by id, and the gate enforces them for the items of every later epic. The human reads progress on the board as verified/total, and an item lead (after "A quiet Coordinator") marks its own criteria done before it asks for review.

## Constraints

- **ADRs.** 0002 (Task tracker: Markdown files are the source of truth, the hub keeps the index): the criteria stay in the item file, the hub writes the marks there and re-indexes hand edits. 0004 (Agents work on a local git territory): the merge gate grows a check but keeps its verdict rules. 0001 (Roles are hub-held state delivered as events): the Reviewer and QA clauses carry the new verdict shape.
- **Risks** from the sizing: the hub rewriting a body section that people also edit by hand, where ids and marks must survive; a stricter gate for every item in flight.
- **References.** The mockups `Thread.dc.html` (criteria marks under a verdict, "4 of 4 verified"), `ItemsBoard.dc.html` (the fraction on a row) and `Item.dc.html` (the item view's layout) in `docs/design/main-screen/`; `prototype/panels` and `prototype/graph` count checkboxes as their stand-in for the fraction. Where they disagree, the spec's words win.
- **The v0 tail.** T-78 (merge, worktree and release checks read the tracker's synchronous view) and T-103 (the tracker's storage queue has no deadline) touch this code. Neither is a prerequisite: the Coordinator takes one first only if it blocks this work; otherwise they carry `tech-debt`.
- **Order.** Third in the hub lane, after "A quiet Coordinator"; it waits only for "v0.1 release and status". "Leads and the crew" waits for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the CLI also runs against item files edited by hand, to prove that ids and marks survive.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.4 Acceptance criteria that live; §3.2 (ready), §3.9 (task events), §3.10 (criteria a plan marks for QA).
- Map T-81: decision T-93.
- GLOSSARY: Criterion, Verdict, Status, Claim, Aide.
- ADRs: `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0001-roles-are-hub-held-state.md`.
- Branches: `prototype/panels`, `prototype/graph` (the checkbox stand-ins).
- Mockups: `docs/design/main-screen/Thread.dc.html`, `ItemsBoard.dc.html`, `Item.dc.html`.

## Comments

### qa-15 · 2026-10-10T17:09:41.987Z

verdict: qa
result: clear
by: qa-15 [qa]
run: qa-2026-10-10-15-112-c
commit: fb12e904d95c0abe7e3aa14dc26503cbb3bee196

| Case | Surface | Result | Observation / evidence |
| --- | --- | --- | --- |
| ITEMS-001 | headless-grid | PASS | Item smoke. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112/ITEMS-001.screen.txt) |
| ITEMS-002 | headless-grid | PASS | 80/120-column glyphs, refresh and green fractions. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112/ITEMS-002.screen.txt) |
| M1 | hub-api | PASS | Legacy null IDs; first write assigns IDs; hand edit preserves exact done mark; fourth criterion gets C4 on touch. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-c/M1.txt) |
| M2 | headless-grid | PASS | Four unmarked criteria display ○ and 0/4. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M2.txt) |
| M3 | hub-api | PASS | Claimant done accepted; Implementer verify and Reviewer done refused. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M3.txt) |
| M4 | hub-api | PASS | Reviewer --verified all accepted; C99 refused; ● and 4/4. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M4.txt) |
| M5 | hub-api | PASS | QA failure clears done and verification; in progress; ✗ and note. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M5.txt) |
| M6 | hub-api | PASS | Merge refused naming C3; ready absent. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M6.txt) |
| M7 | hub-api | PASS | Done and fresh verification restore ready; merge succeeds. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M7.txt) |
| M8 | hub-api | PASS | Removed C2 not reused; C5 survives restart; next allocation C6. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M8.txt) |
| M9 | headless-grid | PASS | Item glyphs and panel/board 0/4, 4/4, 3/4, 4/4 captured. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M9.txt) |
| M10 | hub-api | PASS | Subscriber receives criterion marked done/verified per C1–C4, plus C3 failed. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M10.txt) |
| M11 | hub-api | PASS | Four required docs describe criteria and marks. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-112/qa-2026-10-10-15-112-b/M11.txt) |

No outstanding high, medium, or low findings.

Resolved low-severity brief defect: original M1 expected legacy reads to allocate IDs. The command `task view T-1 --json` returned four `id:null` values after a hand edit, as documented. Coordinator corrected the brief in T-200 at fb12e90; corrected M1 passed. The original failing record remains in qa-2026-10-10-15-112/M1.txt.

Execution: catalogue cases ran through `CLAND="$PWD/hub/bin/cland.ts" sh .agents/skills/qa/qa-record.sh run T-112 qa-2026-10-10-15-112 ITEMS-001` and ITEMS-002. Manual lifecycle ran with `QA_SUFFIX=-b QA_ONLY=M2,M3,M4,M5,M6,M7,M8,M9,M10,M11 node .cland/qa/epic-demo-qa15/t112.mjs`; corrected M1 with `QA_SUFFIX=-c node .cland/qa/epic-demo-qa15/t112-m1.mjs`. Every case has a qa-record line. Scratch hubs used actual assigned fixture roles, a local territory branch and a real headless Neovim driven through nvim_input with screenstring captures; no model session was required. Scratch hubs stopped after completion.

The initial manual driver left its task unscheduled inside a collapsed UI fold, causing panel waits to fail. Those records remain; the fresh -b lifecycle places its task under an open release/epic, and all M2–M11 checks pass. No product change was made.

Build: qa-2026-10-10-15-112-c M1 ran at fb12e904d95c0abe7e3aa14dc26503cbb3bee196. Catalogue and -b passes ran at 21a57ac4b75ae0560cf20ff39f99a1bf000cbb83. The only difference is the M1 brief correction; product code is identical. Root branch was dev, with tracked modifications confined to .cland/ as the brief permits. Carry-forward follows Coordinator's request in topic-97.

Criteria map: C1 M1; C2 M2/M3/M5; C3 M4; C4 M5/M6/M7; C5 M8; C6 ITEMS-002/M9; C7 M10; C8 M11. Epic criteria marks are textual under brief 6a pending T-196.

verified: C1,C2,C3,C4,C5,C6,C7,C8
failed: none
deferred to the T-117 walkthrough: none

verdict: qa
result: clear
run: qa-2026-10-10-15-112-c
commit: fb12e904d95c0abe7e3aa14dc26503cbb3bee196

Full report artifact: A-686, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-686-t-112-qa-clear-criteria-lifecycle-and-corrected-legacy-id-check.md
