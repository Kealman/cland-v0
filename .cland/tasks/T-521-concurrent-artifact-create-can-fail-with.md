---
id: T-521
kind: task
title: Concurrent artifact.create can fail with 'artifact reservation moved' (id allocated twice)
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1035
branch: t/T-521-concurrent-artifact-create-can-fail-with
created: 2026-10-15T18:13:01.794Z
updated: 2026-10-25T12:38:31.086Z
closed: 2026-10-25T12:38:31.086Z
---

## Summary

`artifact.create` can fail with "artifact reservation moved" when two creates overlap. hub/src/hub/artifacts.ts reserves an id, prepares the bytes, then calls `store.registerArtifact`. Registration allocates the next id afresh and throws when that differs from the prepared one (around lines 98–100). Under today's load an Implementer's evidence upload failed this way, on T-508 at 18:10Z on 2026-10-15, and succeeded on retry.

## Acceptance criteria

- [x] C1. Registration uses the reserved id, or retries preparation under the new id, so two concurrent creates both succeed with distinct ids. No prepared bytes are orphaned.
  - done: impl-521 · 2026-10-25T10:33:58.946Z
  - verified: rev-31 [reviewer] · run rev-20261025-521-final · 2026-10-25T10:49:54.568Z · commit 22105f3139ac9493e8c3b4a95043bdb662fd3378
- [x] C2. A test runs two artifact.create calls whose preparation overlaps and sees both registered, with their bytes intact.
  - done: impl-521 · 2026-10-25T10:36:28.583Z
  - verified: rev-31 [reviewer] · run rev-20261025-521-final · 2026-10-25T10:49:54.568Z · commit 22105f3139ac9493e8c3b4a95043bdb662fd3378

## Comments

### impl-521 · 2026-10-25T10:31:25.067Z

Seam: T1 createArtifact API with real in-memory Store and scripted filesystem async operations. Two concurrent callers expose duplicate preparation ids, then assert both indexed artifacts, exact bytes and no unregistered paths. Fix will serialize createArtifact by Store at the module boundary, covering tool, suite-child and batch callers even when they bypass Dispatcher.#artifactQueue. No wire shape, refusal class, schema or policy changes; Store registration contract remains unchanged.

### impl-521 · 2026-10-25T10:32:16.353Z

TDD red observed on macOS arm64, local Node v24: node --test hub/test/artifact-create-unit.test.ts failed with `AssertionError: A-1\nError: artifact reservation moved`, statuses fulfilled/rejected. After per-Store serialization in createArtifact, the same T1 case passes and checks A-1/A-2, both exact byte strings, every prepared path indexed, and both publications. No browser or T2–T4 run claimed.

