---
id: T-340
kind: task
title: Sweep the Neovim tests for actions before their snapshots land (four flakes of one class on 2026-10-13)
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-212
branch: t/T-340-sweep-the-neovim-tests-for-actions
created: 2026-10-13T19:12:35.068Z
updated: 2026-10-13T20:24:57.775Z
closed: 2026-10-13T20:24:57.775Z
---

## Summary

Four Neovim test flakes on 2026-10-13 had one cause: a test pressed keys before the snapshot or state those keys need had landed. They were fixed one per failed full run, with shared commits b5b67ad (plan view, T-292), 7210621 (palette, T-301) and 7d9bb4d (shell reconnect), plus a fourth in T-331's run ("r gives a free ask answer…"). Each cost a full run of about 14 minutes. Sweep the Neovim tests once for the class.

## What to build

- Find every test in `nvim/test/` that sends keys or commands right after connect or reconnect, or right after a frame that triggers a snapshot, without waiting for the state the keys act on. Waiting only for the connection does not count.
- Give each one a readiness wait on the state it reads: the task and tracker snapshots, the rendered heading, or the plan owner, using the existing helpers. Keep every assertion, and add no sleep, retry or longer timeout.
- A test helper for "after connect, the initial snapshots have landed" is fine, kept out of hub/test/harness.ts.
- Prove the class with a delayed hub.status and task.list replay over the whole Neovim suite: it passes after the sweep.

## Acceptance criteria

- [x] C1. Every Neovim test that acts after connect or reconnect waits for its readiness state, listed in the item.
  - done: impl-340 · 2026-10-13T19:40:26.752Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-340-2 · 2026-10-13T19:41:57.305Z · commit b03c4bb1f074497d3ddf2c2dae354949170d66d4
  - verified: rev-23 [reviewer] · run rev-2026-10-13-340-3 · 2026-10-13T20:24:49.110Z · commit b03c4bb1f074497d3ddf2c2dae354949170d66d4
- [x] C2. The Neovim suite passes under a delayed initial-snapshot replay, and passes normally.
  - done: impl-340 · 2026-10-13T20:24:41.533Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-340-3 · 2026-10-13T20:24:49.110Z · commit b03c4bb1f074497d3ddf2c2dae354949170d66d4
- [x] C3. No assertion is weakened, no timeout raised, and no retry added. `cland verify` is green.
  - done: impl-340 · 2026-10-13T20:24:41.814Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-340-3 · 2026-10-13T20:24:49.110Z · commit b03c4bb1f074497d3ddf2c2dae354949170d66d4

## Comments

### impl-340 · 2026-10-13T19:23:51.561Z

T-340 readiness audit (2026-10-13)

