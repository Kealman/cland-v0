---
id: T-1133
kind: task
title: The verify line and the queue view
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
topic: topic-874
branch: t/T-1133-the-verify-line-and-the-queue-view
created: 2026-10-22T15:16:15.253Z
updated: 2026-10-22T23:38:58.458Z
---

## Summary

The verify line in the Sessions area summarizes the verification queue in one line and opens in place into the queue view of P21, its times aged from the frame's receipt.

## Parent

E-418 (§3.2, P21; v0.1.2 §3.6 and §3.14; tracer step 2).

## What to build

- **The line:** who holds the local slot and for how long, the remote slots in use against the remote budget, how many wait, and the next admission ETA, as Neovim's `verify:` line with the remote part added.
- **The queue view.** Enter or a click on the line toggles it in place, its open state remembered in this browser like a fold: the local slot (holder, item, mode or occasion, worktree, running time and remaining ETA); each remote slot with its droplet (machine name, size, region, since); the waiters in order with the executor each asked for, their wait and admission ETA; the metrics of the last 20 runs (run and wait median and p90); and today's droplet spend against the cap, read once with `executor.status` when the view opens.
- **Ageing.** The hub pushes the queue only when it changes, so running times and waits advance on the client from the frame's arrival; ETAs stay the hub's estimates, shown with ~.

A pure model turns a queue, the elapsed time and the executor status into the line and the view's rows. Neovim's `verification.lua` defines the summary and the ageing.

## Acceptance criteria

- [x] C1. With a hand run holding the local slot and one waiter, the line reads the holder, its running time and one waiting, and Enter opens the queue view in place with the holder and the waiter with its executor, wait and ETA (Web test).
  - done: impl-1133 · 2026-10-22T23:24:51.843Z
  - verified: rev-26 [reviewer] · run rev-20261022-1133-final-1 · 2026-10-22T23:36:39.579Z · commit 35a35f72808b9175d968384b465bb6d872b8e32b
- [x] C2. The queue model renders remote slots with their droplet's name, size and region, the waiters in order, the last-20 metrics and today's spend against the cap from recorded frames (T1 test).
  - done: impl-1133 · 2026-10-22T23:17:40.803Z
  - verified: rev-26 [reviewer] · run rev-20261022-1133-final-1 · 2026-10-22T23:36:39.579Z · commit 35a35f72808b9175d968384b465bb6d872b8e32b
- [x] C3. Without a new frame the holder's running time and the waiter's wait advance from the frame's receipt, and a `verification.queue` frame replaces the view (Web test).
  - done: impl-1133 · 2026-10-22T23:24:51.963Z
  - verified: rev-26 [reviewer] · run rev-20261022-1133-final-1 · 2026-10-22T23:36:39.579Z · commit 35a35f72808b9175d968384b465bb6d872b8e32b
- [x] C4. The queue view's open state survives a reload (Web test).
  - done: impl-1133 · 2026-10-22T23:17:41.468Z
  - verified: rev-26 [reviewer] · run rev-20261022-1133-final-1 · 2026-10-22T23:36:39.579Z · commit 35a35f72808b9175d968384b465bb6d872b8e32b
- [x] C5. `web/README.md` describes the verify line and the queue view (docs).
  - done: impl-1133 · 2026-10-22T23:17:41.639Z
  - verified: rev-26 [reviewer] · run rev-20261022-1133-source-2 · 2026-10-22T23:26:11.240Z · commit 35a35f72808b9175d968384b465bb6d872b8e32b
  - verified: rev-26 [reviewer] · run rev-20261022-1133-final-1 · 2026-10-22T23:36:39.579Z · commit 35a35f72808b9175d968384b465bb6d872b8e32b
  - verified: rev-26 [reviewer] · run rev-20261022-1133-source-3 · 2026-10-22T23:38:58.458Z · commit ee0dce9b556927edba4fe35adcfbc1fc17491625

## Comments

### impl-1133 · 2026-10-22T23:17:01.014Z

Implemented the pure queue presentation model first against committed recorded verification.queue and executor.status frames from sealed scratch fixtures, then the Sessions in-place queue using shared Fold persistence and session-open dispatch. Targeted T1 and Web C1/C3/C4 pass on macOS; existing Sessions/folds/key-contexts/palette regressions pass. web/README and test-seam docs updated. Merged origin/dev before first source review; final same-head static and targeted checks underway. No live queue or real droplet touched.

