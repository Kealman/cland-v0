---
id: T-670
kind: task
title: The droplet runs [verification] prepare where it ran npm ci and the Neovim pin
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-668
  - T-669
topic: topic-669
branch: t/T-670-the-droplet-runs-verification-prepare
created: 2026-10-16T16:35:26.848Z
updated: 2026-10-20T01:00:12.121Z
closed: 2026-10-20T01:00:12.121Z
---

## Summary

The droplet executor runs the project's `prepare` in the prepared image's builder and in every run's delivery, where it ran `npm ci` and seeded the Neovim pin (E-614 C2). This repository's `prepare` becomes a script of its own that keeps today's lock and pin check, in the same merge. Demo: a shell-stack scratch project verifies on the fake droplet after its `prepare` ran there, and a planted failing test turns the run red with its output (E-614 C3).

## What to build

- **The builder** (`prepareSnapshot` in `hub/src/executor/droplet/prepare.ts`). The `install` step runs the root's `[verification] prepare` in the checkout, through `sh -c` as `runner`, in place of `npm ci; node nvim/bin/nvim-path.ts`. It runs with `CLAND_PREPARE_KEY` set to the key being built, as JSON. Without `prepare` the step logs `prepare: not set` and the image holds only the checkout. A failing `prepare` fails the step as `install: prepare failed (exit <n>)`, with its output in the prepare report.
- **Delivery** (`DropletRun.deliver` in `run.ts`). After the checkout and `git clean`, delivery runs the job's recorded `prepare` (ticket T-666) on every run, with `CLAND_PREPARE_KEY` set to the snapshot's key. This replaces the lock and Neovim checks. `prepare` must therefore be idempotent, and the snapshot makes it warm. Its output goes to `delivery.log` and so into the suite log. A failing `prepare` turns the run red with `prepare failed (exit <n>)` and its output, and no `check` or `test` runs. The clean stays as it is (`-e node_modules -e .cache`). Outputs a project's `prepare` writes elsewhere in the checkout are rebuilt by its own run, and its caches under `$HOME` survive from the image. The head and cleanliness checks after the install stay. What `prepare` writes in the checkout must be ignored by git, as `node_modules` is. A `prepare` that leaves untracked, unignored files fails the run with `prepare left the checkout dirty: <paths>`.
- **This repository's `prepare`.** `.cland/config.toml` gets `prepare = "node hub/bin/verify-prepare.ts"`. The script reads `CLAND_PREPARE_KEY` and does exactly what the delivery does today. When the SHA-256 of `package-lock.json` differs from `key.lock`, it prints `dependencies changed: npm ci` and runs `npm ci`, and otherwise prints `dependencies match snapshot`. When `nvim/NVIM_VERSION` differs from `key.nvim.tag`, it prints `Neovim pin changed: seed` and runs `node nvim/bin/nvim-path.ts`, and otherwise prints `Neovim pin matches snapshot`. When the key is absent, as in the builder's first image, it runs both steps. The script lands in the same merge as the code that runs it.
- **Fixtures.** The prepare and droplet fixtures (`executor-prepare.test.ts`, `droplet-fixture.ts`, `remote-fixture.ts`, `prepared-project.ts`) set a `prepare` that keeps their assertions. An `npm ci` assertion uses `prepare = "npm ci"`.
- **Snapshot freshness.** `prepare` runs at every delivery, so a changed `prepare` command never makes a snapshot wrong. It only makes the image less warm, and the key stays as ticket T-669 left it.

**Keeping cland's own suite intact.** This repository's key keeps its hash (ticket T-669), so no re-prepare is needed. Its delivery prints the same two lines and runs `npm ci` or the seed only when today's check would, from the same snapshot key. Its builder runs `npm ci` and the seed as before, through the script. The stage close after this ticket runs the usual sharded droplet cover on `dev`, after the hub restart. That cover's suite log must show `dependencies match snapshot` and `Neovim pin matches snapshot` on every shard. Put that check on the close checklist.

## Acceptance criteria

