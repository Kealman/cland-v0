---
id: T-568
kind: task
title: 'heartbeat digest-aging test fails alone on dev: "new review state gets a fresh full interval" not within 15000 ms'
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
  - v0.1.3
assignee: null
parent: E-482
blocked_by: []
topic: topic-353
branch: t/T-568-heartbeat-digest-aging-test-fails-alone
created: 2026-10-16T03:29:14.808Z
updated: 2026-10-16T03:51:07.644Z
closed: 2026-10-16T03:51:07.644Z
---

## Summary
On 2026-10-16, T-469's droplet run f9f957db at 50af1e39 (A-3645) failed hub/test/heartbeat.test.ts:165 inside the case at :130, "the digest ages review and ready items and open asks, caps both sections, and includes claimed sessions": "new review state gets a fresh full interval: not within 15000ms". The Coordinator then ran the file alone on dev 516cac6d on a quiet Mac (load 2): 2 passes, 1 failure at 15.9 s. So this is a dev defect, not a T-469 one, and the shared-fix rule applies. CLAND_HEARTBEAT_MS is 200 in this test, so a 15 s wait for one fresh interval points at an ordering or reset bug, not slowness.

## Acceptance criteria
- [x] C1. Find why the review state's fresh interval is sometimes not observed within 15 s, fix the test or the heartbeat ageing, and record the cause on this item.
  - done: impl-568 · 2026-10-16T03:42:12.262Z
  - verified: rev-30 [reviewer] · run rev-20261016-568-source · 2026-10-16T03:43:43.613Z · commit 8183e1b98f2ebcca108906baec897c72f04cd206
  - verified: rev-30 [reviewer] · run rev-20261016-568-final · 2026-10-16T03:50:54.926Z · commit 8183e1b98f2ebcca108906baec897c72f04cd206
- [x] C2. heartbeat.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet in the task's verify; the fix is posted as a shared fix.
  - done: impl-568 · 2026-10-16T03:50:26.216Z
  - verified: rev-30 [reviewer] · run rev-20261016-568-final · 2026-10-16T03:50:54.926Z · commit 8183e1b98f2ebcca108906baec897c72f04cd206

## Comments

### impl-568 · 2026-10-16T03:34:54.557Z

Reproduced exact reported failure at unchanged dev 516cac6d: node --test --test-name-pattern='^the digest ages review and ready items and open asks, caps both sections, and includes claimed sessions$' hub/test/heartbeat.test.ts. Narrowed serial run 61 failed at line 165 after 15,993 ms, 'new review state gets a fresh full interval: not within 15000 ms'; load 2.06 and PID-only pgrep guard clear. Before this: 11 whole-file passes and 60 narrowed passes. Ranked hypotheses: fresh window missed by independent heartbeat schedule; status-age reset failure; fresh frame discarded by post-edit cursor. Timestamp instrumentation next.

### impl-568 · 2026-10-16T03:38:47.455Z

Cause confirmed: test expectation, not product reset. Independent heartbeat schedule does not promise a firing inside every item's fresh interval. Baseline failure is A-3648. Temporary test-only trace with interval shortened 200→20ms raised reproduction: run 5 reset heartbeat_item_states[T-1] to review/since=1792121887452, then first post-cursor firing at 1792121887472 (exactly since+20) correctly had stale=13; later firings stay stale=13 forever. Prior firing at .449 preceded the review reset, so neither reset failure nor discarded fresh frame explains it. The test incorrectly requires an observable stale=12 digest between status reset and age maturity. Minimal fix removes its four-line transient reset check; existing final frozen-clock test retains explicit fresh-state and full-interval transition coverage. No product change required.

### impl-568 · 2026-10-16T03:42:12.240Z

Fix committed/pushed to local territory: 8183e1b98f2ebcca108906baec897c72f04cd206, branch t/T-568-heartbeat-digest-aging-test-fails-alone. Only hub/test/heartbeat.test.ts changes: four lines removed. origin/dev fetched/merged before commit (already up to date). Final whole-file Mac proof A-3650: 10/10 serial runs, 90/90 test passes, pgrep guard clear before each run, load 1.28–2.44. npm run typecheck and git diff --check pass. Mutation proof: changing heartbeatItemSince to retain since for every known row made the retained frozen-clock transition test fail immediately (stale 2 vs expected 0); mutation fully restored. Baseline exact failure A-3648; shortened-interval timing evidence A-3649. C2 droplet/shared-fix steps remain pending source review and Coordinator publication.

### rev-30 · 2026-10-16T03:43:43.613Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-568-source
commit: 8183e1b98f2ebcca108906baec897c72f04cd206
scope: full

Source review T-568 clear at8183e1b98f2ebcca108906baec897c72f04cd206, fixed comparison516cac6d9aabb1856de928784f93a1c45ac757e5 (resolved merge-base with origin/dev). Current origin task ref matches requested SHA. Standards and Spec reviewed directly under Reviewer no-delegation role.

## Standards
No high, medium or low findings. AGENTS/test lifecycle rules and existing test conventions apply; no separate CODING_STANDARDS/CONTRIBUTING found in prior repository standards inventory. Entire immutable diff removes exactly four lines from heartbeat.test.ts: transient planned→review reset, post-edit cursor and eventual stale12 condition. No product source, duration allowance, test deadline, fixture cleanup or other file changes; whitespace check clear.

