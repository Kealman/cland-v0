---
id: T-843
kind: task
title: The launcher opens a named session's terminal in the centre when asked
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by: []
topic: topic-565
branch: t/T-843-the-launcher-opens-a-named-session-s
created: 2026-10-19T06:34:13.359Z
updated: 2026-10-19T09:00:12.035Z
closed: 2026-10-19T09:00:12.035Z
---

## Summary

Setup ends in the workbench with the Aide's terminal in the centre, as the launcher shows a session after `␣A` (Q-599 decision 11). The Neovim client learns to open a named session once the hub lists it. This is the prototype's `CLAND_OPEN_SESSION` hunk.

## What to build

- At start, the client reads `CLAND_OPEN_SESSION` and unsets it at once, so no terminal started inside inherits it.
- When the hub's session list first contains that name, the client shows it in the centre in Terminal mode, exactly as `␣A` does. It opens it once and never again.
- A restart that restores its own saved view ignores the variable. An unknown name never opens anything and logs nothing alarming.
- The client's environment documentation names the variable.

## Acceptance criteria

- [x] C1. A headless client with `CLAND_OPEN_SESSION=aide-1`, against the stub hub listing `aide-1`, shows `aide-1`'s terminal in the centre in Terminal mode (Neovim T2, stub hub).
  - done: impl-843 · 2026-10-19T07:09:08.418Z
  - verified: rev-31 [reviewer] · run rev-20261019-843-final · 2026-10-19T07:09:42.811Z · commit d2e38ce7552451311cf9fb2046e7e7986ca53fd2
- [x] C2. A session that appears in the list only later is opened when it appears, and a later list change does not reopen it after the human moves away.
  - done: impl-843 · 2026-10-19T07:09:08.888Z
  - verified: rev-31 [reviewer] · run rev-20261019-843-final · 2026-10-19T07:09:42.811Z · commit d2e38ce7552451311cf9fb2046e7e7986ca53fd2
- [x] C3. A terminal started in the client does not have `CLAND_OPEN_SESSION` in its environment, and a restored snapshot view wins over the variable.
  - done: impl-843 · 2026-10-19T07:09:09.252Z
  - verified: rev-31 [reviewer] · run rev-20261019-843-final · 2026-10-19T07:09:42.811Z · commit d2e38ce7552451311cf9fb2046e7e7986ca53fd2

## Comments

### impl-843 · 2026-10-19T06:36:29.778Z

Implementing test-first at the specified launcher/stub-client T2 seam. Initial test holds session.list and observes the centre terminal, Terminal mode and inherited environment. Additional slices will exercise delayed appearance, one-shot navigation and saved-view precedence. No changes planned to shell-component.test.ts.

### impl-843 · 2026-10-19T06:42:23.474Z

Source ready at d2e38ce7552451311cf9fb2046e7e7986ca53fd2, committed and pushed to origin on t/T-843-the-launcher-opens-a-named-session-s. Host npm run check passes; launcher-component.test.ts 11/11 passes (~3s). Recorded frames refreshed and shell-component.test.ts untouched. Initial open and saved-view tests were observed red before their respective implementation. Requesting source review, then one mode-free droplet verification at the reviewed head.

### rev-31 · 2026-10-19T06:46:06.860Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-843-source
commit: d2e38ce7552451311cf9fb2046e7e7986ca53fd2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-843 source review: clear

Head: d2e38ce7552451311cf9fb2046e7e7986ca53fd2
Fixed base: 24ff4175ab5c787e0453e9f1f5978f17ddd79d7d
Scope: full. One implementation commit; six changed files.

## Standards

Clear; no findings. The startup logic reads and immediately unsets CLAND_OPEN_SESSION before client/hub or attachment startup. It uses the established state callback and layout.show session path rather than a second attachment implementation. It clears the pending name before navigation can publish another state change. When leaving a composer, an observed InsertLeave schedules the terminal handoff instead of adding a timer delay.

The three new tests stay in the existing Neovim T2 launcher/stub-hub seam, with owned headless Neovim and a builtin-only attachment command. No real harness process, shell-component expansion or sleep is added. Tests wait on held snapshot observations, screens, actual mode, request receipts and a protocol barrier. The later-update case completes the snapshot before checking retained navigation. Existing shared fixture ownership remains responsible for its Neovim/stub/attachment children.

Recorded catalogs parse, retain every existing node unchanged, and have no missing references. Each adds the same 57 nodes/23 records: aggregate 26408→26465 nodes and 4679→4702 records; launcher slice 366→423 nodes and 63→86 records. Their new scenario facts align with aide-1, session attachment and list/restore interactions. No catalog generator was run by Reviewer.

