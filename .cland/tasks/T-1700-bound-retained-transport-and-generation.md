---
id: T-1700
kind: task
title: Bound retained transport and generation ownership receipts
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1576
branch: t/T-1700-bound-retained-transport-and-generation
created: 2026-11-05T20:18:31.073Z
updated: 2026-11-17T00:40:58.920Z
---

## Summary

Non-blocking follow-up from rev-35's fourth source review of T-1696 at 3c30df86 (review-loop bar; recorded by coord). Exact finding text:

"stoppedOwners retains every successful transport-stop owner and its forward-id set for the module lifetime, without retirement. Sessions.#localForwardOwners and the generation facade's scope/identity indexes also retain old entries. Define bounded retention tied to outstanding current/retained generation obligations, preserving idempotent release and refusing unknown proof."

This is resource retention and maintainability only. No C1–C3 or T-1614 main-path failure was demonstrated.

## What to build

Retire entries from the transport stop-owner receipts, `Sessions.#localForwardOwners` and the generation facade's scope and identity indexes once no current or retained generation obligation refers to them. Repeated release must stay idempotent while an obligation exists, and a release with unknown or retired proof must still be refused.

## Acceptance criteria

- [x] C1. After a generation's obligations settle, its stop-owner receipt, local-forward owner and facade scope or identity entries are gone, and the maps stay bounded across many relaunch cycles (test).
  - done: impl-1700 · 2026-11-17T00:40:35.418Z
- [x] C2. Release stays idempotent while an obligation is outstanding, and a release presenting unknown or retired proof is refused (test).
  - done: impl-1700 · 2026-11-17T00:23:12.832Z

## Comments

### impl-1700 · 2026-11-16T23:54:58.055Z

Consumer inventory (rule 20): transport claim/stop proof is produced by transport/ssh.ts, read by adapters/sessions.ts and transport/transport.ts; generation facade is constructed by codex.ts, opencode.ts and claude-code.ts. HarnessAdapter contract consumers include Sessions release, host settlement/destroy/relaunch, adapter-generation T2 and adapter-generation-forward T3 fixtures. Search across hub/src, hub/test, nvim, web, docs and shipped skills found no other stop-proof/index readers. Persisted ProcessTable retainedHostGenerations/clearHostGeneration, restart register/watch and pending-stop restoration remain the owners of durable obligations; no persisted schema/wire shape change planned. Additive in-memory retirement hook will follow positive clearHostGeneration. Existing old-shape adapters keep optional-hook compatibility.

### impl-1700 · 2026-11-17T00:01:42.511Z

Coordinator-posted shared fix T-1923 added unmodified as separate commit 594f59418 (source 15757e4d4); new pushed review head 594f59418. Shared fix files byte-identical; stable patch-id ca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. At new head, local Darwin arm64 Node 24.21.0: hub-priority.test.ts 1/1 passed and hub typecheck passed. T-1700 implementation unchanged at 337aa165b. npm run test:lint completed exit 0 on that implementation tree (0 refusals; advisory findings report-only). Review head update sent to reviewer role in existing item topic; waiting for queued assignment.

