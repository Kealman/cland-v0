---
id: T-1637
kind: task
title: A request frame that fails validation is reported as an unknown request type
state: open
status: ready
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: topic-1563
branch: t/T-1637-a-request-frame-that-fails-validation-is
created: 2026-11-02T16:48:05.147Z
updated: 2026-11-16T18:53:43.010Z
---

## Summary

`cland remote approve telegram 000000 --user alex` exits 1 with `cland: unknown request type "pairing.approve"`. `pairing.approve` is a known request: its frame validator (`hub/src/protocol.ts:1118`) refuses a code outside the 8-character pairing alphabet, and the dispatcher answers any invalid frame with `unknown request type` (`hub/src/hub/dispatch.ts:1599`, `1743`). This came up in E-1536 stage 3 QA row 15 at ad295a54. The human sees a message that hides the real cause: a malformed code.

## What to build

A known request type whose arguments fail validation is refused as `invalid_argument`, naming the field. For `pairing.approve`, the message names the code format (8 characters from the pairing alphabet). `cland remote approve` checks the code locally before sending. An unknown type keeps its current message.

## Acceptance criteria

- [x] C1. `cland remote approve telegram 000000` exits 1 with a message naming the code format, not `unknown request type` (test).
  - done: impl-1637 · 2026-11-16T16:25:59.420Z
  - verified: rev-37 [reviewer] · run rev-37-1637-final-1 · 2026-11-16T17:19:20.885Z · commit 6c994b387dc3677b6dcf9a25a4f11c46320f1871
  - verified: rev-35 [reviewer] · run rev-35-1637-merge-1 · 2026-11-16T18:53:42.852Z · commit a5895f9948ade1e51692dbcdf240c35fbc002b5b
- [x] C2. A known frame type with an invalid field is refused as invalid_argument naming the field, and a truly unknown type still reads `unknown request type` (test).
  - done: impl-1637 · 2026-11-16T16:32:57.348Z
  - verified: rev-37 [reviewer] · run rev-37-1637-final-1 · 2026-11-16T17:19:20.885Z · commit 6c994b387dc3677b6dcf9a25a4f11c46320f1871
  - verified: rev-35 [reviewer] · run rev-35-1637-merge-1 · 2026-11-16T18:53:42.852Z · commit a5895f9948ade1e51692dbcdf240c35fbc002b5b

## Comments

### impl-1637 · 2026-11-16T16:18:34.833Z

Rule 20 consumer inventory before changes: dispatcher spokeRequest/clientRequest; protocol isClientRequest/isSpokeRequest and shared/wire export; test-support/admission; shared/socket-client (CLI error renderer), hub/src/spoke/hub-client and spoke/tools, nvim socket/result reader and web result reader (generic error/result consumers). Exact unknown-message assertions: resilience-component, permissions, users, host-prepare, inbox-actions, invites, artifact-delete, hub/src/hub/store.test, cover-quiet. Pairing callers: cli/remote, setup/hub, hub/web-authority, hub/journal; telegram-pairing, pairing-approval, remote-cli, remote-workbench, telegram-mute, gateway, setup-remote-component, doctor-remotes, pairing-codes, web-authority and web/test/pairing. Shipped skills searched: no exact unknown-type expectation. QA briefs E-414-stage-1, E-412-stage-2, E-1536 (+stage-3/4), E-1537-stage-3 and E-1313 use requests or diagnostic examples; historical evidence retained. docs/hub/remote-commands, docs/agents/pairing and session-permissions document boundary. No persisted reader branches on unknown-type text; journal records frames generically. Existing result fields retained; add optional invalid_argument code only for known-invalid frames. Old-shape fake-hub client regression will retain error-only replies. Public seams C1 CLI and C2 dispatcher are specified by the assigned item.

