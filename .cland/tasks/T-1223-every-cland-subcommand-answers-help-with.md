---
id: T-1223
kind: task
title: Every cland subcommand answers --help with its usage and exit 0
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-990
branch: t/T-1223-every-cland-subcommand-answers-help-with
created: 2026-10-24T09:45:41.634Z
updated: 2026-10-24T15:16:41.899Z
closed: 2026-10-24T15:16:41.899Z
---

## Summary

Found by impl-783 in the T-783 docs pass (2026-10-24 09:41Z, topic-953). The docs promise `cland <command> --help` for every command, but in a scratch project `cland hub --help` exits 2 with `unknown hub command "--help"`, `cland task --help` exits 2, and `cland session --help` exits 1 with `no hub runs for this project`. T-1188 fixed `release`, `sync`, `publish`, `push` and `merge`; the rest still lack it. A newcomer's first move after install is `--help`.

## Acceptance criteria

- [x] C1. Every top-level command and every command group (`hub`, `task`, `session`, `verify`, `topic`, `executor`, `web`, `role`, and the rest `cland --help` lists) answers `--help` and `-h` with its usage and exit 0, without a running hub and without touching the project, shown by one table-driven CLI test over the commands `cland --help` lists.
  - verified: rev-26 [reviewer] · run rev-20261024-1223-final-1 · 2026-10-24T14:48:09.185Z · commit 5a914c8b07db0f32ca4dd51234c99f9f848832a5
  - done: impl-1223 · 2026-10-24T14:57:20.182Z
  - verified: rev-26 [reviewer] · run rev-20261024-1223-final-2 · 2026-10-24T15:10:53.199Z · commit 6ce0837980a8e963080226eef71ab5d4c43b01db
- [x] C2. A command or group added later without help fails that test.
  - verified: rev-26 [reviewer] · run rev-20261024-1223-source-2 · 2026-10-24T14:07:01.861Z · commit d0333145427c40188ecc0c16532d9869427fc81c
  - verified: rev-26 [reviewer] · run rev-20261024-1223-source-3 · 2026-10-24T14:34:49.402Z · commit 5a914c8b07db0f32ca4dd51234c99f9f848832a5
  - verified: rev-26 [reviewer] · run rev-20261024-1223-final-1 · 2026-10-24T14:48:09.185Z · commit 5a914c8b07db0f32ca4dd51234c99f9f848832a5
  - done: impl-1223 · 2026-10-24T14:57:20.405Z
  - verified: rev-26 [reviewer] · run rev-20261024-1223-source-4 · 2026-10-24T14:58:27.444Z · commit 6ce0837980a8e963080226eef71ab5d4c43b01db
  - verified: rev-26 [reviewer] · run rev-20261024-1223-final-2 · 2026-10-24T15:10:53.199Z · commit 6ce0837980a8e963080226eef71ab5d4c43b01db

## Comments

### impl-1223 · 2026-10-24T14:01:10.608Z

Implemented and pushed c55360cd. Table-driven real CLI regression covers all 33 commands listed by actual help, both flags, sealed scratch no-hub/project/profile immutability; green 35/35 tests incl subtests. Test-first red reproduced 23 command-row failures; a temporary newly listed future-command independently failed the table, then was removed and the complete file passed again. Existing import guards 3/3 and hub typecheck pass; static lint 0 refusals (test lint report mode retains 133 findings). Full verification awaits source review. Evidence artifact published in topic-990.

### impl-1223 · 2026-10-24T14:05:07.494Z

Corrected Reviewer M1/C2. Actual help temporarily included future2-command without dispatch: old discovery incorrectly passed 34/34 (33 command subtests + parent), proving the omission. Complete non-option token discovery now makes future2-command fail with `future2-command --help: cland: unknown command "future2-command"` (exit 2), while all 33 existing command rows pass. Removed temporary row; targeted cli-help T2 file on local Darwin arm64 passes 35/35 incl subtests and hub typecheck passes. Source correction touches only test parsing/usage-token assertion and test notes; no post-review dev merge or production changes. Fresh review required; full verification still not run.

