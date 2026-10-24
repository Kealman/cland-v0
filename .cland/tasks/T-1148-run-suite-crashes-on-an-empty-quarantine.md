---
id: T-1148
kind: task
title: run-suite crashes on an empty quarantine receipt and hides the Web phase's real failure
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-937
branch: t/T-1148-run-suite-crashes-on-an-empty-quarantine
created: 2026-10-22T17:21:01.416Z
updated: 2026-10-24T08:42:54.919Z
closed: 2026-10-24T08:42:54.919Z
---

## Summary

T-1118's verify 2153dc17 (A-9371, Linux c-8 lon1) ended its Web phase with `SyntaxError: Unexpected end of JSON input` at `JSON.parse(await readFile(quarantinePath))` (hub/test/run-suite.ts:254). The quarantine receipt was empty while `web/test/items.test.ts` › "closed container pages restore nested archives once and preserve unloaded release progress" was still in flight. The runner crash replaced whatever ended the test process with an unrelated parse error. The completed tests (2511/2511) had passed.

## What to build

When the quarantine receipt is missing, empty or torn, the runner reports the phase as incomplete. The report names the in-flight test and the test process's own exit and stderr tail, never a JSON parse error, and the phase still exits non-zero.

## Acceptance criteria

- [x] C1. An empty or truncated quarantine receipt yields a non-zero phase with an "incomplete: receipt missing" line naming the in-flight test, and no SyntaxError (test).
  - done: impl-1148 · 2026-10-24T07:54:07.970Z
  - verified: rev-31 [reviewer] · run rev-20261024-1148-final · 2026-10-24T08:37:52.974Z · commit 49738d52b9311b195b079f8c4789ef084503ab42
- [x] C2. The phase output keeps the test process's exit status and stderr tail when the receipt is unusable (test).
  - done: impl-1148 · 2026-10-24T07:54:08.070Z
  - verified: rev-31 [reviewer] · run rev-20261024-1148-final · 2026-10-24T08:37:52.974Z · commit 49738d52b9311b195b079f8c4789ef084503ab42

## Comments

### coord · 2026-10-22T18:43:47.091Z

Root cause of both empty-receipt crashes (T-1118 A-9371, T-1150 A-9419): the Web phase's 60 s gross hang guard in hub/test/run-suite.ts killed the Web test process on Linux c-8 droplets once the grown phase passed 60 s of wall ('Web phase exceeded 60 s gross hang guard'). The guard is now 180 s on dev (4e6193f2). T-1148 still stands: a killed phase must report incomplete, naming the in-flight test, not crash on JSON.parse.

### impl-1148 · 2026-10-24T07:44:59.765Z

TDD: confirmed public runSuite/process and reporter-stream seams with Coordinator. Reproduced empty receipt as `SyntaxError: Unexpected end of JSON input`; regression now retains in-flight identity, raw child exit/signal and stderr tail. Implemented atomic reporter staging+rename with repetition-local paths. Local macOS targeted quarantine/reporter/admission checks passed (19 tests) before the latest pipe-drain lifecycle adjustment; npm run check passed (T0 lint report-only, 0 refusals). Final targeted/lifecycle checks and docs in progress.

### rev-23 · 2026-10-24T07:50:27.062Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1148-source
commit: d3ab834a3d55ebb26770e93b796131ae4eaa7ae9
scope: full
findings: [{"severity":"medium","text":"M1: use the repository test path heading required by test-docs.test.ts; the new indexed document currently fails that existing T1 guard.","file":"docs/agents/tests/hub-test-quarantine-runner.test.ts.md","line":1},{"severity":"medium","text":"M2: missing/empty/torn quarantined-repetition receipts still pass through unguarded read/JSON.parse and reject the phase before incomplete/native diagnostics. Handle this consumer and add a faulted repetition regression.","file":"hub/test/load-gate.ts","line":145},{"severity":"medium","text":"M3: use a streaming UTF-8 decoder for stdout progress capture; independent Buffer.toString calls corrupt Unicode identity bytes split across chunks. Cover the split-byte boundary.","file":"hub/test/run-suite.ts","line":228}]
finding_counts: {"high":0,"medium":3,"low":0}

T-1148 full source review — not clear

Head d3ab834a3d55ebb26770e93b796131ae4eaa7ae9; tree 09fc60ba0b83cbc830aed5d5c54c27156a048d2d. Fixed parent 12817c759ab1aefad45add6cc26d26c5c862045e. Comparison git diff 12817c75...d3ab834a3d55ebb26770e93b796131ae4eaa7ae9: eight files, 173 additions / 14 removals. Run rev-20261024-1148-source.

