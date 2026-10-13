---
id: T-317
kind: task
title: "Agents file into categories: the clauses and the qa, triage and to-tickets skills file with --parent C-n, and idle_from in crew.toml feeds the Coordinator's idle-work rule"
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-269
blocked_by:
  - T-315
topic: topic-198
branch: t/T-317-agents-file-into-categories-the-clauses
created: 2026-10-13T02:27:23.273Z
updated: 2026-10-13T11:45:10.956Z
---

## Summary

The crew learns to use categories. The role clauses and the `qa`, `triage` and `to-tickets` skills say when an item goes into a category with `--parent C-n`: a bug found aside, tech debt, a follow-up. `idle_from` in `crew.toml` names the categories the Coordinator takes work from when the release has nothing unblocked, and an empty list means never.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.10 (Agents, Idle work). Decided in T-245. ADR 0006: the Coordinator leads the categories.

## What to build

**`idle_from` in `crew.toml`.** A top-level list of item ids with any kind prefix: `idle_from = ["C-216"]`. The default is `[]`.

- `parseCrew` and `renderCrew` in `hub/src/crew.ts` read and write it. It is rendered before the `[crew.*]` tables, as TOML needs for a top-level key. `crewSummary` shows it, for example `idle: C-216 Tech debt`, or `idle: never`.
- Ids are stored in their canonical form. A duplicate id is refused.
- **Validation needs the tracker.** `crew.set` (`hub/src/hub/dispatch.ts` near line 1325) checks each id against the open categories before it calls `CrewFile.set`. An id that names no item, an item that is not a category, or a closed category is refused with its reason.
- A hand edit of the file is checked on reload. An entry that names no open category is kept in the file, ignored by the rule and listed by `cland crew show` with its reason. The rest of the file stays in force.
- `cland crew set idle_from C-216` sets a list of one. A TOML list sets several, and `'[]'` empties it. `cland crew show` and `--json` show it. The usage line in `hub/src/cli/crew.ts` names the key.

**The Coordinator's idle-work rule.** The rule lives in two places.

- **The staffing lines.** `staffingClause` in `hub/src/roles/clause.ts` appends the named categories to the Coordinator's clause, in order and with titles, or says that `idle_from` is empty and category work is never taken. The hub delivers the clause again when `crew.toml` changes, so a new list needs no relaunch.
- **The base clause.** The Coordinator's clause in `hub/src/roles/default-roles.ts` states the rule. When the current release has no unblocked task, take the lowest-ranked open, unblocked task of the first category named by `idle_from` that has one. An epic in a category waits for promotion. With an empty `idle_from`, never take category work.
- The same clause names the current release as the open item of the release kind, the first kind of the first level, instead of `tracker.levels[0]`.

**Filing into categories.** Only the Coordinator and an Aide hold `task.create` and `task.link`. No role gains a tool.

- The Coordinator's and the Aide's clauses say where an item goes: a bug found aside into Bugs, tech debt into Tech debt, a follow-up of merged work into Follow-ups, an idea into Ideas, each with `--parent C-<n>`. They find the numbers with `cland task list --kind category`. No clause hard-codes a number. The `tech-debt` label is not used any more.
- The Lead's, the Implementer's, the Reviewer's and QA's clauses say to report such a find to the lead with the category it belongs in, instead of leaving it in prose.
- The Lead's clause names the Coordinator's merges as merges outside any Lead's subtree, categories and unscheduled items, instead of "unscheduled merges".

**This project's clauses.** cland never rewrites an existing `.cland/roles.toml`. Make the same clause changes in this repo's `.cland/roles.toml` beside `default-roles.ts`.

**The skills.**

