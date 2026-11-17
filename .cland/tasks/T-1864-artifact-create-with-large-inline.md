---
id: T-1864
kind: task
title: artifact.create with large inline content times out at 300 s with an unknown outcome
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1571
branch: t/T-1864-artifact-create-with-large-inline
created: 2026-11-15T04:42:50.038Z
updated: 2026-11-17T00:10:04.330Z
---

## Summary

On 2026-11-15 around 04:37Z, impl-1835 (T-1835) called `artifact.create` with large inline `content`: a 979-test ledger plus repeated ~11,900-name `/private/tmp` inventories. The spoke returned `timed out awaiting tools/call after 300s`. There was no refusal, and it is unknown whether the hub created the artifact. Smaller inline content and a file-path publication succeeded immediately afterwards (A-19506, A-19507). T-576 fixed a similar lost result for large folders (closed 2026-10-20). Inline content is a separate path.

## What to build

Find where a large inline `content` stalls: size limits, the secret scan, the copy and index write, or the spoke's framing. Then do two things:
- an oversize inline body is refused promptly with a named limit, and the error suggests `path`;
- an accepted body completes well within the tool-call timeout.

When the outcome is unknown, a retry must not publish a duplicate. Use the same idempotency T-576 gave folders.

## Acceptance criteria

- [x] C1. `artifact.create` with inline content above the limit is refused quickly with the limit and a pointer to `path`, and content at the limit completes within a bounded time (test).
  - done: impl-1864 · 2026-11-16T23:27:43.825Z
  - verified: rev-36 [reviewer] · run rev-36-1864-final-1 · 2026-11-17T00:10:03.161Z · commit c1e8f014c1770f6c92ef44099e13899c2da8c67a
- [x] C2. A retry after a lost reply returns the same artifact rather than a duplicate (test).
  - done: impl-1864 · 2026-11-16T22:38:06.918Z
  - verified: rev-36 [reviewer] · run rev-36-1864-final-1 · 2026-11-17T00:10:03.161Z · commit c1e8f014c1770f6c92ef44099e13899c2da8c67a

## Comments

### impl-1864 · 2026-11-16T22:16:07.041Z

Consumer inventory before contract change: artifact.create producers: spoke/tools + spoke.ts, CLI artifact.ts/usage, web composer/Workspace, dispatcher suite artifacts, remote artifact-plan. Protocol validation/tool-arguments and artifacts prepare own admission. Consumers: artifact lists/store/retention/web readers remain unchanged; response shape remains unchanged. Tests searched across hub/web/nvim incl artifacts, artifact-folders/upload/host/user/CLI/lifecycle/create-unit, spoke-artifact-budget, frame/stdio, wire conformance, QA briefs and shipped skill examples. Planned additive optional retry key and bounded inline admission; old wire requests remain supported. Main diagnosis candidate: stdio cap returns id:null before tool handling, leaving MCP tools/call unresolved.

### impl-1864 · 2026-11-16T22:20:22.405Z

Rule 20 full consumer audit: A-20409, durable /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20409-t-1864-contract-consumer-audit.md. Includes 146 matched paths across every tier/QA/skills/client/server, dispositions, supplementary release/retro search, no-key compatibility regression, and 64KiB sizing rationale. retryKey is needed for C2: T-576 extended the wait but had no durable deduplication; opt-in key avoids coalescing intentional publications. New receipt requires a supporting restarted hub; source tests run fixture hubs only.

### rev-35 · 2026-11-16T22:28:26.714Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1864-source-1
commit: 9cd33c9c5bb15911523f5daad17fbd2004dd864f
scope: full
findings: [{"severity":"medium","text":"Prefix-only envelopeId misses actual MCP SDK order ({...request, jsonrpc, id}), whose large params precede id. Oversized real tools/call still receives id:null and waits for timeout; new test manually puts id first. Claimant confirms no normalizer/disposition. Recover trailing top-level id with bounded memory and test actual SDK serialization, retaining nested-id/malformed/next-frame controls.","file":"hub/src/spoke/stdio.ts","line":37},{"severity":"medium","text":"CLI inline content/content-file is sent without shared local inline validation. Above the full frame cap, generic wire framing runs before named65536-byte/path admission. Claimant confirms missed caller. Validate before transport and cover both CLI input forms.","file":"hub/src/cli/artifact.ts","line":39},{"severity":"medium","text":"Frozen ARTIFACT_USAGE bytes were not migrated with the changed help. cli-usage-compatibility.test.ts:9 deep-equals all exports, so this source mismatch predicts a T1 failure; no Reviewer runtime claim. Update expected bytes deliberately and retain the guard; claimant confirms audit omission.","file":"hub/test/fixtures/cli-usage/commands.json","line":51},{"severity":"medium","text":"Both new integration callbacks (also395) lack pre-root-acquisition whole-sequence ownership for hub/UI/spoke requests, file reads and restart. Returned-resource hooks do not fence/join pending continuations or adopt late acquisitions before storage/root disposal; claimant confirms. Reuse shared admitted-work owner and add owned held-work cancellation coverage.","file":"hub/test/artifacts.test.ts","line":366}]
finding_counts: {"high":0,"medium":4,"low":0}

