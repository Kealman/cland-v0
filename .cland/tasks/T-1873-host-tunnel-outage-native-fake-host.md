---
id: T-1873
kind: task
title: "host-tunnel-outage-native: fake host stays cloning past the 15 s alert wait under Linux batch load"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1669
branch: t/T-1873-host-tunnel-outage-native-fake-host
created: 2026-11-15T16:30:06.052Z
updated: 2026-11-20T04:29:58.861Z
closed: 2026-11-20T04:29:58.861Z
---

## Summary

`hub/test/host-tunnel-outage-native.test.ts::native tunnel outage pushes host alert and CLI scratch control restores it` (T-1839) failed once in merge batch e35f0ece (T-1760 alone), run 312bfe01, on a Linux droplet: c-8, nyc1, workers 2, peak load 7.5, log A-19740. It reported `no frame matched within 15000ms`. The last hosts.state it saw had the fake host in state `cloning`, with alert `null`. The test passed in the previous batch on dev (13cab6f4, A-19719). Afterwards, on macOS, it passed 3 out of 3 at dev 9dad57082 and 3 out of 3 at T-1760's head a4596490b (impl-1760, 2026-11-15 16:29Z). So it's load- or Linux-sensitive, not caused by T-1760. The hub's singleton bisect dropped T-1760 on it.

## What to build

Find what keeps the fake host in `cloning` past the test's 15 s frame wait under Linux batch load. It could be the clone through the tunnel, fixture Git or the fake transport. Either:
- remove the wait on real time;
- move the clone readiness onto the shared load-scaled waits, with a named reason.

Keep the outage-alert and scratch-restore assertions exact. Print the last hosts.state on timeout. It already does, so keep that.

## Acceptance criteria

- [x] C1. The cause of the stuck `cloning` is named from a reproduction under load, and the fix removes it or bounds readiness with the shared load-scaled wait (test).
  - verified: rev-39 [reviewer] · run rev-20261120-1873-evidence-4 · 2026-11-20T01:58:04.962Z · commit e77e0640668e33b811786d7988c623510a71a8c5
  - done: impl-1873 · 2026-11-20T02:02:05.662Z
  - verified: rev-39 [reviewer] · run rev-20261120-1873-final-5 · 2026-11-20T02:22:04.807Z · commit e77e0640668e33b811786d7988c623510a71a8c5
- [x] C2. The test passes 20 out of 20 runs on macOS with each run starting at a 1-minute load of 8 to 12 (amended from Linux Docker on 2026-11-20: Docker unavailable; the cause was a deterministic replay race fixed and proven by a held-boundary test, and a full Linux verify all at the head is green), with unchanged assertions (test).
  - done: impl-1873 · 2026-11-20T02:20:32.927Z
  - verified: rev-39 [reviewer] · run rev-20261120-1873-final-5 · 2026-11-20T02:22:04.807Z · commit e77e0640668e33b811786d7988c623510a71a8c5

## Comments

### coord · 2026-11-15T16:32:07.216Z

Evidence from impl-1760's six-run comparison (A-19741, macOS, 2026-11-15 16:29Z): dev 9dad57082 passed 3/3 (7.9, 5.6 and 5.8 s) and T-1760 head a4596490b passed 3/3 (8.0, 5.8 and 5.8 s). Every run saw ready/no-alert, then ready/outage, then ready/no-alert, and 4 of the 6 first saw `cloning` before `ready`. So the clone phase always runs before readiness, and under Linux batch load it apparently outlasts the 15 s frame wait. Full-name inventories were unchanged in all six runs.

### impl-1873 · 2026-11-20T00:21:30.421Z