## Standards

M1 (medium), docs/agents/tests/hub-test-quarantine-runner.test.ts.md:1. The new indexed note begins “# Quarantine runner receipts”; the shipped T1 test-docs guard requires the exact repository test path heading to validate its filename/source/index mapping. This document will fail that existing guard. Change it to “# hub/test/quarantine-runner.test.ts” and include the existing docs guard in necessary correction checks. Implementer accepted M1.

M3 (medium), hub/test/run-suite.ts:226–229. The new raw stdout pipe observer decodes every Buffer independently with chunk.toString(). Node pipe chunks can split a multibyte UTF-8 test name; the reconstructed JSON may still parse but contain replacement characters, corrupting the in-flight identity this feature promises. Use streaming UTF-8 decoding (the existing load-discovery reader already does) and a split-byte Unicode identity regression at the smallest suitable seam.

The rest of the reviewed design retains appropriate boundaries: the atomic reporter uses same-directory staging/rename and awaits publication before flush completion; test-worker unit consumers retain the streamed JSON contract; ordinary/repetition receipt paths are separated. The phase stderr tail is byte-bounded. The real-process regression is justified at existing T3, with sealed scratch env, owned child and ten-second outer deadline. It observes an execution-order start before group termination and faults the read after writer exit. The stream-publication test is file-only T1 and awaits its writer before cleanup. No browser or hub daemon is added.

## Spec

M2 (medium), hub/test/load-gate.ts:144–145 and run-suite.ts phase/gate rejection handling. The changed repetition path still reads its quarantine receipt through unguarded JSON.parse(await readFile()). With a failed quarantined repetition and one result, a missing/empty/torn receipt rejects runLoadGate; runSuite then throws that gate rejection before its new ordinary-phase incomplete/native-diagnostic handling. A parse/ENOENT error can still replace the producer's real failure. Apply the incomplete contract to this consumer too, naming the repetition identity/native status and diagnostic tail, refusing quarantine excuse, and retaining a faulted repetition regression. The existing successful quarantined-repetition regression does not exercise missing publication.

The ordinary phase path addresses the original failure: ENOENT/SyntaxError become explicit incomplete status; native nonzero is retained and zero is changed to failure. It tracks execution-order unfinished starts, keeps cancelled identities, skips incomplete duration-budget evidence, sweeps owned descendants before awaiting pipe closure, then reports native exit/signal and the captured stderr tail. Shared suiteProgress filters file envelopes when a test identity exists. However, M2/M3 leave the overall promised reporting incomplete; C1/C2 are not clear.

Coordinator 8a3f587a explicitly confirms public runSuite/process faults and pure reporter stream tests, without browser scope. Missing/empty/truncated process cases and zero-native-exit case match that seam; their bounds/assertions must remain. The fixture's native reporter stderr marker and child process close are relevant evidence rather than an unrelated timeout. No duration allowances or gross Web hang guard changes are included.

## Evidence and limits

A-10417 summarizes local macOS working-tree checks: quarantine/reporter/admission 19/19, runner lifecycle 45/45, npm run check passed with report-only lint/zero refusals. It states these preceded commit of the final tree. No configured/Linux run exists. Original raw stdout/exits/timings/source/platform/cleanup attribution have been requested for durable preservation without rerunning for transcription. No Reviewer runtime reproduction has been performed.

Current task worktree is tracked-clean at reviewed head; diff whitespace check passes. Complete finding set is M1–M3 only. Correct those, preserve existing receipts, commit/push and request fresh source review before mode-free verification. QA policy none/after-stage, no per-item brief/criteria. Reviewer performed source/Git/artifact inspection only, no tests/probes, browser, edits, merge or delegation. Both axes completed in-session.

Standards: two medium findings (M1/M3). Spec: one medium finding (M2).
Durable review A-10424.

Criteria: C1 failed (An indexed doc fails the source-heading guard; repetition receipt parsing can still throw instead of reporting incomplete, and split UTF-8 progress chunks can corrupt the in-flight identity.), C2 failed (The unguarded load-repetition quarantine reader can reject the gate before native exit/stderr diagnostics are reported for an unusable receipt.).

### impl-1148 · 2026-10-24T07:54:08.172Z

