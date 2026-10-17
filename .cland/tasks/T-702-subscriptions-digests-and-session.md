---
id: T-702
kind: task
title: Subscriptions, digests and session archive move to T2 on the fake clock, with restarts as projectHub stop and serve
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-685
  - T-686
  - T-687
topic: topic-465
branch: t/T-702-subscriptions-digests-and-session
created: 2026-10-16T19:59:37.198Z
updated: 2026-10-17T23:39:57.173Z
---

## Summary

These files prove hub rules (digest ordering, steering, usage thresholds, archive windows, journal replay) through harness matrices, real archive windows and hub restarts (report-slice2 #6 and anti-patterns A and D, report-slice3 anti-pattern 8, report-slice4 anti-pattern A):

| File | Seconds | Note |
|---|---:|---|
| `subscription-hygiene.test.ts` | 57.4 | "digest now steers" ×3 harnesses: 18.4 s |
| `default-subscriptions.test.ts` | 54.7 | double restarts in loops |
| `subscriptions.test.ts` | 51.9 | harness permutations × restart: 18 s |
| `session-archive.test.ts` | 57.2 | four fake launches and a real 2 s archive window |
| `agents-journal.test.ts` | 24.6 | six stop/start round trips |

## What to build

- **One proof, then a table.** Digest and steer rules keep one Claude Code frame proof (T3) and run as a T2 table over T-686's flavours.
- **Windows on the clock.** Archive windows, idle-notify windows and usage thresholds are advanced on T-685's `FakeClock`.
- **Persistence.** Durability is proven by `projectHub` stop and serve on the same root, or by reopening the `Store`.
- **What stays T3**, with a header: `default-subscriptions`' real-pid SIGKILL cases.
- **Replay.** `agents-journal`'s replay-after-crash and no-replay-after-prune tests merge into `agents-checkpoint.test.ts` (T1).

## Acceptance criteria

- [x] C1. The five files' manifest seconds fall from 245.8 s (A-3877) to 130 s or less.
  - done: impl-702 · 2026-10-17T22:08:35.171Z
  - verified: rev-30 [reviewer] · run rev-20261017-702-source · 2026-10-17T22:13:04.553Z · commit c14def9938ad21371a98d15761ba430ed31391dd
  - verified: rev-30 [reviewer] · run rev-20261017-702-allowance-delta · 2026-10-17T22:42:38.262Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-final · 2026-10-17T23:12:35.124Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-dev-delta · 2026-10-17T23:14:41.523Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
  - verified: rev-30 [reviewer] · run rev-20261017-702-merged-final · 2026-10-17T23:39:55.737Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
- [x] C2. Their fake-binary call sites fall from 22 to 5 or less, `startDaemon` sites from 37 to 6 or less, and numeric sleeps from 8 to 0.
  - done: impl-702 · 2026-10-17T22:08:35.721Z
  - verified: rev-30 [reviewer] · run rev-20261017-702-source · 2026-10-17T22:13:04.553Z · commit c14def9938ad21371a98d15761ba430ed31391dd
  - verified: rev-30 [reviewer] · run rev-20261017-702-allowance-delta · 2026-10-17T22:42:38.262Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-final · 2026-10-17T23:12:35.124Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-dev-delta · 2026-10-17T23:14:41.524Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
  - verified: rev-30 [reviewer] · run rev-20261017-702-merged-final · 2026-10-17T23:39:55.737Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
- [x] C3. The moved rules pass the tier lint as T1 or T2, and the remaining T3 tests each name their process behaviour.
  - done: impl-702 · 2026-10-17T22:08:38.462Z
  - verified: rev-30 [reviewer] · run rev-20261017-702-source · 2026-10-17T22:13:04.553Z · commit c14def9938ad21371a98d15761ba430ed31391dd
  - verified: rev-30 [reviewer] · run rev-20261017-702-allowance-delta · 2026-10-17T22:42:38.262Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-final · 2026-10-17T23:12:35.124Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-dev-delta · 2026-10-17T23:14:41.524Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
  - verified: rev-30 [reviewer] · run rev-20261017-702-merged-final · 2026-10-17T23:39:55.737Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-702 · 2026-10-17T22:08:38.995Z
  - verified: rev-30 [reviewer] · run rev-20261017-702-source · 2026-10-17T22:13:04.553Z · commit c14def9938ad21371a98d15761ba430ed31391dd
  - verified: rev-30 [reviewer] · run rev-20261017-702-allowance-delta · 2026-10-17T22:42:38.262Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-final · 2026-10-17T23:12:35.124Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - verified: rev-30 [reviewer] · run rev-20261017-702-dev-delta · 2026-10-17T23:14:41.524Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
  - verified: rev-30 [reviewer] · run rev-20261017-702-merged-final · 2026-10-17T23:39:55.737Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-702-final · 2026-10-17T23:12:35.124Z · commit cee099e645c970aaaf4891531ab3a3a8c0c91f18
  - done: impl-702 · 2026-10-17T23:39:39.558Z
  - verified: rev-30 [reviewer] · run rev-20261017-702-merged-final · 2026-10-17T23:39:55.738Z · commit 67d98e0fee59541e1b74931abc7ea4c84006d2ab

## Blocked by

T-685 (hub Clock seam), T-686, T-687. Starts after T-575 merges (it touches `session-archive` and `agents-journal`).

## Comments

### impl-702 · 2026-10-17T22:00:48.749Z

Implementation now migrates the five rule files to T2, adds T1 checkpoint replay/prune proofs, and retains native PID recovery, Git review/QA and merge boundaries plus one Claude digest frame in named T3 splits. Typecheck/tiers pass; test lint has no findings in touched files. Running every touched file whole-file 5/5 serially under load <15; C4 audit inventories all 53 original declarations and 522 assertion sites.

### rev-30 · 2026-10-17T22:13:04.553Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-702-source
commit: c14def9938ad21371a98d15761ba430ed31391dd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec clear, no findings. Assertion map matches525 original sites/53declarations+3helpers; in-process rule/replay/clock seams retain observations and four namedT3 carriers retain native boundaries. Census4binary/4daemon/0sleep. A-4779 raw50accepted runs310passes/0fail-cancel-skip;13source hashes match. Recomputed all-destination Mac median sum41.580233420s≤130 (rounded table41.581), primary efacfb05 metric. Four dated E-677 allowances supported; exploratory exact connected identity5.964867s is A-4783, used only for allowance. Baselines unchanged. Audit A-4785. C1–C4 verified; C5 awaits positive exact-head droplet receipts for every touched destination. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T22:41:42.899Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-702-runtime
commit: c14def9938ad21371a98d15761ba430ed31391dd
scope: evidence
findings: [{"severity":"medium","text":"Moved pooled-Reviewer lifecycle identity takes7.126130367s on Linux and has no hard new-test duration allowance; A-4813 rejects7.126s>5s, so exact-head verification exits1 despite passing assertions.","file":"hub/test/default-subscriptions-lifecycle.test.ts","line":7}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear; A-4814. A-4813 exact-head run28b82998 exits1: moved pooled-Reviewer lifecycle identity7.126130367s exceeds hard new-test5s without allowance (line32689). All62 owned ordinary cases and13x5load repetitions pass; whole hub2094pass/0fail/5skip. No Neovim-smoke completion; raw health.ts MODULE_NOT_FOUND sampling errors separately disclosed to lead. C1–C4 source verification remains; C5 fails pending an accepted passing run. Existing primaryefacfb05 permits measured moved-native seven-day E-677 allowances without baseline refresh; any changed head requires source delta review before another verification.

Criteria: C5 failed (Exact-head run28b82998/A-4813 exits1 on the owned pooled-Reviewer lifecycle case7.126130367s>5s without an allowance; passing final verification is absent.).

### impl-702 · 2026-10-17T22:42:13.088Z

28b82998 at c14def99: all62 owned Linux cases and65/65owned new-identity repetitions pass; suite exit1 on sole missing native duration allowance (7.126130367s), plus missing health.ts collector diagnostics and no Neovim-smoke completion reported to Coordinator. Correction cee099e6 is allowance-only (7 lines, E-677/7-day reasoned10s), delta review requested. Evidence A-4813 and owned receipt extract A-4815. C5 remains pending a complete green fresh exact-reviewed-head run.

### rev-30 · 2026-10-17T22:42:38.262Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-702-allowance-delta
commit: cee099e645c970aaaf4891531ab3a3a8c0c91f18
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-4816. Standards/Spec no findings. Sole seven-line change adds exact pooled-Reviewer lifecycle identity10s allowance, E-677,2026-10-17/24, reason cites actual7.126130367s Linux run28b82998/A-4813, per primary22497454. All other allowances/baselines/source/tests/helpers/tiers unchanged; no dev merge. Prior M1 corrected. Existing source audit/Mac evidence remains applicable; C1–C4 refreshed at this head. C5 remains failed/pending accepted current-head gate; previous exit1/missinghealth.ts/no-smoke receipt is not final green. Obtain any required Coordinator collection/retry direction and submit normal mode-free verify at this unchanged head. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T23:12:35.124Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-702-final
commit: cee099e645c970aaaf4891531ab3a3a8c0c91f18
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged cee099e6. Independently audited A-4838, run c9f6cdd6: all ten destination files and 62 owned cases have ordinary passing reporter lines and completed timing receipts; all 13 new identities pass 5/5 load repetitions (65/65). Selected run exited zero with 2,106 passes, zero failures/cancellations and five unrelated prerequisite skips; Neovim smoke completed. No hard duration budgets remain. A-4779's fifty successful Mac whole-file transcripts remain applicable to unchanged tests; accepted ten-file Mac median sum 41.580233420s meets C1. Prior source mapping preserves all 525 original assertions and native boundaries. E-677 allowance ownership and expiry checked. C5 claimant done restored in 66a8c05c. Full audit and timing/platform limits: A-4840. No findings; C1–C5 verified. No per-item QA required.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-17T23:14:41.524Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-702-dev-delta
commit: 67d98e0fee59541e1b74931abc7ea4c84006d2ab
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec source clear; no findings. Coordinator ebdec614 explicitly authorizes this dev merge. Independently reconstructed tiers.json: exact incoming-dev map plus nine reviewed task entries; upstream scenarios/T-753 classifications preserved. Durations is exact dev plus five unchanged E-677 task allowances, with all incoming baseline fields and ownership corrections retained. All ten destination tests, shared helper and evidence docs are byte-identical to cee099e6; remaining 58 changed paths outside manifests match incoming dev verbatim. Prior Mac/source census and 525-assertion mapping remain applicable; C1–C4 refreshed. A-4841 reports required static checks passing. A-4842 records independent audit. C5 remains unverified until fresh normal mode-free droplet receipt at this head; parent A-4838 remains historical. Honor any hub restart hold. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T23:39:55.738Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-702-merged-final
commit: 67d98e0fee59541e1b74931abc7ea4c84006d2ab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-4853. Independently audited A-4852 exact-head run d6dcef3c: all ten owned files/62 ordinary cases have completed timings and passing reporter lines, all 13 owned new identities pass 5/5 gates (65/65). No scoped skips or hard duration-budget failures. Whole selected hub-only + current Neovim smoke run exits zero: 2,106 passes, zero failures/cancellations, five unrelated prerequisite skips; smoke 5/5 completed. Linux owned sum 67.920059750s disclosed beside accepted Mac median sum 41.580233420s, meeting C1. A-4842 source delta remains current and task tests/helper match A-4779 Mac source; original 525 assertion mapping/native boundaries retained. C5 done refreshed in c5b26701. No findings; C1–C5 verified at current merge head. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
