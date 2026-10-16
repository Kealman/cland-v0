---
id: T-585
kind: task
title: claude-code-adapter "discovery and watch share the default 30-second schedule" counts 2 calls instead of 1 on a loaded droplet
state: closed
status: done
size: S
rank: 4445
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
  - v0.1.4
assignee: null
parent: E-482
blocked_by: []
topic: topic-403
branch: t/T-585-claude-code-adapter-discovery-and-watch
created: 2026-10-16T08:50:52.161Z
updated: 2026-10-16T19:04:57.761Z
closed: 2026-10-16T19:04:57.761Z
---

## Summary
Integrated cover 0000625b at dev 3a3b4633 (droplet, 2026-10-16 08:49Z) failed hub/test/claude-code-adapter.test.ts:353, "Claude discovery and watch share the default 30-second schedule, and stop works before the next pid arrives": "launch discovery and watch use one call", actual 2. The case passed 3/3 alone on dev on a quiet Mac. Under load the shared schedule apparently fires a second discovery before the watch takes over: either a timer-ordering race in the adapter or a test that counts calls across a boundary load can shift.

## Acceptance criteria
- [x] C1. Find whether a real double discovery happens under load (a product issue: fix the adapter so they share one call) or the test counts across a timing boundary (a test issue), fix the cause, and record it on this item.
  - done: impl-585 · 2026-10-16T17:32:06.901Z
  - verified: rev-30 [reviewer] · run rev-20261016-585-source · 2026-10-16T17:33:04.606Z · commit eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57
  - verified: rev-30 [reviewer] · run rev-20261016-585-shared-duration · 2026-10-16T18:12:48.683Z · commit 073bb593131c51836d18d0ceef717faf4d6a9ac9
  - verified: rev-30 [reviewer] · run rev-20261016-585-final · 2026-10-16T19:04:35.299Z · commit 073bb593131c51836d18d0ceef717faf4d6a9ac9
- [x] C2. claude-code-adapter.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.
  - done: impl-585 · 2026-10-16T19:04:18.422Z
  - verified: rev-30 [reviewer] · run rev-20261016-585-final · 2026-10-16T19:04:35.299Z · commit 073bb593131c51836d18d0ceef717faf4d6a9ac9

## Comments

### impl-585 · 2026-10-16T17:30:47.313Z

C1 cause: test counts across a real timing boundary, not duplicate adapter admission. Baseline named case passed (8.134 s). A temporary 3.1 s delay while the first hub was stopped deterministically reproduced 2 !== 1 at 'launch discovery and watch use one call'. Moving the delay before the second launch also reproduced 2 calls; delaying the watcher (600 s poll override) while crossing that same interval reproduced the other receipt exactly: a PID instead of null at 'the next launch does not bypass the schedule'. Both are valid discovery once the 3 s test interval expires; the adapter already shares agentsFlight/lastAgentsAt and persists the floor. Fix uses Node's Date mock with the actual default 30 s interval, real CLI children and frame clients, and reopens projectHub to retain persisted-snapshot proof. Time remains fixed across restart and second launch; explicit 29,999/30,000 ms assertions prove the schedule, then advance another full interval after the last stop to prove no CLI. Bounded observation uses performance.now so failure deadlines do not freeze. First fixed named run passed (3.922 s).

### rev-30 · 2026-10-16T17:33:04.606Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-585-source
commit: eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-585 source review

Clear at eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57, fixed point cb8462c81dbb5daaca59d89b11f4053a8166f48d. Origin task tip matches. Two test/manifest files; adapter source is unchanged. Both review axes performed in-session under no delegation.

## Standards
No findings. The test controls Date only; real CLI child processes, frame clients and liveness timers remain in use. Its bounded observation helper uses performance.now, so freezing wall-clock scheduling does not freeze those assertion deadlines; an outer 30 s test timeout bounds the case. The fake clock is reset explicitly after stopping the reopened hub and in a cleanup hook on failure. Reopening projectHub retains the real persisted adapter state while removing unrelated daemon startup latency; no daemon-PID assertion is being replaced.

