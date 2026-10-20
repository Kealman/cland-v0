---
id: T-673
kind: task
title: "nvim sessions test: the reset-label case depends on the time of day and fails near Kolkata midnight (18:30Z)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - flaky
  - nvim
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-679
branch: t/T-673-nvim-sessions-test-the-reset-label-case
created: 2026-10-16T18:32:31.742Z
updated: 2026-10-20T02:24:14.723Z
closed: 2026-10-20T02:24:14.723Z
---

## Summary

nvim/test/sessions.test.ts "source windows keep severity, local resets and stale age, wrap at 30 columns and leave default sessions unnamed" depends on the time of day. It runs the UI in TZ=Asia/Kolkata (UTC+5:30) and builds reset times from `Date.now()`, so a run near Kolkata midnight (18:30Z) crosses a day boundary between the test's clock and the UI's render, and the weekday/date labels it expects change. It failed this way in T-657's droplet run 84ec4964 (A-4107, log lines 7155–7170), which reached the Neovim phase at about 18:30Z: `stale.includes('↻<weekday> <time>')` for the tomorrow window was false.

## What to build

The test takes a fixed instant well away from a day boundary in its zone, or injects the UI's clock, so the labels it asserts don't depend on when the suite runs. Each assertion keeps its meaning: today's reset shows a time, tomorrow's a weekday and time, a later one a date.

## Acceptance criteria

- [x] C1. The case passes when the suite's clock is set just before and just after Kolkata midnight, proved by running it with the two instants (an injected clock or a fixed `now`), with its assertions' meaning unchanged.
  - done: impl-673 · 2026-10-20T02:13:28.447Z
  - verified: rev-31 [reviewer] · run rev-20261020-673-source-recorded · 2026-10-20T02:15:07.122Z · commit bddcb2e56d0f71828dd58cbdf6404d310100e614
  - verified: rev-31 [reviewer] · run rev-20261020-673-final · 2026-10-20T02:19:59.404Z · commit bddcb2e56d0f71828dd58cbdf6404d310100e614
- [x] C2. nvim/test/sessions.test.ts passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-673 · 2026-10-20T02:18:35.053Z
  - verified: rev-31 [reviewer] · run rev-20261020-673-final · 2026-10-20T02:19:59.404Z · commit bddcb2e56d0f71828dd58cbdf6404d310100e614

## Comments

### impl-673 · 2026-10-20T01:42:21.620Z

Baseline c388c844 already pins the source-window case at noon and overrides Lua os.time. T-673 adds full-case regressions at 2026-10-19T18:29:58Z and 18:30:01Z (Kolkata midnight), keeps severity/stale age/default identity/wrapping assertions, and uses independent literal reset labels. Target seam remains the authorized T2 recorded-frame UI. Cover-quiet postpones executing the red/green loop until the Coordinator lifts it.

### impl-673 · 2026-10-20T01:43:53.274Z

Head 32375a3f46ac853bf9626824b3c8b7aafb1b6ae3 committed and pushed after fetch/merge origin/dev. Source-review request queued for next free Reviewer. A-6933 is the admitted pre-review dry-run; A-6934 records change and validation plan. Typecheck green. Coordinator authorized source review and then droplet verification while Mac C2 and red/green evidence await cover-quiet lift.

### rev-31 · 2026-10-20T01:46:46.326Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-673-source
commit: bdd175924b026e5a28a40449c2a003bf7c70a83d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6940: source clear, no remaining Standards/Spec findings. Original recorded-frame UI assertions retained; three fixed Lua/fixture clocks cover noon and Kolkata23:59:58/00:00:01 with independently checked time/weekday/date literals. Rendered-frame question resolved: wide wait requires current labels twice and narrow wait requires wrapped wk, final assertions retained. Only existing T2test file changes; no new boundary/identity/allowance. C1/C2 remain unverified until actual boundary receipts and five serial Mac whole-file passes plus whole-file task droplet pass. Local tests explicitly unrun under Coordinator cover-quiet; source clear permits unchanged-head configured mode-free droplet verification. QA none; no Reviewer tests/edits.

### impl-673 · 2026-10-20T01:50:56.442Z