### rev-31 · 2026-10-25T10:35:41.947Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-521-source1
commit: 32f1b9a524f96f5aca34181eaafa42d2595a3362
scope: full
findings: [{"severity":"medium","text":"M1: new artifact-create-unit entry precedes artifact-cli entries, violating required path order and blocking verification admission. Move only this T1 entry after both cli entries.","file":"hub/test/tiers.json","line":44}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-521 full source review — NOT CLEAR

Head32f1b9a524f96f5aca34181eaafa42d2595a3362/tree91e21c1dc9930c350826a1e78eec17fe5cbdc8a0, one task commit, dev...head merge-base diff. Standards and Spec reviewed personally; no delegation or Reviewer execution.

## Standards

M1 (medium), hub/test/tiers.json:44: artifact-create-unit.test.ts is inserted before artifact-cli-lifecycle.test.ts and artifact-cli.test.ts. Required path order puts both cli entries before create. Static parsed-key inspection identifies this first inversion: (`hub/test/artifact-create-unit.test.ts`, `hub/test/artifact-cli-lifecycle.test.ts`). The enforcing tier-manifest admission rejects unsorted maps, so the required configured verification cannot be admitted at this head. Move only the new entry to its sorted position; preserve its T1 classification and all existing entries/assertions. C2's registered regression is incomplete until this is corrected. No runtime refusal is claimed from Reviewer execution.

No additional Standards finding: T1 uses a real in-memory Store with scripted asynchronous fs methods, no socket/process/browser/time wait; ESM built-in bindings restore after cases. Canonical exact heading, Notes index, README and upstream implement CHANGES are present. The task changes no CLI help, public wire, schema, refusal class or role permission.

## Spec

No additional Spec finding. A WeakMap keyed by Store serializes every createArtifact call through preparation, transactional registration/publication and its awaited normal failure cleanup, including suite-child/batch paths that bypass Dispatcher queueing. A rejected creation's tail is caught for queue continuation without suppressing its caller's rejection. Existing authorization after awaits and before registration stays intact; no authority is captured and trusted across the new queue wait. Production registerArtifact consumers route through this boundary, while direct Store calls found outside it are fixture seeds.

The concurrent regression starts both operations before awaiting, historically reproduces duplicate A-1 preparation/registration, and retains both fulfilled results, distinct registered A-1/A-2, exact contents, both publications and all prepared paths indexed. The refused-publication control preserves transaction rollback, cleanup before id/path reuse, only accepted final bytes/index and one publication. The implementation serializes preparation rather than allowing simultaneous writes; it satisfies the intended concurrent-call success requirement without changing the public registration contract.

## Evidence and disposition

A-11733 records original red `Error: artifact reservation moved` with fulfilled/rejected outcomes and summarizes two green local T1 cases (~0.008/~0.004s), typecheck/wording/test-lint checks on Darwin27.0.0 arm64/Node24.21.0. This is implementation-time summary, not complete original stdout/exits/native timing capture or configured exact-head evidence. No browser, Linux or T2–T4 run claimed. Retain available original command/tool outputs with actual source attribution and explicit missing-record limits; do not rerun for transcription.

Full source NOT CLEAR: one medium Standards finding, no additional Spec findings. Fail C2 for M1; C1 remains claimant-done/runtime-unverified. Correct manifest ordering only, restore C2 done and request fresh pushed-head source review before ordinary mode-free configured verify. No extra dev merge, tests/assertion relaxation or per-item QA requested (scope none/after-stage). Reviewer used immutable source/artifact inspection only.
Durable review: A-11736.

Criteria: C2 failed (M1: the new regression's unsorted tier registration blocks required configured verification admission.).

### rev-31 · 2026-10-25T10:36:55.230Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-521-source2
commit: 22105f3139ac9493e8c3b4a95043bdb662fd3378
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-521 corrected source review — CLEAR

Head22105f3139ac9493e8c3b4a95043bdb662fd3378/tree6fc05ea9214ad43343f49b3fd62a81e839647571; direct parent32f1b9a524f96f5aca34181eaafa42d2595a3362. Full correction diff is solely movement of the new artifact-create-unit.test.ts tier entry below both artifact-cli entries. No dev merge, source/test/assertion or other file changes.

## Standards

M1 resolved. Parsed tests keys are path-sorted; semantic manifest data equals the prior manifest and the new test retains T1. Canonical guidance, index, README and implement skill CHANGES remain. No findings. Reviewer performed read-only inspection, no test/build/probe/browser/fetch/Git mutation.

## Spec

Carry the accepted full A-11736 audit: per-Store createArtifact sequencing covers dispatcher-bypassing suite/batch callers through normal preparation/registration/refusal cleanup, retains authorization rechecks and caller rejection, and preserves public shape. Concurrent-success and refusal/id-reuse tests keep exact ids/bytes/publication/path assertions. Both claimant done marks are now present. No scope expansion.

## Evidence and disposition

A-11737 retains original implementation-time Darwin27 arm64/Node24.21 tool output excerpts with exact limits: red has actual fulfilled/rejected and artifact reservation moved, exit1; final two cases7.639542/4.213792ms, Nodefile120.106542ms,2/2exit0; typecheck exit0 with no captured total wall; test lint report-only133/60,0refusals. Original correction tier lint exits0 (148free/384machine files), whitespace exits0. Production/test source was final before later docs/manifest-order changes; these are not exact-commit/Linux/configured receipts, and no transcription reruns occurred. No browser or T2–T4 runtime evidence claimed.

Source CLEAR, findings empty; C1/C2 remain runtime-unverified pending one ordinary mode-free configured verify at unchanged22105f31 and final evidence review. No extra dev merge or repeat requested. QA none/after-stage, no per-item brief.
Durable review: A-11738.

### rev-31 · 2026-10-25T10:49:54.568Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-521-final
commit: 22105f3139ac9493e8c3b4a95043bdb662fd3378
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-521 final evidence — CLEAR

Reviewed unchanged22105f3139ac9493e8c3b4a95043bdb662fd3378/tree6fc05ea9214ad43343f49b3fd62a81e839647571, still branch tip. Carry full source A-11736 and corrected manifest/source A-11738. Mode-free configured6e780a7b-fa00-4ce5-8287-247b1caa2448/A-11751 is terminal passed at this exact head in task.view; both claimant done marks present.

## Criteria

C1/C2 verified. Exact `concurrent artifact creates register distinct ids with intact bytes and no orphan files` passes ordinary0.015719722s and5/5load (worst0.026845434s). Accepted source assertions start both concurrent callers before awaiting, require both fulfilled, registered A-1/A-2, exact first/second bytes, both publications and every prepared path indexed. The scripted async filesystem is the T1 race seam; no live-project or real filesystem race is claimed.

Exact `a refused publication cleans its bytes before the next queued create reuses the id` passes ordinary0.012502915s and5/5load (worst0.027934349s). It retains first refusal/second success, sole reused A-1, only accepted bytes/path/index and single publication after rollback. Together with the unchanged per-Store API-boundary queue and preserved authority checks, these establish concurrent success and cleanup before normal refused-publication id/path reuse, including callers bypassing dispatcher queueing.

## Scope and provenance

Parsed unique terminal test progress excluding file containers:3121ordinary passes plus10additional load passes, nofail/cancel/skip/todo. All ten load passes are the two task identities, five sequential repetitions each under two load workers. These remain separate from ordinary totals. Both new tests and their whole file pass; enforcing manifest admission and host check also pass after M1 reorder. No Web repetition required (zero new Web files).

Executed hostT0exit0/29.799s; allT1exit0/65s; fallback-all hub+NeovimT2exit0/354s due skill coverage fallback; Webexit0/150s. No T3 or T4 executed; remainingT3 is deferred periodic/integrated and absent configured batch tiers. No all-tier/stage/QA coverage claim or per-item QA requirement (none/after-stage).

Dropletc-8lon1/cland-v0-94d93ea7, Linuxx64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5,workers2, machine lifetime666s/cost$0.0462 (not suite wall). Pinned Chrome Headless Shell156.0.8078.4/revision1248/linux64 prepared at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248 for isolated Web tests. Host check reused remotely under gate-tree key8e6ed94031d77f10d71f9e57d34427304c627d64, not an alternate task head or repeated remote check.

Report-only limits:133lint findings/60files, two missing duration baselines (new artifact-create file and install-claims), six listed budget overages, Web actual suite146.10s vs40s and unchanged T3ratchet2209.786s. These are not enforced-budget passes. New task identities remain far below enforced new-identity duration bound without allowances. Case/phase timing, projections and machine lifetime remain distinct.

## Disposition

Final CLEAR, C1/C2 verified across unchanged accepted source and original exact-head executed evidence; findings empty. A-11737 retains original implementation-time macOS/precommit excerpt/native-timing limits, not relabelled as Linux or exact-child local reruns. No extra repeats, source changes or dev merge requested. Lead sends the normal fresh no-auto-maintenance conflict-check/unchanged-head ready report to Coordinator, who owns enqueue and separate integrated/pre-merge covers. Reviewer performed read-only inspection only.
Durable final review: A-11753.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T12:32:27.237Z

Rule 6 pre-merge verify all 55b87b2c at 22105f31 (A-11908): 4011 passed, 1 failed, 5 skipped across T0–T3 (Web not reached). The single failure, hub/test/roles-timing.test.ts '150 ms of malformed parsing plus 150 ms of failure logging counts as one 300 ms roles continuation', is a dev defect, not T-521: it passes at 82cf0f6c and fails 5/5 on clean dev at 8acdd283 (T-1230), c966b086 and 0026fcd0 (Coordinator, local macOS). Filed as T-1302 (regression-of T-1230). T-521 touches only hub/src/hub/artifacts.ts and its tests. Coordinator accepts this run as T-521's rule 6 evidence with the attributed identity; Web is covered by T-521's mode-free run 6e780a7b.

### coord · 2026-10-25T12:38:31.086Z

Merged b70efcccc80e6ed829f7d605eba04f6cd2a2eeac onto dev.
