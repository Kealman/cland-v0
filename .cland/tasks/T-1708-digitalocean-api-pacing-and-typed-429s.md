---
id: T-1708
kind: task
title: DigitalOcean API pacing and typed 429s
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1403
branch: t/T-1708-digitalocean-api-pacing-and-typed-429s
created: 2026-11-06T10:47:52.181Z
updated: 2026-11-06T11:09:44.238Z
---

## Summary

The shared DigitalOcean client paces its calls within 250 requests a minute on the hub's clock, and turns a 429 into a typed refusal carrying the retry time from the response, with no immediate re-send. The executor and the host provider share one budget per token. The fake DigitalOcean API learns to answer 429 with rate-limit headers.

Hot files: `hub/src/executor/droplet/api.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/digitalocean-pacing.test.ts` (new)

## What to build

A token bucket in the client over the injected clock, the parse of `Retry-After` and `ratelimit-reset` into a `RateLimited` error, and fault injection for 429 in the fake API.

Notes: `api.ts` and `fake-api.ts` are shared and serialized in one lane with the DigitalOcean machines, declarations, volumes and pool-image tickets.

## Acceptance criteria

- [x] C1. With an injected clock, 300 queued calls never send more than 250 within any 60 s window (test).
  - done: impl-1708 · 2026-11-06T11:08:42.166Z
- [x] C2. A 429 surfaces as a typed refusal carrying the response's retry time, and the client sends nothing for that call before then (test).
  - done: impl-1708 · 2026-11-06T11:08:42.835Z
- [ ] C3. The executor test files (`executor-droplet`, `executor-prepare`, `executor-safety`) pass with no test edited.

## Comments

### impl-1708 · 2026-11-06T10:51:18.750Z

Rule 20 sweep before change: searched DigitalOceanApi, DigitalOceanError, ProviderCall, fakeDigitalOcean, Retry-After, ratelimit-reset across hub/src, all hub/test tiers, nvim, web, docs, qa/briefs, shipped .agents/skills. Production consumers: droplet/{droplet,run,prepare,cleanup,deadline,watchdog,snapshot-recovery,dependencies}. All retain signatures and DigitalOceanError status/id/cause semantics; RateLimited is additive subclass. Test consumers: executor-{admission,deletion-confirmation,liveness,lock-liveness,prepare-component,prepare-retry,deadline,watchdog,snapshot-confirmation,droplet,prepare,safety}, remote-fixture, droplet-fixture, suite-{unit-fixture,soak-component,dry-run}, startup-ready-component, daemon. No client/wire/persisted shape changes; nvim/web no callers. QA E-1538/E-1538-stage-1 and T-271 retain fake HTTP contract; unrelated speech/Telegram Retry-After consumers unaffected. Fake provider callback signature remains unchanged; fake HTTP and scripted failures use one exported 429 parser. Preserve old non-429 error regression. Tests at assigned public API seam.

### impl-1708 · 2026-11-06T10:54:40.446Z

TDD evidence: C1 red 300 !== 250 before pacing; C2 HTTP/scripted red Missing expected rejection before 429 injection/parser. Now 9/9 local macOS Node 24.21 focused cases pass; worst sample 0.322s, none crosses 3s allowance threshold. Full typecheck passed. Preservation + importing T3 pending T-1706 lock release (executor-droplet/prepare/safety/run plus daemon and suite-dry-run identified by direct api/fake imports). Additional sweep finds accounts-policy and demo-release-component T2 unaffected method signatures. No criteria marked done until preservation receipts complete.

### impl-1708 · 2026-11-06T10:58:53.053Z

Correction at pushed head ce355d89c082038da82908bd959fe98a184984ad: headerless 429 keeps provider id/text (redacted), has retryAt undefined and imposes no cooldown; only explicit retry headers fence the shared token. Added missing-header HTTP regression. Final focused run 10/10 on local macOS arm64 Node24.21.0 (worst new test 1.060s; no >=3s allowance needed). Full typecheck green. Earlier head d2a53bcde preservation executor-droplet 10/14 was RED: /429 refused/ mismatch plus three transport timeouts due invented fallback cooldown. Other files were unexecuted. C3 remains incomplete; waiting for allocated preservation slot after T-1707, then source review before mode-free verification.

