---
id: T-1373
kind: task
title: Web composer test times out waiting for the General row after reload on a loaded Linux droplet
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1211
branch: t/T-1373-web-composer-test-times-out-waiting-for
created: 2026-10-27T07:48:08.661Z
updated: 2026-10-29T19:11:02.890Z
---

## Summary

The E-1309 Linux stage cover e7616d5d at dev 18a6f01b (A-12644, shard-1) failed one Web case: web/test/composer.test.ts "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read". The error was `locator.click: Timeout 3000ms exceeded` waiting for `[data-object-id="general"]` (composer.test.ts:20, called from :187). The macOS cover at the same commit was green, and the case passed 5/5 alone on macOS afterwards. Trace: web/test-results/110535-0.zip on the droplet.

## What to build

Make the case wait for the reloaded shell's topic list to be ready before it clicks General, using the harness's own readiness signal rather than a fixed 3 s locator timeout, so it holds under a loaded two-worker Linux Web phase.

## Acceptance criteria

- [ ] C1. The case waits on an explicit post-reload readiness receipt before selecting General and passes 10/10 under the load gate's CPU load at two workers (test).
  - failed: rev-31 [reviewer] · 2026-10-29T18:49:48.761Z · note Hard test-lint admission refusal prevents configured Linux verification; reported macOS load proof remains separate and pending audit.

## Comments

### impl-1373 · 2026-10-29T18:37:55.797Z

Scope: test-only reload readiness at existing headless Web DOM/authenticated-frame seam. No shared contract changes. Inspecting existing harness readiness before changing the composer case; C1 also requires queued Linux two-worker CPU-load repetitions.

### impl-1373 · 2026-10-29T18:39:45.343Z

Red receipt on macOS: held post-reload topic frames reproduce `locator.click: Timeout 3000ms exceeded` waiting for `[data-object-id="general"]`, thread :20, case :199 (one selected case, exit 1). Prior attempt was incomplete: missing generated Web bundle; built bundle before valid red. Fix now separately awaits rendered target row with 15 s readiness bound and final visibility assertion before normal click. Regression retains all original draft/read/offline/replay checks.

### impl-1373 · 2026-10-29T18:41:27.727Z

Coordinator decision replaces 3.5 s hold with case-local 500 ms action timeout and 800 ms hold, avoiding deliberate seconds of duration debt. Revised red control (readiness removed) fails with `locator.click: Timeout 500ms exceeded` on exact General row; restoring readiness now. Rule 9 already covers the proposed readiness rule. macOS 10/10 load proof authorized only after source review and exclusive slot; ordinary Linux proof follows via verify.

### rev-31 · 2026-10-29T18:45:08.656Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1373-source1
commit: 31ff98e98d320972b85be5f808c38af61107cd30
scope: full
findings: [{"severity":"medium","text":"M1: elapsed release is armed before Topics navigation, so a slow click can consume the intended 800/500 ms gap and let old direct General selection pass. Anchor the release to the selected action/readiness boundary and dispose held delivery before pageCase context teardown; update the deterministic claim in the guide.","file":"web/test/composer.test.ts","line":202}]
finding_counts: {"high":0,"medium":1,"low":0}

Source review not clear at 31ff98e98; A-13978 contains Standards and Spec audit. Exact rendered-row readiness fix is appropriate, but M1 remains. Original draft/read/offline/replay assertions and identity retained. No runtime verification or Reviewer executions claimed; replacement source review before stress/verify.

Criteria: C1 failed (The regression does not deterministically establish the action/readiness boundary; 10/10 CPU-load and configured Linux evidence remain pending.).

### impl-1373 · 2026-10-29T18:45:53.070Z

Addressing source1 M1: split Topics navigation and shared row selection. After navigation, assert withheld General absent, invoke selection, then signal the 800 ms release timer with case-local 500 ms action budget. Body-local finally clears timer, synchronously drains held sends and restores timeout before context teardown. Revised red without wait fails exact General locator.click 500ms in selectTopic (macOS, selected reload case 1.732 s); final row visibility/draft/read/replay assertions retained.

### rev-31 · 2026-10-29T18:46:57.343Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1373-source2
commit: 63c6e4bb99b22c0d94ec19b737391c1abfa418f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; M1 resolved, no remaining source findings. A-13984 records the exact rendered-row boundary, post-navigation selection/release and body-local disposal. Original assertions/identity remain. C1 load plus ordinary Linux evidence still pending and not verified by this source verdict. Follow Coordinator's stress-ready/exclusive-slot sequence at unchanged reviewed head, then configured mode-free verify; retain original generated case/native process/CPU receipts.

### rev-31 · 2026-10-29T18:49:48.761Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1373-evidence1
commit: 63c6e4bb99b22c0d94ec19b737391c1abfa418f0
scope: evidence
findings: [{"severity":"medium","text":"Configured verification admission refused: new wall-clock-wait count 1 exceeds frozen allowance 0. No Linux suite ran; resolve through owning guard/Coordinator and obtain successor source clearance for any source change.","file":"web/test/composer.test.ts","line":212}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13992 preserves exact hard admission refusal 5adba0f7 at unchanged source2 head; no run/T0/Linux pass exists. Source M1 correction remains separate. Reported macOS A-13988/A-13989 is not yet audited here. Hold retry pending Coordinator disposition, and fresh source review for any changed head; do not bypass frozen allowance.

Criteria: C1 failed (Hard test-lint admission refusal prevents configured Linux verification; reported macOS load proof remains separate and pending audit.).

### rev-31 · 2026-10-29T18:54:24.637Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1373-source3
commit: eda3372ea0807b935cced34ae3c6da13b4c07559
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Timer-free source3 clear, A-14000; tree 5ba069865d03ac3a109e4d13c8a785411afd1181. Coordinator-approved native timeout receipt signals release, readiness must remain pending, exact-row/original assertions retained and finally joins before context teardown. No allowance change. C1 not yet verified; old-head load proof does not carry. Fresh Coordinator stress slot and unchanged-head mode-free Linux evidence required; prior admission refusal remains separate.
