---
id: T-1265
kind: task
title: 'A long-lived Codex session cannot reattach after a hub restart: app-server thread read fails with "Max payload size exceeded"'
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1029
branch: t/T-1265-a-long-lived-codex-session-cannot
created: 2026-10-24T22:20:46.414Z
updated: 2026-10-25T10:27:08.595Z
---

## Summary

After hub restart #55 (2026-10-24 22:18:50Z), Reviewer rev-23 (codex, gpt-6.1-sol, running since 16:52Z with many reviews) stayed `[unknown]`; the hub posted inject-stalled after 60 s. `cland session resume rev-23` failed: `the app-server (pid 25379) does not answer for thread 01a12ffb-…: the app-server connection failed (Max payload size exceeded); a pending request may have been accepted`. The other four Codex sessions reattached. Coord stopped rev-23 and launched rev-33 in its place.

## Evidence

- inject-stalled notice 75a70650 at 22:19:58Z.
- The resume refusal text above; verifier holds were not restored.

## Acceptance criteria

- [x] C1. The Codex adapter reattaches a session whose thread read exceeds the client's default frame limit (raised limit, paged read, or a reattach path that does not read the whole thread), with a test at the fake app-server boundary (test).
  - done: impl-1265 · 2026-10-25T10:25:28.970Z
- [x] C2. When reattach still fails, the session row says why (payload limit) instead of `[unknown]`, so the Coordinator knows to replace it (test).
  - done: impl-1265 · 2026-10-25T10:25:29.155Z

## Comments

### impl-1265 · 2026-10-25T10:02:47.525Z

Consumer inventory before native error classification/reattach request change (rule 20): AppServerClient callers in adapters/codex.ts and accounts/poller.ts; RpcError/RpcNoAnswer handlers in codex.ts (resume fallback, uncertain turn admission/readback) retain parent error semantics; scripted-codex.ts and codex-native.test.ts test doubles; codex-adapter.test.ts and fakes/codex/fake-codex.ts native T3 contract (unknown optional params tolerated). Existing optional stateReason consumers in adapters/sessions.ts, hub/core.ts and protocol.ts reuse the same string field; Claude adapter/tests and qa/briefs/T-272.md use signed-out unchanged. Repository-wide searches across production, nvim, web, skills, QA, docs and all test tiers found no other native error type or request-param consumers. No hub reply/list/schema change; previous-wire compatibility remains the existing optional stateReason behavior. TDD seams are the criterion-specified fake app-server plus real in-process WebSocket transport, no harness binary required.

### impl-1265 · 2026-10-25T10:07:29.560Z

TDD receipts on local macOS working tree: original reattach path failed the C1 receipt wait; metadata-only resume passes. C2 initially failed `actual undefined / expected 'payload limit'`, then CLI assertion failed with `[unknown]`; both now pass via the existing stateReason field and CLI formatter. Transport negative controls at 100 MiB/plain RpcNoAnswer failed both generated WebSocket cases; 512 MiB and the preserving RpcNoAnswer subtype pass with a 101 MiB reply and 513 MiB declared-frame header. Latest complete touched-file run: 33/33 T2 tests passed; new cases <1s macOS. No T3/T4/Web locally run. Updated README, session help, file-specific test doc and implement skill/CHANGES. No role permission/default change or role-clause addition. Additional stateReason consumer inventory: shared/wire/index.ts is already optional-string compatible; CLI session rows now render the reason, web/Neovim consume SessionRow state and are unchanged.