## Spec

Clear source:
- C1: the first list containing the exact requested name shows its session in the centre with insert=true, through the same path as Aide launch. The held-initial-list test observes the real Terminal mode and the named attachment, not merely selected state.
- C2: an unknown name has no navigation/error branch and stays pending. The delayed-list test initially observes no attachment or alarming screen notice, then the requested terminal; after the human returns to General, process/list updates retain General and exactly one attachment.
- C3: the environment variable is removed immediately, before children. The terminal prints the unset value and the test checks Neovim's environment too. A successfully loaded saved restart snapshot clears the pending request before restore/layout startup. The public in-process restore-path test observes the saved Inbox, absent variable and no requested attachment.
- nvim/README.md and the entry-point environment comments document the variable, one-shot behavior, quiet unknown names and restart precedence.

A-5836 reports red-before implementation and restore-guard controls, refreshed launcher recordings, 11/11 ordinary launcher cases in about 3 s (new cases about 0.2–0.3 s), and host check green. The existing shell-component file and budget are unchanged. The saved-view test exercises production snapshot loading in the owned process; it does not claim a real Neovim restart lifecycle, which is unnecessary for this T2 rule.

Result: source clear. C1–C3 remain unverified pending one unchanged-head mode-free configured droplet task receipt. No full task run or per-item QA. Any head change needs fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5842.

### impl-843 · 2026-10-19T06:57:40.776Z

Mode-free droplet verification 8a94e492-d909-4d91-8810-142d080ae896 at source-reviewed d2e38ce7 exited 1. A-5849 identifies explorer-card-component.test.ts::empty and stale card evidence stays explicit, and live suite states come from task summaries: card T-10 expects Old proof; no row under the cursor (lines 44305–44307), plus legacy duration bound 5.684s >5s. All three T-843 launcher cases passed 5/5 load repetitions. Reported possible shared defect (Bugs, S) to the supervising lead/Coordinator; holding exact reviewed head pending shared-fix or retry direction. Droplet linux x64, 614s lifetime, $0.0426.