### rev-26 · 2026-10-22T23:21:29.348Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1133-source-1
commit: 0ddd0ab150db0f3bb3f7d254389f07046cc182e6
scope: full
findings: [{"severity":"medium","text":"M1: Advertising session-open as handled prevents native Enter everywhere in Sessions, while the handler activates only the queue; existing group folds and other native buttons lose Enter activation. Preserve focused native activation and add physical-Enter regressions outside the queue.","file":"web/src/sessions/SessionsArea.tsx","line":18},{"severity":"medium","text":"M2: C1/C3 wait for the fold/table shell rather than the initial queue receipt and exact holder/waiter facts; slow delivery races immediate assertions and the ageing clock advance. Bound initial data observation separately and retain final/replacement assertions (rule 9).","file":"web/test/verification.test.ts","line":29}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear at 0ddd0ab1; complete Standards/Spec audit in A-9499. Two medium findings: M1 Sessions native Enter regression (SessionsArea.tsx:18); M2 missing initial data observation in new C1/C3 Web cases (verification.test.ts:29,62). Pure model, remote/metrics/spend presentation, receipt replacement, persistence, fixture tiers and matching docs otherwise reviewed without additional findings. No tests or browser run by Reviewer; no configured run claimed. Finish fixes and original receipt retention, then request fresh source review before verification.

Criteria: C1 failed (Queue Enter handling swallows native Enter on existing Sessions buttons; initial holder/waiter setup also lacks an exact data receipt.), C3 failed (Ageing starts after only the empty table shell is visible, before the initial queue receipt and holder/waiter facts are observed.).

### impl-1133 · 2026-10-22T23:23:37.269Z

Fixed source-review M1/M2 in 25553311 (tree e9a62c39), pushed to origin without another dev merge. Physical Enter regression first failed on Fold Yours ('true' !== 'false', A-9501), then passed with the scoped native-button guard (same independent patch as T-1136). C1/C3 now await the initial queue snapshot and exact holder/waiter rows/times before assertions or clock advancement. Final assertions and armed replacement observer remain. Original green Web output+exit+native timings and source tree/diff: A-9508. Fresh static and keyboard regression checks running; fresh source review next.

### rev-26 · 2026-10-22T23:26:11.240Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1133-source-2
commit: 35a35f72808b9175d968384b465bb6d872b8e32b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 35a35f72; A-9516 carries the full Standards/Spec audit with no remaining findings. M1 fixed by scoped native-button Enter guard and group/archive physical-key regressions; M2 fixed by bounded initial snapshot plus exact holder/waiter identity/executor/time observations before assertions and clock advance. Original final assertions and armed replacement observer retained. A-9501 red, A-9508 intermediate green, A-9511 intermediate static and A-9512 final-head local targeted receipts keep their actual provenance; no configured or Linux pass claimed. C5 verified by matching docs; C1–C4 await mode-free configured evidence at this exact unchanged head. No post-review dev merge or merge by Reviewer.

Criteria: C5 verified.

### rev-26 · 2026-10-22T23:36:39.579Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1133-final-1
commit: 35a35f72808b9175d968384b465bb6d872b8e32b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified. A-9546 audits same-head 4ca6dbc8/A-9540: exit0,2536 passed with zero failed/cancelled/skipped, Linux c-8 lon1 T1/all-T2 hub+Neovim/Web and reused host T0, not repeated remotely. Both new T1 model identities have actual distinct5/5 load finishes. C1/C3/C4 Web cases and parent pass; parent3.986645884s below >=4s allowance trigger, no owned Web repetition claim. M1 native Enter and M2 initial-data receipts remain covered. Generic lint/duration/ratchet warnings retained in report mode, including actual Web wall53.941s>40s and two missing baselines. C5 docs carried from source A-9516. No T3/T4/QA pass or merge claimed; affected QA remains after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-26 · 2026-10-22T23:38:58.458Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1133-source-3
commit: ee0dce9b556927edba4fe35adcfbc1fc17491625
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear at ee0dce9b; A-9551 audits Coordinator51717564-authorized dev merge and both conflict resolutions. Queue product/model/tests and M1/M2 corrections byte-identical to prior clear35a35f72; inherited Artifacts connection changes match dev. Both README sections, test seams/tier entries and Sessions18/Artifacts20 help counts preserved. No findings. A-9549 actual new-head local palette11/11 and key-contexts3/3 are targeted supporting evidence. C5 docs verified; C1–C4 pending fresh mode-free configured receipt at this head. Earlier A-9540/A-9546 remains historical at old head; no fresh runtime/QA or merge claim.

Criteria: C5 verified.