Full24-file Standards/Spec review not clear A-20420,4medium findings. Source receipt design otherwise uses durable session/user identity, per-store serialization and atomic index/receipt/chip transaction; additive no-key behavior retained. A-20409 inventory misses actual SDK serializer/help export consumers; retain all hits and add normalized tier/disposition supplement. Local reported17artifact cases and other targets remain development evidence, not actual SDK/frozen-help/cancellation or configured proof. Preserve existing producer command/cwd/completion/source-linkage excerpts and explicit raw/hash/signal/scan unknowns without provenance-only reruns. C1/C2failed. Hold released for consolidated correction, docs realignment and fresh committed-head source request before verification/window. No extra dev merge or Reviewer runtime.

Criteria: C1 failed (Actual SDK oversized requests remain uncorrelated; CLI bypasses named admission above wire cap and frozen help bytes are stale.), C2 failed (New retry/restart integration lacks pre-acquisition whole-work and late-resource drainage required for safe evidence.).

### impl-1864 · 2026-11-16T22:35:42.259Z

Revision audit/evidence A-20425 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20425-t-1864-revision-audit-and-development-receipts.md) corrects A-20409's serializer/help-consumer assumptions and retains original command excerpts/unknowns without provenance-only reruns. Subsequent real CLI stdin-pipe regression added and passed in artifact-cli.test.ts (6/6, modified working tree macOS/local Node24.21; typecheck passed). stdin uses fd0 directly rather than reopening /dev/stdin, preserving native pipe/socket compatibility. New configured verification still unexecuted.