The existing test identity and duration allowance seconds remain; only the reason is updated. The initial no-CLI idle window, config-directory check, unknown-PID stop via harness id, shared-call count and final stopped-watch silence are retained. No assertions or production behaviors are relaxed. Read-only diff whitespace check passes.

## Spec
No findings. C1 source/cause record established. The adapter already shares agentsFlight and lastAgentsAt per directory, persists its lastAt/entries state and tests Date.now against the resolved interval. The old 3 s interval could legitimately expire during stop/restart/second launch, so its exactly-one-call and unknown-PID assumptions crossed a legal timing boundary.

A-4073 and the item comment record controlled reproductions: a 3.1 s restart gap yields 2 versus 1 calls; moving the gap before launch does the same; delaying the watcher while crossing the interval yields a discovered PID instead of null. These experiments support the timing-boundary diagnosis for the observed signatures; they are claimant records, not Reviewer executions or direct traces from every historical failure.

The corrected case uses default 30000 ms (still asserting the resolved schedule log), freezes time across first launch and persisted-state reopen, and proves the second launch cannot bypass the shared schedule. At 29999 ms it requires exactly one agents call across real liveness polls; at 30000 ms it observes exactly the second call. After stopping the final watch it advances a full interval and requires no additional CLI calls.

## Validation / criteria
A-4073 reports the fixed named test green in 3.922 s and root typecheck green; the request says ten serial Mac whole-file passes are in progress. Those repetitions and the exact-head droplet whole-file run remain pending. C1 verified; C2 requires all ten Mac whole-file passes plus the normal task droplet receipt. No per-item QA criteria.

Standards 0 findings; Spec 0 findings.
Review artifact A-4074.

Criteria: C1 verified.

### impl-585 · 2026-10-16T17:46:20.734Z

C2 Mac proof complete at reviewed head eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57: claude-code-adapter.test.ts passed 10/10 serially as a whole file, all 130 tests green. Every file start checked one-minute load <15 (12.38–14.94); waits admitted no run at/above the threshold. Updated discovery case passed 10/10, 3.282–5.327 s. Durable receipt A-4084: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4084-t-585-mac-10-10-serial-whole-file-passes-at-eb05ad9f.log. Source clear rev-20261016-585-source (A-4074), root typecheck green, clean unchanged head. Exact-head explicit droplet verification 7b91714c-8fbe-4d9c-8cf6-9b148f8832dd already submitted; C2 remains pending only its whole-file Linux pass.

### impl-585 · 2026-10-16T18:07:58.319Z

Droplet run 7b91714c / A-4099 at eb05ad9f executed 1975 tests: 1970 passed, 5 skipped, zero test failures. The changed schedule case passed in 6.820 s and the whole Claude adapter file passed every assertion. Verification exit 1 is solely missing duration allowances on unchanged T-603 pinned-account (5.898 s) and inherited-directory (5.235 s) cases; both also passed their 5/5 load repetitions. Coordinator identified the dev defect and posted shared-fix commit ad5e2c86, to land after integrated cover ce9e3110; instructed this item to hold until the dev SHA is posted, then cherry-pick only that shared fix, typecheck, push, obtain delta review, and resubmit droplet verification. Head remains unchanged while waiting.

### impl-585 · 2026-10-16T18:11:41.379Z

Applied Coordinator-authorized shared duration fix ad5e2c86 via cherry-pick as 073bb593131c51836d18d0ceef717faf4d6a9ac9. Only eight duration-manifest lines changed from source-clear eb05ad9f; test source is unchanged. Root npm run typecheck passed, head pushed to origin, delta review requested from Reviewer before rerunning droplet verification.

### rev-30 · 2026-10-16T18:12:48.683Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-585-shared-duration
commit: 073bb593131c51836d18d0ceef717faf4d6a9ac9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-585 shared-duration delta source clear at 073bb593131c51836d18d0ceef717faf4d6a9ac9, direct child of reviewed eb05ad9f22af20c40fe5c4e91854c9e5e59a3a57. Standards and Spec axes: no findings.

Independently read primary Coordinator cc249229-f019-40fb-be83-e680fa90f2eb in Agents: ad5e2c861fed137db7808f9ff70278e60e9549db is posted on dev, with explicit cherry-pick/typecheck/review/resubmit direction for T-569/T-585 and alongside owned corrections for T-475.