Corrected review M1–M3 at 970cb402aa954b18ba2986b26000ddd6c674c234. M1 heading assertion reproduced then docs guard passed. M2 faulted quarantined repetition reproduced `SyntaxError: Unexpected end of JSON input`; shared guarded reader now retains repetition native diagnostics without an excuse for missing/empty/truncated receipts. M3 split UTF-8 reproduced `held test ����`; streaming decoder now preserves `held test 🦊`. Local macOS at correction tree: 25/25 targeted T1/T3/docs tests passed, npm run check exit 0 (T0 lint report-only, 132 findings/0 refusals). Raw correction outputs A-10447/A-10448. Original d3ab834a check/19+45 raw receipts preserved from harness records in A-10438, not replaced by reruns. No full verification yet.

### rev-23 · 2026-10-24T07:57:42.239Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1148-source2
commit: 970cb402aa954b18ba2986b26000ddd6c674c234
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1148 corrected source review — clear

Head 970cb402aa954b18ba2986b26000ddd6c674c234; tree 085e6db887ae68d1d5d3d545b65b346905d8432c. Delta from source-reviewed d3ab834a3d55ebb26770e93b796131ae4eaa7ae9: five files, 71 additions / 16 removals. Fixed original base remains 12817c759ab1aefad45add6cc26d26c5c862045e. Run rev-20261024-1148-source2. Both Standards and Spec reviewed in-session.

Standards: clear. M1 is corrected by the exact indexed test-path heading. M3 uses StringDecoder('utf8') across stdout chunks while preserving raw passthrough. The deterministic process fixture splits the fox character's UTF-8 bytes across emitted chunks and asserts the exact retained in-flight name. Existing start/termination, ownership, outer bounds and cleanup assertions remain. No allowance, hang-guard, dependency or dev-merge change.

Spec: clear. M2 is corrected through the shared readQuarantineReceipt helper, used by ordinary phase and repetition consumers. Missing files and malformed/empty JSON supply no quarantine authority; unrelated I/O failures remain visible. A failed repetition with an unusable receipt stays a failure, reports its exact file/name/repetition, native exit/signal and bounded stderr tail, and receives no excuse. The repetition drains stderr after owned-process cleanup and before reporting. Missing/empty/truncated repetition regressions assert native exit 1, stderr marker, incomplete identity, zero successful repetitions and no SyntaxError/false excuse. Ordinary incomplete/zero-exit handling and successful quarantine behavior are retained. M1–M3 from A-10424 are all addressed; no remaining findings.

Evidence: A-10447 retains the correction's native targeted output, 25/25 tests with zero failures/cancellations/skips, duration 17,966.732542 ms. It covers quarantine, public runner faults, admission and indexed-doc guards. New repetition fault samples are approximately 1.74–1.92 s and split-Unicode sample approximately 0.782 s. A-10448 preserves the correction's full static-check output; implementer records native check exit 0 on local Darwin arm64 at this correction tree, with report-only test lint and zero refusals. These are local correction-tree receipts, not a configured/Linux suite. A-10438 preserves original tool command/output/exit records for the earlier 19 targeted and 45 lifecycle checks; earlier head attribution is retained rather than replaced by a transcription rerun. A-10417 supplies original source/platform/cleanup limitations.

C1/C2 remain done but runtime verification pending the configured same-head result. Source clearance permits mode-free verification at exactly 970cb402; it is not final readiness. QA policy none/after-stage, no per-item QA brief. Reviewer performed static source/Git/artifact inspection only; no tests, probes, browser, edits, merge or delegation. Findings: [].
Durable review A-10463.

### rev-23 · 2026-10-24T08:19:06.400Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1148-evidence1
commit: 970cb402aa954b18ba2986b26000ddd6c674c234
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1148 same-head evidence audit — clear; authorized integration pending

Head 970cb402aa954b18ba2986b26000ddd6c674c234; tree 085e6db887ae68d1d5d3d545b65b346905d8432c. Source clearance A-10463 (M1–M3 resolved) remains current. Run rev-20261024-1148-evidence1. Findings [].

A-10504 / configured mode-free a51c6b04-ca14-4a1b-8aee-aacbd1974c8c exits 0 at exact reviewed head, independently matched to current branch. Parsed native finishes: 2,795 ordinary test passes and 418 file passes, plus five actual load-gate test/file passes, zero failures/cancellations/skips. Repetitions are additional, not included in 2,795. T1 and fallback all T2 across hub/Neovim plus complete Web (44 files, 223 top-level tests) completed.

Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-923de6ee, Node v24.21.0, Neovim v0.12.5; workers 2 / Web4; lifetime 617 s, cost $0.0429. Actual suite durations 51.37 / 318.04 / 141.76 s, Web shard 141.65 s. Report phase envelopes 55/323/145 s and projections remain separate. Host npm run check is retained; host gate 46e7352f29ed8b451c29722bc3c44a8b9f3946dc independently resolves to a candidate tree object, reused rather than executed again on droplet.

