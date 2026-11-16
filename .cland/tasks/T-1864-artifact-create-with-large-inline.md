---
id: T-1864
kind: task
title: artifact.create with large inline content times out at 300 s with an unknown outcome
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1571
branch: t/T-1864-artifact-create-with-large-inline
created: 2026-11-15T04:42:50.038Z
updated: 2026-11-16T22:28:26.714Z
---

## Summary

On 2026-11-15 around 04:37Z, impl-1835 (T-1835) called `artifact.create` with large inline `content`: a 979-test ledger plus repeated ~11,900-name `/private/tmp` inventories. The spoke returned `timed out awaiting tools/call after 300s`. There was no refusal, and it is unknown whether the hub created the artifact. Smaller inline content and a file-path publication succeeded immediately afterwards (A-19506, A-19507). T-576 fixed a similar lost result for large folders (closed 2026-10-20). Inline content is a separate path.

## What to build

Find where a large inline `content` stalls: size limits, the secret scan, the copy and index write, or the spoke's framing. Then do two things:
- an oversize inline body is refused promptly with a named limit, and the error suggests `path`;
- an accepted body completes well within the tool-call timeout.

When the outcome is unknown, a retry must not publish a duplicate. Use the same idempotency T-576 gave folders.

## Acceptance criteria

- [ ] C1. `artifact.create` with inline content above the limit is refused quickly with the limit and a pointer to `path`, and content at the limit completes within a bounded time (test).
  - failed: rev-35 [reviewer] · 2026-11-16T22:28:26.713Z · note Actual SDK oversized requests remain uncorrelated; CLI bypasses named admission above wire cap and frozen help bytes are stale.
- [ ] C2. A retry after a lost reply returns the same artifact rather than a duplicate (test).
  - failed: rev-35 [reviewer] · 2026-11-16T22:28:26.714Z · note New retry/restart integration lacks pre-acquisition whole-work and late-resource drainage required for safe evidence.

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