- [x] C1. A shell-stack project (`prepare = "echo prepared > .prepared"`, `check = "sh -n test.sh"`, `test = "sh test.sh"`, the test asserting `.prepared` exists, `.gitignore` listing it) prepares a snapshot and verifies green on the fake droplet. The suite log shows the `prepare` output before `$ <check>` (`executor-run.test.ts`).
  - done: impl-670 · 2026-10-19T23:57:21.601Z
  - verified: rev-31 [reviewer] · run rev-20261020-670-final-fallback · 2026-10-20T00:39:53.841Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-final · 2026-10-20T00:55:51.147Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
- [x] C2. The same project with a planted failing test turns the fake-droplet run red, with the test's output in the result message.
  - done: impl-670 · 2026-10-19T23:48:50.861Z
  - verified: rev-31 [reviewer] · run rev-20261020-670-final-fallback · 2026-10-20T00:39:53.841Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-final · 2026-10-20T00:55:51.147Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
- [x] C3. `cland executor prepare` runs `[verification] prepare` in the builder's checkout in place of `npm ci` and the Neovim seed, as the fake machine's call log shows, and an unset `prepare` logs `prepare: not set` (`executor-prepare.test.ts`).
  - done: impl-670 · 2026-10-19T23:48:51.452Z
  - verified: rev-30 [reviewer] · run rev-20261019-670-corrected-source · 2026-10-19T23:58:21.840Z · commit 43aa7d3ae31c028f587986b92c8e7126b48523c7
  - verified: rev-30 [reviewer] · run rev-20261020-670-m2-source · 2026-10-20T00:02:46.306Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-final-fallback · 2026-10-20T00:39:53.841Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-source · 2026-10-20T00:47:36.148Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-final · 2026-10-20T00:55:51.148Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
- [x] C4. A failing `prepare` at delivery turns the run red with `prepare failed (exit <n>)` and its output, and neither `check` nor `test` runs. A `prepare` that leaves an unignored file fails with `prepare left the checkout dirty`.
  - done: impl-670 · 2026-10-19T23:57:22.093Z
  - verified: rev-31 [reviewer] · run rev-20261020-670-final-fallback · 2026-10-20T00:39:53.841Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-final · 2026-10-20T00:55:51.148Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
- [x] C5. `node hub/bin/verify-prepare.ts` with a matching key prints `dependencies match snapshot` and `Neovim pin matches snapshot` and runs neither step. With a moved lock it prints `dependencies changed: npm ci` and runs `npm ci` (script test with a fake `npm` on the PATH).
  - done: impl-670 · 2026-10-19T23:48:52.536Z
  - verified: rev-30 [reviewer] · run rev-20261019-670-corrected-source · 2026-10-19T23:58:21.840Z · commit 43aa7d3ae31c028f587986b92c8e7126b48523c7
  - verified: rev-30 [reviewer] · run rev-20261020-670-m2-source · 2026-10-20T00:02:46.306Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-final-fallback · 2026-10-20T00:39:53.841Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-source · 2026-10-20T00:47:36.148Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-final · 2026-10-20T00:55:51.148Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146
- [x] C6. This repository's `.cland/config.toml` sets `prepare = "node hub/bin/verify-prepare.ts"`, and a cland-shaped fake-droplet run's delivery log shows today's two lines (`executor-run.test.ts`).
  - done: impl-670 · 2026-10-20T00:02:17.495Z
  - verified: rev-31 [reviewer] · run rev-20261020-670-final-fallback · 2026-10-20T00:39:53.841Z · commit 418a8da52a253969b9128f8184fdc9695b33e552
  - verified: rev-31 [reviewer] · run rev-20261020-670-enforce-final · 2026-10-20T00:55:51.148Z · commit 170407605f5ac1a91b2265ed93d9bb9f7837b146

## Comments

### impl-670 · 2026-10-19T23:34:31.102Z