Read all 30 nvim/test/*.test.ts files, the harness/stub/RPC helpers, Lua layout/QA fixtures and key logger. Read shared commits b5b67ad, 7210621, 7d9bb4d and 7fd169d, and T-323. Test fixes leave the product's early-navigation behavior to T-323.

New startup barrier: nvim/test/readiness.ts waits for connection, completion of inbox loading, and the initial hub.status, task.list, topic.list, session.list and artifact.list journals. It does not issue requests or resend actions. Empty lists count as loaded. A fixture with no inbox can keep its existing refusal. Topic history/details need their own state waits.

Audit matrix:
- agents-filters.test.ts: both tests now settle startup before item/session completion and log filters.
- artifact-browser.test.ts: shared connected sites settle artifact/topic snapshots before browser actions; the attachment/ask case additionally waits for "Choose the next path" before selecting the thread row.
- artifacts.test.ts: every client settles initial lists before log/list/picker/open/fold actions. Existing thread history/fold-ready and moved-source waits remain.
- client.test.ts: existing empty General thread/cleared connection notice guards composer sends, including reconnect. Runtime-path checks do not act on snapshots. No change.
- crew.test.ts: settle startup before panel key and crew edits.
- criteria.test.ts: three clients settle task/tracker snapshots before item navigation and criterion keys.
- events-quiet.test.ts: five initial/cold starts settle snapshots before events/subject navigation. Existing first-page/rendered-row waits remain.
- events.test.ts: both clients settle subjects before Enter/gi/gt/gs navigation.
- graph.test.ts: shared start settles task/tracker lists before graph keys and commands; existing configured-level, node, stage and live-update waits remain.
- graph-layout.test.ts: offline layout Lua, no hub snapshots or input action. No change.
- inbox-actions.test.ts: "Answer me" gets a rendered row wait before selection. "Give an answer" is already fixed by 7fd169d and folded into this branch. The panel/full case waits on four sections before selecting rows.
- inbox-requests.test.ts: already waits on authoritative count and inbox header before updates/actions; no data-selection key before readiness. No change.
- inbox-sections.test.ts: startup settles tracker/tasks before plan approval navigation; rendered row/fold waits remain.
- item-prefixes.test.ts: both legacy/migrated-reference cases settle task/tracker snapshots before gi or direct canonical item navigation.
- items.test.ts: four clients settle task/tracker lists before panel filters, folds and item commands.
- layers.test.ts: shared stub startup settles initial lists before layers/folds/plan commands. Cold-start selection already waits on mute/pin rows. Real-hub warning test waits on the resulting inbox/events rows before action.
- needs-you.test.ts: existing authoritative count plus inbox header checks guard actions; topic panel opens without selecting a data row. No change.
- nvim-path.test.ts: launcher/binary discovery, no workbench snapshot actions. No change.
- palette.test.ts: shared startup settles lists before item/session/topic/ask selection and palette mark inspection. Keep 7210621's item/ladder wait.
- plan.test.ts: real-hub setup settles task/tracker lists before its initial item command. Stub and reconnect commands retain b5b67ad's plan-owner waits and detail fence readiness.
- qa.test.ts: QA-runner process tests and dump; case state waits below. Dump checks grid/connection, no snapshot-selected action. No change.
- session-archive.test.ts: settle startup before stopped-row search/archive and counts. Preserve more-count, archive result and live row waits.
- session-resume.test.ts: wait for stopped heading before zR; after refresh wait for old.live=false before r, retaining the existing stopped-screen assertion. Other actions wait on outcome/confirmation.
- sessions.test.ts: settle startup before launcher defaults. Hold-column test already waits on verifier rows; launched/dead/stopped actions retain their state/screen waits.
- shell.test.ts: shared start settles startup before all ordinary fixture actions. The overlapping-delayed-snapshot test explicitly opts out because it intentionally acts on live events before releasing its initial snapshots; its waitSnapshot, live-row and pending-drain guards remain. Reconnect unscheduled search retains 7d9bb4d's heading wait. Other reconnects wait on changed chip/role/langmap/body/card. Controlled refresh/release cases already wait on pending drain before selecting fresh rows.
- thread.test.ts: shared start settles lists; ordinary fixtures also wait for initial topic.history completion before thread instrumentation/actions. Cases intentionally holding topic.history retain explicit release/state guards and skip only that history barrier.
- ui.test.ts: shared startup settles lists before preference/filter/scope/focus mutations. Existing local geometry/debounce timing tests are preserved.
- vboard.test.ts: shared start settles task/tracker snapshots before filters/scopes/rank/select. Keep event-state and rank-request/release barriers.
- verification-queue.test.ts: existing verification snapshot wait, pushed-queue waits and deliberately held refresh barriers guard all actions. No change.
- verification-view.test.ts: existing initial summary plus subsequent pushed holder/queue waits guard all keys. No change.

Lua/helpers:
- qa-cases LABELS-001 waits for two fixture items before item navigation; ROLES-001 waits for role defaults before launcher keys; STATE-001 waits on sessions then inbox ask section before search, and the final item/ask state. Key-chunk cases act on local composer/mapping readiness after connect; failure/timeout/error cases intentionally exercise missing/invalid state. graph-layout.lua and graph-layout-demo.lua are offline. RPC/fakes/JSON are transport/layout data, not action callers.
- No edits to hub/test/harness.ts or production code.
- No assertions removed, test timeout values raised, sleeps or action retries added. The only added timer is the requested stub snapshot replay delay.

Controlled evidence:
- Without the added startup wait, legacy-reference gi under 1000 ms initial hub.status/task.list delay fails at the unchanged canonical epic screen bound, leaving T-107 open.
- With the wait restored, the full item-prefixes file passes 2/2 with the same 1000 ms replay delay.
- graph.test.ts passes 15/15 with 350 ms delay.
- Neovim TypeScript check passes.

C2 remaining: Coordinator-authorized sequential sweep of every test file with delay, only when verify queue has no holder/waiters; stop on admission and resume afterward. Normal full validation stays cland verify all after clear source review.

### rev-23 · 2026-10-13T19:37:16.847Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-340-1
commit: e86410a47b090fd28dc0f72e60d3bd9f15ba555b

Medium — nvim/test/readiness.ts:15: only snapshot journals/inbox are checked, leaving role.list pending while shell.test.ts:808 selects reviewer; launcher.lua:74 records the role without defaults and will not refill merely on late role-state arrival. C1 failed; C2/C3 remain pending complete delayed replay and exact-head cland verify. Other source checks found no assertion weakening, timeout increase or action retry. Evidence A-2044: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2044-t-340-source-review-startup-role-readiness-gap.md.

Criteria: C1 failed (Ordinary startup does not wait for plain role.list; launcher actions can select a role before its defaults land.).

### impl-340 · 2026-10-13T19:40:26.720Z

T-340 review correction: role readiness

Head: b03c4bb1f074497d3ddf2c2dae354949170d66d4; base origin/dev cb5f71af.

The startup helper now additionally waits for the configured role state. role.list is a plain request rather than a snapshot journal, and the launcher reads its defaults when the role is selected. Ordinary fixtures all configure at least one role; task/topic/session/artifact lists can still be empty. Deliberate held snapshot and history cases are unchanged.

Controlled feedback loop: CLAND_STUB_ROLE_DELAY_MS=1000 node --test --test-name-pattern='the launcher: ␣l opens' nvim/test/shell.test.ts.
- Before the role-state guard: 0/1 passed, exact existing reviewer-defaults screen assertion fails after 10000 ms (no Codex/model/effort prefill).
- After the guard: 1/1 passed, 2098.8 ms total.
- Full palette file with CLAND_STUB_SNAPSHOT_DELAY_MS=1000 CLAND_STUB_ROLE_DELAY_MS=1000: 18/18 passed, including the configured single-Aide role/prefill case.
- Neovim TypeScript and diff checks pass.

A-2040's file/action audit remains applicable with this added role-state dependency at all ordinary startup callers. No assertion, action or timeout changed. Both replay controls stay in nvim/test and apply only to the initial replies, preserving explicit hold/release priority. The 30-file sweep will use both 1000 ms replay controls after the Coordinator's hub-back notice. As decided, qa.test.ts end-to-end --qa cases preserve their pinned isolated environment and explicit state waits (ENV-001); no wrapper or production change.

### rev-23 · 2026-10-13T19:41:57.305Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-340-2
commit: b03c4bb1f074497d3ddf2c2dae354949170d66d4

No remaining high or medium findings. Ordinary startup now waits for configured role state before launcher defaults are consumed; A-2046 proves the unchanged launcher check red then green with delayed role.list. C1 verified from the complete action audit and correction. Assertions, timeouts, action sequences and explicit held snapshots remain intact. C2/C3 await the complete delayed replay and normal exact-head cland verify after the Coordinator's hub-back window. A-2048: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2048-t-340-corrected-source-review-at-b03c4bb.md.

Criteria: C1 verified.

### impl-340 · 2026-10-13T20:11:07.492Z

C2 delayed replay complete at source-reviewed b03c4bb1f074497d3ddf2c2dae354949170d66d4: all 30 Neovim files run serially, 322/322 tests passed, no failures/skips/cancellations; per-file time totals 434.530 s. Initial hub.status/task.list and role.list replies used 1000 ms replay delays. Queue checked empty before every file, no pause occurred. A-2052 contains index.md, results.json and every raw TAP log at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2052-t-340-complete-delayed-replay-30-files-322-tests. QA-runner cases retained their pinned environment/state waits as decided (46/46 passed). Normal exact-head cland verify all is being submitted now; C2/C3 remain pending that result.

### impl-340 · 2026-10-13T20:24:42.099Z

C2/C3 complete at b03c4bb1f074497d3ddf2c2dae354949170d66d4. Delayed serial Neovim sweep A-2052 passed 30/30 files and 322/322 tests, with no failures/skips/cancellations. Normal exact-head cland verify all 28714871-0bdb-4eda-9753-185232452364 is green: 1843/1843 tests, no failures/skips/cancellations, typecheck passed; durable log A-2053 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2053-suite-28714871-0bdb-4eda-9753-185232452364-all-at-b03c4bb.log. Source head and action/assertion/timeout preservation remain as reviewed. C2/C3 marked done; awaiting Reviewer's same-head final verdict and hub ready event.

### rev-23 · 2026-10-13T20:24:49.110Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-340-3
commit: b03c4bb1f074497d3ddf2c2dae354949170d66d4

No high or medium findings remain. A-2052 covers every one of the 30 Neovim test files: 322/322 pass under the delayed replay, with zero failures/skips/cancellations. A-2053 exact-head cland verify all 28714871 passed typecheck and 1843/1843 tests, including normal Neovim 322/322. Source preservation checks remain A-2048. All C1–C3 verified; implementer C2/C3 done marks remain its responsibility. A-2054: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2054-t-340-final-delayed-and-normal-verification.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-13T20:24:57.775Z

Merged cf838de8bca86a5f2fe4a4a0a22ee23747fd4efa onto dev.
