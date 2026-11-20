---
id: T-2038
kind: task
title: "Shared output redactor leaks the token in 'Authorization: Bearer <token>' (the authorization key match consumes only the scheme)"
state: closed
status: done
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
updated: 2026-11-20T20:53:06.190Z
closed: 2026-11-20T20:53:06.190Z
---

## Summary

The shared output redactor (`remoteRedactor` in hub/src/host/agent/redact.ts) leaks the credential in an `Authorization: Bearer <token>` header. The `authorization\s*[:=]\s*\S+` alternative matches first, at the header name, and consumes only "Authorization: Bearer". Matching then resumes after it, so the token itself is never matched by `\bbearer\s+\S+`. Probe with a synthetic value: `Authorization: Bearer synthetic-fixture-value` becomes `[redacted] synthetic-fixture-value`, and the same happens in `.text()`, the callable form, quoted curl headers, multi-line output and JSON records. Found by impl-1901's positive control in T-1901 (merge-batches.test.ts, enqueue preflight tail) on 2026-11-20.

## What to build

Make an authorization or token-style key followed by an auth scheme (Bearer, Basic, Token and similar) redact the whole credential, scheme and value together, in every redactor form. Keep the existing redaction of URLs, bare bearer values, key=value pairs and registered exact secrets. Use synthetic values only.

## Acceptance criteria

- [x] C1. `Authorization: Bearer <value>`, `authorization=Basic <value>` and quoted header forms redact the value in .text(), the callable form and .value(), shown red first on the current pattern (test).
  - done: impl-2038 · 2026-11-20T18:54:38.218Z
  - verified: rev-35 [reviewer] · run rev-35-2038-evidence-1 · 2026-11-20T19:27:45.502Z · commit 5f742603e00bc910180612865b7668890830755e
- [x] C2. The existing redaction cases still pass unchanged (test).
  - done: impl-2038 · 2026-11-20T18:17:26.324Z
  - verified: rev-35 [reviewer] · run rev-35-2038-evidence-1 · 2026-11-20T19:27:45.502Z · commit 5f742603e00bc910180612865b7668890830755e

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

