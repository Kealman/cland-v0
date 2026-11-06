---
id: T-1708
kind: task
title: DigitalOcean API pacing and typed 429s
state: open
status: in progress
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
updated: 2026-11-06T12:08:07.385Z
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
  - failed: rev-37 [reviewer] · 2026-11-06T11:34:36.704Z · note Unedited executor-prepare is reported3/5 red at this head, and configured compatibility evidence is cancelled/incomplete; required preservation is not green.

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

### impl-1708 · 2026-11-06T11:13:08.555Z

Source clear rev-37-1708-source-2 at d717f45e375f35cf0567fa4eec1976c000912c60. All three findings reproduced red and fixed with regressions. Exact-head node --test hub/test/digitalocean-pacing.test.ts completed19/19, zero skips/cancel/todo; local macOS arm64 Node24.21.0, sealed disposable environment, no browser/cloud resources. Full typecheck green. Exact-head npm run test:lint exit0, zero refusals,122 baseline report-only findings. C1/C2 done again. C3 remains pending six UNEDITED preservation files in slot after T1706 (latest order); no mode-free verify submitted yet.

### impl-1708 · 2026-11-06T11:29:31.865Z

Regression diagnosis update, before scope fix: baseline detached0eb62a96 unedited prepare5/5 and run19/19 green; reviewed d717f45e prepare3/5 red, run incomplete180s, droplet14/14 safety17/17 green. New unit seam reproduces cross-authority leakage: same clock/sentinel token,250 sends to first fake API => fresh second fake API sends0 and expires15s deadline. Rule20 scope consumer sweep: CLAND_DIGITALOCEAN_API production api.ts callers keep canonical same-base per-token budget; test fake API url/synthetic-provider/account-fixture-env and docs/QA examples already pass per-fixture endpoints. No wire/method/persisted shapes changed. Default real API clients still share across executor/provider. New regression retains same-endpoint sharing and distinguishes independent provider authorities; native per-case send counts still pending instrumented disposable-copy run.

### rev-37 · 2026-11-06T11:34:36.704Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1708-evidence-1
commit: d717f45e375f35cf0567fa4eec1976c000912c60
scope: evidence
findings: [{"severity":"medium","text":"Configured compatibility control cancelled after native120000ms timeout (120.009s completion); hub hung221s is separate. Run is incomplete, with Web/later tiers unexecuted; provider admission/clock interactions require diagnosis before retry.","file":"hub/test/suite-accounting.test.ts","line":311},{"severity":"medium","text":"Budget key omits provider authority, coupling independent fake endpoints reusing clock/token. Item reports250 calls to one authority make fresh second authority send0/deadline; required unedited prepare3/5 red and run incomplete. Preserve same-authority sharing while migrating scoped admission/clock consumers; complete accounting-timeout cause remains unproved.","file":"hub/src/executor/droplet/api.ts","line":42}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1708 configured evidence review: not clear

Head d717f45e375f35cf0567fa4eec1976c000912c60.
Run rev-37-1708-evidence-1; scope evidence; result not clear.
Configured run3e93c15b-754a-4801-9f09-ac4864543a14 / A-17078 exited1.
Canonical verification tree independently reconstructed as cb06e6a4ad80fd540640a6d32a33e46f958fee23, matching run provenance. Source clear A-17067/rev-37-1708-source-2 covered this head before execution.

Actual failure output:
hub/test/suite-accounting.test.ts:311:1
'50 parallel acquirers refuse the spend cap after a stalled budget publication'
'test timed out after120000ms'
Completion record: outcome cancelled, timedOut true,120.009066058s.
The hub's later 'running221s' hung observation is a separate measurement, not the test's native timeout.

Medium — hub/test/suite-accounting.test.ts:311. Required configured compatibility run is cancelled in the50-acquirer accounting control; it is not passing evidence. Investigate the provider admission/clock interactions and retain the exact failure; no source-supported classification as unrelated or mere load flake is established here.

Medium — hub/src/executor/droplet/api.ts:42. New shared budget is keyed only by clock identity and token digest, coupling independent API authorities that reuse a sentinel token. The item records an unchanged-head synthetic reproduction:250 sends to one fake endpoint cause a fresh second authority to send0 and expire its15s deadline. It also records required unedited executor-prepare3/5 red and executor-run incomplete180s (versus detached baseline prepare5/5 and run19/19), with droplet14/14 and safety17/17 passing. These are Implementer reports pending durable raw producer receipts, not reviewer test runs. Shared per-token accounting must remain within the same provider authority, with old same-authority sharing preserved; broader scoped/fake-clock migration needs fresh source review. Cross-authority coupling is directly visible in source; it is not yet proved to be the accounting timeout's complete cause.

Independent streaming facts: digitalocean-pacing has19 unique generated names and114 passing completion records (base19 plus95 load repetitions), no nonpass outcome. suite-accounting has15 unique completions:14pass/1cancelled. Thus C1/C2 named regressions ran successfully, but no final criterion verification is granted from this failed configured run.

Execution: Linux x64 6.8.0-142-generic, droplet c-8 nyc1, Node24.21.0, Neovim0.12.5, workers2, cached:null. T0/T1 completed exit0; fallback T2 stopped exit1. Native phase summary4491tests/4490pass/1cancelled is distinct from hub observed4710 completed pass records before interruption. Neither is a full pass. T3/T4/Web did not execute; browser provenance binary/version null. Remaining T3 deferred to merge batch. Duration/lint/ratchet advisories report-only; skipReasonCheck report/missing0 and skips[] do not turn cancellation into success.

C3 failed for compatibility evidence: required unedited executor-prepare is reported3/5 red, executor-run incomplete, and configured accounting case cancelled. C1/C2 remain done/unverified; no verified marks. Source fix must get a new source verdict before another configured run. Preserve all earlier ce355/d2a53 failed controls and current A-17078 failure; no allowance or timeout relaxation is implied.
Reviewer read only, no tests/typecheck/browser/edits/merge.

A-17079: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17079-t-1708-failed-configured-evidence-and-authority-scope.md

Criteria: C3 failed (Unedited executor-prepare is reported3/5 red at this head, and configured compatibility evidence is cancelled/incomplete; required preservation is not green.).

### impl-1708 · 2026-11-06T12:08:07.385Z

Coordinator decision284ee1a9: rate is endpoint-declared; real DigitalOcean remains250/min, fake default declares100000/min, C1/C2 explicit250. New shared endpoint.ts parser/formatter used by API and fake; fragment metadata removed before canonical transport/budget key. Legacy bare URLs stay250; same clock/base/token share strictest declared limit. Consumer sweep covers CLAND_DIGITALOCEAN_API all source/tests/nvim/web/docs/qa/skills, direct api.url uses and regex guards: synthetic-provider preserves declaration unchanged; QA E-1538-stage-1's three strict loopback checks migrated to shared parser; scripted fake keeps its prior public empty url and supplies internal declaration to callback client. No method/wire/persisted record shape change or new dependencies; CLI help/usage and role/skills contain no superseded endpoint-policy instructions. Added T1 endpoint tests, updated T2 pacing/fake regressions and docs/index. High-budget control red250!==300 then green; immediate-send control observes1 actual transport call/0 clock timers before await. Current targeted35/35 green on local macOS Node24.21, no native processes/browser/cloud. Native unchanged prepare/safety/accounting still pending next slot; no final passing claim.
