---
id: T-2038
kind: task
title: "Shared output redactor leaks the token in 'Authorization: Bearer <token>' (the authorization key match consumes only the scheme)"
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-1686
branch: t/T-2038-shared-output-redactor-leaks-the-token
created: 2026-11-20T18:12:36.300Z
updated: 2026-11-20T18:24:57.559Z
---

## Summary

The shared output redactor (`remoteRedactor` in hub/src/host/agent/redact.ts) leaks the credential in an `Authorization: Bearer <token>` header. The `authorization\s*[:=]\s*\S+` alternative matches first, at the header name, and consumes only "Authorization: Bearer". Matching then resumes after it, so the token itself is never matched by `\bbearer\s+\S+`. Probe with a synthetic value: `Authorization: Bearer synthetic-fixture-value` becomes `[redacted] synthetic-fixture-value`, and the same happens in `.text()`, the callable form, quoted curl headers, multi-line output and JSON records. Found by impl-1901's positive control in T-1901 (merge-batches.test.ts, enqueue preflight tail) on 2026-11-20.

## What to build

Make an authorization or token-style key followed by an auth scheme (Bearer, Basic, Token and similar) redact the whole credential, scheme and value together, in every redactor form. Keep the existing redaction of URLs, bare bearer values, key=value pairs and registered exact secrets. Use synthetic values only.

## Acceptance criteria

- [ ] C1. `Authorization: Bearer <value>`, `authorization=Basic <value>` and quoted header forms redact the value in .text(), the callable form and .value(), shown red first on the current pattern (test).
  - failed: rev-35 [reviewer] · 2026-11-20T18:23:59.316Z · note Parameterized Authorization values remain exposed and the changed agent module cannot be bundled under its stale committed closure (M1/H1); correct both plus stable case labels.
- [x] C2. The existing redaction cases still pass unchanged (test).
  - done: impl-2038 · 2026-11-20T18:17:26.324Z

## Comments

### impl-2038 · 2026-11-20T18:13:51.022Z

Red-first on base: 7 new header tests failed with actual '[redacted] synthetic-fixture-value' (tab/newline/quoted variants similarly leaked); existing 14 tests passed. Minimal scheme-aware key span now makes all 21 pass locally on macOS Node 24.21.0. Consumer search: shared host redactor, remote re-export/frame helpers, hub daemon/artifact upload, remote gateway/messenger/provider APIs/telegram prompts/signin/secrets/discord inbound, speech command/provider/index/elevenlabs, OpenCode adapter, executor droplet, doctor remotes, host provision/ref-push worker. No API/schema changes; all inherit the fix. Direct importer tests found across T1/T2 and native T3/T4; native cases deferred per assignment, requesting scope clarification separately.

### rev-35 · 2026-11-20T18:23:59.316Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2038-source-1
commit: 81d764e287163dc58b2c64fcea02929f4cc05c51
scope: full
findings: [{"severity":"high","text":"H1: committed redactor SHA256e4f37a1f... differs from pinned source63b850a5.... code-delivery.ts:20 rejects every bundle containing these bytes as agent closure stale. Regenerate the pinned closure and include matching closure/delivery consumers.","file":"hub/src/host/agent/closure.json","line":117},{"severity":"medium","text":"M1: Digest/OAuth parameterized authorization still leaks: unquoted branch stops at the first quote after username=, leaving parameter values unredacted. Coordinator08b6b0f6 directs authorization-specific whole-value redaction without a scheme list, synthetic parameter regressions and closing-quote tail preservation; other token/key patterns stay unchanged.","file":"hub/src/host/agent/redact.ts","line":25},{"severity":"low","text":"L1: embedding header contents in all seven generated titles collapses them to the same title after shared redaction. Use unique stable case labels for durable per-case/load receipts.","file":"hub/src/remote/redact.test.ts","line":14}]
finding_counts: {"high":1,"medium":1,"low":1}

Consolidated A-22213: H1 concrete native-agent delivery blocker (independent Git-byte hash comparison); M1 incomplete whole-authorization coverage; L1 durable test-name ambiguity. Implementer9b1c14a7/5eb956c0 accepts gaps; Coordinator08b6b0f6 explicitly directs no scheme list, whole authorization value, parameter red controls and preserved quoted tail. Fourteen old cases unchanged; C2 stays done/unverified, no partial verification on not-clear. A-22208 selected local checks are authored evidence, not configured proof; native/Web deferrals approved by Coordinator0a89ecd3 remain explicitly unexecuted locally. Correct together and request fresh exact-head source review before configured verify. Reviewer ran no tests/compiler/scanner/probes. Hold released.

Criteria: C1 failed (Parameterized Authorization values remain exposed and the changed agent module cannot be bundled under its stale committed closure (M1/H1); correct both plus stable case labels.).

### impl-2038 · 2026-11-20T18:24:57.559Z

Source-1 findings accepted. Coordinator decision 08b6b0f6 replaces scheme enumeration with whole Authorization values, leaving other token/key patterns unchanged. New red-first run at original reviewed production pattern: Digest/OAuth parameter and unknown-scheme tests failed (3 fail/19 pass); Digest literal actual '[redacted]"synthetic-user", response="synthetic-response"', expected '[redacted]'. Corrected pattern passes 22/22 redactor tests with stable labels and quote-tail preservation. Additional raw consumer: host/agent/closure.json pinned-byte manifest, read by code-delivery.ts; generated via generate-host-agent-closure.ts. Matching host-agent-closure and host-runtime-bundle T1 tests added to selection; host-agent-restart, host-runtime-delivery and claude-code-remote T3 deferred with native importers. Matching secrets and gateway docs updated.
