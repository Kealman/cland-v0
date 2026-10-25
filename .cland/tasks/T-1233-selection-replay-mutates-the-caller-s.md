---
id: T-1233
kind: task
title: Selection replay mutates the caller's repository with an unsealed Git environment
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1045
branch: t/T-1233-selection-replay-mutates-the-caller-s
created: 2026-10-24T11:03:29.065Z
updated: 2026-10-25T12:22:03.430Z
closed: 2026-10-25T12:22:03.430Z
---

## Summary

The outer Git helper in hub/test/selection-replay.ts runs `git archive` and `git worktree add/remove` against the caller's repository, without a sealed environment or cwd. Its read-only exemption does not cover these worktree mutations or inherited `GIT_*` variables (rule 15). The T-1231 reviewer found it aside.

## Acceptance criteria

- [x] C1. The manual selection replay runs in a disposable clone with its own HOME, XDG and Git configuration, inherited `GIT_*` removed; it never adds or removes a worktree in the caller's repository (test).
  - done: impl-1233 · 2026-10-25T11:56:13.424Z
  - verified: rev-26 [reviewer] · run rev-20261025-1233-evidence-3 · 2026-10-25T12:15:06.591Z · commit e951654c600df68eb8444579ba0f828734de40b0
- [x] C2. The replay's existing assertions are kept and still pass (test).
  - done: impl-1233 · 2026-10-25T11:56:13.516Z
  - verified: rev-26 [reviewer] · run rev-20261025-1233-evidence-3 · 2026-10-25T12:15:06.591Z · commit e951654c600df68eb8444579ba0f828734de40b0

## Comments

### impl-1233 · 2026-10-25T11:26:47.141Z

Plan: preserve the existing replay CLI seam in hub/test/suite-selection.test.ts (T3, already exercises the actual replay subprocess). C1 regression will use a disposable caller and an audited Git executable, poison only scratch-owned GIT_* / account paths, and assert clone ownership, private HOME/XDG/config, no inherited Git redirect, and no caller worktree mutation. C2 retains and runs existing coverage assertions (selection, time share, own/historical misses, missing-map fallback), with positional selector-ref exercised. Replay metadata remains read-only from the caller. This is test-tool implementation sealing; no wire/schema/refusal/delivery/admission contract is changed.

### rev-26 · 2026-10-25T11:33:24.506Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1233-source-1
commit: 42442ee4cbc701b43c07407d7dc186d9e9a07230
scope: full
findings: [{"severity":"medium","text":"M1: plain timeout-bound execFile of the Node replay has no owned descendant-tree cleanup; a timeout during synchronous Git clone/worktree can leave a native writer alive when fixture roots containing replay TMPDIR are removed. Register/drain ownership before removal and prove the held-native timeout/failure path.","file":"hub/test/suite-selection.test.ts","line":641}]
finding_counts: {"high":0,"medium":1,"low":0}

Full in-session Standards/Spec audit complete, A-11814; consolidated finding M1 only. Clone-only Git mutations, explicit cwd/sealed per-call environment and retained replay assertions otherwise match scope. New T3 regression lacks positive native descendant stop/drain before owned root cleanup on timeout. Correct and request fresh committed source review before verification; no deadline/assertion relaxation. Coordinator-classified existing dev failure T-1299 remains separate, not a T-1233 finding or pass. Local A-11806 is premerge summary with capture limits, not configured same-head evidence. Preserve original available output/exits/source records, no transcription reruns.

Criteria: C1 failed (New replay isolation regression must own and stop native Git/tar descendants before disposable fixture roots are removed on timeout/failure.).

### rev-26 · 2026-10-25T11:39:25.479Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1233-source-2
commit: 78b96e8c8b0f45f3c4b4db09c47f58564b191ebd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source audit A-11814 carried forward; M1 corrected, A-11827. Sole-parent two-file correction registers detached replay-tree ownership before launch, stops/drains exact group and child pipes on the unchanged 15s deadline/finalization, and observes group ESRCH before root removal. New held synchronous-native-writer control waits for persisted PID before deadline action and retains signal/death/removal receipts; original isolation/replay assertions unchanged. Both axes clear. C1/C2 final runtime marks pending exact-head ordinary mode-free configured proof; local correction outputs remain transcript/excerpt evidence with limits. T-1299 known dev defect and any authorized merge/new-head review remain separate; no configured/QA/landing pass claimed.