Only hub/test/durations.json changes. Parsed before/after manifests independently: exactly two new allow identities, byte-equivalent values to the posted shared additions, and every other manifest value unchanged. The pinned-account/inherited-directory T-603 cases gain narrow reasons for native launch/stop/resume/guidance process costs, with observed A-4092/A-4094 timings stated. Baselines match their siblings; no assertions, deadlines, source/tests, other allowances or parent integration changed. Direct parent matches the prior head; diff whitespace check passes. No local rerun needed for this authorized manifest-only shared pick. Request reports root typecheck exit 0 at this head.

Independently inspected A-4084's ten serial Mac whole-file passes, each 13/13 (130/130), all start loads 12.38–14.94. Schedule case 3.282–5.327 s. A-4099's exact prior-head Linux whole file passes, including schedule 6.820 s; overall 1970 pass/zero fail/five skips, exit 1 solely the two external T-603 budgets. No Neovim phase was reached. These unchanged-source receipts remain relevant, but are not a green new-head gate. C1 refreshed; C2/final waits for required new-head droplet evidence.

Proceed with the Coordinator-directed mode-free exact-head droplet verification. No per-item QA criteria.
Review artifact A-4102.

Criteria: C1 verified.

### impl-585 · 2026-10-16T19:04:18.712Z

Final execution evidence is green at reviewed head 073bb593131c51836d18d0ceef717faf4d6a9ac9: mode-free explicit droplet run 00747641-2e72-4d02-8789-ee95978c70d5 exit 0, 1987 total / 1982 passed / zero failed / five skipped, including Neovim smoke. Whole claude-code-adapter.test.ts passed; the discovery schedule case passed in 7.521 s. All four T-603 variants passed their 5/5 load repetitions, and shared duration allowances cleared the prior external budgets. Durable receipt A-4126: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4126-suite-00747641-2e72-4d02-8789-ee95978c70d5-auto-at-073bb59.log. C2 done with Mac A-4084 10/10 whole-file passes on unchanged test source. Clean task head remains pushed; awaiting Reviewer evidence verdict and hub readiness.

### rev-30 · 2026-10-16T19:04:35.299Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-585-final
commit: 073bb593131c51836d18d0ceef717faf4d6a9ac9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-585 final evidence review clear at unchanged source-reviewed 073bb593131c51836d18d0ceef717faf4d6a9ac9. Standards and Spec axes: no findings.

Independently audited complete A-4126 / 00747641-2e72-4d02-8789-ee95978c70d5: exact branch/head stamped in the log, exit 0; 1987 tests, 1982 pass, zero fail, five platform/prerequisite skips. Hub free 38/38, machine 1932 pass/zero fail/five skips, Neovim smoke 12/12. All thirteen claude-code-adapter whole-file cases have positive timing receipts, including changed discovery/watch schedule at 7.521161824 s. No hard duration-budget or load-gate failure. Routine regression notices are non-failing. Linux c-8 lon1, Node 24.21.0/Neovim 0.12.5, four workers; suite 1863.75 s, peak load 18.24, machine lifetime 1943 s, $0.1349.

C2 Mac proof independently rechecked in A-4084: ten serial whole-file runs, thirteen passes each, zero failures/skips (130/130); load admission records were reviewed in the preceding evidence audit. These were at eb05ad9f; independent git diff confirms the entire test file is byte-unchanged through the authorized ad5e2c86 manifest-only pick to current 073bb593. Thus the Mac proof remains applicable to the current test source. Latest claimant report restores C2 done at this head.

C1 source/cause proof from A-4074 and manifest delta A-4102 remains: observed timing-boundary mechanism, default 30-second Date schedule controlled while real timers/processes remain, shared discovery/cache/restart and stop assertions retained. This final runtime proof supports the correction; no new historical tracing claim or product change is inferred. C1/C2 verified at this exact head. No per-item QA criteria and no further task run required.
Review artifact A-4127.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T19:04:57.761Z

Merged a5ace6664c9ac9f38a6b51b1e0bf9675ade6c37f onto dev.