### rev-35 · 2026-11-20T18:34:14.465Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2038-source-2
commit: bc0d3a354610f80f8306cbf34af7304a1c70d0b8
scope: full
findings: [{"severity":"medium","text":"M2: whole-line Authorization consumes the bare scheme before a newline, preventing the later bare-bearer alternative from revisiting it; next-line credential survives. The previous wrapped regression was removed. Coordinatorb6a52b7c explicitly requires empty/bare-word continuation across whitespace through next token, restored red-first wrap control and complete-line preservation control.","file":"hub/src/host/agent/redact.ts","line":28}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22220 consolidated source2: source1 H1/M1/L1 resolved. Independent pinned SHA256 matches regenerated closured0763109..., parameterized/unknown schemes use whole authorization values without enumeration, stable labels eliminate title normalization collisions. Single remaining medium M2 confirmed by Implementerc32bc070 and Coordinatorb6a52b7c. Other old key/token logic and fourteen old tests unchanged. A-22218 local22/1045 selected passes and full gates are supporting authored evidence, not configured/native/Web proof. C1 failed; C2 done/unverified. Refresh closure after correction, fresh exact-head source before verification. Reviewer ran no project checks/probes; hold released.

Criteria: C1 failed (Wrapped key/scheme/newline credential remains exposed; restore its regression and implement Coordinatorb6a52b7c's continuation rule, preserving complete-line/quoted boundaries.).

### rev-35 · 2026-11-20T18:40:56.506Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2038-source-3
commit: db218c0ae9b3e4ccb8d63afae369b1dc58f4c048
scope: full
findings: [{"severity":"medium","text":"M2 residual: continuation next-token class excludes leading quotes; empty or bare-scheme Authorization followed by a quoted next-line credential still leaks when whole-line matching consumes the first line. No waiver/control exists (Implementere9a11605). Add quoted credential-unit controls through public forms/JSON/outer quoting, retaining complete-line and quote-tail boundaries.","file":"hub/src/host/agent/redact.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22228 consolidated source3: unquoted wrapped/empty remainders and complete-line control now covered; M2 persists only for quoted continuation units. Source1 H1/M1/L1 remain resolved; independent pinned hash38c95084... matches closure. Stable labels and fourteen old bodies retained. A-22225 authored25/1048 selected local passes/full gates do not cover the missing composition or supply configured/native/Web evidence. Correct residual, regenerate closure, fresh source before configured verify. C1 failed, C2 done/unverified; no Reviewer runtime/probes, hold released.

Criteria: C1 failed (Quoted continuation composition still exposes the credential under Coordinatorb6a52b7c's next-token rule (residual M2).).

### rev-35 · 2026-11-20T18:49:45.786Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2038-source-4
commit: 64a02c25cde1efe4e78110c64b34646dd167c309
scope: full
findings: [{"severity":"medium","text":"M2 residual pair: unterminated/dangling-escape quoted continuation cannot match a closed-unit branch and remains exposed; CR-only wrap is recognized by header framing but not continuation. Correct both with conservative line/EOF endings and CRLF/LF/CR controls while preserving all covered forms. Implementere4bd39df confirms; Coordinator5021b425 sets this as final agreed source5 scope.","file":"hub/src/host/agent/redact.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22233 consolidated source4: closed quoted/escaped continuation and tail controls now addressed; H1/L1 remain resolved and independent source hashff837b54... matches closure. A-22231 local29/1052 selected passes/full gates remain supporting, not configured/native/Web evidence. Coordinator5021b425 explicitly caps source5 at no leaks in already-covered forms plus this pair/all recognized endings; additional compositions go to sized C-325 follow-up unless regression of covered form. C1 failed, C2 done/unverified. Refresh closure after correction, then fresh exact-head source5 review before configured verify. No Reviewer runtime/probes; hold released.

Criteria: C1 failed (The agreed final continuation pair (unterminated quoted unit at EOF and CR-only wrap) remains exposed under M2.).

### rev-35 · 2026-11-20T18:57:08.918Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2038-source-5
commit: 5f742603e00bc910180612865b7668890830755e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22238 source5 clear at Coordinator5021b425's agreed bar; H1/M1/M2/L1 resolved, no findings. Authorization whole values have no scheme list; existing complete-line/parameter/quote-tail/wrapped controls retained. CRLF/CR/LF and incomplete single/double/escaped-quote/dangling continuation controls cover the final pair across public APIs/JSON, preserving following lines. Shared quoted grammar, no API/wire/dependency change. Independent pinned SHA25689bab1dd... matches committed closure; all other closure JSON and original14 test suffix unchanged. A-22237 local32/1055 selected passes/full gates remain supporting, not configured/native/Web receipts; prior red epochs retained. C1/C2 done but runtime verification pending actual same-head result. Additional compositions outside agreed bar go C-325 follow-up unless covered-form regression. Obtain Coordinator window then authorized mode-free verify at unchanged head; Reviewer ran no project checks/probes. Hold released.

### rev-35 · 2026-11-20T19:27:45.502Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2038-evidence-1
commit: 5f742603e00bc910180612865b7668890830755e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22249 final audit: producing59488faf/A-22248 passes at exact source5 head5f742603e00bc910180612865b7668890830755e; branch unchanged and producer canonicalf0b652cc... matches host gate. All32 redactor cases pass ordinary;18new stable controls each have5passing load receipts (90total), original14 pass unchanged; closure5/runtime-bundle3 consumers pass. Independently counted8058paired unique starts/finishes:7145ordinary test passes incl145nested,733file envelopes, plus90load test/file pairs, no non-pass/missing ends. ActualT0/all237T1/441T2/55Web exit0, including setup-signin;272T3/18T4 unexecuted here, batchT3 remains. C1/C2 verified at Coordinator5021b425's agreed source5 bar. Earlier qualified red-first notes/failures remain separate; no invented native/invocation-tree proof. Report-only advisories are not performance clearance; cached:null not inferred, accounting not wall time. No Reviewer runtime/probe/source/merge action; hold released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T20:53:06.190Z

Merged 0d0f13dba6ac8934136f17dcd1efa7589ce6edd8 onto dev.