### rev-26 · 2026-10-25T11:41:04.024Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1233-evidence-1
commit: 78b96e8c8b0f45f3c4b4db09c47f58564b191ebd
scope: evidence
findings: [{"severity":"medium","text":"M2: verify-test-lint refuses the new deadline timer as wall-clock-wait count 1 over frozen allowance 0; submission never executed. Resolve via documented permitted deadline handling, preserve behavior/bounds and request fresh source review before retry.","file":"hub/test/suite-selection.test.ts","line":164}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR; A-11831. Original hub refusal 2ef4eeab names verify-test-lint wall-clock-wait at line164. task.view verify:null confirms no admitted run, native test counts/platform/timing or tier evidence. Prior source-2/A-11828 and local lifecycle observations remain separate, not runtime proof. Do not bypass lint or retry unchanged head; any correction must preserve deadline/held-writer assertions and receive fresh source review. T-1299 known dev defect remains separate.

Criteria: C1 failed (Configured verification refused before execution on new deadline lint; no exact-head runtime isolation receipt.), C2 failed (Configured verification refused before execution; retained replay assertions have no current configured passing receipt.).

### rev-26 · 2026-10-25T11:45:19.131Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1233-source-3
commit: 55f25b09eba558a59b9493fe6d76194df15cac6f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source chain A-11814/A-11828 carried forward; A-11839. M2 resolved by removing inline timer and using node:test timeout:15000 on both owned native cases, as Coordinator363de12c directs. Child close/pipe receipts, shared owned-group teardown, bounded ESRCH and held-writer PID/SIGKILL/death/root-removal assertions retained. No allowance, production replay or dev merge change; both axes clear. C1/C2 runtime marks pending exact-head ordinary configured proof. Prior A-11831 was admission-only refusal with verify:null, not a native test run. Local correction receipts remain transcript summaries with limits; preserve originals without reruns. T-1299 and any authorized integration/new-head review remain separate.

### rev-26 · 2026-10-25T11:51:01.509Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1233-evidence-2
commit: 55f25b09eba558a59b9493fe6d76194df15cac6f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence NOT CLEAR, no source findings; A-11854. A-11852/run4840c2cb at55f25b09 is terminal exit143/cancelled under Coordinatorcc028964, after green hostT0/30.459s and before completed runtime counts/platform. Planned phase counts/projections are not pass evidence; attempted droplet114s/$0.0079 is not suite wall. Preserve source-3/A-11839 and local limits separately. Await T-1299 landing, authorized dev merge, fresh source review and one new-head mode-free verification; no unchanged-head retry requested.

Criteria: C1 failed (Coordinator-authorized cancellation ended old-head verification after T0, with no runtime isolation proof.), C2 failed (Coordinator-authorized cancellation supplied no completed replay runtime receipt; fresh integrated-head verification is pending.).

### rev-26 · 2026-10-25T11:57:51.494Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1233-source-4
commit: c0d54d996b6a63e1284c40478af11f2006e9d89e
scope: delta
findings: [{"severity":"low","text":"L1: merge retains the older fixture-setup paragraph immediately above the updated T-1299 projection/growth instructions. Consolidate to the updated paragraph; correct guidance is already present, so this does not block source clearance.","file":"docs/agents/tests/hub-test-suite-selection.test.ts.md","line":15}]
finding_counts: {"high":0,"medium":0,"low":1}

Merged-head source CLEAR, A-11864, carrying full source-3/A-11839. Exact parents55f25b09/bd061ddb and Coordinator authorization inspected. Complete seven-file task diff reviewed; replay blob, owned cleanup helper and both new regression bodies unchanged. Incoming T-1299 guard projection/growth controls retained, no assertion/deadline/allowance relaxation. One low duplicate-guide finding, no high/medium; Spec zero findings. Local101/101/typecheck remain transcript-only targeted macOS claims with capture limits, not configured evidence. C1/C2 final runtime marks pending one ordinary mode-free exact-head run. Cancelled old-head A-11852 remains incomplete. Any further commit, including low guide cleanup, needs source review before verification.

### rev-26 · 2026-10-25T11:58:48.583Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1233-source-5
commit: e951654c600df68eb8444579ba0f828734de40b0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction CLEAR, A-11866; carry full source-3/A-11839 and authorized integration source-4/A-11864. Complete sole-parent commit diff deletes exactly the superseded guide paragraph; updated projection/growth controls and all lifecycle/sealing guidance remain. L1 resolved, zero findings on both axes; no runtime/test/tier/allowance or further dev-merge change. C1/C2 final verification remains pending one ordinary mode-free configured receipt at unchanged e951654c. Prior targeted macOS receipts and cancelled old-head A-11852 remain separately attributed; no transcription/test reruns or QA/landing claim.

### rev-26 · 2026-10-25T12:15:06.591Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1233-evidence-3
commit: e951654c600df68eb8444579ba0f828734de40b0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence CLEAR, A-11892; carry source-5/A-11866 and prior full/integration chain. Original A-11888 independently parsed: 3258 ordinary tests / 440 files all pass, no load-gate finish records. Changed T3 file 101/101 once: native clone/sealing case 0.940405531 s, held writer stop/drain/root-removal control 0.229642981 s, retained coverage/time-share/own/historical-miss/fallback assertions 3.700178727 s all pass; shared manifest-growth control passes. T0/all T1/fallback all T2/changed T3/Web green on Linux x64. Remaining T3/T4 deferred, no repetition/full-occasion claim. Host prepared-tree check and report-only lint/timing/ratchet retained; +1.170 s T3 growth with incomplete base timing is not enforced budget failure. C1/C2 verified, zero findings. Old cancelled A-11852 remains historical. Coordinator owns enqueue/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T12:22:03.430Z

Merged 0026fcd09531b3dd1d630601b6bee942254584af onto dev.
