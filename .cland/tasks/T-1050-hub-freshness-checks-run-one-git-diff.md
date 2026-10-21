---
id: T-1050
kind: task
title: Hub freshness checks run one git diff-tree per commit for old epic demos, starving stage checks for minutes after a restart
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-820
branch: t/T-1050-hub-freshness-checks-run-one-git-diff
created: 2026-10-21T12:59:03.163Z
updated: 2026-10-21T20:32:36.819Z
closed: 2026-10-21T20:32:36.819Z
---

## Summary

impl-1049 found (T-1049, topic-799, 2026-10-21) that the hub's `Freshness.#work` serializes every freshness want. An older epic demo's `#compute`, via `epicDemoFreshness`, scans the intervening commits with one `git diff-tree` per commit, and runs before the stage ancestry checks. On a copy of the live project, the first 5 s ran 273 diff-tree calls and 1 rev-parse; by 10 s it had run 601 and still 1. After hub restart #37, stage covers stayed "missing Linux droplet" for about 16 minutes until the queue drained.

## What to build

Stage and merge-gate freshness facts are answered within seconds after a restart:
- Epic-demo freshness computes changed files over a range in one Git call, such as `git log --name-only` or `git diff --name-only <base>..<tip>`, instead of one diff-tree per commit.
- Stage and merge-gate ancestry wants run ahead of background demo scans, or in their own lane.
- Closed epics' demos are not rescanned at start.

## Acceptance criteria

- [x] C1. On a generated repository with 1,000 commits since an old epic demo, a stage ancestry want issued after start resolves within 2 s, while the demo scan is outstanding (test).
  - done: impl-1050 · 2026-10-21T19:17:00.191Z
  - verified: rev-32 [reviewer] · run rev-20261021-1050-final · 2026-10-21T20:16:29.438Z · commit cc4250265bfaacc8d6c476552eb35e4f40176093
  - verified: rev-32 [reviewer] · run rev-20261021-1050-final-2 · 2026-10-21T20:27:36.813Z · commit 35aea4e835071b02492c5310e50cea7dd25d8ac6
- [x] C2. Epic-demo freshness gives the same `current` and conflicting-file results as before, with at most a handful of Git calls per demo (test counting Git invocations).
  - done: impl-1050 · 2026-10-21T19:12:59.645Z
  - verified: rev-32 [reviewer] · run rev-20261021-1050-final · 2026-10-21T20:16:29.438Z · commit cc4250265bfaacc8d6c476552eb35e4f40176093
  - verified: rev-32 [reviewer] · run rev-20261021-1050-final-2 · 2026-10-21T20:27:36.813Z · commit 35aea4e835071b02492c5310e50cea7dd25d8ac6
- [x] C3. On a copy of the live project, after a hub start, `task plan show` reports stage covers within 10 s (local evidence).
  - done: impl-1050 · 2026-10-21T19:12:59.664Z
  - verified: rev-32 [reviewer] · run rev-20261021-1050-task-evidence · 2026-10-21T19:28:18.010Z · commit cc4250265bfaacc8d6c476552eb35e4f40176093
  - verified: rev-32 [reviewer] · run rev-20261021-1050-final · 2026-10-21T20:16:29.438Z · commit cc4250265bfaacc8d6c476552eb35e4f40176093
  - verified: rev-32 [reviewer] · run rev-20261021-1050-final-2 · 2026-10-21T20:27:36.813Z · commit 35aea4e835071b02492c5310e50cea7dd25d8ac6

## Comments

### impl-1050 · 2026-10-21T19:04:01.724Z

Diagnosis and test-first progress: native 1,000-commit public Freshness regression was red on stage ancestry pending beyond 2000ms behind an outstanding demo; native side-branch/merge/revert/rename test preserved exact conflicts but failed bounded invocation count (8 calls). Separate owned task/stage and demo workers plus two raw -z history reads turn both green. Closed planning-container reads now consult cached demo currency without enqueuing work, with a T2 restart/reopen regression; pending build trees defer cover ancestry until a tree receipt can qualify candidates. Local Darwin/arm64 targeted native4/4, epic-close15/15, follows9/9, freshness8/8, stage component5/5, and updated native shutdown1/1 have passed in working-tree runs (not same-head suite evidence). Copied-live pre-fix ordinary startup complete6505.5ms; stronger all-closure-recompute baseline still pending after456s/27518 diff-tree calls, final measurement pending. Diagnostics and raw outputs will be published as artifacts before source review. No suite run submitted yet.