### rev-37 · 2026-11-06T11:04:45.759Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1708-source-1
commit: ce355d89c082038da82908bd959fe98a184984ad
scope: full
findings: [{"severity":"medium","text":"Rolling-window timestamp is spent before awaited admission returns, so delayed continuations can send after reservations age out; reproduced250 queued at0 plus50 after clock.block60000 yields300 actual sends at60000. Couple admission/spend to transport invocation and retain a delayed-send regression.","file":"hub/src/executor/droplet/api.ts","line":89},{"severity":"medium","text":"HTTP429 JSON null passes the cast then value.id throws; outer catch converts it to status0/transport, losing typed RateLimited/retry headers. Validate unknown diagnostics and preserve typed429 for null/non-object/invalid bodies.","file":"hub/src/executor/droplet/api.ts","line":111},{"severity":"medium","text":"Shared token cooldown is installed only after awaiting429 body JSON. A held/slow body lets sibling requests send after Retry-After headers already arrived. Fence on headers before optional body reads, with a held-body sibling regression.","file":"hub/src/executor/droplet/api.ts","line":110}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-1708 full source review

Head ce355d89c082038da82908bd959fe98a184984ad; branch t/T-1708-digitalocean-api-pacing-and-typed-429s.
Fixed point 74117dabbf7652bdd5e41e40975943619828048d, merge base with origin/dev. Reviewed both task commits d2a53bcde and ce355d89c using git diff origin/dev...ce355d89c; no dev merge.
Run rev-37-1708-source-1; scope full; result not clear.
Standards and Spec axes reviewed in-session; role prohibits delegation. Reviewer read source/docs/tests/item/evidence only; no tests, edits or browser.

## Spec

Medium — hub/src/executor/droplet/api.ts:89. The rolling window timestamps admission at line76, then awaits #admit before invoking the provider/fetch. A delayed continuation can spend a reservation after its timestamp has aged out, so the claimed actual-send maximum fails. Queue250 calls at FakeClock0, synchronously block clock60000 before yielding, then queue50 and drain: all300 transport calls send at60000. Implementer reproduced unchanged-head output {actualSends:300,at60000:300,expectedMaximum:250}. Make admission/check-and-spend synchronous with invoking the actual transport after every wait, and preserve deadline/cancellation checks. Add a delayed-send regression that counts transport invocation times across clients, retaining the final moving-window assertion.

Medium — hub/src/executor/droplet/api.ts:111. JSON null is successfully parsed and assigned to Record<string,unknown>; reading value.id throws. The outer catch converts a real429 to DigitalOceanError status0/id transport, losing retryAt and shared cooldown. Implementer reproduced unchanged-head Response('null',429,Retry-After2): status0, id transport, no retryAt, message 'DigitalOcean 0 transport: request failed or exceeded its time bound'. Treat response diagnostics as unknown and validate their shape;429 must remain RateLimited with valid header timing for null/non-object/malformed/empty bodies. Retain provider-text redaction and headerless compatibility.

Medium — hub/src/executor/droplet/api.ts:110. The HTTP429 branch waits for the entire optional JSON body before parsing/publishing its header-derived token fence. While that body remains pending, a sibling client using the same token can pass #admit and send despite the already received Retry-After/reset. Establish retry time and shared admission fencing when429 headers arrive, before awaiting optional diagnostic bytes. Add a held-body test that observes the429 boundary before triggering the sibling and retains the no-send-before-deadline assertion.

C1 failed: admitted timestamps do not bound actual transport invocation timestamps under delayed continuation.
C2 failed: null429 body loses typed refusal/retry timing; held429 body delays shared token fencing.
C3 remains unverified, awaiting the allocated six-file preservation run. No criteria verified.

## Standards

No additional findings. Shared HTTP/scripted retry parsing is exported rather than copied; additive RateLimited extends DigitalOceanError so status/id and existing catches remain available. Token keys are hashed, not retained credentials, and clock identity scopes the shared budget. Existing error redaction/no automatic client replay are retained in ordinary paths. Fake429 fault injection covers HTTP headers and scripted transport. The new file's fake clock/provider/loopback HTTP tier is T2 with no new real process; tier manifest, generated index and file guidance are included. Running docs describe clock/process scope, later-header choice, absent-header behavior and no replay. The consumer inventory lists production, fixtures, all tiers, QA and skill searches; preservation files are unedited in this diff. Final preservation evidence is still needed to establish compatibility.

Evidence limits: A-17054 is earlier working-tree red/green development evidence; A-17059 records corrected ce355d89c focused10/10/typecheck/T0-lint on local macOS arm64 Node24.21.0, no browser/full verification. Its prior d2a53bcde executor-droplet10/14 is RED (provider-text mismatch and three headerless-cooldown timeouts); other preservation files unexecuted. No configured/Linux/Web/C3 pass is claimed. The two reproduction outputs above are Implementer-supplied unchanged-head reports independently consistent with source traces, not reviewer-run tests. No new run or source change was made during this review.

Standards:0 findings. Spec:3 medium findings. Correct these, retain red controls/history, then request fresh source review at the corrected pushed head before verification.

A-17062: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17062-t-1708-source-review-send-boundary-and-typed-429-receipt.md

Criteria: C1 failed (Delayed pre-send continuations can age out admission timestamps and send300 calls within one actual transport window.), C2 failed (A null429 body loses the typed refusal/retry time, and a held429 body delays installing shared token cooldown.).

### rev-37 · 2026-11-06T11:09:44.238Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1708-source-2
commit: d717f45e375f35cf0567fa4eec1976c000912c60
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1708 corrected source review

Head d717f45e375f35cf0567fa4eec1976c000912c60; branch t/T-1708-digitalocean-api-pacing-and-typed-429s.
Run rev-37-1708-source-2; scope full; result clear; findings [].
Compared against ce355d89c082038da82908bd959fe98a184984ad and read the intervening7d22e1fdc correction plus final diagnostic controls. No dev merge. Original full audit A-17062 remains applicable with its three findings addressed. Standards and Spec reviewed in-session without delegation; Reviewer read only.

## Spec

All three medium findings addressed by source:
- #admit now invokes a synchronous send callback in the same continuation that checks/spends the shared budget; #call no longer awaits a reservation before calling transport. After any budget wait, the loop rechecks deadline, cancellation, rolling timestamps and provider fence. The delayed-continuation regression uses two same-token clients and retains the actual-provider-send moving-window maximum after all300 calls complete.
- HTTP429 diagnostics are unknown, narrowed to non-null/non-array object before optional id/message extraction. Null, string, number, array, empty object, malformed JSON and empty-body controls require RateLimited with the original header retry time. Provider fields still use token redaction; headerless explicit-call compatibility remains.
- Retry time is computed and applied to the shared token on429 header receipt, before awaiting body diagnostics, and the same captured retryAt is retained in the eventual error. The held-body test observes the client beginning the response read before triggering its sibling; it checks no send at1999ms, explicit successful send at2000ms, then releases body and joins both calls before teardown. Final retryAt remains2000 regardless of delayed body completion. No automatic replay added.

C1/C2 remain runtime criteria: new controls look appropriate, but are not marked verified by source review. C3 remains pending unedited preservation.

## Standards

No findings. Synchronous callback factors admission and transport without copying budget logic. HTTP/scripted parser and existing error subclass compatibility remain shared. Added regressions use injected time/provider or scoped fetch mocks, no real cloud/native processes/browser. Held stream is released and outstanding calls joined in finally; mock cleanup is test-owned. T2 tier and unchanged preservation assertions/files retained. Subsystem and per-file docs describe header-time fencing, body robustness and actual-send control. Previous consumer inventory remains valid; corrections introduce no new public wire/persisted shape.

Supplemental Implementer reports: local macOS arm64 Node24.21.0 focused19/19 green (worst new1.212s), earlier corrected13-case tree typecheck green; final typecheck/T0 finishing. Prior red controls at ce355d89c and earlier d2a53bcde executor-droplet10/14 remain red history. No configured/Linux/Web/preservation/C3 pass at this head yet. These are development reports, not reviewer executions or final verification.

Source clear allows the lead to finish the Coordinator-authorized six-file unedited preservation slot after T-1707, then submit configured mode-free verification pinned to d717f45e375f35cf0567fa4eec1976c000912c60. Final evidence must check named pacing/429 regressions, required preservation and exact head/tree. Any later source/head change needs fresh source review. QA remains affected/after-stage.

Standards0 findings; Spec0 findings. No criterion newly verified.

A-17067: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17067-t-1708-corrected-source-review-at-d717f45e.md