Implementation: builder runs root prepare with JSON CLAND_PREPARE_KEY, delivery uses each job's recorded prepare with snapshot key, failures preserve output and dirty paths. cland's script retains exact warm lock/pin lines and uses successful-install marker plus legacy image-marker fallback (Coordinator decision in topic-669) so existing images need no re-prepare. Native focused proofs: executor-run 17/17, executor-prepare 5/5; typecheck/test:lint green. Required executor-*, droplet-*, suite-* and verify-* serial local sweep in progress. Stage close checklist for supervising Lead: after hub restart, usual sharded dev cover must show dependencies match snapshot and Neovim pin matches snapshot on every shard.

### impl-670 · 2026-10-19T23:49:07.591Z

Source ready and pushed at c201b3e8f400e23553bd3cf5b33aac32ea2f5c18 after final fetch/merge of origin/dev. All C1–C6 marked done. A-6830 contains 81 serial local file receipts (537/537, zero fail/cancel/skip/TODO, 536.050s total) at task source 1700df92 plus final-head check, project-layout 0.099s and native droplet scenario 23.303s after base merge; own 15-file patch unchanged. Original owned fixture failure retained. Full source review assigned through reviewer routing; awaiting verdict before mode-free configured verification. QA policy none/after-stage, no item QA required.

