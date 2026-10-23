---
id: T-1127
kind: task
title: The events view with the hub's filter, day groups and the last look
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
topic: topic-898
branch: t/T-1127-the-events-view-with-the-hub-s-filter
created: 2026-10-22T15:16:14.417Z
updated: 2026-10-23T08:45:32.099Z
closed: 2026-10-23T08:45:32.099Z
---

## Summary

The Events area shows events newest first in day groups, at most the newest 200 that match the filter with older ones on demand, filters through the hub, and sets the human's last look when opened.

## Parent

E-417 (v0.1.2 §3.7 the events view; §3.6 the last look; tracer step 6, the events half).

## What to build

Rows are newest first in day groups with day rules; a day folds. A row is the time, a glyph, the kind, the subject and one line; bookkeeping rows are dimmed and equal events merged by the hub show ×N. At most the newest 200 rows matching the filter show; a control and `A` load 200 older ones from the journal. The filter keys work as in Neovim in the events context: `1` to `8` by kind, `0` all, `w` warnings only, `s` a subject through the palette, `F` clears; the filter goes through the hub's events filter (T-1055) on the subscription and the page reads, and the browser keeps it. Enter opens the subject (a card, a session, a topic, an artifact). Opening the view sets the human's last look in the hub, and rows newer than the previous look are marked; the inbox's events line then counts from the new look. Nothing still waiting in the inbox repeats here.

## Acceptance criteria

- [x] C1. The Events area lists rows newest first in day groups with day rules, at most 200, and loads 200 older ones on demand (Web test).
  - done: impl-1127 · 2026-10-23T08:02:59.047Z
  - verified: rev-23 [reviewer] · run rev-20261023-1127-final · 2026-10-23T08:40:46.991Z · commit deb36b1b44697f7bdf95173a35d8793faa973791
- [x] C2. `w` shows only warnings and `2` only task events through the hub's filter, and `F` restores every row (Web test).
  - done: impl-1127 · 2026-10-23T08:28:48.293Z
  - verified: rev-23 [reviewer] · run rev-20261023-1127-final · 2026-10-23T08:40:46.991Z · commit deb36b1b44697f7bdf95173a35d8793faa973791
- [x] C3. Bookkeeping rows are dimmed, merged events show ×N, a day folds, and Enter opens the subject (Web test).
  - done: impl-1127 · 2026-10-23T08:02:59.231Z
  - verified: rev-23 [reviewer] · run rev-20261023-1127-final · 2026-10-23T08:40:46.991Z · commit deb36b1b44697f7bdf95173a35d8793faa973791
- [x] C4. Opening the view sets the human's last look, which a frame client reads, and the inbox's events line drops to 0 (Web test).
  - done: impl-1127 · 2026-10-23T08:02:59.310Z
  - verified: rev-23 [reviewer] · run rev-20261023-1127-final · 2026-10-23T08:40:46.991Z · commit deb36b1b44697f7bdf95173a35d8793faa973791

## Comments

### impl-1127 · 2026-10-23T08:02:59.488Z

Implemented and pushed 24c8d5eed48741e8ea4c79ee33a206b0258ff0d9 after merging origin/dev (T-1164 included). Test-first Web/public-frame coverage proves C1–C4 plus live paging/coalescing races, split Inbox independence, old artifact resolution, small-viewport help and fresh-epoch recovery without visit-write replay. Local darwin arm64 / isolated Headless Shell: events 10/10, area-slots 4/4, key-contexts 3/3, palette 11/11, inbox 16/16; no skips/failures on final named runs. npm run check passed (test lint report-only: 132 findings, 0 refusals); one final stopped-feed guard was subsequently covered by Events 10/10. No passing new identity reached 4 s (worst local Events identity ~1.28 s), so no duration allowance added. Full mode-free verification awaits clear source review; QA is after-stage per item policy, no per-item brief supplied.

### rev-23 · 2026-10-23T08:07:26.750Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1127-source
commit: 24c8d5eed48741e8ea4c79ee33a206b0258ff0d9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-9905 audits hub-side filters, independent unfiltered Inbox summary, bounded paging/live coalescing, focus/subject navigation, shared visit marks, reconnect fencing, key contexts and matching docs/provenance. Ten Web contracts retain exact row/marks/focus/scroll receipts and final assertions. A-9902 local macOS summary is supplemental, not an audited configured pass; its check preceded the final feed-stop guard. C1–C4 remain pending same-head mode-free verification. Preserve original local receipts with their actual head/tree and timing limits; no transcription reruns. Reviewer ran no tests/browser. After-stage QA separate.

### impl-1127 · 2026-10-23T08:24:16.794Z

692b1a23/A-9910 at 24c8d5ee failed in Web (8 reported records); Linux T1/all fallback T2 completed green, T3 not covered. The failure was a source-owned rail context regression, reproduced locally with original form/digit assertions and fixed in pushed 50ca83cc043c24ce9c180fa87f20d2fc0138bce5. Only mapped rail digit navigation is shell-scoped; area letters remain local, document dispatch uses actual focus. Added actual-target regression and E-417 6.8 s allowance from the passing 4.528953661 s Linux subject-navigation sample. Original local repros and complete final eight named files pass (68 reported tests, darwin arm64 Headless Shell), npm run check passes with report-only lint/zero refusals. A-9913 retains diagnosis and limits. Fresh source review requested before any verification retry.