Droplet 655539da at bdd17592: 823 pass/1 fail; changed source-window case fails on unrecorded account push, not calendar assertion (A-6942 lines44388–44397). Per-file recorder needed: npm run test:nvim-fixtures -- nvim/test/sessions.test.ts. Coordinator explicitly holds this real-process recorder and Mac tests until cover-quiet lift (~02:20Z), then record, Mac 5/5 plus deterministic red/green clock-drift check, delta review, new verify. No shared-defect flag; no unrelated code changes needed.

### rev-31 · 2026-10-20T01:51:21.400Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-673-runtime
commit: bdd175924b026e5a28a40449c2a003bf7c70a83d
scope: evidence
findings: [{"severity":"medium","text":"M1: New emitted account frame is missing from recorder catalogue. A-6942:44390 rejects unrecorded frame key b0d8edcc0981a205be618977f4ad4f2daf68cd7ae3e66d1c5e91d3020bdf9750 before label assertions. Generate required fixtures via documented recorder, preserve assertions and prior entries, then fresh source review/verification.","file":"nvim/test/sessions.test.ts","line":106}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6944: runtime not clear. A-6942 exact reviewed head has823/824passes, sole changed case fails .467136798s at43815;raw44390names unrecorded account-push frame. No duration/resource diagnostics; failure precedes date assertions. Owned recorder data was missed during source review, not an external shared defect. C1/C2failed. Preserve assertions and use documented recorder after Coordinator cover-quiet lift, then Mac proof/fresh delta source review/new mode-free gate per reported Coordinator sequence. No unauthorized local test/retry implied. QA none;no Reviewer tests/edits.

Criteria: C1 failed (Changed boundary case fails on unrecorded account frame before its date assertions.), C2 failed (Task droplet whole file is red; five serial Mac whole-file passes also remain pending.).

### impl-673 · 2026-10-20T02:13:42.328Z

Cover-quiet lift received. Per-file documented recorder passed all 4 tests (A-6952), adding exactly 3 records to main catalog (5322→5325) and sessions slice (77→80); structural audit confirms zero existing records removed or changed. Head bddcb2e56d0f71828dd58cbdf6404d310100e614 contains only these fixture additions over source-reviewed bdd17592; no dev merge. A-6953 deterministic red injects +3 seconds in rendering clock: before-midnight frame renders after midnight and exact labels fail at 18:29:58Z with 31m age intact. Original bytes restored. A-6954 then passes entire file 5/5 serially on Mac: wall 1.159, 1.159, 1.204, 1.160, 1.174 s (changed case 0.174–0.186 s); no skips. Root typecheck and exact-head dry-run green. Requesting fresh delta source review before replacement mode-free verify.

### rev-31 · 2026-10-20T02:15:07.122Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-673-source-recorded
commit: bddcb2e56d0f71828dd58cbdf6404d310100e614
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6963: source clear, M1 resolved. Only main recorder catalogue/sessions slice change: each6nodes/3records added,zero prior changes/removals; exact rejected account key now present, slice matches catalogue. Test source identical to bdd17592 and original SHA in A-6953. A-6952documented recorder4/4;A-6954five serial Mac whole files4/4 each,no skips,wall1.159–1.204s,changedcase.174137625–.186239250s. Explicit+3s clock mutationA-6953fails at Kolkata23:59:58 withstale31mintact,then restores exact bytes; not a claim of parent regression. C1verified. C2Mac half proven but final awaits replacement exact-head configured mode-free droplet whole-filepass. Prior A-6942red retained; no findings, no Reviewer tests/edits;QA none.

Criteria: C1 verified.

### rev-31 · 2026-10-20T02:19:59.404Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-673-final
commit: bddcb2e56d0f71828dd58cbdf6404d310100e614
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6985: final clear. Whole A-6980at unchanged reviewed/pushedbddcb2e5 has824/824passes,no duration/resource/missing diagnostics. sessions file4/4,summed1.365913632s; boundary case.309604240s at43811. Combined with independently audited A-6954Macwholefile5/5and controlled drift proofA-6953/sourceA-6963 establishesC1/C2. Actual fixture correction preserves prior records,M1resolved; A-6942red retainedhistorically. Allclaimantdone,currentheadunchanged,no findings. QA none;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T02:24:14.723Z

Merged a1bc5894f81d8da0310538ecf130e4d0ea3f7a2c onto dev.
