---
id: T-1030
kind: task
title: Recorded-frame matching misses the /private/tmp alias, so Neovim shell tests fail with TMPDIR under /tmp
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-979
branch: t/T-1030-recorded-frame-matching-misses-the
created: 2026-10-20T20:51:01.853Z
updated: 2026-10-24T12:52:35.997Z
closed: 2026-10-24T12:52:35.997Z
---

## Summary

nvim/test/frame-fixtures.ts canonicalizes only the `/private/var` temp alias when matching recorded protocol frames. With TMPDIR under `/tmp` (macOS reports it as `/private/tmp`), the stub hub refuses frames whose paths embed the temp dir as "unrecorded protocol frame" (seen as `session.attach` in nvim/test/shell.test.ts, 10/25 failing, E-789 stage QA M4 on 2026-10-20). With the default `/var/folders/...` TMPDIR the same file passes 25/25 at the same commit 44097bad.

## What to build

Canonicalize every macOS temp alias (`/private/tmp` as well as `/private/var`), or better, compare paths after resolving both through realpath, so a scratch TMPDIR anywhere matches the recordings.

## Acceptance criteria

- [x] C1. nvim/test/shell.test.ts passes with TMPDIR under `/tmp` and under the default `/var/folders` on macOS (targeted local runs named in the item).
  - done: impl-1030 · 2026-10-24T12:30:38.234Z
  - verified: rev-26 [reviewer] · run rev-20261024-1030-final-1 · 2026-10-24T12:46:13.722Z · commit 4c0233de92f2fe71f1c65eece5d2649e006b8624
- [x] C2. A unit test covers the canonicalization of `/private/tmp`, `/tmp`, `/private/var` and `/var` paths (T1).
  - done: impl-1030 · 2026-10-24T12:30:38.734Z
  - verified: rev-26 [reviewer] · run rev-20261024-1030-final-1 · 2026-10-24T12:46:13.722Z · commit 4c0233de92f2fe71f1c65eece5d2649e006b8624

## Comments

### impl-1030 · 2026-10-24T12:27:21.506Z

Starting test-first at the existing canonical()/recording-key seam (C2); will run nvim/test/shell.test.ts separately with TMPDIR under /tmp and default /var/folders (C1), on sealed fixtures from T-1012.

### impl-1030 · 2026-10-24T12:30:51.828Z

Implementation pushed at 4c0233de92f2fe71f1c65eece5d2649e006b8624, tree 6d8dfb5973f02ddabd975dc6cc2a38c9399d56b4. Local macOS arm64: T1 nvim-fixture-boundary 8/8 after expected red; shell.test.ts 25/25 with TMPDIR=/tmp and 25/25 with default /var/folders, serial sealed fixture runs. Hub/nvim typechecks passed. Durable evidence A-10982, raw shell A-10978/A-10981 in topic-979. Both criteria done; source review requested from reviewer, mode-free verification awaits clear verdict. These targeted receipts are not full-suite evidence.

### rev-26 · 2026-10-24T12:31:59.712Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1030-source-1
commit: 4c0233de92f2fe71f1c65eece5d2649e006b8624
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1030 full source review — clear

Head 4c0233de92f2fe71f1c65eece5d2649e006b8624; tree 6d8dfb5973f02ddabd975dc6cc2a38c9399d56b4. Fixed base and merge-base 4b617576635e60110aea55df67f310c8abb780c1. Reviewed git diff4b617576...4c0233de: two files,20+/3−; single task commit. Task C1/C2 and retained local evidence inspected. Standards and Spec reviewed in-session; no delegation or runtime execution.

## Standards
No findings. The helper remains a repository-only pure normalization boundary, adding no realpath/host filesystem dependency, native child, runtime import, recording edit or dependency. T1 matrix extends the existing nvim-fixture-boundary test (already declared T1); actual shell behavior remains at the existing T3 client seam. No lifecycle/cleanup, authority, clock, cap or final assertion changes. Existing fail-closed recording reader and explicit committed fixture boundary are unchanged. No new test file/index-heading contract to migrate.

## Spec
No findings. The new alias helper recognizes both directions of /private/tmp↔/tmp and /private/var↔/var, with directory/end boundaries in its prefix expression. It sorts aliases longest first so a public suffix cannot match inside the private spelling first. Root substitutions precede parent substitutions, preserving specificity; fixture parents remain limited to the existing cland-* parent convention. Actual incoming values bind the existing token restoration table, retaining the observed wire spelling for the matrix cases. There is no requirement to touch existing path targets or rewrite recordings.
The T1 matrix covers both root spellings × both wire spellings for both alias families, compares exact canonical root/parent tokens and exact restored frames. Existing cross-platform timestamp/path and recorder drift tests remain intact.

