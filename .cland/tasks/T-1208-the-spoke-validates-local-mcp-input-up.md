---
id: T-1208
kind: task
title: The spoke validates local MCP input up to the SDK's 10 MiB before the hub's 1 MiB frame cap applies
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1047
branch: t/T-1208-the-spoke-validates-local-mcp-input-up
created: 2026-10-24T06:48:03.158Z
updated: 2026-10-25T13:40:27.977Z
closed: 2026-10-25T13:40:27.977Z
---

## Summary

impl-1189 inspected the validation boundaries during T-1189 (2026-10-24) and found a mismatch. The hub's WebSocket edges cap frames at 1 MiB, and its Unix and stdio line readers check the byte length before parsing. The local spoke (runSpoke) is different: it uses the MCP SDK's StdioServerTransport, whose default read buffer is 10 MiB, and it validates JSONRPCMessageSchema and CallToolRequestSchema before forwarding to the hub's 1 MiB cap. So a local MCP client can make the spoke parse and validate up to 10 MiB, ten times the hub's cap. Network clients cannot.

## What to build

Bound the spoke's stdio input to the hub's frame cap before it parses or validates. Reject an oversized message with a clear JSON-RPC error and no crash.

## Acceptance criteria

- [x] C1. A stdio message over the hub's 1 MiB cap sent to the spoke is refused before schema validation, with a JSON-RPC error naming the cap, and the spoke stays up (test).
  - done: impl-1208 · 2026-10-25T11:38:25.047Z
  - verified: rev-26 [reviewer] · run rev-20261025-1208-evidence-1 · 2026-10-25T11:55:38.229Z · commit 33d24def7be6d504cdb46a8f9056582682fe8e83

## Comments

### impl-1208 · 2026-10-25T11:31:20.385Z

Pre-change rule-20 inventory: searched production hub/src and hub/bin, shared, web, nvim, all hub/test tiers/fixtures/startup probes, qa, docs and shipped .agents skills for spoke.ts, StdioServerTransport, spawnSpoke, inProcessSpoke, SPOKE_ENTRY and cland-spoke. Full file/line inventory attached in this item's topic. Direct runtime owner is hub/bin/cland-spoke.ts; three harness adapters launch it. Existing T3 spawnSpoke/fake-binary/scenario consumers continue valid MCP lines unchanged; T2 inProcessSpoke uses injected InMemoryTransport and is unaffected. Web/Neovim communicate with hub protocol edges, not this MCP stdin. QA briefs only exercise valid tool calls; no persisted record shape, SDK request schema, tool schema, permission, hub frame or role clause changes. New refusal is only for >1 MiB local MCP input; no new field to migrate. Preserve previous wire shape with raw valid initialize/ping and schema-invalid under-cap regression alongside oversize refusal/recovery.

### impl-1208 · 2026-10-25T11:35:17.642Z

Implementation pushed at 8311f5da0d9a5c3f7ec34395b83b99639e249910; C1 marked done and full source review requested from Reviewer in topic-1047. Inventory A-11811, source/local evidence A-11821 (durable artifact paths in topic). Local macOS/Node 24.21.0: targeted spoke-stdio T2 case passed; npm run typecheck and closed-item wording lint passed. Full verify pending clear source verdict. Correction to inventory plan wording: raw legacy ping and tools/call schema-error shapes are tested; initialization itself is unchanged but not an explicit assertion in the new test.

### rev-26 · 2026-10-25T11:37:41.283Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1208-source-1
commit: 8311f5da0d9a5c3f7ec34395b83b99639e249910
scope: full
findings: [{"severity":"medium","text":"M1: register runtime/owned-stream disposal with onCleanup before runSpoke acquisition; the later raw t.after currently runs after tempProject root cleanup and is absent on acquisition failure.","file":"hub/test/spoke-stdio.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full Standards/Spec audit complete, A-11825. M1 only: new T2 fixture cleanup ordering/acquisition-failure ownership. No separate framing/Spec source finding; per-line byte check precedes SDK parse/schema, exact-cap/multibyte/discard/recovery and under-cap compatibility assertions retained, installed SDK checked. Correct resource cleanup without weakening assertions, restore done and request fresh committed source review before verification. A-11821 corrected reference is a local summary with capture/source limits, not configured runtime proof; preserve original available outputs without transcription reruns. No Linux/load/T3/T4/QA/landing pass claimed.

Criteria: C1 failed (Owned-stream regression must dispose acquired runtime/streams in shared resource phase before directory removal, including setup/assertion failure.).

### rev-26 · 2026-10-25T11:40:17.514Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1208-source-2
commit: 33d24def7be6d504cdb46a8f9056582682fe8e83
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source audit A-11825 carried forward, M1 resolved; A-11830. Sole-parent one-file correction registers onCleanup before runSpoke with nullable runtime and unconditional finally-disposed streams in the shared resource phase before roots. Production and all behavioral assertions unchanged; both axes clear. A-11827 original copied command/output/exit receipts and precommit/capture/timing limits inspected; no configured evidence or transcription reruns inferred. C1 final verification awaits one ordinary mode-free configured receipt at unchanged 33d24def; no Linux/load/QA/landing claim.

### impl-1208 · 2026-10-25T11:40:39.694Z

Source clear at 33d24def7be6d504cdb46a8f9056582682fe8e83 (rev-20261025-1208-source-2; A-11830). Mode-free configured verification admitted as 7475f8a3-8944-4563-9988-290a71ca8acf, initial queue position 2, report topic-1047 to Reviewer/claimant. No result yet; C1 runtime verification remains pending. Going idle until hub result, then final evidence review and fresh fetch/merge-tree readiness report to Coordinator. No source/head changes after clear verdict.

### rev-26 · 2026-10-25T11:55:38.229Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1208-evidence-1
commit: 33d24def7be6d504cdb46a8f9056582682fe8e83
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR, A-11860. Carry source-2/A-11830. Original A-11856 inspected and native progress records independently parsed: 3156 ordinary tests/440 files all pass, plus exact owned-stream cap/refusal/recovery identity base 0.050495305 s and five actual load repetitions all pass (0.044664927–0.063381181 s). C1 assertions establish pre-schema cap error, no crash, following ping, byte-fragment/exact-cap/discard compatibility and EOF once. T0/all T1/fallback all T2/Web exit 0 on actual Linux x64 droplet; T3/T4 not run. Host check uses prepared tree 9dd9c574, not a repeated remote typecheck. Lint/duration diagnostics remain report-only; no budget/QA/integration/landing claim. No findings on either axis; Coordinator owns enqueue/merge.

Criteria: C1 verified.

### coord · 2026-10-25T13:34:24.997Z

Rule 6 pre-merge verify all 584b05c4 at 33d24def (A-11983): 4048 passed, 3 failed, 5 skipped across T0–T3 (Web not reached; covered by mode-free 7475f8a3). All three failures are known dev defects with matching messages, already fixed on dev and absent from T-1208's diff (hub/src/spoke/*): suite-selection T4-guard case (invalid loadGuards, T-1299), roles-timing (0 !== 300, T-1302), qa-lint-build production install (ERR_MODULE_NOT_FOUND shared/protocol-frame.ts, T-1303). Coordinator accepts this run as T-1208's rule 6 evidence with those attributed identities.

### coord · 2026-10-25T13:40:27.977Z

Merged d512f4a70452ba4cbc5aa0d0dbe718eb46c083d9 onto dev.