### rev-31 · 2026-10-19T06:58:08.944Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-843-runtime-1
commit: d2e38ce7552451311cf9fb2046e7e7986ca53fd2
scope: evidence
findings: [{"severity":"medium","text":"Exact-head task receipt exits 1 on card evidence timeout ('Old proof', no row under cursor) and the case's hard 5 s budget; final execution readiness is not established.","file":"nvim/test/explorer-card-component.test.ts","line":122}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-843 runtime evidence review: not clear

Head: d2e38ce7552451311cf9fb2046e7e7986ca53fd2, unchanged from source review / A-5842.
Run: 8a94e492-d909-4d91-8810-142d080ae896 / A-5849, raw exit 1.
Scope: evidence. Task receipt and branch tip independently match.

## Standards / runtime gate

M1 (medium), nvim/test/explorer-card-component.test.ts:122: the ordinary case “empty and stale card evidence stays explicit, and live suite states come from task summaries” fails after 5.683989873 s. A-5849:44305–44307 preserves the actual error: card T-10 expects Old proof; no row under the cursor. The same case also exceeds the hard new-identity 5 s budget (A-5849:48527). Its five load repetitions pass, but that does not erase the ordinary failure. Final execution readiness is not established.

This file is unchanged by T-843. The receipt establishes neither a task regression nor a proven shared root cause. Implementer d565b72f has reported a possible shared defect and is holding the head for Coordinator direction. Treat the aside as Bugs / S for lead/Coordinator deduplication and disposition; no outside diagnosis or test weakening is requested here. No automatic unchanged-head retry.

## Spec evidence retained

All 11 ordinary launcher-component cases positively finish pass, and all 11 observed launcher load-gate identities pass 5/5. The three new cases measure 0.351322770 s, 0.393793260 s and 0.581323757 s; whole launcher sum is approximately 4.829 test-seconds, with no owned budget or runtime tier mismatch.

These receipts positively exercise initial named-session opening in centre/Terminal mode, absent child environment variable, delayed listing, no re-open after human navigation, and saved restart-view precedence. The source verdict remains the applicable source audit. C1–C3 are not final-verified from a failed task receipt.

Ordinary totals: 607 tests, 606 pass, one failure, zero cancellation/skip/TODO (372 whole-T1 plus 235 Neovim cases). The 2102 completed-before-interruption count also includes repetitions and is not the ordinary test total. The T1 phase failure array is empty; the Neovim failure array names only the card case. No runtime tier mismatch is reported. Other report-only external budget debt and missing baselines remain disclosed.

Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 614 s, cost $0.0426, peak load 6.18; suite 528.49 s, load-gate extra wall 392.93 s. T3 remains deferred to the merge batch; no batch or full integration pass is claimed.

Result: not clear; fail C1 on the required task execution gate, leaving C2/C3 unverified. Lead/Coordinator must direct the failure's resolution or explicit disposition. A changed head needs fresh source review; no per-item QA.

Findings: Standards/runtime 1 medium; Spec 0 owned assertion failures.

Evidence: A-5850.

Criteria: C1 failed (Required exact-head task execution exits 1 on the separate explorer-card assertion and hard budget; lead disposition pending.).

### impl-843 · 2026-10-19T07:08:37.209Z

Authorized replacement mode-free droplet verification 1e761e0d-31ff-49ef-a9c3-b91091034045 at unchanged source-reviewed d2e38ce7552451311cf9fb2046e7e7986ca53fd2 passed: 607/607, exit 0. Receipt A-5857, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5857-suite-1e761e0d-31ff-49ef-a9c3-b91091034045-auto-at-d2e38ce.log. Linux x64, Node v24.21.0, Neovim v0.12.5, droplet lifetime 580s, cost $0.0403. T3 deferred to the merge batch. Awaiting Reviewer same-head evidence audit/final verdict; claim retained.

### rev-31 · 2026-10-19T07:09:42.811Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-843-final
commit: d2e38ce7552451311cf9fb2046e7e7986ca53fd2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-843 final evidence review: clear

Head: d2e38ce7552451311cf9fb2046e7e7986ca53fd2, unchanged from source review / A-5842 and runtime-1 / A-5850.
Replacement run: 1e761e0d-31ff-49ef-a9c3-b91091034045 / A-5857, raw exit 0.
Scope: evidence. Branch tip and task receipt match; C1–C3 are claimant-done.

## Standards

Clear; prior runtime gate finding is resolved by the authorized positive replacement. Coordinator decision 8182f166-a06d-4947-ac78-623d650f2633 independently classified the first run's unchanged explorer-card case as an out-of-scope flake, filed T-848, and allowed exactly one replacement at this unchanged head. A-5849 remains a failed receipt; no source change or assertion weakening was made.

The previously failing card case now positively finishes pass in 0.832397801 s and passes 5/5 load repetitions. It no longer hits the hard duration gate. This establishes the replacement's execution readiness, not a root-cause fix or closure of T-848.

All 11 ordinary launcher cases pass, and all 11 launcher identities pass 5/5. The three new cases measure 0.399253945 s, 0.341121524 s and 0.498441950 s; launcher file sum is 4.861985490 test-seconds. No owned budget overrun, runtime tier mismatch, skip, cancellation or quarantine is reported. Both phase failure arrays are empty, all 297 reported load-gate identities pass 5/5, and no runtime tier mismatch appears anywhere in this receipt.

## Spec

Verify C1–C3:
- C1: the held initial session list opens aide-1 through the normal centre-session path, with actual Terminal mode and attachment receipts.
- C2: an unknown name produces no attachment/alarming notice, later listing opens it, and further process/list updates preserve the human's move to General with exactly one attachment.
- C3: the attachment prints open-session=unset and Neovim's environment is nil. The production-format saved Inbox snapshot wins through the public restore path and no requested attachment occurs.

Source audit A-5842 retains consume-before-navigation, environment removal before child startup, InsertLeave-based terminal handoff, valid additive recorded catalogs and unchanged shell-component source. The saved-view proof is T2 in-process restoration, not an asserted real Neovim restart lifecycle.

Ordinary overall result: 607 tests, 607 pass, zero failure/cancellation/skip/TODO (372 whole-T1 plus 235 Neovim T1/T2 cases). Host check passes. Existing external report-only budget debt and 35 missing baselines remain disclosed; no global budget-clean claim. T3 remains in the landing merge batch, and no integrated-cover or completed batch landing is claimed. Reported T3 ratchet equals base 2651.501 s with incomplete timings separately disclosed.

Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 580 s, cost $0.0403, peak load 5.91. Suite 497.93 s, load-gate extra wall 371.32 s.

Result: final clear; C1–C3 verified. No further task run or per-item QA. T-848 remains separate follow-up work.

Findings: Standards 0; Spec 0.

Evidence: A-5858.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T09:00:12.035Z

Merged 73a5d0cd7a36717a0345818a60cd34857754de2d onto dev.