## Local evidence and limits
A-10982 attributes local Darwin arm64 runs to the implementation source tree before its unchanged commit: new matrix red then full T1 8/8 green, hub/nvim typecheck pass. This artifact is a summary, not complete raw tool receipts.
A-10978 and A-10981 retain actual native shell output: TMPDIR=/tmp 25/25 pass, no skip/fail, runner14123.484917ms; default /var/folders TMPDIR 25/25 pass, no skip/fail, runner14182.079875ms. Their platform/source/command/cleanup attribution is presently in A-10982. No standalone load/enforced-budget or configured suite claim is made. Requested original returned command/exit records and available red/green/typecheck outputs with missing/truncated limits, without rerunning for transcription.

Disposition: full source clear at this exact head, findings[]. Both criteria are test-dependent and remain unverified until final evidence settlement, using these properly attributed macOS runs for C1 and the same-head configured T1 regression receipt for C2. Submit normal mode-free configured verify at this unchanged head, retaining selection/timing/report-only scope. Source helper changes may select mapped guards; do not infer an all-T3 cover. QA none/after-stage requires no per-item run. Changed head needs new source review; no post-review dev integration without Coordinator authorization. Standards0; Spec0 findings.
Durable review: A-10991.

### impl-1030 · 2026-10-24T12:46:02.853Z

Same-head mode-free verification 21df0501-e18f-4c38-9f62-7c58c87022b7 at 4c0233de exited 0: T0 + all T1 + fallback all T2 + Web, 2961/2961 on Linux x64 droplet c-8 lon1 (737s lifetime, $0.0512). T3 deferred; lint/duration/ratchet report-only. Receipt A-11030. Requested final evidence review. Fresh origin/dev 2ec0b26f conflict check via merge-tree exited 0, prospective tree 4077dc29; source head unchanged and tree clean.

### rev-26 · 2026-10-24T12:46:13.722Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1030-final-1
commit: 4c0233de92f2fe71f1c65eece5d2649e006b8624
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1030 final same-head evidence review — clear

Head4c0233de92f2fe71f1c65eece5d2649e006b8624; tree6d8dfb5973f02ddabd975dc6cc2a38c9399d56b4. Current source review A-10991 remains unchanged. Audited configured run21df0501-e18f-4c38-9f62-7c58c87022b7 / A-11030, original macOS stdout A-10978/A-10981 and retained original invocation/exit/provenance A-10996. task.view confirms exact-head passed result.

## Standards
No findings. Evidence only; no new tests/probes/edits by Reviewer. A-10996 preserves original precommit source attribution and native records without reruns. It explicitly labels the first red and intermediate longest-first-ordering red, missing wrapper receipt files/empty typecheck log, and absence of per-child source hashes. Hub standalone typecheck preceded final sort correction; Neovim standalone check includes it. No precommit check is relabelled as exact-commit execution.

## Spec / criteria
C1 verified: local Darwin arm64 shell runs used base4b617576 plus the final two-file patch committed unchanged as4c0233de, not hashes emitted by those children. Both actual shell stdout logs and original returned exit0 records are retained: TMPDIR=/tmp 25/25, no fail/skip/cancel, runner14123.484917ms; default /var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/ 25/25, no fail/skip/cancel, runner14182.079875ms. A-10996 retains sealed fixtureEnvironment wrappers, requested TMPDIR paths, disposable cwd, serial invocation, original chunk/session/final exit records and limitations. These establish the required macOS targeted runs, separate from Linux verification.
C2 verified: new T1 matrix covers private/public tmp and var roots × wire spellings and exact root/parent restoration. Original first red fails root/private-tmp vs public-tmp; intermediate red shows private-prefix partial substitution, motivating longest-first sort. Final local8/8 passes. Configured exact-head boundary file8/8 ordinary pass; alias matrix0.000783151s plus5/5 actual load repetitions (worst0.022698820s), all far below1s T1 budget.

## Configured result / limits
Mode-free configured task run, mode full, exit0: T0 host check, all T1, fallback all hub/Neovim T2 and Web pass. Deduplicated native records:2961 ordinary test passes,423 passing file records,zero fail/cancel/skip; five extra load-gate test passes for the single new alias identity counted separately. No T3/T4 executed: helper-only nvim frame-fixtures change selects T2 fallback, not the unchanged shell T3 file. Do not infer Linux shell/T3 proof from this receipt.

Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-6b22ad95, Node v24.21.0, Neovim v0.12.5, configured workers2; lifetime737s, cost$0.0512. T0 passed35.545s, full host output retained; remote log says host gate3271380545793e3ff5542ab00d44af97453e69bd not repeated (read-only Git identifies a tree object). No remote repeated-typecheck claim.
Budgets/lint/ratchet remain report-only:133 lint findings/60files, existing Web and hub scale/Neovim artifact overrun diagnostics, projected Web wall over40s; T3 ratchet2195.304s equals base because no T3 changed. Exit0 is not enforce-mode budget success.

Final evidence clear, findings[], C1/C2 all verified across A-10991/source, attributed macOS targeted receipts and exact-head Linux configured result. QA none/after-stage requires no per-item run. Coordinator owns landing; retain normal read-only fetched-dev conflict check without changing the reviewed head. Standards0; Spec0 findings.
Durable review A-11031.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:52:35.997Z

Merged 699a44dd1741e272ecd883c73c1aeda0215d6dff onto dev.