## Spec
No findings. Primary task records exact baseline failure at old:165. A-3648 raw narrowed run reproduces 'new review state gets a fresh full interval' after15s. A-3649 shortened20ms test-only trace shows state reset since1792121887452, prior firing7449, first post-cursor firing7472 exactly since+20, correctly stale13. No heartbeat firing was guaranteed inside the fresh window; after maturation, waiting longer cannot recreate stale12. This distinguishes scheduling alignment from a broken reset or a fresh frame already discarded by the cursor. The diagnostic20ms interval/trace is not present in committed source (remaining production-test interval200ms unchanged).

Retained digest test still matures all13 rows and checks inFlight, claimed review identity/assignee, missing-review explanation, ready text, both 'and3more' caps and11 listed stale rows. Reset/full-interval behavior remains independently covered by the existing frozen-clock final test: create review+ready transitions with old updated dates, await actual task watcher observations, enable overdue schedule at frozen age, assert stale0, advance clock exactly200, then require stale2. Source review of common core tracker-change path confirms both API edits and watched edits call Store.heartbeatItemSince; the surviving test exercises the same status-age reset semantics without depending on wall-time phase alignment. Item reports a reset-disabled mutation produces stale2 versus expected0 and was restored; this mutation is supporting claimant evidence, not a Reviewer-executed run.

A-3650 raw final proof inspected: ten labelled serial whole-file runs, each9/9,90/90 total, no failures/cancellations/skips. Admission PID guard clear, load1.28–2.44. Both digest and frozen-clock cases retained. Typecheck reported green. This establishes C1 cause/minimal fix and substantial local support, not final gate or shared publication.

C1 verified. C2 remains pending actual droplet heartbeat whole-file pass at this exact reviewed head and Coordinator publication of the shared fix, as its criterion requires. Source clear permits requested one --executor droplet --fresh verification; further head movement requires delta review. No per-item QA brief needed. No Reviewer tests/compiler/binary execution, edits, installs, signals, commits, merges, provider actions, task.view journal scan or subagents. Counts: Standards0, Spec0.

Review artifact A-3652 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3652-t-568-source-clear-remove-unaligned-duplicate-fresh-window-assertion.md

Criteria: C1 verified.

### impl-568 · 2026-10-16T03:49:08.081Z

Fresh requested droplet verify green at reviewed 8183e1b98f2ebcca108906baec897c72f04cd206: run 1d400332-06bc-4b00-9654-1cd74f996ac0, log A-3660; hub-selected includes the whole heartbeat file and hub/Neovim smoke, 40 passed / 0 failed. Linux x64 Node v24.21.0, c-8 lon1, 137s lifetime, $0.0095. Mac proof A-3650 remains 10/10 serial whole-file green. No head changes since source clear. Coordinator owns shared-fix publication; requesting that final C2 step and Reviewer final settlement.

### impl-568 · 2026-10-16T03:50:26.436Z

C2 done per Coordinator decision 6b38b0ae-1652-492b-a7f7-87af53800d75: shared-fix notice by the Coordinator on merge. Coordinator explicitly owns that clause after ready/merge and will publish the merged commit to the crew in the same minute. Runtime proof is complete at unchanged reviewed head 8183e1b98f2ebcca108906baec897c72f04cd206: Mac 10/10 whole files A-3650 and fresh droplet run 1d400332 / A-3660 (40/40, all nine heartbeat cases included).

### rev-30 · 2026-10-16T03:50:54.926Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-568-final
commit: 8183e1b98f2ebcca108906baec897c72f04cd206
scope: evidence

Final evidence review T-568 clear at unchanged source-cleared8183e1b98f2ebcca108906baec897c72f04cd206. Standards/Spec: no high, medium or low findings. Source analysis A-3652 remains current; exact origin branch head confirmed during A-3663 runtime audit.

Primary Coordinator6b38b0ae-1652-492b-a7f7-87af53800d75 read directly in topic-353 disposes C2 publication sequencing: 'posted as a shared fix' is the Coordinator's step following merge; mark C2 done now with 'shared-fix notice by the Coordinator on merge', then final review on A-3660/A-3650. This is an explicit pre-merge acceptance disposition, not evidence that publication has already happened. Coordinator owns the promised merged-commit notice. It resolves A-3663's sole pending administrative condition without source/head change or another run.

Runtime A-3660/1d400332-06bc-4b00-9654-1cd74f996ac0 at exact8183e1b9 is green: actual Linux c-8 lon1,Node24.21.0/Neovim0.12.5,workers4, lifetime137s/$0.0095. Function-selected hub28/28 and Neovim smoke12/12,40/40total, fail0/cancel0/skip0, exit0. Suite51.85s,peak1.98; no hard duration-budget or load red. All nine heartbeat whole-file cases completed despite selected mode, including changed digest2.378s and retained frozen-clock transition/full-interval1.058s. Known-entry duration notices do not fail this gate.

A-3650 raw Mac proof remains ten serial whole-file runs9/9 each,90/90 with no failures/skips/cancellations and recorded clear guards/load1.28–2.44. A-3652 reviewed the exact four-line-only deletion against timing trace A-3649 and baseline A-3648; source/assertions outside the transient duplicate are unchanged, deterministic age-reset/full-interval coverage retained. No product or allowance changes.

C1 verified/current through source cause/minimal fix; C2 verified across complete Mac sequence, actual Linux whole-file completion and explicit Coordinator publication disposition. All criteria established for ready/merge. No per-item QA, rerun or head movement required. No Reviewer tests/compiler/binary execution, edits, installs, signals, commits, merges, provider actions, task.view journal scan or subagents.

Review artifact A-3665 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3665-t-568-final-evidence-clear-under-coordinator-publication-sequence.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T03:51:07.644Z

Merged 64390ae842f08e1fd8e3c624cde8c210cc7aa9c6 onto dev.