### rev-30 · 2026-10-19T23:52:21.045Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-670-source
commit: c201b3e8f400e23553bd3cf5b33aac32ea2f5c18
scope: full
findings: [{"severity":"medium","text":"M1: New shell snapshot/green-red case takes 10.08955625 s and the new prepare-failure case at line 276 takes 5.070200333 s in A-6830; both exact identities lack baseline/allowance and exceed the active 5 s new-identity gate. Direct node --test omits that gate, and task-mode verification omits these T3 cases. Reduce/split while preserving assertions or obtain the permitted exact allowance before verification.","file":"hub/test/executor-run.test.ts","line":245}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear at c201b3e8. A-6840 contains the Standards/Spec review and independent receipt audit: all 81 local files total 537/537, and the 15 task patches are identical through the final merge. No functional spec mismatch found, but the two new native identities violate the active duration gate. Correct and request fresh source review before mode-free verification; no full task-head run requested. C1/C4 failed for M1; remaining criteria unverified on this pass. Stage warm-line cover checklist retained.

Criteria: C1 failed (M1: New shell snapshot/green-red test exceeds the active new-identity duration budget without an allowance.), C4 failed (M1: New delivery prepare-failure test exceeds the active new-identity duration budget without an allowance.).

### impl-670 · 2026-10-19T23:57:22.682Z

M1 corrected and pushed at 43aa7d3ae31c028f587986b92c8e7126b48523c7; A-6845 contains original/final receipts and production duration audit. Two combined native cases split into four identities with assertions retained; atomic actual builder→snapshot→delivery→green stays together under Coordinator-approved exact10s/E-880 allowance (2026-10-19→2026-10-26). Full changed file19/19, twelve production timing receipts; checkDurations reports zero failures. Snapshot proof5.945s, planted-red4.934s, failure2.943s, dirty2.950s. npm run check and whitespace check pass. Only tests+one allowance changed; no dev merge after first review. Requesting fresh source review before any configured verification.

### rev-30 · 2026-10-19T23:58:21.840Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-670-corrected-source
commit: 43aa7d3ae31c028f587986b92c8e7126b48523c7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, A-6847. M1 resolved: four native scenarios retain all prior assertions and public suite.start removes incidental CLI launch cost. Atomic builder/snapshot/green proof remains intact. Only that identity gets the directly Coordinator-authorized 10 s allowance, E-880 open epic, Oct19–26; all baseline/other allowance data unchanged. A-6845 raw 19/19 and 12 production timings independently read; corrected bodies 5.945/4.934/2.943/2.950 s, production checkDurations failures empty. No dev merge; production/fixtures unchanged from full functional review. C3/C5 verified using unchanged source and audited A-6830 local native proofs. C1/C2/C4/C6 await final settlement with configured same-head mode-free green; no Linux T3 claim. QA none; stage warm-line checklist retained.

Criteria: C3 verified, C5 verified.

### rev-30 · 2026-10-20T00:01:34.418Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261020-670-runtime
commit: 43aa7d3ae31c028f587986b92c8e7126b48523c7
scope: evidence
findings: [{"severity":"medium","text":"M2: Repository command contract still asserts prepare: '' after this task configures node hub/bin/verify-prepare.ts. A-6851 fails exactly this deep equality (actual new script, expected empty); preserve full command/tiers and recorded-plan assertions while updating the prepare expectation.","file":"hub/test/verification-commands.test.ts","line":67}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear, A-6852. Independently audited A-6851/93ef7b8f at exact reviewed head: 559 tests, 558 pass, 1 fail, zero cancel/skip/TODO, no resource mismatches. Raw ordinary failure 42866 and diagnostic 42936–42958 show only repository prepare expectation differs. This config-consumer assertion was missed in earlier source review. Required production config should remain; correct the assertion, retain all command/plan checks, and request fresh source review before replacement mode-free verify. C6 failed; C3/C5 source/local proof retained. M1 remains resolved. QA none; no Reviewer tests.

Criteria: C6 failed (M2: Configured same-head verification fails the stale repository prepare expectation in verification-commands.test.ts:67; T2 never runs.).

### impl-670 · 2026-10-20T00:02:17.987Z

M2 corrected in one expected prepare literal, pushed418a8da52a253969b9128f8184fdc9695b33e552. Local verification-commands T1 file reproduces original13/14 red and passes14/14 green after update; full equality/tiers and auto/all/hub/nvim pinned-plan assertions retained. npm run check and whitespace check green. A-6853 contains original red/green/static logs. Failed Linux93ef7b8f/A-6851 retained; no T2 ran. No production/allowance change or dev merge. Requesting fresh source review before replacement mode-free run.

### rev-30 · 2026-10-20T00:02:46.306Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261020-670-m2-source
commit: 418a8da52a253969b9128f8184fdc9695b33e552
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear, A-6854. M2 resolved by exactly one expected prepare literal; complete command/tiers and per-mode recorded-plan assertions retained. A-6853 original red 13/14 and green 14/14 independently audited, zero green nonpasses, corrected case .026928125 s. Parent is prior reviewed head; no production/fixture/baseline/allowance/dev-merge change. M1 remains resolved. C3/C5 reverified using unchanged source and audited A-6830 local proofs. C1/C2/C4/C6 await final settlement with replacement configured mode-free green at this exact head. Failed A-6851 retained; no Linux T3 claim. QA none; stage warm-line checklist retained.

Criteria: C3 verified, C5 verified.

### impl-670 · 2026-10-20T00:11:29.912Z

Same-head configured mode-free ff3164f5-cefb-4302-a7a1-b7f8134f355a passed at418a8da52a253969b9128f8184fdc9695b33e552:1913/1913, zero fail/cancel/skip/TODO; A-6867. T1 + fallback all T2 across hub/Neovim green. Linuxx64/Nodev24.21.0/Neovimv0.12.5; lifetime462s,cost$0.0321. Head/tree unchanged. Existing report-only notices retained. Waiting for Reviewer final evidence verdict; local native T3 evidence A-6830/A-6845 remains qualified, Linux T3 and shard warm lines stay stage/periodic/integrated evidence.

### rev-31 · 2026-10-20T00:39:53.841Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-670-final-fallback
commit: 418a8da52a253969b9128f8184fdc9695b33e552
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fallback final evidence at claimant's request after who confirms rev-30 offline and hub pending review routes here; no duplicate verdict/hold. A-6883 independently audits complete A-6867 ff3164f5: exact source-clear/pushed418a8da5,1913ordinary passes,zero nonpasses/resource mismatches/hard duration failures;host check and allT1+fallbackallT2green. M2 corrected repository contract passes at42866. Qualified native A-6830 81files/537passes and A-6845 corrected executor-run19/19/12timings independently inspected; relevant production/builder/script blobs unchanged from native source and corrected executor-run blob identical to final. C1/C2 actual shell snapshot/green/planted-red;C3builder/unset;C4failed prepare output/no worker and dirty paths;C5script matching/moved inputs;C6config/warm native delivery lines all established with prior source A-6847/A-6854. M1 exact10s allowance directly authorized, four corrected native bodies5.945/4.934/2.943/2.950s,production budget failures empty. All claimant done marks present. No remaining findings;C1–C6verified. Existing report-only unrelated diagnostics retained. Native receipts are local macOS, not LinuxT3;stage hub-restart/sharded-dev cover must still show both warm lines per shard. QA none/after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-670 · 2026-10-20T00:46:08.264Z

Enforce admission correction pushed170407605f5ac1a91b2265ed93d9bb9f7837b146 after Coordinator-directed single origin/dev merge (T-915 landed). A-6886 records five new measured T3 baselines (growth17.548153875s), existing aggregate updates/provenance, and exact allow.T3 seconds2115/ownerE-880/added2026-10-20/expires2026-11-20; prior exact snapshot10s allowance unchanged. Final-head verify --dry-run exits0; immutable production merge-budget check has zero failures/no estimate and ratchet2109.778s vs base2092.229s allowed. Live manifest lint, retained native durations under enforce, npm run check and whitespace checks pass. Requesting delta source review before fresh enforce-mode mode-free verification; prior1913-green remains historical.

### rev-31 · 2026-10-20T00:47:36.148Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-670-enforce-source
commit: 170407605f5ac1a91b2265ed93d9bb9f7837b146
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6887 source delta clear after primary99a3c0b1 authorized dev merge/admission repair. Merge885e8762parents418a8da5+dev03711a42;all14task code/test/fixture blobs unchanged, required prepare config/T3script classification retained. Post-merge only duration data: five exact raw native values matchA-6845/A-6830, prior per-test baselines retained, executor aggregate88.464157542/12 and script.776026333/1 correct. Only whole-tier allowance expands to2115/E-880/Oct20→Nov20(31days);independent base2092.229397+growth17.548153875=2109.777550875,headroom5.222449125. Snapshot exact10s allowance unchanged;provenance appended,no other metadata/budget weakening. Immutable final-head admission failures empty/no estimates;dry-run0,retained native duration checks pass. C3/C5 source/local proof current;C1/C2/C4/C6await new same-head configured enforce-mode green. PriorA-6867is historical. No findings;stage warm-line/LinuxT3/QA boundaries retained.

Criteria: C3 verified, C5 verified.

### impl-670 · 2026-10-20T00:55:27.456Z

Fresh configured enforce-mode1d084a17-2f9c-4b38-9f33-f05c0ac03aaf passed1915/1915 at reviewed170407605f5ac1a91b2265ed93d9bb9f7837b146; A-6888, zero fail/cancel/skip/TODO or duration/tier failures. T1 + fallback all T2 in both packages. Linuxx64/Nodev24.21.0/Neovimv0.12.5; lifetime418s,cost$0.0290. Head/tree unchanged. A-6886 supplies independent immutable T3 merge admission (measured2109.778s under2115 E-880 cap). Awaiting final Reviewer settlement. LinuxT3/stage shard warm-line checklist remains explicit.

### rev-31 · 2026-10-20T00:55:51.148Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-670-enforce-final
commit: 170407605f5ac1a91b2265ed93d9bb9f7837b146
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6889 full raw A-6888 audit at exact unchanged17040760: configured mode-free1d084a17 passes1915ordinary tests,zero nonpasses/resource mismatches/duration failures/overages/regressions/missing baselines. Host check and allT1+fallbackallT2pass under enforce;0new groups. Repository command contract passes42876. NativeT3absent from task run; actual task ratchet2092.229=base is distinct from A-6886 immutable admission proof2109.777550875<=2115 measured cap/no estimates, validated in sourceA-6887. C1/C2/C4/C6combine fresh same-head gate with unchanged qualified local macOS nativeA-6830/A-6845;C3/C5source/local marks remain valid. All criterion done marks confirmed;C1–C6verified,no findings. PriorA-6867historical only. Stage hub-restart/sharded-dev warm-line checklist, periodic/integrated LinuxT3 and QA none/after-stage remain explicit.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-20T01:00:12.121Z

Merged 0f8cb85b75c17adb30cbc8d62c595ed8a22be5db onto dev.
