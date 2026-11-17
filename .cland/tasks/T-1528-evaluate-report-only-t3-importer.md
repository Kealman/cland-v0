---
id: T-1528
kind: task
title: Evaluate report-only T3 importer selection for merge batches (T-1490 class)
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1601
branch: t/T-1528-evaluate-report-only-t3-importer
created: 2026-10-31T17:17:41.198Z
updated: 2026-11-17T13:37:18.316Z
closed: 2026-11-17T13:37:18.316Z
---

## Summary

The only real interaction miss since T-1454 went live was T-1490. In it, T-1484 and T-1453 landed in separate T1-only batches and broke a shared T3 test (suite-admission-native). Batch interaction selection adds only T2 and Web, so neither `report` nor `run` would have caught it (T-1488, A-15009). Evaluate a report-only T3 importer selection for batches.

## Acceptance criteria

- [x] C1. A report-only T3 importer selection, replayed against T-1490's exact heads, lists suite-admission-native for the T-1484 × T-1453 pair.
  - done: impl-1528 · 2026-11-17T11:55:09.917Z
  - verified: rev-35 [reviewer] · run rev-35-1528-final-1 · 2026-11-17T12:46:48.888Z · commit 4c6b61954f43ad4c22da65b4d9a918ddc3601d45
- [x] C2. The artifact records explicitly synthetic zero-delta negative controls, labels the A-15009 window's historical T3 negatives as unknown (their candidate trees expired), and gives per-batch projected extra T3 wall time and droplet cost from labelled landing/parent reconstructions, plus the platform caveats, so that a later enforce/run switch has its evidence under rule 27.
  - done: impl-1528 · 2026-11-17T11:59:31.257Z
  - verified: rev-35 [reviewer] · run rev-35-1528-source-1 · 2026-11-17T12:10:37.328Z · commit 4c6b61954f43ad4c22da65b4d9a918ddc3601d45
  - verified: rev-35 [reviewer] · run rev-35-1528-final-1 · 2026-11-17T12:46:48.888Z · commit 4c6b61954f43ad4c22da65b4d9a918ddc3601d45

## Comments

### impl-1528 · 2026-11-17T11:44:00.931Z

Consumer audit before extending report: suite-interactions produces batchInteraction; suite-selection owns transport validation and cache comparison; shared/wire duplicates selection type; hub/suites passes/logs/persists selection unchanged; hub/merge-batches batchInteractionSummary emits bounded report JSON; suite-selection.test (T3) and merge-batches.test (T1) assert old report fields; init-config tests assert unchanged setting, not report shape. Searches for batchInteraction and batch interaction across hub/web/nvim/shared/qa/docs/.agents found no raw report parsers, startup probes or frozen CLI report bytes. Existing CLI help fixture describes unchanged T2/Web run switch. Add optional t3 report, preserving old fields and legacy reads. No hot suite files changed.

### impl-1528 · 2026-11-17T12:00:05.707Z

C1/C2 evidence: A-20861 supersedes A-20860 and matches the Coordinator-updated C2 wording. Exact positives list suite-admission-native conservatively and host-ssh-contract through a proved edge; 25 window rows explicitly distinguish reconstructed nonempty projections from synthetic zero-delta controls and unknown historical negatives. Rate scenario $0.25/hour is receipt-backed, historical price unknown. Local Darwin arm64 Node24.21.0: 82 reachable/conservative T1 files passed 882/882 cases (A-20862), T2 new report tests 2/2 with positively controlled native launch guard, full typecheck exit0. No T3/Web/browser execution in these local checks. Final source merged origin/dev once (1cd9883c0), source head 4c6b61954, full lint pending at this comment. No help exports/config/default/role change.

### rev-35 · 2026-11-17T12:10:37.328Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1528-source-1
commit: 4c6b61954f43ad4c22da65b4d9a918ddc3601d45
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20867 full source/evaluation clear, tree285dedd07ca4f37c885a93fd5a6b18cc94abb394; base1cd9883c0 before firstrequest. Standards0/Spec0 findings. Optional validated/wire-mirrored report-onlyt3 cannot feed execution tiers/T2Webrun/admission; individualunknown retained, wholefailure null, fullT3 noextra. Oldreports/summaryshape/cacheexecutioncompat preserved; summary10examples/fullpersistedreasons. AsyncT2case wholebody/root+positivecustom/nativeguard; pureparsercase. C1replay exactT1484/T1453heads listsnativeadmission viaexplicit conservativefallback,notcounterfactual/causalproof. C2amendedCoordinator998f3c64 established:25unique windowrows/13landing-parent reconstructions+12syntheticzeros,12nonidenticalhistoricalnegativesunknown. Independentlyallprojection/costtable formulas matchimmutablebaseline;11missingtimingoccurrences/120sassumption/$0.25illustrativerate/historicalunknown/platform-overhead caveats/recommendreportonly explicit. A-20861 supersedes20860. Retainedreplya07951fb clarifies precommit replay0/T2guard2/2/type-lint0/128report0refusals; A20862 has882passes butremoved82filemanifest/launch-tree/nativecwd/rawhash/signals unknown. Selector/importgraph/parser unchangedafterf3f→4c6; noexactheadreplay/fullT1claim. Oldfailed/partialroundsretained,noT3/Web/browser/providerexecutionproof. C2verified;C1pendingqualifiedreplay+sameheadconfiguredfinal. No Reviewer runtime/probe/edit.

Criteria: C2 verified.

### rev-35 · 2026-11-17T12:46:48.888Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1528-final-1
commit: 4c6b61954f43ad4c22da65b4d9a918ddc3601d45
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20879 final same-head clear; source A-20867 unchanged. Config e41ac1fb/A-20876 passed at 4c6b61954, delivered normalized tree75971b16c8dfe44fcf64abdaa78c7578631f8c1e. Independently 6672 ordinary pass/1 documented macOS caffeinate skip/0fail/cancel; all224T1/431T2/55Web/2mappedT3 file envelopes pass; separate220load passes. Both new report identities ordinary+5/5 proofs29018/29092. 19 native passing identities+1platform skip, one base/no repetitions; 20.329s selected phases excluding wait, not suite wall;267T3/17T4 unexecuted and proposed advisory lists not run. All44added warning identities versus A20850 resolve to shared fake-only-fixture.ts:31 retained-custom positive controls; pinned lower prototype guard,12count/reset/finalzero and passing assertions prove refusal boundary, no child/PID claim. Coordinator730f8c04 separate diagnostic debt. T1935 exact fixture pair28622/623; structured outcomes/Finished0 independent. Linuxx64Node24.21Nvim.12.5, actual isolated Headless1248/CfT156 browser; lint128/62+budgets report-only. C1 exact T1484×T1453 replay lists suite-admission-native conservatively, not causal/counterfactual execution proof. C2 amended scope retained:13reconstructed+12synthetic rows/historical negatives unknown/qualified projection+rate+platform. Precommit replay/local882 supporting provenance limits and prior failed/partial rounds remain, no exact-head offline replay/fullT1 claim. No Reviewer runtime/probe/edit; no enforce/run authorization.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T13:37:18.316Z

Merged fd186828762a948451a1fc264770ba083ef3a788 onto dev.