The new atomic receipt-publication T1 test passes in 0.012056668 s and five actual repetitions, maximum 0.013813382 s. No affected-file tier mismatch found. Generic five-repetition headers do not establish any other repetitions. Generic lint (132 findings/59 files), duration budgets, one missing baseline and incomplete-base T3 ratchet are report-only; existing Web/scale warnings and Web wall projections are retained, not enforced-budget compliance.

T3/T4 are absent from this configured task run; T3 is explicitly deferred to periodic/integrated occasions and absent configured batch tiers. The public process-fault regressions are therefore supported by local Darwin arm64 correction-tree A-10447: 25/25 targeted tests across quarantine/reporter/runner/admission/docs, zero failures/cancellations/skips, native duration 17,966.732542 ms. Those retained tests assert missing/empty/torn ordinary and repetition receipts, nonzero native status/signal/stderr-tail retention, zero-native-exit turned into failure, no false quarantine excuse, and exact split-UTF8 identity. They are local targeted T3 evidence, not Linux T3 or load repetitions. A-10448 retains local check output; A-10438 retains original earlier 19+45 tool receipts with separate attribution; A-10417 carries source/platform/cleanup limits. No tests were rerun by Reviewer.

C1/C2 source and local behavior evidence are satisfactory at 970cb402, with the configured same-head green above. However, the post-run lead conflict check found an additive index conflict with fetched dev. Coordinator a6bb6168-6bfb-422c-ae14-5fb221c1caa9 now explicitly requests dev integration, a delta review and fresh mode-free verification. This audit accepts current-head green as provenance and intentionally leaves final criterion verification/readiness pending the replacement merge head; it is not exact-head evidence for that changed head.

QA policy none/after-stage. Both axes completed in-session; no tests/probes, edits, browser, merge or delegation by Reviewer. Standards zero findings; Spec zero findings.
Durable audit A-10508.

### rev-31 · 2026-10-24T08:20:28.276Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1148-delta
commit: 49738d52b9311b195b079f8c4789ef084503ab42
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear at 49738d52/tree18451f7a, no findings. A-10512 carries rev-23 source A-10463 and parent evidence A-10508. Verified Coordinator a6bb6168 and parents970cb402+aafdc9a4; actual index rows exactly equal parent union (81/88 ->89, no missing/extra). Task runner/reporter/load-gate/quarantine source/tests unchanged, matching README retained alongside incoming dev. A-10510/A-10511 local static/doc receipts inspected; C1/C2 final marks await fresh configured mode-free evidence at this head. Prior A-10504 belongs to970cb402 only. QA none/after-stage; native local T3 limits retained, no LinuxT3/stageQA claim. Reviewer ran no tests and did not enqueue.

### impl-1148 · 2026-10-24T08:37:18.837Z

Fresh mode-free verify d1ba9a6b-5405-40c7-8127-f6f4af3654fb at reviewed 49738d52b9311b195b079f8c4789ef084503ab42 exited 0: Linux x64 c-8 lon1 droplet, T1/T2/Web 2826/2826 passed, no failures/cancellations/skips. T3 was not selected; budget/lint report-only. Droplet lifetime 627s, cost $0.0436. Raw receipt A-10545. Current origin/dev c345bf92ecb1d105d614c4cccb3c089e12f02599 conflict check `git merge-tree --write-tree HEAD origin/dev` passed; task head and worktree remain unchanged/clean. Waiting for Reviewer same-head evidence settlement before final ready report/enqueue; no merge performed.

### rev-31 · 2026-10-24T08:37:52.974Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1148-final
commit: 49738d52b9311b195b079f8c4789ef084503ab42
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 clear at unchanged merged/source-clear 49738d52/tree18451f7a. A-10548 carries rev-23 source A-10424/A-10463 and authorized delta A-10512. Fresh d1ba9a6b/A-10545 exit0,2826/2826,Linux c-8 lon1 T1/all fallback hub+Neovim T2/Web. Independently checked atomic publication ordinary+five distinct load passes/explicit5/5, max0.021103062s. Native C1/C2 fault regressions remain separate local Darwin correction-tree A-10447 25/25, inspected with source-equivalence/provenance limits; configured task did not execute T3/T4. Host T0 retained/not repeated remotely, budgets/lint/ratchet report-only with zero lint refusals. No outstanding findings or stageQA/Reviewer-runtime/enqueue claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T08:42:54.919Z

Merged 666e19fa89158347849ac29f39cf607bbeb268cc onto dev.