### rev-35 · 2026-11-17T00:12:13.712Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1700-source-1
commit: 594f59418cafa0c841dd64c3ad8338d83ce438f3
scope: full
findings: [{"severity":"medium","text":"The retirement hook has no production local stop/relaunch or fresh-resume caller. Superseded positively stopped local generations remain strongly indexed until facade close; the 100-cycle test invokes retirement manually rather than through that lifecycle owner. Retire settled superseded scopes at the positive boundary while retaining current/pending obligations (C1).","file":"hub/src/adapters/generation-adapter.ts","line":149},{"severity":"medium","text":"All three new callbacks start asynchronous fixture setup before any whole-body owner. Later adapter/Sessions cleanup hooks do not fence/join setup, loop/body continuations or late acquisitions before storage/root removal. Use the shared lifetime owner before first acquisition and retain the final assertions (rule 12).","file":"hub/test/adapter-generation.test.ts","line":186}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear A-20492, two medium findings consolidated. Implementer222e0678 confirms missing local retirement owner and missing whole-callback fixture owner, with no approved exclusions. Remote settlement/refcount retirement, idempotent references and pinned forward namespace otherwise match the task; optional hook retains old adapter compatibility. Coordinator Agents1a096385 authorizes identity-only shared-fix review: independent complete diff equality confirms594f59418 matches15757e4d4 exactly. A-20482/A-20491 original targeted counts, early/final source linkage, lint concurrency and missing raw/hash/signal/scan limits retained; independent current consumer search normalizes ten T2/six T3/one Web direct matches without implying exhaustive dynamic coverage. No configured/Linux/browser evidence or Reviewer runtime. C1/C2 failed; hold released for consolidated correction and fresh committed source review before verify. No post-review dev merge implied.

Criteria: C1 failed (Superseded settled local generations lack production lifecycle retirement; the manually driven hook test does not establish bounded production relaunch cycles.), C2 failed (The new release/proof regression callbacks lack whole-fixture lifetime ownership during cancellation.).

### impl-1700 · 2026-11-17T00:23:13.089Z

Consolidated corrections pushed at 805c727a3 (tree a85b8ad8266d8268d474f49a76678b68702421d0). Production facade now retires superseded settled local scopes on successful relaunch/stop+replacement, including restored rows and late stop; unknown closure retains scope. New test fixtures own whole bodies before acquisition and guard root removal. A-20498 preserves current-head immutable-source targeted checks and expanded symbol/importer/field census with manifest-normalized tiers, executed/deferred disposition, unchanged persisted/wire contracts and explicit evidence limits. Local Darwin arm64 Node24.21.0: generation15/15, host-revoke41/41, hub typecheck exit0, whole-source test:lint exit0/0refusals (advisory findings retained), closed-item wording0 findings. No configured verification submitted; fresh review first.

### rev-36 · 2026-11-17T00:27:51.213Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1700-source-2
commit: 805c727a30bf1d5ca3311bcc4cfa6817c6bd11b1
scope: full
findings: [{"severity":"medium","text":"C1: a local spawn that rejects before returning a process leaves its strong facade scope after obligations have settled, including failure before native acquisition. make()/launching precede await spawn, but replacement retirement requires prior.stopped and prior.process; subsequent success overwrites launching without removing that scope. Claimant c94257d2 confirms no settlement owner/exclusion and no failed-spawn regression. Retire on positive failed-launch settlement and cover repeated settled failures plus later success; preserve unknown cleanup obligations.","file":"hub/src/adapters/generation-adapter.ts","line":181}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear A-20500. Standards0: prior whole-body fixture ownership corrected with pre-acquisition owner/body join/resource disposal/root guard. Successful local resume/stop/spawn/restored/late-stop retirement now accepted; remote settlement, idempotent retained proof and replacement namespace accepted. Spec1medium: settled failed spawn scopes have no production retirement owner (generation-adapter.ts:181, predicate98-102), claimantc94257d2 confirms. C1failed; C2 policy accepted but unverified. Shared T-1923 complete diff/patch identity independently unchanged. A-20498 local immutable-source15/15+41/41/compiler/lint positives and A-20491 historical capture limits retained; they do not cover this gap. No configured or Reviewer runtime. Hold released for consolidated settled-failure correction and fresh source review before verification/window; unknown cleanup must remain retained.

Criteria: C1 failed (Settled failed spawns without a returned process retain strong facade scopes; later successful replacement does not retire them.).

### impl-1700 · 2026-11-17T00:37:49.245Z

Remaining C1 correction uses an additive optional in-memory AdapterHost.spawnFailureSettled receipt and shared withSpawnSettlement preparation boundary. Consumer inventory before finalizing: all AdapterHost/HarnessAdapter importers/constructors are enumerated in A-20498; new receipt producers are Codex/OpenCode LaunchSettled and Claude local/remote failed-generation settlement, reader is generation-adapter's scope-captured hook. launch-settlement.ts existing boundedSettlement/LaunchSettled consumers include LaunchFiles and launch-settlement.test.ts; their signatures/behavior remain unchanged. No persisted recovery state, wire shape or CLI/role change. Existing hosts/fakes omit the optional callback and remain compatible. Native adapters share the same pre-acquisition receipt policy; acquired failures require positive existing rollback/settlement, including delayed durable recovery. Unknown outcomes keep the scope even across replacement. New tests exercise all three native producers with isolated recording Hosts and retain the earlier whole-body owner.

### impl-1700 · 2026-11-17T00:40:50.346Z

Fresh source review requested at b274aa8e6 (tree7338708a723c9d164f702253ed5cc4e87e3043c1). A-20508 documents the positive failed-spawn producer owner, unchanged optional/old-shape compatibility, and exact-source57 targeted T2 passes plus hub typecheck/test:lint exit0 (0 refusals, advisory findings retained). C1/C2 done. Awaiting reviewer assignment/verdict; no configured verify submitted. A-20498 consumer census remains applicable with new launch-settlement export and callback producer/reader accounting in A-20508.
