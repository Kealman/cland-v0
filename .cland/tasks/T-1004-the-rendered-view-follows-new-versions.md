---
id: T-1004
kind: task
title: The rendered view follows new versions of the artifact and its window
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by:
  - T-796
topic: topic-771
branch: t/T-1004-the-rendered-view-follows-new-versions
created: 2026-10-20T16:58:41.360Z
updated: 2026-10-20T21:02:31.209Z
closed: 2026-10-20T21:02:31.209Z
---

## Summary

When an artifact changes, the rendered view shows the new version and never a stale cached one. The view re-lays itself when the window width changes, keeps the reading position across the raw toggle, and stays bound to the artifact when it is moved.

## What to build

An agent updates a note the human has open, and the rendered view shows the new text; the version key is client-side (path, mtime and size), so a changed file is a new version (Coordinator decision, 2026-10-20). The human switches to raw, fixes a typo, saves and switches back, and sees the fix rendered at the same place. Narrowing the window from 120 to 80 columns stacks a wide table as the thread does. Moving the artifact into a folder keeps the open view working. The mode is not remembered: after `:restart` an artifact reopens rendered.

## Acceptance criteria

- [x] C1. A changed artifact (an artifact event for new file content, or the human's save in raw) renders its new text, and the previous version's cached render is not shown, proved by a T2 recorded-frames test.
  - done: impl-1004 · 2026-10-20T20:07:42.006Z
  - verified: rev-23 [reviewer] · run rev-20261020-1004-final · 2026-10-20T20:17:25.916Z · commit f16b548a40cb9bba07514863a13cc29406a29eeb
- [x] C2. Resizing the window from 120 to 80 columns re-lays a table as the thread does at those widths, proved by a T2 test.
  - done: impl-1004 · 2026-10-20T20:07:42.025Z
  - verified: rev-23 [reviewer] · run rev-20261020-1004-final · 2026-10-20T20:17:25.916Z · commit f16b548a40cb9bba07514863a13cc29406a29eeb
- [x] C3. Toggling to raw and back keeps the cursor on the same source line, or the nearest rendered one, through the source-to-rendered line mapping, proved by a T2 test.
  - done: impl-1004 · 2026-10-20T20:07:42.044Z
  - verified: rev-23 [reviewer] · run rev-20261020-1004-final · 2026-10-20T20:17:25.916Z · commit f16b548a40cb9bba07514863a13cc29406a29eeb
- [x] C4. A Markdown artifact open in the centre comes back rendered after `:restart`, proved by a T2 test of the snapshot and restore.
  - done: impl-1004 · 2026-10-20T20:07:42.063Z
  - verified: rev-23 [reviewer] · run rev-20261020-1004-final · 2026-10-20T20:17:25.916Z · commit f16b548a40cb9bba07514863a13cc29406a29eeb
- [x] C5. Moving an open Markdown artifact into a folder (a rebind) keeps the rendered view and the raw toggle working on the new path, proved by a T2 recorded-frames test.
  - done: impl-1004 · 2026-10-20T20:07:42.083Z
  - verified: rev-23 [reviewer] · run rev-20261020-1004-final · 2026-10-20T20:17:25.916Z · commit f16b548a40cb9bba07514863a13cc29406a29eeb

## Comments

### impl-1004 · 2026-10-20T19:50:44.924Z

Implementation at the ticket's pre-agreed T2 recorded-client seam (headless scratch fixture): artifact event/raw save refresh, 120→80 table relayout, source-line cursor mapping through toggle, snapshot/restore rendered default, moved-path rebind. Keep deterministic receipts and gross guards; no per-item QA or new timing claims.

### impl-1004 · 2026-10-20T19:56:28.072Z

Implemented the five criteria and T2 cases, plus a deferred-table position regression. Before cover-quiet: local macOS targeted artifact-render 11/11, thread 23/23, artifacts compatibility 9/9 passed on the working source at that time; no full suite or timing-target claim. The fixture recorder completed 10/10 cases and added 54 catalog lines with no removal. Subsequent static-only edits keep cursor rows on unchanged refresh, preserve modified raw-buffer version tracking, and add the matching no-op-refresh assertion/docs; those edits await the reviewed-head remote gate. No local test runs during current cover-quiet.

### rev-23 · 2026-10-20T19:58:51.213Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1004-source
commit: 9d2742e39aa420c5796b29b170459b31a82841af
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1004 source review

Head 9d2742e39aa420c5796b29b170459b31a82841af; tree 1c78d7c0a2f996976562df7367c255ea8ad4a507. Fixed base 44097bad (current pre-review dev parent). Reviewed all seven task files; pre-review merge adds no task conflict resolution.

## Standards
No findings. Source maintains the existing shared Markdown projector, version-key cache and bounded async apply path. Source metadata updates remain within the existing 128-row write chunks. Unchanged refreshes preserve the exact cursor row; version/width changes remap by source row, with independently ordered initial/applied halves during deferred completion. Disk reload skips modified raw buffers. Existing async entry identity checks reject superseded work.
New T2 tests use the existing recorded client and scratch fixture seams, retain bounded exact-content/cursor/buffer assertions, and introduce no new timing targets or process tier. Fixture catalogue comparison confirms every old node and record is byte-equivalent: 48 nodes and six records added, none removed or replaced. No shipped QA catalogue change. README and test documentation match the new refresh, relayout and mapping behavior; diff check is clear.

## Spec
No findings. C1 covers artifact events with an already-loaded raw buffer, followed by human raw write and cache refresh. C2 compares actual 120/80/120 buffer and grid layouts with the shared thread projection. C3 asserts exact raw/projected source positions, unchanged-refresh stability and a deferred table expansion moving a later anchor by three rendered rows. C4 exercises actual state snapshot/reset/restore and rebuild from raw to read-only rendered mode. C5 delivers a recorded move, observes the resolved destination path, toggles to the rebound editable source, saves there and checks the new rendered text.
The shared projector adds one-based source_line metadata for ordinary/table/generated rows; no unrelated rendering policy is introduced.

## Evidence and verdict
Source clear, no final runtime criteria marked yet. A-8025 preserves original failures and local macOS dirty-working-source greens (artifact-render 11/11, thread 23/23, artifact compatibility 9/9), explicitly based on 0877bba4 before the final static-only cursor/modified-source edits and merge. These are historical targeted results, not exact-head passing evidence. A-8026 documents the final source map and current static-check claim; lint 131/59 is report-only. No extra local tests during cover-quiet, and Reviewer executed none.
C1–C5 await the normal same-head configured remote mode-free gate. Full after-stage QA under E-795 after T-1005 remains separate.
Standards 0 findings; Spec 0 findings.

### rev-23 · 2026-10-20T20:07:03.793Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-1004-final-red
commit: 9d2742e39aa420c5796b29b170459b31a82841af
scope: evidence
findings: [{"severity":"high","text":"The new buffer,changed return expands through views.placeholder into nvim_win_set_buf, yielding three arguments and breaking Markdown artifact opens; gate has 13 ordinary and 25 repetition failures.","file":"nvim/lua/cland/artifacts.lua","line":253}]
finding_counts: {"high":1,"medium":0,"low":0}

# T-1004 failed exact-head gate

Head 9d2742e39aa420c5796b29b170459b31a82841af; A-8029 / run 5c627151-6c99-4c3b-9b15-7d14e84349ca exited 1.

## Standards
No separate standards finding. The actual receipt contains:
```
Error: nvim: [0,"Lua: /home/runner/cland/nvim/lua/cland/layout.lua:692: /home/runner/cland/nvim/lua/cland/layout.lua:430: Expected 2 arguments
...
.../nvim/lua/cland/artifacts.lua:168: in function 'open'
```
Parsed ordinary records: 2,151 tests completed, 2,138 pass / 13 fail; 335 files, 332 pass / 3 fail. Separately, all 25 load-gate tests failed (five new identities, five repetitions each). This is not 38 independent defects. T1 exited 0, T2 exited 1. Linux x64 c-8 lon1 droplet, Node v24.21.0, Neovim v0.12.5, two workers, lifetime 384 seconds, estimated cost $0.0267. Host check reference 61d046c78c8e26d14fa5dd142f8e404b8457b7b4 was not repeated remotely. Lint/duration diagnostics are report-only; assertion failures are enforcing. No T3/T4 pass is claimed.

## Spec
High H1 — nvim/lua/cland/artifacts.lua:253: returning both buffer and changed leaks an extra Lua return through views.placeholder/views.buffer into layout's nvim_win_set_buf(w, views.placeholder(v)). The final argument expression expands both values, supplying three API arguments instead of two. Markdown opening fails before event refresh, resize/toggle, restart or rebind behavior can be exercised. The unchanged view facade still expects a single buffer return. Keep that public contract or explicitly constrain every facade/call site, while retaining any internal changed signal. The new and existing artifact tests plus existing Events navigation must pass after correction.

## Verdict
Not clear; fail C1–C5 because their required artifact-open path and tests are broken. This is a task-owned return-contract regression, not a load-only timeout or shared flake. Fresh corrected-head source review is required before another normal mode-free gate. Previous source-clear A-8028 did not catch this API interaction; historical dirty-source greens are not this head's proof. Reviewer ran no tests.
Standards 0 findings; Spec 1 high.

Criteria: C1 failed (Markdown artifact opening throws Expected 2 arguments because the changed two-value buffer return expands through the view facade into nvim_win_set_buf; required tests fail.), C2 failed (Markdown artifact opening throws Expected 2 arguments because the changed two-value buffer return expands through the view facade into nvim_win_set_buf; required tests fail.), C3 failed (Markdown artifact opening throws Expected 2 arguments because the changed two-value buffer return expands through the view facade into nvim_win_set_buf; required tests fail.), C4 failed (Markdown artifact opening throws Expected 2 arguments because the changed two-value buffer return expands through the view facade into nvim_win_set_buf; required tests fail.), C5 failed (Markdown artifact opening throws Expected 2 arguments because the changed two-value buffer return expands through the view facade into nvim_win_set_buf; required tests fail.).

### impl-1004 · 2026-10-20T20:07:42.110Z

A-8029/run5c627151 at9d2742e3 failed: `layout.lua:430: Expected 2 arguments`; 13 ordinary failures and25 new-case load repetitions failed. Root cause: artifacts.buffer's extra return expanded through views.placeholder into nvim_win_set_buf. Fixed at pushedf16b548a40cb9bba07514863a13cc29406a29eeb (tree2dc9b43fe194eda3625e072dff2f7aea225755f4): both buffer APIs again return one value; unchanged refresh uses native changedtick/identity. Two-file7+/6− delta; tests and all assertions retained. No dev merge, local tests or quiet-Mac timing runs during cover-quiet. C1–C5 done again; fresh source review required before new exact-head remote verification.

### rev-23 · 2026-10-20T20:08:14.037Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1004-source-2
commit: f16b548a40cb9bba07514863a13cc29406a29eeb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1004 corrected source review

Head f16b548a40cb9bba07514863a13cc29406a29eeb; tree 2dc9b43fe194eda3625e072dff2f7aea225755f4. Reviewed the two-file, seven-add/six-remove correction since 9d2742e3. No dev merge.

## Standards
No findings. Both artifact_md.buffer and artifacts.buffer now return exactly one buffer on cache-hit and constructed paths. Refresh captures the original native changedtick and remaps only when the returned buffer differs or construction changed its tick. A cache hit does neither, retaining exact cursor position without adding public API state. Tests, duration allowance, deterministic caps, guards, docs and recorded fixtures remain unchanged; diff check is clear.

## Spec
No findings. H1's source cause is resolved: the two view facades (views.placeholder and views.render_placeholder) can forward their buffer return into layout API calls without an extra changed result. This also clarifies the facade naming in A-8030/report, where “views.buffer” referred to that forwarding path. Existing artifact-open, Events navigation and no-op-refresh assertions are retained as the regression seam. C1–C5 implementation and test mapping from A-8028 otherwise remains applicable.

## Evidence and verdict
Source clear only; leave C1–C5 runtime marks pending the new same-head configured remote mode-free gate. A-8029 remains the failed old-head receipt; historical local dirty-source greens remain supplemental. Lead reports corrected-source static npm run check success, test lint 131/59 report-only, and no local runtime tests during cover-quiet. Reviewer ran none.
Standards 0 findings; Spec 0 findings. Full after-stage QA under E-795 remains separate.

### rev-23 · 2026-10-20T20:17:25.916Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1004-final
commit: f16b548a40cb9bba07514863a13cc29406a29eeb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1004 final evidence review

Head f16b548a40cb9bba07514863a13cc29406a29eeb; tree 2dc9b43fe194eda3625e072dff2f7aea225755f4. Corrected source review A-8032 remains current.

## Standards
No findings. A-8036 / run 82f9e470-fee3-4e58-958d-aa91255d9baa exited 0 at this exact head. Parsed ordinary finish records show 2,151 passing tests and 335 passing files. Separately, all 25 load-gate tests passed: the five new identities each five times. The complete artifact-render, artifact compatibility, thread and Events files passed. H1's public return-contract regression is resolved in source and in the previously failing normal opening/navigation paths.
Actual execution: Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, c-8 lon1 droplet, two machine workers. T1 and fallback all T2 completed, including Neovim 97.16 seconds. No T3/T4 or full after-stage QA completion is claimed. Host check reference e45965fdf2b3e929796695b8ee8058283902e8c0 was not repeated remotely. Test lint 131 findings/59 files, duration diagnostics, eight missing baselines and incomplete-base T3 ratchet remain report-only. Lifetime 467 seconds; estimated cost $0.0324.

## Spec
No findings. C1 event/raw-save refreshed versions passed; C2 actual table layouts at 120/80/120 passed; C3 source-line toggles, unchanged refresh and deferred-completion anchor passed; C4 raw snapshot restores rendered with correct buffer options passed; C5 moved artifact's new path, editable raw write and refreshed rendered content passed. Each corresponding new test also has all five repetition receipts. Existing parser/caching/context and artifact/Events compatibility tests passed, retaining prior bounds and behavior.
The historical dirty-source local greens are supplemental only; A-8029 remains the old failed gate, not retrospectively green. No new quiet-Mac timing claim is made.

## Verdict
Final clear; verify C1–C5 at f16b548a. No per-item QA criteria apply; full E-795 after-stage QA after T-1005 remains separate. Reviewer ran no tests or product processes.
Standards 0 findings; Spec 0 findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-20T21:02:31.209Z

Merged e58f0c45eb529ad422de59e5fd58b5d2ec6b5f3d onto dev.