### rev-32 · 2026-10-21T19:16:16.031Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261021-1050-source
commit: 146ba73a539aa0b9f922124f115b0feae465ab52
scope: full
findings: [{"severity":"medium","text":"Native Git setup has no finite process timeout; a stall occurs before the demo-entry/foreground bounds are armed, violating rule 9's separate setup bound.","file":"hub/test/follows-native.test.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium — hub/test/follows-native.test.ts:52: New synchronous native Git setup (fast-import and git helper calls) has no finite process timeout; the separately bounded demo-entry wait begins afterward and cannot prevent a setup hang (rule 9). Add finite setup-command timeouts and align the setup documentation. Confirmed by implementer df8256e4; correction underway. No separate production behaviour finding. C2 batching/conflict semantics and C3 ordinary saved-checkpoint diagnostic reviewed; run-dependent acceptance remains unverified. Source review A-8658: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8658-t-1050-full-source-review-at-146ba73a-setup-bound.md. No reviewer tests/suite run; fresh source verdict required on correction before verification.

Criteria: C1 failed (The 1,000-commit regression has unbounded synchronous Git setup before its behaviour deadline; add finite native setup timeouts.).

### rev-32 · 2026-10-21T19:17:47.847Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1050-source-2
commit: cc4250265bfaacc8d6c476552eb35e4f40176093
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8658 medium setup finding resolved. New native cases now own direct scratch Git init; each Git setup command and fast-import has a 5000 ms timeout, independent from demo-entry 5000 ms and unscaled foreground 2000 ms observations. Receipt, final cache, demo-outstanding, exact conflicts and call-count assertions remain. Production/diagnostic/shutdown blobs unchanged from full review at 146ba73a, no dev merge. Standards 0 findings; Spec 0 findings. C1–C3 run-dependent marks remain pending. A-8660 targeted/static support and prior-head A-8650 C3 diagnostic retain exact provenance/limitations; neither is configured-suite evidence. Mode-free verify may proceed only at this unchanged head; Coordinator's separately required full pre-merge suite remains outstanding. Review A-8661: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8661-t-1050-source-clear-at-cc425026.md.

### impl-1050 · 2026-10-21T19:27:39.303Z

Source-clear headcc4250265bfaacc8d6c476552eb35e4f40176093: mode-free configured runa15e9074-711c-458f-a293-e7bf0c8545da GREEN, reported2339 tests/pass2339/fail0/skip0, T1/T2/Web exit0 (coverage fallback allT2 in both packages); T3/T4 absent. Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, droplet c-8 lon1, lifetime519s/cost$0.0360. Host gate0ba95d5c reused, not repeated remotely. Lint/duration/ratchet findings report-only; enforced gates passed, zero lint refusals. Raw A-8671 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8671-suite-a15e9074-711c-458f-a293-e7bf0c8545da-auto-at-cc42502.log. Coordinator full pre-merge run remains required/pending (scheduled after T-1067 and T-1058); head fixed, not claiming final readiness or merging.

### rev-32 · 2026-10-21T19:28:18.010Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1050-task-evidence
commit: cc4250265bfaacc8d6c476552eb35e4f40176093
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Task evidence clear, not final pre-merge clearance. Fresh exact-head a15e9074/A-8671 passed Linux x64 c-8 lon1 T1/all fallback hub+Neovim T2/Web: 2339 ordinary tests, plus new closed-demo 5/5 repetitions. Host check 0ba95d5c reused, not repeated remotely. T3/T4 absent; C1/C2 remain unverified pending Coordinator's required full pre-merge run (bd67e5b8). C3 verified from prior-head A-8650 quiet Darwin copied-live process-local projectHub receipt 6646.384 ms to exact complete Linux/macOS cover IDs, no pending/missing; production/diagnostic blobs unchanged at this corrected head. This is prior-head ordinary saved-checkpoint diagnostic support, not a forced-recompute speedup or native-process timing. Lint/tier/duration budgets and ratchet report-only; warnings/missing baselines are not timing-budget passes. No findings. Full evidence audit A-8673: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8673-t-1050-task-evidence-clear-full-run-pending.md.

Criteria: C3 verified.

### impl-1050 · 2026-10-21T20:15:30.299Z

Coordinator-required full c0c82672-4114-4b20-a8e0-c09a6baed0f8 GREEN at unchanged source-clearcc4250265bfaacc8d6c476552eb35e4f40176093: T1/T2/T3/Web exit0,3585 tests/3577pass/8skip/0fail, T4 absent. Native C1 genuinely passed (A-8688 lines14408/14529) and printed foreground receipt50.522ms within unscaled2000ms while demo outstanding (14530); C2 exact native conflicts/call-count pass14412/14531. Updated shutdown ownership test pass13691/13724; T-1049 real projectHub restart pass16496/16498. Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, droplet c-8 lon1, lifetime1751s/cost$0.1216. Lint/duration/T3-ratchet report-only overages retained; enforced gates pass. A-8688 durable log /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8688-suite-c0c82672-4114-4b20-a8e0-c09a6baed0f8-all-at-cc42502.log. Requesting final Reviewer C1/C2 settlement with prior task-green A-8671 and verified C3 A-8673. No source changes or merge.

### rev-32 · 2026-10-21T20:16:29.438Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1050-final
commit: cc4250265bfaacc8d6c476552eb35e4f40176093
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed head. Coordinator full c0c82672/A-8688 freshly passed Linux x64 c-8 lon1 T1/T2/T3/Web: 3577 pass, 8 skip, 0 fail (3585 total). Host check 0ba95d5c reused, not repeated remotely; T4/QA absent. C1 native 1000-commit held-demo ancestor/contains receipt actually ran and passed at 50.522 ms against unscaled 2000 ms; all final cache/outstanding-demo assertions retained. C2 native exact conflict commit/path and bounded invocation assertions ran and passed, along with existing trailer/path/environment contracts. Native shutdown and two-shard restart passed. C3 carries reviewed prior-head A-8650 ordinary saved-checkpoint process-local Darwin diagnostic 6646.384 ms with byte-identical production/diagnostic modules here; not a forced-recompute speedup or native-process startup claim. Same-head task A-8671 additionally supplies closed-demo 5/5. Lint/duration/T3 ratchet report-only: +0.560 s ratchet growth and inherited overages are not budget passes; no T3 load-repetition or T4 claim. No findings; C1–C3 verified. Audit A-8689: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8689-t-1050-final-clear-at-cc425026.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-32 · 2026-10-21T20:18:39.379Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1050-delta
commit: 35aea4e835071b02492c5310e50cea7dd25d8ac6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear; Coordinator 4c2e3174 requests merge dev341b671f under rule 11 and retains full A-8688 at cc425026 as pre-merge code evidence. Combined/both-parent docs review confirms complete T-1050 freshness/diagnostic and T-1067 watchdog guidance retained; README preserves both. Independent tree comparison: 10 T-1050 non-doc paths exactly cc425026, 26 incoming non-doc changed paths exactly dev, no non-doc overlap/unexpected blob. No new manual code or behaviour change; Standards 0 findings, Spec 0 findings. No runtime receipt at merged head yet; C1–C3 current-head marks remain pending fresh mode-free verification. A-8692 audit: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8692-t-1050-merge-delta-source-clear-at-35aea4e8.md.

### impl-1050 · 2026-10-21T20:27:06.539Z

Replacement mode-free1f162304-a029-4d7f-91e8-22bc5a224e48 GREEN at delta-source-clear35aea4e835071b02492c5310e50cea7dd25d8ac6:2352tests/2352pass/0fail/0skip; T1, allT2 fallback across hub+Neovim, Web exit0; no T3/T4 at this merged head. Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, c-8 lon1 droplet lifetime446s/cost$0.0310. Host gatecbefe083 reused, not repeated remotely. Existing lint/duration/ratchet findings report-only; enforced gates pass. A-8697 raw log at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8697-suite-1f162304-a029-4d7f-91e8-22bc5a224e48-auto-at-35aea4e.log. Prior fullT1/T2/T3/Web A-8688/c0c82672 atcc425026 is retained by Coordinator decision4c2e3174 as pre-merge code evidence; all task code unchanged (independent delta reviewA-8692). Final Reviewer settlement at35aea4e8 pending; no source changes, enqueue or merge by Implementer.

### rev-32 · 2026-10-21T20:27:36.813Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261021-1050-final-2
commit: 35aea4e835071b02492c5310e50cea7dd25d8ac6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head clear, C1–C3 refreshed. Delta source A-8692 plus fresh 1f162304/A-8697 at exact unchanged 35aea4e8: Linux x64 c-8 lon1 T1/all hub+Neovim T2/Web exit0, 2352 ordinary tests plus closed-demo 5/5, no failures/skips. Host check cbefe083 reused, not repeated remotely. Fresh run has no T3/T4. Coordinator 4c2e3174 explicitly retains prior full c0c82672/A-8688 at cc425026 as pre-merge code evidence; independent blob proof establishes unchanged T-1050 code/tests/diagnostic. C1/C2 native exact conflicts/call counts and foreground50.522ms actual pass are retained prior-head evidence, not newly run T3 here. C3 retains labelled prior-head A-8650 6646.384ms ordinary saved-checkpoint process-local Darwin diagnostic with unchanged modules; no forced-recompute speedup/native-startup claim. Lint/duration/ratchet report-only, overages/projections/missing baselines not budget passes. No findings. Audit A-8698: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8698-t-1050-final-clear-at-merged-head-35aea4e8.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T20:32:36.819Z

Merged 57c0c61ee46ebac05675ff219f5b194d4efe2008 onto dev.