### rev-36 · 2026-11-16T22:43:51.402Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1864-source-2
commit: 690e1cd97bcb6232291b605037fb8dd37b38fe11
scope: full
findings: [{"severity":"medium","text":"The new artifact guidance is in every role's base, so the unchanged roles-clauses growth-reserve test includes it. Read-only source projection yields Coordinator 6668, Implementer 6670 and QA 6619 bytes against the 6528-byte ceiling (base 6520/6522/6471). roles-clauses was not run; claimant confirms no exclusion. Tighten or relocate guidance without weakening the budget and validate this direct consumer.","file":"hub/src/roles/default-roles.ts","line":157}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear A-20434: one medium remaining Standards finding at default-roles.ts:157. The new artifact line is in clause base; source-derived projections are Coordinator6668/Implementer6670/QA6619 versus6528 ceiling, while base projections fit. roles-clauses is unexecuted and claimant confirms no exclusion; these are projections, not Reviewer runtime failures. The four A-20420 gaps are resolved by actual SDK trailing-id coverage, bounded CLI validation/stdin, migrated frozen help and shared whole-fixture ownership. A-20431 now retains normalized consumers and original development excerpts/unknowns. C1failed; C2 corrected source accepted but unverified. Consolidate guidance/budget repair and obtain fresh pinned source review before configured verification; no Reviewer tests/probes.

Criteria: C1 failed (New artifact guidance exceeds the unchanged default role-clause growth budget; source projection predicts Coordinator, Implementer and QA assertion failures.).

### rev-36 · 2026-11-16T22:46:37.049Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1864-source-3
commit: 2fc8e35370873c60c5c7c9b9bc2c7a843b424cff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 2fc8e35370873c60c5c7c9b9bc2c7a843b424cff. Standards: remaining A-20434 clause budget finding resolved by moving identical guidance into the separately delivered Project rules section for all six roles, preserving base byte/reserve assertions and adding its per-test note. A-20438 reports actual old-head 3-failure red and repaired51/51 targeted roles checks with compiler/wording pass, retaining pre-commit/raw/hash/signal limits. Spec: all four A-20420 fixes remain accepted; artifact/CLI/scanner/fixture runtime is unchanged by this repair, and guidance is still delivered. Full source review A-20440 with prior complete runtime/audit basis A-20434/A-20431. C1/C2 remain unverified pending same-head configured evidence; no Reviewer runtime/probes.

### rev-36 · 2026-11-16T22:48:31.790Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1864-source-4
commit: 6b16f33146bb0c5e138fdcebbbfd8af0ab73d5a2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-20445 from source-clear2fc8e3537/A-20440. The sole three-file delta is Coordinator c99bc02f-authorized T-1923 shared fix15757e4d4, unchanged stable patch idca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. Captured native fixture lock identity survives the sealed environment swap; doctor gets a positive local-holder assertion and existing priority assertions remain. Guide/index align. No artifact/runtime/clause/protocol/fixture-owner changes and no dev merge. Local priority1/1/compiler success is claimant targeted Darwin evidence, not configured/Linux proof for this head. C1/C2 remain unverified pending same-head result; Coordinator owns window/preflight. No Reviewer runtime.

### rev-36 · 2026-11-16T23:25:24.743Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1864-evidence-1
commit: 6b16f33146bb0c5e138fdcebbbfd8af0ab73d5a2
scope: evidence
findings: [{"severity":"medium","text":"The artifact line moved into role-rulebook guidance changes composed launch/brief text, but its exact-text and filter consumers were not migrated. A-20455 records eight T2 failures across this file, adapter-composition:66 and rule-sessions-component:80, including extra guidance in expected bare briefs and durable-brief count0!=1. Claimant confirms item-local omissions, not T-1923. Preserve the existing scope/replay/refusal assertions while restoring intended composition or deliberately migrating every affected consumer.","file":"hub/test/session-brief-component.test.ts","line":99}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence not clear A-20457:27a257f6/A-20455 exit1,8T2failures across adapter-composition,rule-sessions-component,session-brief-component. Actual output adds artifact guidance between Project rules header and previously expected bare brief/rules text; durable-brief filter also gets0!=1. Claimant confirms item-local missed consumers,notT-1923. One medium finding; previous source clearance overlooked these exact composition assertions. All8newartifact/CLI/SDK/ownership identities have independently checked base1+load5pass; byte-budget/help/sharedpriority files pass. Those positives do not complete the run: T0/T1pass,T2fail,T3/Webunexecuted,browsernull; report-only budgets/lint retained. C1failed,C2unverified. Consolidate composition correction/audit and fresh pinned source review before another run. No Reviewer runtime.

Criteria: C1 failed (Configured verification has eight item-local clause/brief consumer failures after the guidance relocation; selected T3/Web did not execute.).

### rev-36 · 2026-11-16T23:29:26.541Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1864-source-5
commit: c1e8f014c1770f6c92ef44099e13899c2da8c67a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-20460. Final two-file repair consolidates cap/path/retry guidance into existing base artifact instructions, restores separate rulebook guidance byte-for-byte to fixed point for all six roles, removes item-added markers and preserves original Coordinator/Aide guidance. No runtime composition/test assertions or artifact implementation changed. A-20459 retains 36-path composition sweep plus original159-path audit (183unique union), actual old Linux/local red and repaired66/66 local roles/affected-consumer/compiler/wording validation with capture limits. A-20457's medium consumer finding resolved; prior artifact implementation and authorized shared-fix reviews retained. Failed27a257f6/A-20455 remains failed/incomplete, not carried. C1done restored/C1C2unverified pending new same-head configured result. No Reviewer runtime.

### rev-36 · 2026-11-17T00:10:03.161Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1864-final-1
commit: c1e8f014c1770f6c92ef44099e13899c2da8c67a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear A-20490 with independent ledger A-20487: cea6eda4/A-20481 at source-clear c1e8f014c exits0,6531ordinary passes/708filepasses,0nonpass/skips/unfinished; separate280loadpasses/files. All8newartifact/CLI/SDK/receipt/ownership names have base1+load5; all8formerlyfailedcomposition cases and their3files pass, as do byte budgets/frozen help/sharedpriority. C1namedcap/path refusals, exact escaped/multibyte persisted bytes, bounded actualSDK refusal+ping/realstdin/path and C2restart/sameid/singlechip/conflict/concurrent/no-key assertions retained. AllT1/allT2fallback/Web/selectedrolesT3 complete; rolesT3once,268T3/17T4deferred. Consumer186union:73positive,17T3deferred,96refs. Actual uncached Linuxx64 Node24.21/CfT156.0.8078.4 headless1248 provenance pinshead; report-mode budgets/lint/ratchet and historical red/capture limits remain. C1/C2verified; no Reviewer runtime.

Criteria: C1 verified, C2 verified.