Diagnosis corrected: A-19740 lines 20068–20073 is the FIRST ready wait (only welcome/remote.state/cloning hosts.state retained). Fixture-held clone delays CLI completion; independently held hello→subscribe boundary reproduces missing ready with same final frame shape. Cause is product legacy subscription gap, not clone duration. Consumer audit before change: production hub core/dispatch/snapshot/protocol and shared/wire; web/src/connection.ts and nvim hub/state/init replace presence/remote/hosts by key, tolerate same-shaped replay. Numbered clients retain snapshot/resume; host-scoped excluded. Raw positional readers: hosts-state, edges-component, request-guard-component, tracker-component, daemon, tracker and connection-snapshot tests; hello ordering unchanged, replay added only first subscribe. Frozen nvim protocol frames/hosts/sessions pin hello snapshots and remain unchanged. Native host-tunnel-outage, web hosts/hosts-view, nvim hosts/sessions and scenarios consume matching typed state, not positional subscribe replies. QA E-1537 briefs pin original hello lines/field shapes, unchanged; broader E-412 briefs collect typed streams. Shipped skills and frozen CLI help have no changed contract bytes. Persisted readers unaffected: replay is ephemeral and retains the existing three frame schemas. Other domains initialize through explicit reads after subscribe or negotiated snapshots; no message/event history replay. Permanent regression retains previous wire shape and covers all three replacements, replay publication ordering, and idempotence.

### impl-1873 · 2026-11-20T00:24:15.393Z

Consumer audit expansion: searched bare subscribe request literals across hub/test, nvim/test and web/test as well (367 occurrences), inspecting positional next/read/shift consumers around those requests. Only tracker-component requires new preceding-frame assertions; artifact-lifecycle and project-clock next calls belong to separate spoke connections, unaffected. No help export or CLI usage fixture changes. Validation on c352aade5 + current diff, local macOS Node24.21: 41/41 targeted T2 tests across hosts-state, tracker-component, request-guard-component, edges-component and connection-snapshot; full test:lint exit0, typecheck exit0. No suite, browser, Linux or loaded campaign claim. origin/dev fetched and merge before first review is already up to date.

### rev-39 · 2026-11-20T00:43:16.191Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261120-1873-source-1
commit: 7fb1f7b671fdbed7654323e5a7867f99445ab8e4
scope: full
findings: [{"severity":"medium","text":"The three new callbacks await tempProject before a whole-case original-work/setup owner exists, then acquire createHubBase and register raw after hooks; cancellation can let that setup continuation acquire after teardown. Enroll/bound the original callback before acquisition and join successful cleanup before fixture release (rules 9/12).","file":"hub/test/hosts-state.test.ts","line":8},{"severity":"medium","text":"The new fake-only dispatcher controls lack a positively controlled native-launch guard through setup/body/successful cleanup; listener-free intent does not establish exclusion of native boundaries (rule 38).","file":"hub/test/hosts-state.test.ts","line":11}]
finding_counts: {"high":0,"medium":2,"low":0}

Source review at exact 7fb1f7b671fdbed7654323e5a7867f99445ab8e4; Standards: two medium findings above, confirmed by implementer a752cf50. Spec: no separate production finding; legacy replacement-before-delta flow, consumer dispositions and unchanged native assertions read correctly. Full detail A-21981 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21981-t-1873-source-review-at-7fb1f7b67.md). A-21965/A-21975 retain deterministic baseline and ordinary macOS Node24.21 native evidence only; no Reviewer execution or configured suite. C1 unverified/failed for proof gaps, C2 Linux load>=8 20/20 unexecuted/pending, not inferred failed. Fix both together; new head needs fresh source review before verification.

Criteria: C1 failed (Permanent regression lacks pre-acquisition original-work/setup ownership and a positively controlled launch guard through cleanup; loaded proof also remains pending.).

### rev-39 · 2026-11-20T00:49:54.502Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261120-1873-source-2
commit: c867e36ed535c20a133cb769e2e537558afb14b2
scope: full
findings: [{"severity":"medium","text":"The new suiteCase cleanup lacks a positive successful-close fence: rejected hub.close settles/removes pending work, non-fenced process-cleanup continues to root removal, and suiteCase restores the launch guard in finally. Retain root/guard until successful resource closure, preserving the original-work join (rules 12/38).","file":"hub/test/hosts-state.test.ts","line":13}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: original-work/setup enrollment and positive launch-control setup now resolved; one remaining medium success-fence gap, confirmed by implementer 907e8e8a. Spec: no separate product finding, product unchanged. A-21991 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21991-t-1873-remaining-cleanup-success-fence-at-c867e36ed.md) details the exact failure path and narrow case-level scope; no legacy caller migration requested. A-21989 is targeted macOS Node24.21 T2/static evidence only, intermediate failed tree distinct. Earlier native receipts remain at their own heads. No Reviewer run, new-head native/Linux loaded20/20 or configured receipt. C1 failed/unverified for remaining cleanup gap; C2 pending/unexecuted.