### rev-23 · 2026-10-23T08:24:40.125Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1127-evidence-red
commit: 24c8d5eed48741e8ea4c79ee33a206b0258ff0d9
scope: evidence
findings: [{"severity":"medium","text":"M1: Blanket shell context on the rail suppresses active area a/l/A after a Sessions click; document-dispatched digits instead fall back to Events despite actual rail focus. A-9910 reports 3000ms timeouts for five launch forms, archive stopped-00 and Artifacts navigation (seven leaves plus parent). Preserve area action/native-field behavior while scoping rail digits; original source review missed this integration regression.","file":"web/src/Shell.tsx","line":329}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9914 audits failed run 692b1a23/A-9910: Linux droplet T1 and all-T2 fallback pass, Web fails; 2679 pass/8 failed records, no skip/cancel, no T3/T4/load coverage. Actual errors are locator.waitFor 3000ms timeouts for New Aide/Launch a session, stopped-00, Artifacts. Ten Events cases pass but aggregate is red. Passing subject-navigation 4.528953661s crosses launch allowance trigger; generic budgets/lint/ratchet report-only, host gate reused. Corrected 50ca83cc request arrived during audit and requires fresh source review; this historical result stays not clear. C2 failed; Reviewer ran no tests.

Criteria: C2 failed (Events keyboard-context integration breaks rail Sessions actions and document-dispatched area digit navigation; same-head Web phase failed.).

### rev-23 · 2026-10-23T08:26:19.016Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1127-source-2
commit: 50ca83cc043c24ce9c180fa87f20d2fc0138bce5
scope: full
findings: [{"severity":"medium","text":"M2: Context now resolves document-dispatched events via document.activeElement, but button/link/card/fold guards and leader tracking still use event.target. Enter dispatched at document with a launch form's Cancel focused resolves launch/accept, skips this button exemption because event.target is Document, then SessionsArea routes accept to SessionLaunch.submit(). Use the resolved target consistently and cover a focused Cancel/native control with a no-launch assertion; retain real-key/native-field contracts.","file":"web/src/keyboard.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9915 records the correction review. Original rail routing M1 is fixed; the dated 6.8s allowance correctly uses the passing 4.528953661s Linux sample, not failed timeouts. M2 remains medium: mixed event target identities bypass native-button guards under the newly supported document-dispatch path. No other source findings. C2 failed; configured verification must wait for fresh corrected-head source clear. Local 68-test/check reports are supplemental; no same-head configured pass. Reviewer performed source inspection only.

Criteria: C2 failed (Document-event target normalization changes context but leaves native-control/leader guards on the old target, allowing accept dispatch from focused Cancel.).

### impl-1127 · 2026-10-23T08:28:48.687Z

Fresh source finding M2 reproduced before fix at the sealed Web seam: document Enter at focused Cancel was default-prevented (false !== true). Pushed deb36b1b44697f7bdf95173a35d8793faa973791 uses the resolved target for all native-control guards and leader identity. The existing launch-actions test now retains unprevented document dispatch, focused Cancel, native cancellation and a public session list proving zero launches. Local corrected tree: all eight named Web files pass again, 68 reported tests / 0 fail / 0 skip on darwin arm64 Headless Shell; npm run check passes (report-only lint 132 findings / 0 refusals). C2 done refreshed after the not-clear verdict; fresh review requested before verification. No post-review dev merge.

### rev-23 · 2026-10-23T08:29:30.495Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1127-source-3
commit: deb36b1b44697f7bdf95173a35d8793faa973791
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-9916 verifies M2's complete resolved-target use across context/native-control/card/fold guards and leader identity; the existing launch test now keeps the unprevented document Enter/Cancel focus receipt, real native cancellation and public zero-process assertion. M1 rail routing remains fixed, prior 6.8s allowance is unchanged/supported by actual passing Linux sample. Reported local corrected-tree 68-test/check greens are supplemental summaries. C1–C4 runtime settlement remains pending fresh exact-head mode-free verification; historical A-9910 stays red. Reviewer ran no tests/browser. After-stage QA separate.

### rev-23 · 2026-10-23T08:40:46.991Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1127-final
commit: deb36b1b44697f7bdf95173a35d8793faa973791
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-9921 independently audits A-9920/eb17d490 at unchanged source-clear head: 2688 ordinary tests and 399 files pass, zero fail/skip/cancel; Linux c-8 lon1 actual T1 + fallback all hub/Neovim T2 + Web. All eleven Events cases and compatibility neighbors pass, including corrected rail routing and native Cancel/no-launch proof. C1–C4 verified through exact page/filter/subject/marks/Inbox receipts. Subject navigation 4.024822397s is covered by existing 6.8s dated E-417 allowance; other new identities <4s. Host check gate reused, no T3/T4 or load repetitions, generic budgets/lint/ratchet/tier warnings report-only; Web wall overage and missing baseline retained. A-9910 remains historically failed. After-stage QA separate; Reviewer ran no tests/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-23T08:45:32.099Z

Merged 5d7c9082223499ccaa81fd1ab8ef613af22c2d8e onto dev.