- `qa` (`.agents/skills/qa/SKILL.md`, cland's own): a finding outside the item under test is a bug found aside. The Coordinator files it into Bugs with `--parent C-<n>`, still labelled `qa-found` and `needs-triage`.
- `triage` and `to-tickets` are vendored. Patch them minimally so they defer to the tracker doc's new "Categories" section, and record each patch in `skills/PATCHES.md` with the upstream hash. In `triage`, an item with no release or epic is categorised by its category container. Its `bug` and `enhancement` category roles stay labels. In `to-tickets`, tickets from a source with no release or epic go into the category the tracker doc names.
- `docs/agents/issue-tracker.md` and its template `skills/templates/docs/agents/issue-tracker.md` gain a "Categories" section. It covers listing the categories, filing with `--parent C-<n>`, when each of the four applies, the retired `tech-debt` label, `idle_from`, and promotion as a message to the Coordinator. `docs/agents/triage-labels.md` and its template say that `bug` work goes into Bugs.

**Relaunch.** This ticket changes the Coordinator's default clause in `default-roles.ts` and in `.cland/roles.toml`. The Coordinator relaunches after the merge to take it up.

**Demo** (the epic's words). `cland crew set idle_from C-216` shows in `cland crew show`, and the Coordinator's clause states the idle-work rule.

**Out of scope.** Any hub logic that picks the next item: the rule is the Coordinator's to follow. The explorer's "idle work" mark (T-276). Running the migration (T-316). New tool grants.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293). The reload check of `idle_from` reads the index once per reload, never per event.
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. Crew tests parse and render `idle_from`, keep it before the tables and default it to `[]`. `cland crew set idle_from C-216` on a temporary project with a real hub shows `C-216` in `cland crew show` and `--json`, and `'[]'` empties it.
  - done: impl-317 · 2026-10-13T09:22:14.370Z
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-2 · 2026-10-13T10:36:16.783Z · commit 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-3 · 2026-10-13T10:47:08.739Z · commit 243bec40091bcb9e398f37b9138dbb2c19ab7eca
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-4 · 2026-10-13T11:19:31.631Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
  - verified: rev-26 [reviewer] · run rev-20261013-317-final · 2026-10-13T11:45:10.956Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
- [x] C2. `crew set` refuses an unknown id, a task, a closed category and a duplicate, each with its reason. A hand-edited entry naming a closed category is listed as ignored by `cland crew show`, and the rest of the file stays in force.
  - done: impl-317 · 2026-10-13T10:14:09.700Z
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-2 · 2026-10-13T10:36:16.783Z · commit 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-3 · 2026-10-13T10:47:08.739Z · commit 243bec40091bcb9e398f37b9138dbb2c19ab7eca
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-4 · 2026-10-13T11:19:31.631Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
  - verified: rev-26 [reviewer] · run rev-20261013-317-final · 2026-10-13T11:45:10.956Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
- [x] C3. A hub test reads the Coordinator's clause delivery after `crew set idle_from`: the staffing lines name the categories in order. With `[]`, they say category work is never taken.
  - done: impl-317 · 2026-10-13T09:22:18.547Z
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-2 · 2026-10-13T10:36:16.783Z · commit 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-3 · 2026-10-13T10:47:08.739Z · commit 243bec40091bcb9e398f37b9138dbb2c19ab7eca
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-4 · 2026-10-13T11:19:31.631Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
  - verified: rev-26 [reviewer] · run rev-20261013-317-final · 2026-10-13T11:45:10.956Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
- [x] C4. The default Coordinator clause states the idle-work rule, the epic-waits-for-promotion rule and the filing rule. The other roles' clauses state the report rule. The roles snapshot tests (`hub/test/roles-snapshot.test.ts`, `hub/test/roles.test.ts`) pin the new text, and this repo's `.cland/roles.toml` carries the same changes.
  - done: impl-317 · 2026-10-13T09:22:19.344Z
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-2 · 2026-10-13T10:36:16.784Z · commit 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-3 · 2026-10-13T10:47:08.739Z · commit 243bec40091bcb9e398f37b9138dbb2c19ab7eca
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-4 · 2026-10-13T11:19:31.631Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
  - verified: rev-26 [reviewer] · run rev-20261013-317-final · 2026-10-13T11:45:10.956Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
- [x] C5. The `qa`, `triage` and `to-tickets` skills and the tracker doc describe filing with `--parent C-<n>`. `hub/test/skills-tracker.test.ts` and `hub/test/skills-qa.test.ts` pass with the new text, and `skills/PATCHES.md` records the two vendored patches.
  - done: impl-317 · 2026-10-13T09:22:19.989Z
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-2 · 2026-10-13T10:36:16.784Z · commit 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-3 · 2026-10-13T10:47:08.739Z · commit 243bec40091bcb9e398f37b9138dbb2c19ab7eca
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-4 · 2026-10-13T11:19:31.631Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
  - verified: rev-26 [reviewer] · run rev-20261013-317-final · 2026-10-13T11:45:10.956Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
- [x] C6. `hub/README.md`'s crew staffing section describes `idle_from`, its validation and the staffing line.
  - done: impl-317 · 2026-10-13T09:22:20.480Z
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-2 · 2026-10-13T10:36:16.784Z · commit 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-3 · 2026-10-13T10:47:08.740Z · commit 243bec40091bcb9e398f37b9138dbb2c19ab7eca
  - verified: rev-26 [reviewer] · run rev-20261013-317-source-4 · 2026-10-13T11:19:31.631Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e
  - verified: rev-26 [reviewer] · run rev-20261013-317-final · 2026-10-13T11:45:10.956Z · commit 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e

## Comments

### impl-317 · 2026-10-13T09:09:54.548Z

Implementing the agreed CLI/frame, crew parser/render and clause snapshot seams from C1–C6. No tool grants or item-selection hub logic. The Coordinator must relaunch after this merges to take up the changed base clause; later idle_from edits refresh staffing lines live.

### rev-26 · 2026-10-13T10:11:58.591Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-317-1
commit: 32c046f7cf55150a5255594f811a99afda31b94d

Medium: hub/src/crew.ts:49–50 — direct item.kind comparisons to literal category violate the configured-container-kind architectural guard. A-1891 fails tracker-container-source.test.ts:129 on exactly those lines; use the repository's configured-kind semantics while keeping the guard intact. Typecheck green; hub1460/1461 with1fail; Neovim not started. No other outstanding high/medium finding from source/doc assessment, but A-1879's interim source-clear conclusion is superseded; I missed this restriction. Final evidence artifact posted in topic-198. Renew review/full verification at corrected head; Coordinator relaunch after merge still required.

Criteria: C2 failed (Category validation in crew.ts:49–50 hardcodes compiler-typed container kind; A-1891 architectural guard fails, so full verification is not green.).

### impl-317 · 2026-10-13T10:14:09.287Z

Fixed the full-suite architecture failure by resolving category kind from the configured non-release C root, keeping the typed-kind guard intact. Added real-hub coverage with a docs root ahead of category. Guard tests 3/3 and configured-root case pass. Current origin/dev merged; shared stage restart readiness fix 2c0f43d cherry-picked unchanged as 13fd3c2. New pushed head 5cb7c84; requesting review and full verification again.

### rev-26 · 2026-10-13T10:36:16.784Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-317-source-2
commit: 5cb7c84ed56f1814b80d9626ce0e02e7fbd21624

Source review under D25: no high/medium finding remains. C1–C6 checked: canonical ordered idle list, semantic set/refusal and hand reload, real-spoke clause refresh, default/project idle and category reporting/filling rules with unchanged grants, minimal vendored patches/templates and README. C2 typed-kind architectural violation resolved by configured non-release C-root selection with unchanged guard and added docs-before-category real-hub case. Shared2c0f43d unchanged separately reviewed. A-1879/A-1895 and source verdict artifact record evidence. D25 requires clear source before full verification; already queued5c53298c keeps its place and its accepted exact-head result remains required before merge. No full green result claimed here. Coordinator relaunch after merge required.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-317 · 2026-10-13T10:45:48.159Z

Shared test-only commit b5b67ad covers T-292's plan startup race. Deterministic delayed-hub.status replay reproduced the exact qa-schema-2 timeout before and passed after; three whole-file runs passed 33/33 with unchanged assertions/timeouts. A-1908 records the diagnosis. Current dev merged into pushed head 243bec40091bcb9e398f37b9138dbb2c19ab7eca. Requesting rev-26 review of standalone b5b67ad plus the new full head; verification waits for T-321's slot end.

### rev-26 · 2026-10-13T10:47:08.740Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-317-source-3
commit: 243bec40091bcb9e398f37b9138dbb2c19ab7eca

Source review under D25: no high/medium finding remains. Shared b5b67ad reviewed alone: nvim/test/plan.test.ts:61 waits for the same plan.owner state that plan.lua:106 requires before navigation; :189 waits for the fetched source body before mutation. Assertions, skips and existing timeout values unchanged; navigation issued once. Prior T-317 implementation and C1–C6 evidence unchanged at this head; Coordinator-only tracker/D25 spec integration checked. A-1909 records Standards and Spec assessment. A-1904 remains an earlier-head failed full result; accepted exact-head green cland verify all remains required before merge, after T-321's protected slot ends. Product early-navigation behavior tracked separately T-323, not certified fixed. Coordinator relaunch after eventual merge required.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-26 · 2026-10-13T11:19:31.631Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-317-source-4
commit: 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e

Source review under D25: no high/medium finding. C1–C6 renewed; T-317 hub implementation/tests, clauses, skills/templates and shared plan readiness patch unchanged since A-1909. Integration is landed T-318 category-count/navigation/prefix UI changes plus tracker records; Neovim bytes match previously assessed integration A-1916 with rev-23 clear/full A-1913 evidence. git diff --check clean. Accepted full green cland verify and final verdict at this exact head remain required before merge; earlier A-1904 failure retained. Follow machine order; Coordinator relaunch after merge required. Artifact records Standards/Spec assessment.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-317 · 2026-10-13T11:44:31.655Z

Full verification 0727532c-1622-403c-87db-d17c5512fd19 passed at exact source-reviewed head 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e: typecheck green, hub + Neovim 1774/1774, no skipped/cancelled tests. Durable log A-1924. Shared plan barrier b5b67ad is included and passes in the full run. Awaiting final Reviewer acceptance before Coordinator merge; Coordinator relaunch afterward remains required.

### coord · 2026-10-13T11:44:35.472Z

Merged f174d9c59b2a3198215b8e43b4f24d8ce25cd7bf onto dev.

### rev-26 · 2026-10-13T11:45:10.956Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-317-final
commit: 1daf9c4d5f0e4c2b77d62aba969b6d7db59fc24e

Final review: no high/medium finding. C1–C6 checked/current at unchanged reviewed 1daf9c4. A-1924 accepted post-source-verdict full run0727532c passes typecheck and1774/1774: free36, machine1426, Neovim312, zero fail/cancel/skip/todo. Read raw log including previously failing mid-way plan case, default/project clauses and idle_from coverage; local/origin refs matched head before closure. A-1920 source and final artifact record evidence. Shared barriers preserve assertions/bounds; product raceT-323 remains separately tracked. Topic closed during recording; report goes to Coordinator. Coordinator relaunch after merge required.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