### rev-26 · 2026-10-24T14:07:01.861Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1223-source-2
commit: d0333145427c40188ecc0c16532d9869427fc81c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11164 records corrected full Standards/Spec source review; both clear, no findings. M1/A-11158 resolved by complete non-option token discovery at exact two-space indentation and literal usage-token comparison; dynamic future2-command now enters a failing row without dispatch. Production map and 33-row/two-flag no-hub/project/profile assertions retained. C2 source verified; C1 requires same-head configured runtime evidence. A-11161 is summarized original local mutation/green/typecheck evidence, not full raw stdout/timing or configured suite proof. Source clear permits mode-free cland verify at unchanged d0333145; fresh evidence review required, no final runtime/QA/landing claim.

Criteria: C2 verified.

### rev-26 · 2026-10-24T14:24:16.476Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1223-evidence-1
commit: d0333145427c40188ecc0c16532d9869427fc81c
scope: evidence
findings: [{"severity":"medium","text":"M2 evidence: new aggregate table passes all assertions but exceeds enforced new-test duration gate8.231914018s>5s, causing T2/overall exit1. Measured correction/allowance needs fresh source review before retry.","file":"hub/test/cli-help.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

A-11193 records original failed duration-gate receipt.2394 ordinary test passes/341hub file passes plus170load test records (5parent repetitions+165leaf subtests), zero assertion failures/skips. Complete help file35/35 ordinary; parent samples8.231914018 base and8.275610322/8.689887198/9.061732655/8.932887647/8.563241325 load. T0/T1 pass,T2exit1; no completed Neovim/Web/T3/T4 claim. C2 source verified remains unchanged; C1 final evidence fails. Preserve all rows/flags/identity/assertions/bounds and native samples; commit measured allowance/CPU correction and request source review before new mode-free verify. No unchanged-head retry/shared-defect/ready/QA/landing claim.

Criteria: C1 failed (Configured run1f339d87/A-11192 exits1 on aggregate help-table enforced duration gate8.231914018s>5s; no usable final configured pass.).

### impl-1223 · 2026-10-24T14:32:02.715Z

Corrected M2 under Coordinator decision c3e6593e-7af1-4cd5-9755-4f23ed91288c: pushed 42a38254, no allowance. All 33 commands/both flags now run through the same pure help entry as the executable at T1 (~6.84ms local Darwin arm64); T2 retains exactly 3 sealed real CLI launches (3/3, file249ms). Digit-bearing advertised future2-command mutation fails T1, then removed. Targeted existing T3 imports3/3; hub typecheck/static/tier lint pass (test lint report-only133 findings/0refusals). Guides/index updated. Original configured A-11192 remains failed old-head evidence; new verification awaits fresh full source review. No post-review dev merge.

### impl-1223 · 2026-10-24T14:34:04.713Z

M3 docs/index guard corrected in pushed 5a914c8b (docs-only follow-up to split head42a38254). Existing targeted T1 test-docs.test.ts reproduced exit1 on duplicate index target, then passed3/3 after separate correctly path-headed guides/index entries. Guard unchanged; original red/green in A-11208 (red output marked tool-truncated). Full source continuation requested at new head; no verification before clear and no post-review dev merge.

### rev-26 · 2026-10-24T14:34:49.402Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1223-source-3
commit: 5a914c8b07db0f32ca4dd51234c99f9f848832a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11209 records full redesigned Standards/Spec source review; no remaining findings. Actual Coordinatorc3e6593e authorizes full in-process T1 table/exactly3T2 executable checks/no allowance. Shared commandHelp entry handles all33 listed commands/bothflags before imports/project discovery; undefined preserves non-help dispatch. M1 token discovery retained; M3 corrected via separate path-headed guides/unique index with unchanged guards. Top-level usage template/usage exports/frozen bytes unchanged. T1 sealed scratch/cwd/env restoration and T2 awaited5s bounded children retain final immutability/output/error checks. A11207/A11208 original local targeted receipts have explicit source/platform/truncation/missing-record limits. C2 source current verified; C1 needs fresh unchanged-head mode-free configured evidence. A11192 remains failed old-head evidence. No runtime/QA/landing claim.

Criteria: C2 verified.

### rev-26 · 2026-10-24T14:48:09.185Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1223-final-1
commit: 5a914c8b07db0f32ca4dd51234c99f9f848832a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11219 final same-head audit carries source3/A-11209 and Coordinator-approved split.4604eada/A-11218 exit0: parsed2997ordinary tests/428ordinaryfiles allpass, plus15actual load test repetitions across3identities each5/5. Full33-command/bothflagT1table0.011022283s;3T2children0.119976888/0.113368023/0.126847947s, no allowance. ChangedT3cli-imports3/3 once3.868190252/0.601579565/2.722011011s, addedwall7.494s, no stanza trigger. Docs3/3. T0/allT1/fallback allhub+NeovimT2/changedT3/Web pass; no remainingT3/T4 claim. Host23.993s/tree9ede57f4 separate/notrepeatedremote. Lint133/60,4missingbaselines/existingduration/Web warnings report-only. C1/C2allverified. Claimant reports clean unchanged head and exit0 read-only merge-tree against devc44650a6/candidate129d6fbf; no merge. No per-itemQA/landingclaim.

Criteria: C1 verified, C2 verified.

### impl-1223 · 2026-10-24T14:57:20.032Z

After batch fcc8ac5d/A-11223 failed on `release: --help has a help dispatch`, integrated exactly authorized devc44650a6 (merge5feeaf60), then pushed6ce08379. Real release dispatch already consumes T-779's updated RELEASE_USAGE. Corrected discovery to distinguish its colon-labelled explanatory row from commands; T-779 bytes/behavior, production dispatch and frozen fixtures unchanged. Each requested file once (cli-command-help, cli-help, cli-usage-compatibility, homebrew-download, homebrew, web-release):6files/10tests passed localDarwinarm64; fullnpmtypecheck passed. Merge-only delta source review requested before one new mode-free run; no additional dev integration.

### rev-26 · 2026-10-24T14:58:27.444Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1223-source-4
commit: 6ce0837980a8e963080226eef71ab5d4c43b01db
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11229 integration delta clear; actual Coordinator99cb1abd authorizes one devc44650a6 merge. Verified merge parents and only postmerge table/guide reconciliation. Filter excludes only release: explanatory label from actual current help, leaving all33 real tokens; complete digit-bearing discovery/future2 mutation behavior preserved. Helpentry/executable/T2checks/fixtures/importguard unchanged from accepted5a914c8b. T779release.ts/usage/frozenfixtures/homebrewtests byte-equaldev, no behavior/byte/assertion/bound/allowance relaxation. A11227 six local namedfiles10tests pass with originalstdout/exits/timings; typecheck complete stdout missing explicitly. C2 source verified; prior greenA11218 and failedbatchA11223 historical. One unchanged-head mode-free verify then evidence review required for C1. No further autonomous dev merge if conflict; no runtime/QA/landing claim.

Criteria: C2 verified.

### rev-26 · 2026-10-24T15:10:53.199Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1223-final-2
commit: 6ce0837980a8e963080226eef71ab5d4c43b01db
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11243 final exact-head evidence carries source4/A11229. Mode-freef4261863/A11242 exit0: parsed3031ordinarytests/430files allpass, plus15actual loadtests3identities each5/5. Integrated33command T1table0.009239905s; T2frozenhelp0.141071433/hubhelp0.134280950/session-h0.114831615s; no allowance. ChangedT3imports3/3once max3.571690488s, sum6.642s/addedwall6.884s, no stanza. Frozencompat/Homebrew/docs pass. T0/allT1/fallback allhub+NeovimT2/changedT3/Web pass; no remainingT3/T4claim. Host29.813s/tree5a69ac42 separate/notrepeatedremote. Lint133/60,sixmissingbaselines/existingduration/Webwarnings report-only. C1/C2allverified. Final freshdev read-only conflict check/cleanhead readyreport remains claimant responsibility; no autonomous furthermerge if conflict. No itemQA/landingclaim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T15:16:41.899Z

Merged 8a069e4a3a05fc4647f3be98d9b8fe334db42171 onto dev.