### rev-31 · 2026-10-25T10:10:44.072Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1265-source1
commit: fe1dd7a50b3528d4343fce4ff72770989c47272c
scope: full
findings: [{"severity":"medium","text":"M1: SESSION_USAGE changed without its frozen commands.json block, so existing named-export and real --help/session -h byte guards disagree; retain guards and update only intended frozen bytes.","file":"hub/src/cli/usage.ts","line":29},{"severity":"medium","text":"M2: new WebSocket fixture registers separate teardown after tempProject's shared directory cleanup, removing the socket root before listener/peer closure. Use the shared pre-directory resource lane with actual closure receipts, partial-setup ownership and bounded listening setup.","file":"hub/test/codex-native.test.ts","line":96}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1265 full source review — NOT CLEAR

Head fe1dd7a50b3528d4343fce4ff72770989c47272c, tree f4a32f256107ccc5e66a93284995f2ede53ada8c; dev...head merge-base comparison, one task commit. Standards and Spec reviewed in-session; role disables delegation. Read-only source/artifact inspection only, no tests, browser, probes, builds, fetches or Git mutations.

## Standards

M1 (medium), hub/src/cli/usage.ts:29: SESSION_USAGE adds the payload-limit state-reason sentence, but hub/test/fixtures/cli-usage/commands.json retains the previous SESSION_USAGE bytes. Existing cli-usage-compatibility.test.ts compares every named export to frozenUsage(); cli-help.test.ts compares real root --help and session -h to the same frozen blocks. The submitted head deterministically disagrees with those retained guards. Update only the intended frozen SESSION_USAGE block, preserving exports.json, the root template and all assertions. This is a static mismatch, not a Reviewer-executed test failure. C2's matching help/regression obligation is incomplete (rule 16).

M2 (medium), hub/test/codex-native.test.ts:96: tempProject(t) at line 74 registers the shared cleanupSteps after hook and owns the root in its directory lane. The separate later t.after at line 96 closes peers and the Unix HTTP server only after that earlier hook has removed the root containing their socket. This violates stop/drain-before-remove ordering (rule 12); an earlier native after-hook failure can also prevent the later teardown. Register teardown in the shared resource/before-directory lane before listen/acquisition, keep ownership through partial setup, and observe actual peer/client/listener closure before root removal. Bound the listening setup receipt separately (current once(listening) has no deadline), retaining both exact 101 MiB receipt/length and overflow RpcPayloadTooLarge+RpcNoAnswer assertions. Do not fix this with a sleep or root-removal retry while the listener is still owned. Anchor C1 to safe lifecycle of its new frame-boundary proof.

The T2 in-process native/WebSocket seams otherwise fit the requested fake app-server boundary; no new harness subprocess or dependency. Canonical per-file guidance and kept implement skill CHANGES are updated. No additional Standards finding.

## Spec

No additional Spec finding. Subscription first requests metadata-only excludeTurns, preserving native thread id/model/state snapshot sequencing. The compatibility retry is restricted to an explicit RpcError -32602 naming that field; it does not retry ambiguous turn admission. Legacy reply shape is retained. WebSocket maxPayload is bounded to 512 MiB; the distinct payload error remains a RpcNoAnswer subtype so existing uncertain-admission handling applies. The existing optional stateReason propagates through session views and the shared CLI formatter, and the adapter clears its reason after successful subscription, stop/unwatch/forget or close. No shared public wire shape or role permission changes. Rule-20 inventory records app-server callers, error handlers, stateReason consumers and all-tier native fixtures. Native-provider QA and affected after-stage QA remain separate from these component seams.

The new tests retain exact busy state and injected-delivery receipts, previous-server no-turn behavior, list payload reason/unknown state and recovery clearing, a real over-100 MiB reply's final receipt/length, and a legal over-limit declared header preserving ambiguous-request classification. Missing matching CLI fixture and teardown sequencing are the consolidated blockers, not a request to expand the native API contract.

## Evidence and disposition

A-11681 summarizes local macOS touched-file 33/33 and typecheck/wording/whitespace checks, with rounded new-case timings; it does not retain complete original command outputs/exits/native timing records or capture source-tree hashes. Keep this as implementation-time summary, not a configured/Linux/Web/T3/T4 receipt. Preserve original available tool outputs from this session with actual source/platform attribution and explicit missing-record limits; do not rerun for transcription. No same-head post-review configured run exists.

Full source NOT CLEAR: two medium Standards findings, zero additional Spec findings. C1 failed for M2; C2 failed for M1. Correct both, restore claimant done marks and request fresh source review at the pushed correction head before one ordinary mode-free configured verify. No dev merge is requested or authorized; per-item QA brief absent, affected after-stage policy remains with E-1280.
Durable review: A-11689.

Criteria: C1 failed (M2: frame-boundary fixture removes its root before server/peer teardown; fix lifecycle ordering and bounded setup.), C2 failed (M1: updated payload-limit help disagrees with the frozen SESSION_USAGE consumed by existing compatibility/help guards.).

### rev-31 · 2026-10-25T10:14:41.206Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1265-source2
commit: bdcfc453b3fd4679136b919da5da0347aefda2a0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1265 corrected source review — CLEAR

Head bdcfc453b3fd4679136b919da5da0347aefda2a0, tree 55884d676f7e3b97ef58458048e55add1ca5a837. Direct parent fe1dd7a50b3528d4343fce4ff72770989c47272c. Reviewed the complete correction diff against A-11689; no dev merge or production change. Standards/Spec reviewed personally, no delegation or Reviewer execution.

## Standards

M1 resolved: SESSION_USAGE is the only changed frozen JSON block and its decoded bytes equal the production literal. Export composition, root template and compatibility/help assertions are unchanged.

M2 resolved: beforeDirectories is registered before listen/connection acquisition. It stops the listener, arms actual client/peer/raw-socket close observers before triggering close/destroy, and awaits all closure receipts with separate 2-second deadlines before the directory lane proceeds. Raw accepted sockets are captured at the connection event, covering pre-upgrade/partial connections; socket close removes identities. Final listener-not-listening, zero peer and zero raw-socket assertions remain. Listening setup is separately bounded to 2 seconds. Both exact large-reply receipt/105906176 length and preserving RpcPayloadTooLarge/RpcNoAnswer overflow assertions are unchanged. Canonical guidance describes the lifecycle correction. No remaining findings.

## Spec

Carry the otherwise accepted full A-11689 audit unchanged: metadata-only resume, narrowly classified legacy invalid-parameter retry, bounded 512 MiB WebSocket receive limit, ambiguous-error subtype semantics, optional stateReason/CLI rendering and clear-on-recovery/stop. The source correction changes only the test fixture's cleanup/observation, its guide and frozen help; no new contract or permission. C1/C2 claimant done marks are restored in task.view.

## Evidence and disposition

A-11701 retains original local macOS correction command logs and observed exits, with explicit precommit working-tree attribution and no captured pre-run tree. Source2 native file is 33/33, file duration 3529.2225ms; exact new cases 132.90475/314.832625/45.856541/672.093958/4.12875ms. Frozen compatibility original red exit1 then green 1/1 exit0 (76.6415ms file); real sealed CLI help 3/3 exit0 (297.374041ms file), typecheck exit0. These are implementation-time local proof, not exact-commit configured/Linux/T3/T4/Web runtime proof. No browser ran. Source1 A-11681 stays a summary with missing raw/tree limits, not reconstructed evidence; no reruns for transcription.

Source CLEAR with findings empty; C1/C2 remain runtime-unverified until one successful ordinary mode-free configured verification at this unchanged head and final evidence review. Preserve exact generated outcomes, actual selected/absent phases, executor/browser provenance and report-versus-enforce limits. No additional dev merge or repetitions requested. Affected after-stage QA remains with E-1280; no per-item QA brief.
Durable review: A-11703.

### rev-31 · 2026-10-25T10:25:09.225Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1265-evidence1
commit: bdcfc453b3fd4679136b919da5da0347aefda2a0
scope: evidence
findings: [{"severity":"medium","text":"M3: configured host T0 rejects the new 'code' in err dictionary membership; preserve classifier/error semantics and use own-property checking without weakening the enforcing guard.","file":"hub/src/adapters/codex/app-server.ts","line":100}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1265 configured evidence disposition — NOT CLEAR

Reviewed unchanged bdcfc453b3fd4679136b919da5da0347aefda2a0/tree 55884d676f7e3b97ef58458048e55add1ca5a837. Original mode-free 02a25979-4243-4b5f-898b-a244183ea4b1/A-11713 is terminal failed in task.view. Source2 A-11703 does not constitute runtime verification.

Actual enforcing failure, quoted before classification:
`hub/src/adapters/codex/app-server.ts:100: dictionary membership must use Object.hasOwn or Map.has; intentional prototype checks need // cland-allow-in: reason`

M3 (medium): the new `'code' in err` classifier is refused by the repository's enforcing T0 dictionary-membership guard. Use the appropriate own-property membership check while preserving payload-limit classification, RpcNoAnswer inheritance and ordinary socket-error semantics; do not weaken or exempt the guard to make this pass. This was missed in source review; the original configured host gate exposed it.

Host npm run check exits1 after 9.665s. The retained output shows typecheck and Web build completed, then test:static stopped at lint-dictionary-membership. This is host static/build output only: no droplet was created, no T1/T2/T3/T4/Web runtime phase or load repetitions executed, no native case pass counts available. Intended executor was droplet with two workers; remote platform/browser/lifetime/cost and machine health are unavailable, not zero. Tier projections, report-only T3 ratchet/budget allowances and configured test counts do not supply executed coverage. No browser launched by Reviewer or by a remote test worker.

Evidence NOT CLEAR, C1 failed for M3, C2 still runtime-unverified. Carry M1/M2's accepted corrections and otherwise unchanged source audit, but do not reuse this failed result as green. Claimant has identified this own-source failure, is fixing it without a dev merge, and must restore C1 done plus request fresh exact-head source review before another ordinary configured verify. No unchanged-head retry or shared-defect classification is warranted by this receipt. Reviewer performed read-only inspection only.
Durable evidence disposition: A-11715.

Criteria: C1 failed (M3: required configured run failed at enforcing T0 dictionary-membership guard before any runtime phase or droplet.).

### rev-31 · 2026-10-25T10:27:08.595Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1265-source3
commit: ac28cf934e8408b4255442e81d21a555cb2a7960
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1265 own-property correction source review — CLEAR

Head ac28cf934e8408b4255442e81d21a555cb2a7960, tree 8e8e53dad01a06c6fc03f000d7578366c247655a. Direct parent bdcfc453b3fd4679136b919da5da0347aefda2a0; entire correction diff is one production line in app-server.ts:100, no dev merge or other file edit.

## Standards

M3 resolved: Object.hasOwn(err, 'code') replaces prototype-chain membership, followed by a typed unknown code read and the same exact WS_ERR_UNSUPPORTED_MESSAGE_LENGTH comparison. No lint exemption or guard change. Payload-too-large still maps to the RpcNoAnswer subtype; all other socket errors retain their existing ambiguous-request classification. No new finding.

## Spec

Carry full A-11689 and accepted M1/M2 corrections A-11703 unchanged: metadata-only native resume and older-server fallback, bounded transport, row/CLI payload reason and recovery clearing; preserved frame assertions, frozen help and pre-directory resource closure. C1/C2 claimant done marks are restored. No further scope or permission change.

## Evidence and disposition

A-11719 preserves original local macOS precommit correction logs/exits and explicit missing pre-run tree limits: dictionary-membership guard exits0, typecheck exits0, codex-native 33/33 exits0, file3068.067834ms. Five new-case timings94.123/306.14175/46.574667/327.823375/2.60225ms. These are implementation-time native T2/static receipts, not configured exact-head/Linux/Web runtime or stage evidence; no browser. No transcription reruns claimed.

Original configured02a25979/A-11713 remains failed hostT0 at parentbdcfc453, with no droplet or runtime phases and unavailable remote metadata. A-11715 records that failure; it is not replaced or reclassified as a pass.

Source CLEAR, findings empty; both runtime criteria remain unverified. Submit one ordinary mode-free configured verify at unchanged ac28cf93, then request final evidence review with the actual generated outcomes, phase/executor/browser scope and gate modes. No dev merge or extra repeats requested. Reviewer used read-only source/artifact inspection only; affected after-stage QA remains with E-1280.
Durable review: A-11723.