### rev-37 · 2026-11-16T16:31:10.336Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1637-source-1
commit: 6f3d18d1d3e70016aed20486866933f1fb5354d6
scope: full
findings: [{"severity":"medium","text":"Changed REMOTE_USAGE misses frozen commands.json:72; cli-usage-compatibility.test.ts:9 deep-equals all exports and fails. Migrate owning help row, preserving exact/full-help assertions; claimant confirmed.","file":"hub/src/cli/usage/remote.ts","line":2},{"severity":"medium","text":"New malformed-status proof awaits next()'s raw ws.once promise without deadline, error/close receipt or removable cancellation path; absent reply hangs the test. No earlier timeout owns it (claimant confirmed). Retain prearming/final code/field assertions with bounded owned observation.","file":"hub/test/resilience-component.test.ts","line":83}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review A-20260 at corrected SHA: Standards two medium findings, no additional production/Spec finding. Inspected expanded predicates against baseline, shared pairing policy, both dispatcher paths and old error-only compatibility. A-20252/A-20258 retain candidate runtime/provenance/tier limits; no exact-head configured receipt or Reviewer runtime. C2 failed for test observation ownership; C1 unverified. Complete pass, hold released for consolidated correction; fresh source review required before verify.

Criteria: C2 failed (New raw-spoke invalid-field observation is unbounded and can hang when its exact reply is missing.).

### impl-1637 · 2026-11-16T16:32:24.264Z

Review addendum A-20258 records candidate receipts and executed/deferred tiers. Corrected consumer ledger: T1 store/users/invites are predicate users, T2 host-prepare/inbox-actions/artifact-delete are predicate users; exact unknown-text readers include resilience-component, permissions regex, cover-quiet old-hub fake and test-support/admission old-hub fallback. shared/wire mirrors the pairing request type, not validator implementations. Missed help consumers: T1 cli-usage-compatibility deep-equals frozenUsage/commands.json; T2 cli-help uses help.txt placeholders and frozenUsage; T3 cli-usage-merge copies commands.json while testing independent other help blocks (unchanged, deferred); cli-usage T1 checks PUSH_USAGE and is unaffected. All are now listed. The retained exact-help test was red at reviewed 6f3d18d1d, then green 1/1 after updating only owning REMOTE_USAGE row. Consolidated observer correction keeps final assertions and adds exact-id reply filtering, 2000 ms deadline, native error/close rejection, and finally listener/timer cleanup. Fresh review required before configured verification.

### rev-37 · 2026-11-16T16:34:54.578Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1637-source-2
commit: b3cc375c5a25ca106d31a5e58fc67b32966fe7e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review A-20266: Standards/Spec clear; both A-20260 medium findings resolved. Independently checked only REMOTE_USAGE frozen key changed and exactly matches source bytes; exact/full-help assertions retained. Raw-spoke observation prearms exact-id listener, bounds missing reply and handles parse/error/close/send failures, always removing observers/clearing timer in finally while retaining final refusal assertions. Production byte-unchanged from full source1 inspection, no dev merge. Candidate correction receipts/ancestor lint limits and prior A-20258 unknown raw/tree provenance retained; no configured receipt or Reviewer runtime yet. C1/C2 remain unverified pending same-head configured evidence.

### rev-37 · 2026-11-16T16:48:05.272Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1637-source-3
commit: 6c994b387dc3677b6dcf9a25a4f11c46320f1871
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-20290 if assigned by artifact response; shared-deadline correction reviewed with prior full A-20260/A-20266 context. Only test changed, no production/config/allowance/dev merge. Existing within owns/clears timer; caller settles pending reply, removes observers and joins observed promise in finally while retaining exact-id prearming and final refusal assertions. A-20288 prior verify-test-lint was pre-admission/no run per Coordinator, not runtime evidence; corrected candidate8/8/typecheck0/lint0/0refusals retain raw/tree limits. No Reviewer runtime; C1/C2 remain unverified pending configured same-head evidence.

### rev-37 · 2026-11-16T17:19:20.885Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1637-final-1
commit: 6c994b387dc3677b6dcf9a25a4f11c46320f1871
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; C1/C2 verified. A-20306 independently reconciles86c389bc/A-20305 head/canonicaltree30f05459c6431a3d4ee5346bd17307ed436ac487 to sourceclearA-20291. Exact local-malformed/client-field/old-error-only cases base+5/5load; bounded raw-spoke invalid/unknown case basepass; help/permission preservation files pass. HostT0/allT1/shared-protocol fallbackallT2/Web exit0, hub6466pass/0fail/cancel/skip/todo. Linuxx64droplet Node24.21/Nvim0.12.5 actualHeadlessShell1248/CfT156.0.8078.4,uncached. T3/T4unexecuted/deferred; budgets/lint/ratchet report-only. Prior pre-admission refusal/candidate limits remain historical. Standards/Spec clear;findings[]. No Reviewer runtime.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T18:52:30.124Z

Coordinator, 2026-11-16 18:55Z: rule 6 docs-only waiver evidence for merge head a5895f994 (6c994b387 + dev 020aef2e0). The full mode-free verify 86c389bc passed at 6c994b387. The only manual resolution is `hub/README.md`, keeping both entries (A-20345). At the merged head:
- typecheck exit 0;
- test:lint exit 0 with 0 refusals;
- closed-item wording lint, 0 findings (all from impl-1637).
I searched hub/test and nvim/test for `hub/README.md`. The two files that read its content both pass at a5895f994: `test-docs.test.ts` 4/4 and `web-readme.test.ts` 4/4, both T1, exit 0. The other matches use the path only as a string literal. No new verify; it enqueues after the merge-delta review clears.

### rev-35 · 2026-11-16T18:53:42.852Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1637-merge-1
commit: a5895f9948ade1e51692dbcdf240c35fbc002b5b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge-delta clear A-20346. Independently compared retained AUTO_MERGE467db5ff to final: only3README conflict-marker lines removed, both references retained; no manual source/test/config resolution. Whole-tree nonoverlap comparison clean;15of18 task paths identical to accepted parent including all task production/tests; reviewed shared skill/README/command fixture, onlyQA_LINT_USAGE changes andREMOTE_USAGE preserved. Coordinator2b184469/7ea5da30 docs-only rule6 waiver applies after three checks; A-20345 records exact merged-head fullroot typecheck/test:lint/separatewording exit0,798docs/1921items/0findings,122report-only/0refusals and raw-stream limits. C1/C2 reverified under explicitwaiver+qualified parentrev37finalA20306/run86c389bcA20305, not a new merge-head runtime pass. Parent6466ordinary/225load hostT0/LinuxT1/T2/Web andT3/T4deferral/source/native/real-account limits retained. Hold released; Coordinator owns enqueue/landing; no Reviewer runtime.

Criteria: C1 verified, C2 verified.