Criteria: C1 failed (Permanent regression still releases root/native guard after rejected resource cleanup; success-fenced closure remains required.).

### rev-39 · 2026-11-20T00:54:55.785Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261120-1873-source-3
commit: e77e0640668e33b811786d7988c623510a71a8c5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE clearance only. Standards: A-21981 M1/M2 and A-21991 remaining cleanup finding resolved. Outer fence precedes suiteCase; root belongs to that same outer context; rejected writer closure prevents both directory removal and guard-restoring checks. Original callback/step ownership, positive native controls and exact assertions retained. General helper work remains T-2022. Spec: no findings; production unchanged from reviewed 7fb1f7b67, consumer dispositions and literal previous-wire regression retained. A-21997 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21997-t-1873-source-clear-at-e77e06406.md). A-21996 is current-tree targeted macOS Node24.21 T2/static evidence only; earlier native evidence stays at earlier heads. No Reviewer execution or new-head native/Linux loaded20/20/configured receipt. C1's source proof defect resolved, but C1/C2 remain unverified pending run-dependent evidence; no criterion marks asserted. Final settlement requires exact same head and required receipts.

### rev-39 · 2026-11-20T01:58:04.962Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261120-1873-evidence-4
commit: e77e0640668e33b811786d7988c623510a71a8c5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial criterion evidence settlement, NOT final all-criteria clearance. A-22034 exact-head configured all run4b553246 finished/passed, confirmed task.view. Structured unique ordinary outcomes9225pass/12skip/0fail/cancel; separate15load passes. Three new replacement/order cases each ordinary+5/5load; unchanged native outage/restore once7.482299161s. T0/allT1/allT2/allT3/Web complete, T4 unexecuted. Uncached Linuxx64 6.8.0-149 c-8ams3 droplet, Node24.21/Nvim0.12.5; actual HeadlessShell1248/CfT156.0.8078.4. Advisories retain report-only labels; skips named prerequisites, not passes. Verification snapshot785c157... distinct Git source treef649b5b.... C1 verified using prior causal reproduction, corrected source and current exact controls/native pass. C2 UNVERIFIED/PENDING: phase peak11.12 plus one native pass and component load repeats are not Linux native20/20 at load>=8. No findings. Details A-22035 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22035-t-1873-same-head-full-suite-evidence-with-c2-pending.md). Reviewer only read source/log, no tests/probes.

Criteria: C1 verified.

### rev-39 · 2026-11-20T02:22:04.807Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261120-1873-final-5
commit: e77e0640668e33b811786d7988c623510a71a8c5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

FINAL same-head clear; C1/C2 verified under current task criteria. Coordinator6459e123 explicitly amended C2 to macOS20/20 each startload8–12; no Linux20/20 claim. A-22042 runner/results/runs/all20raw logs checked: exact native generated case/counts1pass each/0fail/cancel/skip/todo, code0/signalnull,20distinct native births, no stopReason/nativeError/overflow/retry. Starts8.1416015625–11.947265625;747samples retain in-run peak12.56494140625, not a start/continuous-band claim. Four source SHA256 values match reviewed blobs; ten intentionally terminated Worker burners exit1/joined:true, rootRemoved:true/incompleteChild:null/failure:null, campaign driver exit0. C1 retains evidence-4. Same-head Linux A-22034 full T0/T1/T2/T3/Web green9225ordinary passes/12prerequisite skips+15load, no failures/cancels; T4 unexecuted. Actual HeadlessShell1248/CfT156.0.8078.4; advisories report-only. Full evidence and timing exclusions A-22044 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22044-t-1873-final-clearance-with-amended-c2-loaded-macos-campaign.md). Prior source defects resolved, findings[]. Reviewer only read source/retained receipts; no runtime/load/browser execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T04:29:58.861Z

Merged 39f9bf166b9ec122dd78ee46d9fed653f9a302fd onto dev.
