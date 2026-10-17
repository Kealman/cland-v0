---
id: T-696
kind: task
title: AccountPoller takes the hub Clock, and the five account files stop sleeping through real poll windows
state: open
status: review
size: L
criterion_seq: 6
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-685
topic: topic-423
branch: t/T-696-accountpoller-takes-the-hub-clock-and
created: 2026-10-16T19:59:36.370Z
updated: 2026-10-17T08:06:02.450Z
---

## Summary

The account files spend most of their time waiting for real poll windows (memo §2.2 wins 1 and 6; report-slice1 #1 and #8, report-slice2 #4, report-slice4 #5):

- `claude-code-accounts.test.ts` (141.0 s): one test sleeps 3 × 30 s to prove nothing polled; another sleeps 2.3 s and four intervals as negatives.
- `account-limited.test.ts` (111.1 s): waits real 12–16 s poll minimums and asserts elapsed milliseconds.
- `account-poller.test.ts` (50.7 s): floors and backoff by `sleep(1.1 * minimumMs)`, `sleep(3200)` and interval deltas.
- `accounts.test.ts` (52.0 s): eight malformed-registry refusals, each through a live launch.
- `account-limits.test.ts` (23.9 s): reading order and coalescing, which are pure.

Size L because one seam, the clock in `hub/src/accounts/poller.ts`, and one fixture, `hub/test/account-fixture-env.ts`, serve all five files; split, the parts would serialize on both.

## What to build

- **The seam.** `AccountPoller` takes T-685's `Clock`, and `serveProject` passes the hub's.
- **The tests.** Eligibility, floors, minimums, backoff, the per-account latch and "newer push wins" are asserted by advancing a `FakeClock`, never by sleeping or comparing elapsed milliseconds. Registry parsing, the malformed-registry refusals, relative `XDG_CONFIG_HOME` and the null-account migration become T1 tests on the accounts module. The `account.clear` permission table runs through `decide()` with one frame proof. Reading order and coalescing are T1.
- **What stays real.** T3, each with a header: the process-group kill of a hung poll, one Codex and one OpenCode launch carrying the account's environment, one restart retention, and one end-to-end limit hit through a fake harness.

## Acceptance criteria

- [x] C1. `AccountPoller` takes the hub `Clock`, proved by a T1 test that advances a `FakeClock` through a floor, a backoff and a latch with no real wait.
  - done: impl-696 · 2026-10-17T07:08:51.656Z
  - verified: rev-30 [reviewer] · run rev-20261017-696-cleanup-correction · 2026-10-17T07:09:43.331Z · commit 36a42528b870be68b5196b54eaca6005e1e1d4ed
  - verified: rev-30 [reviewer] · run rev-20261017-696-native-ownership · 2026-10-17T08:06:02.450Z · commit 3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b
- [ ] C2. The five files' manifest seconds fall from 378.7 s (A-3877) to 170 s or less.
  - verified: rev-30 [reviewer] · run rev-20261017-696-first-gate · 2026-10-17T07:52:50.417Z · commit 36a42528b870be68b5196b54eaca6005e1e1d4ed
- [x] C3. The five files hold no numeric sleep and no elapsed-milliseconds assertion except the reasoned ones in the T3 process-group kill test, proved by the test lint.
  - done: impl-696 · 2026-10-17T06:58:15.551Z
  - verified: rev-30 [reviewer] · run rev-20261017-696-cleanup-correction · 2026-10-17T07:09:43.331Z · commit 36a42528b870be68b5196b54eaca6005e1e1d4ed
  - verified: rev-30 [reviewer] · run rev-20261017-696-native-ownership · 2026-10-17T08:06:02.450Z · commit 3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b
- [x] C4. Their `startDaemon` call sites fall from 25 to 5 or less and fake-binary sites from 8 to 3 or less.
  - done: impl-696 · 2026-10-17T06:58:15.904Z
  - verified: rev-30 [reviewer] · run rev-20261017-696-cleanup-correction · 2026-10-17T07:09:43.331Z · commit 36a42528b870be68b5196b54eaca6005e1e1d4ed
  - verified: rev-30 [reviewer] · run rev-20261017-696-native-ownership · 2026-10-17T08:06:02.450Z · commit 3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b
- [x] C5. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-696 · 2026-10-17T07:08:51.955Z
  - verified: rev-30 [reviewer] · run rev-20261017-696-cleanup-correction · 2026-10-17T07:09:43.331Z · commit 36a42528b870be68b5196b54eaca6005e1e1d4ed
  - verified: rev-30 [reviewer] · run rev-20261017-696-native-ownership · 2026-10-17T08:06:02.450Z · commit 3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b
- [ ] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - failed: rev-30 [reviewer] · 2026-10-17T08:01:56.091Z · note M5: New default-realClock delayed-PID proof has no failure-path owner of its hidden native worker; ownership and controlled pre-publication cleanup proof are required before verification.

## Blocked by

T-685 (hub Clock seam). Starts after T-575 merges (it touches the same five files).

## Comments

### impl-696 · 2026-10-17T06:32:22.009Z

Implementation in progress: poller now receives Clock from serveProject; a separately committed Claude directory schedule Clock seam was approved by the Coordinator (45efb437). Added direct T1 coverage for minimum/floor/capped backoff/latch/newer-push, registry refusals/relative XDG/process migration, reading ordering/reopen and account.clear permissions; added T2 fake-adapter publication coalescing. Initial targeted runs green for these and the migrated Claude and poller files. Building assertion audit and serial repetition evidence before source review.

### impl-696 · 2026-10-17T06:58:17.102Z

Source ready at 0010a87c70d6af6713f3f7e4caa331e5b34dcdc3, branch t/T-696-accountpoller-takes-the-hub-clock-and, merged current origin/dev and pushed origin. Assertion audit A-4326; Mac raw TAP/source hashes/timing split A-4336. All 12 touched test files pass 5/5 serially below load 15; additional fixture-isolation and clock regressions pass. Typecheck/test:tiers pass. Five original files: 378.583 → 91.453 median test-seconds; seven extracted files add 0.346 s. No timing baseline was rewritten; removed 16 obsolete legacy allowances (385.884 allowance-seconds). Native cases stay with explicit T3 headers under the Coordinator's approved scope. C2 and C6 await exact-head droplet evidence after a clear source verdict. Inherited QA policy is none/after-stage, so review only.

### rev-30 · 2026-10-17T07:03:25.470Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-696-source
commit: 0010a87c70d6af6713f3f7e4caa331e5b34dcdc3
scope: full
findings: [{"severity":"medium","text":"M1: The held read in the single-flight/newer-push test (and the three gates at lines 184-196) is released only on the successful assertion path. If an assertion or publication fails before release, the fixture teardown at line 39 awaits AccountPoller.close(), which in turn awaits those unresolved pending reads. Own and release/cancel these gates before poller cleanup, drain the refresh operations, and prove an injected pre-release failure cleans up without advancing fake time or weakening the concurrency assertions.","file":"hub/test/account-poller-clock.test.ts","line":126},{"severity":"medium","text":"M2: The new native-read completion frame cursor is captured after awaiting the release-file write. The fake reader and adapter may complete and publish session.usage while that write is finishing; the cursor then excludes the only completion frame and the test waits for another event indefinitely until its bound. Capture the cursor/arm the completion observation before releasing the read, correlate it to the released operation, and preserve the final equal-reading silence assertion.","file":"hub/test/account-limits.test.ts","line":70},{"severity":"low","text":"L1: The root-removal after hook is registered before the hub/adapters and dispatcher peer close hooks. This removes the fixture root while its Sessions/dispatcher resources are still owned and closes adapters after the core store. Consolidate teardown in dependency order (peer, adapters, hub, root), including partial construction failure, so the new test follows the documented fixture ownership order.","file":"hub/test/account-coalescing.test.ts","line":19}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source review T-696 at 0010a87c70d6af6713f3f7e4caa331e5b34dcdc3, fixed point caf9fc074de23025fac90beb9c5415015aa6d7bc. Reviewed the 22-file diff, request, criteria, declaration audit A-4326 and Mac evidence A-4336, with primary Coordinator decisions read in topic-423. Read-only review; no Reviewer execution.

## Standards
Medium M1 — account-poller-clock.test.ts:126 (also :184-196): held boundary reads have no failure-path owner. The release calls occur only after assertions; an assertion failure at :131 or :191 leaves the fake read pending. The fixture after hook at :39 first awaits each poller.close(), and production close awaits its pending reads (:273), so teardown cannot drain them. This is specific to the new deliberately held fake boundary; native process killers cannot release it. Register gate release/cancellation before owning the poller cleanup, drain the tracked refresh operations before closing the store/root, and include a controlled pre-release failure proof. Keep all pre-release concurrency/newer-push assertions.
Low L1 — account-coalescing.test.ts:19: root removal is registered before cleanup for the dispatcher peer, adapters and hub. Its later hook also closes the hub/core store before the adapters. Use a single dependency-ordered owner (including partial-construction paths), with root removal last. No file-backed SQLite claim is made here: these particular core/table defaults are in memory, while Sessions still owns a project-root fixture.

## Spec
Medium M2 — account-limits.test.ts:70: the newly substituted completion cursor is established after awaiting the native release-file write. A fast released reader may already have published its sole session.usage frame before the cursor is sampled, so the positive barrier can exclude its own completion. Establish the cursor/wait before release and correlate completion to the held operation; retain the final two-row equal-reading silence check. This avoids replacing the old sleep with a scheduling race and follows the completion-before-downstream-observation rule.

The production Clock changes otherwise match the approved seam. AccountPoller eligibility/minimum/backoff/hit timers and timestamps use the injected hub Clock; actual native read/kill deadlines remain real. The separately authorized Claude directory Clock seam is passed from projectSessions and defaults to realClock. T-726 retains the remaining fullWindowReset Date.now boundary by explicit Coordinator disposition. account.clear keeps its fixed Coordinator/human boundary while moving the role decision into decide(), with refusal permutations and forged-grant coverage below the frame seam.

A-4326 maps the moved policy/registry/migration/ordering/publication assertions; retained native Claude auth/mod/PID/re-find, Codex sparse-read, attach/pool, OpenCode environment and recorder propagation contracts are explicitly approved by a571d086 and headed T3. Pure registry/reading/permissions and scheduling rules are lower-tier; the mocked-timer CLI case preserves the beyond-ordinary-deadline claim without a wall wait. C3/C4 source conditions are established: numeric schedule sleeps/elapsed assertions are removed, one direct startDaemon remains for native preload propagation, and the shared fixture selects the three native binaries. New tier entries are present. C5's mapping is present, but M2 leaves one rewritten proof unreliable.

Evidence accounting: A-4336 reports all 12 touched test files five serial Mac passes with source hashes; original five medians total 91.453 test-seconds, extracted tests add 0.346. Per primary 779d2fee, C2 is judged from those medians plus eventual exact-head Linux file seconds, not a partial baseline refresh. Independently verified durations.json leaves version/source/budget/files/tests byte-equivalent and removes exactly 16 legacy allowances, adding/changing none. C2 and C6 remain pending Linux evidence; Mac passing runs do not establish failure-path teardown or rule out the cursor race.

Verdict not clear: correct M1/M2 and request new-head source review before task verification. L1 remains recorded as a low finding.

Criteria: C1 failed (M1: Held fake read gates have no failure-path release before poller.close awaits pending work, so the designated T1 proof can strand cleanup.), C5 failed (M2: Rewritten equal-read silence proof samples its completion cursor after release and can miss the sole released-reader completion frame.).

### impl-696 · 2026-10-17T07:08:52.453Z

Review findings M1/M2/L1 addressed at 36a42528b870be68b5196b54eaca6005e1e1d4ed and pushed origin. A-4344 contains revised 60/60 source-matched Mac receipts, changed-file 5/5 reruns, the controlled pre-release failure proof and review-fix explanation. Original five medians total 90.194 s; extracted seven add 0.279 s. Typecheck/test:tiers pass. Declaration audit A-4326 remains; only an added cleanup control declaration has no predecessor. No dev merge after first review. C2/C6 remain pending exact-head Linux verification after a fresh clear source verdict.

### rev-30 · 2026-10-17T07:09:43.331Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-696-cleanup-correction
commit: 36a42528b870be68b5196b54eaca6005e1e1d4ed
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction source review T-696 at 36a42528b870be68b5196b54eaca6005e1e1d4ed, delta from 0010a87c70d6af6713f3f7e4caa331e5b34dcdc3. One commit changes only account-poller-clock.test.ts, account-limits.test.ts and account-coalescing.test.ts; no production changes or dev merge. Origin branch matches. Read-only review, no Reviewer execution.

## Standards
M1 resolved. The poller fixture registers an idempotent partial-construction-safe owner before setup, owns every held read gate, replaces future reads with immediate fixture answers during disposal, releases all held gates, drains tracked refresh callers, then closes pollers/core/store and removes the root. Existing single-flight/newer-push and two-slot concurrency assertions remain before release. The new controlled assertion-failure declaration covers both a single held read and two held plus one queued read, then checks zero tracked refreshes, zero fake timers and root disappearance, without advancing fake time to settle I/O. All five whole-file Mac runs include this control and pass 10/10.
L1 resolved. Coalescing now has one owner registered immediately after root creation; it closes the frame peer, adapters and hub in dependency order before root removal, and attempts all cleanup stages if an earlier close fails. Its in-memory frame connection and original publication/coalescing assertions remain; tier remains T2 for the harness import.

## Spec
M2 resolved. The Codex test establishes its frame cursor and completion promise before creating the release file. A raw readReceipt field survives native session.usage but does not change normalized account windows, so the predicate identifies the released full read rather than any session usage update. The final exactly-two account-limit journal rows assertion remains, along with sparse/newer/full-bucket checks. Fake Codex reads rateLimits() only after leaving its held-read barrier, confirming the planted receipt belongs to that response.

Original Clock, fixed permission boundary, approved native-contract split, C3/C4 source checks and A-4326 declaration mapping remain unchanged. Primary Coordinator dispositions in the first review still apply, including T-726 and stage-close-only duration baseline refresh. C1/C3/C4/C5 are verified at this corrected head; no behavior claim was dropped by this correction.

A-4344 independently audited: all 60 indexed receipts exist, match current committed test-file SHA-256 values, report zero failures/exit zero and start below load 15; exactly five per each of 12 files. The changed three files were rerun; unchanged nine use source-identical prior receipts. Five original medians sum to 90.194345 test-seconds; seven extracted files add 0.279247, combined 90.473592. Claimant also records typecheck/test:tiers green. This establishes the Mac portion, not the required Linux portion. C2/C6 remain unverified pending the normal mode-free exact-head droplet receipt and its per-file timing evidence.

Source correction clear, no remaining findings. The old not-clear A-4342 remains the historical finding record; M1/M2/L1 are resolved here. Task verification may proceed at this head.

Criteria: C1 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-17T07:52:50.920Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-696-first-gate
commit: 36a42528b870be68b5196b54eaca6005e1e1d4ed
scope: evidence
findings: [{"severity":"medium","text":"M4: Exact-head Linux fails the replacement PID discovery after 45000 ms. The fixture freezes its timestamp-only now during that wait, while T-696 now passes the resulting hub Clock into Claude directory eligibility. A first pre-PID snapshot can therefore prevent later timer polls becoming eligible. This causal mechanism is inferred from source and needs controlled reproduction/correction or primary classification; the red task gate cannot yet be considered unrelated/known.","file":"hub/test/subscription-hygiene.test.ts","line":49}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence review T-696 at unchanged 36a42528b870be68b5196b54eaca6005e1e1d4ed, source-clear A-4347 / rev-20261017-696-cleanup-correction. Completed mode-free droplet 181884dc-bd8c-4851-a8c7-a2b1df0fd420 / A-4365 exits one. Hub record matches; read-only audit, no Reviewer execution.

## Standards
No new account-fixture ownership or hard-budget finding. Previous M1/M2/L1 remain resolved: all ten Clock cases, including the controlled pre-release cleanup proof, pass ordinarily and 5/5; native equal-read completion and the coalescing owner also pass. No hard duration-budget line appears. Tier wall/identity overages and duration regression notices remain report-only.

## Spec
Medium M4 — hub/test/subscription-hygiene.test.ts:49: the task gate fails its second native PID-discovery wait (replacement session) after 45000 ms. This is the only ordinary failure; no load gate fails. It is outside the authored account test files, but compatibility with the newly broadened Clock seam is unresolved. Static evidence identifies a concrete mechanism worth reproducing: this fixture passes a timestamp-only now closure that remains frozen during each native PID wait; resolveClock wraps that now with real timers, and T-696 now passes core.clock into ClaudeCodeAdapter. Directory eligibility uses clock.now minus lastAgentsAt, so a first snapshot taken before the replacement PID is visible can suppress every later real timer poll while now stays fixed. The historical timeout is observed; the precise scheduling cause remains an inference, not a claimed controlled reproduction. Preserve lifecycle transition assertions and establish/correct this fixture/seam compatibility before a new gate, or obtain primary Coordinator classification. It cannot currently be assumed an unrelated known flake.

C2 timing evidence is established at this head under primary 779d2fee: original five Linux test-second sums from durable timing rows are Claude accounts 39.361350, account-limited 41.012748, account-poller 10.433845, accounts 44.764410, account-limits 12.659910, total 148.232263811 (<170). Mac five-file medians in A-4344 total 90.194345. Baselines remain unchanged per the integrated-stage-refresh policy; these measured sums satisfy that explicit disposition. C2 is verified separately with this review run. All twelve touched files execute successfully and all twenty-one task-added identities have 105/105 fresh load repetitions. A-4344's 60 matching Mac receipts remain valid. C1/C3/C4/C5 source verification stands.

C6 final settlement is not clear because the task verification is red and Neovim smoke is not reached. Totals: 2091 tests, 2085 pass, one fail, five skips, no cancellations; free 70/70 and machine 2015 pass/one fail/five skips. Linux x64 c-8 lon1, two workers; wall 2409.13 s, peak 13.67, lifetime 2482 s, cost $0.1723. Completed host typecheck uses candidate-tree receipt 9e39015a97d6bacd97039abec918b6047bb104b6 remotely.

Evidence verdict not clear due M4. Bugs/S compatibility candidate reported to lead T-696 for classification; no separate duplicate ticket is presumed. No unchanged retry or source edit is authorized by this verdict; any correction/head change needs source review first.

Criteria: C6 failed (M4: Same-head task verification has an unresolved subscription-hygiene replacement-PID timeout; hub exits one before Neovim despite all touched account files passing.).

### impl-696 · 2026-10-17T07:59:43.638Z

Native Clock compatibility failure reproduced and corrected at f0545fa9b76cabc1152506eef11d29d38461b006, pushed origin. Before: focused subscription-hygiene replacement PID timeout46.298s; after complete offset real Clock:1.259s. Same+1000 lifecycle steps and all assertions retained. Added native default-realClock delayed-PID regression with public PID publication proof. Both changed files pass5/5 serially at load<15; A-4378 packages65 current-source Mac receipts for13 files. Original five medians86.439s; extracted seven0.279s; extra subscription-hygiene median40.134s outside target. Typecheck/test:tiers pass. Authorized dev merge4229a0c1 keeps dev allowance changes and16 own account removals; no baseline refresh. A-4376 documents first Linux timings148.232s and diagnosed failure. Broader bare-now deprecation filed T-728. Requesting delta source review before retry; C6 awaits new-head green receipt.

### rev-30 · 2026-10-17T08:01:56.091Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-696-clock-boundary
commit: f0545fa9b76cabc1152506eef11d29d38461b006
scope: delta
findings: [{"severity":"medium","text":"M5: New delayed-PID test starts a hidden native worker without a failure-path owner; stop runs only at successful completion. Generic fakeClaude cleanup queries another/default config directory and cannot discover this worker; projectHub close preserves native sessions and parsing the raw PID does not register it. An early failure can leave the writer alive while roots are deleted. Own it independently of public discovery, observe exact exit before removal, and prove cleanup on a controlled pre-publication assertion failure.","file":"hub/test/claude-code-accounts.test.ts","line":47}]
finding_counts: {"high":0,"medium":1,"low":0}

Delta source review T-696 at f0545fa9b76cabc1152506eef11d29d38461b006, scope Clock-boundary correction plus primary Coordinator 4229a0c1-authorized merge of dev 010c9955e047b71b8145ff14152f9ff198c5ae83. Origin matches. Prior source head 36a42528, failed gate A-4365 and finding M4 in A-4368. Read-only review; no Reviewer execution.

## Standards
Medium M5 — hub/test/claude-code-accounts.test.ts:47–56: the newly added delayed-PID test starts a native worker while agents-omit hides it, but only stops it on the successful final line. If an assertion, raw-snapshot read, omission removal or discovery wait fails, there is no registered owner of that hidden worker. The generic fakeClaude after hook queries agents with the helper's default config directory; fake-claude.ts:149 filters by that directory and agents-omit. This test launches under a different root/claude directory, so that cleanup does not find it even after omission release. projectHub shutdown closes adapters and preserves native sessions, and raw JSON.parse at :51 does not register a process identity. A failure before public PID publication therefore leaves an unrecorded writer alive while fixture roots can be removed. Own the worker independently of public discovery, with cleanup registered before the failure boundary, bounded exact-identity exit observation before directory removal, and a controlled pre-publication failure proof. Preserve the null-before-release and exact-PID-after-release assertions. This is the new test's failure path, not a request to weaken delayed discovery.

## Spec
M4 is resolved in source. subscription-hygiene now uses a complete Clock with real timers and progressing realClock.now()+offset, retaining both +1000 steps and every original lifecycle/digest assertion. This precisely follows primary 22c527aa; the focused 46.298 s red-before/1.259 s green-after supports the diagnosed compatibility cause. The new default-realClock delayed-publication declaration otherwise tests the requested native boundary correctly. Production AccountPoller/Claude Clock source is byte-unchanged from the prior review; the broader legacy now-callback hazard is explicitly owned by T-728 under primary 9474e691, not silently claimed fixed here.

Authorized manifest resolution checked independently: every non-allow field equals incoming dev, exactly sixteen obsolete account allowances are removed, none added or modified, and all retained Claude values match dev. No baseline refresh or global-budget change. Previous M1/M2/L1 corrections and assertion mapping A-4326 remain intact. This delta adds only the mapped native delayed-PID declaration and the timestamp-boundary correction beyond incoming dev.

A-4378 independently audited: 65 indexed raw receipts match current committed file SHA-256 values, all exit zero/zero failures and load below 15, five per thirteen touched test files. Both changed whole files were rerun; eleven unchanged files reuse source-matched receipts. Their successful runs do not exercise M5's pre-publication failure cleanup. Mac five-original-file medians total 86.439 s; subscription-hygiene's additional 40.134 s is disclosed outside the original target. Old-head Linux 148.232 s remains diagnostic/previous-head C2 evidence, not a current green receipt; current C2/C6 final freshness still awaits the next qualifying gate after source correction.

Source not clear due M5; M4 and original findings are resolved. Correct failure-path native ownership and request source review at the new head before verification. C6 fails current source proof safety; no unchanged retry.

Criteria: C6 failed (M5: New default-realClock delayed-PID proof has no failure-path owner of its hidden native worker; ownership and controlled pre-publication cleanup proof are required before verification.).

### impl-696 · 2026-10-17T08:05:17.234Z

M5 corrected at3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b and pushed origin. Delayed-PID fixture owns cleanup before launch, captures native identity independently of public discovery, uses root-cwd fallback for partial paths and observes exact identity exit before directory removal. Added controlled pre-publication assertion-failure proof: native identity gone while omission marker/root still exist. Preserved null-before-release/exact-PID-after-release assertions. Current native file8 tests passes5/5 serially below load15; typecheck/test:tiers green. A-4388 contains65 source-matched Mac receipts for13 files plus audit addition. Original five medians86.889s; extracted seven0.279s. No dev merge after f0545fa9. C6 pending corrected-head review and green exact-head droplet retry.

### rev-30 · 2026-10-17T08:06:02.450Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-696-native-ownership
commit: 3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction source review T-696 at 3ec2a6cf52a8a8af6117fa4444176ff68a3a0e7b, one-file delta from f0545fa9; origin matches and no further dev merge. Prior delta A-4382 accepted the Clock-boundary correction and authorized manifest resolution but found M5. Read-only review; no Reviewer execution.

## Standards
M5 resolved. delayedPidFixture registers its idempotent owner before the native launch. Cleanup closes its UI and hub, invokes the independently captured native process disposer, then uses verified fixture-root cwd ownership discovery to cover partial launch/raw-snapshot failures before a PID could be captured. It observes captured PID/start/group identity disappearance with a bounded condition and retains the final assertion before normal directory cleanup. ownProcess also registers the captured identity for existing context/signal cleanup; it does not depend on agents or public PID discovery. Repeated disposer calls share the same promise.

The new headed T3 failure control asserts a live independently owned worker while launch still reports null, deliberately raises a pre-publication assertion failure, and runs that same owner in finally. Afterwards it asserts the exact native identity is gone while agents-omit and the project root still exist. This specifically closes the failure path from A-4382 without removing or pre-releasing the publication barrier. The successful native delayed-discovery case still asserts pid=null before release, exact native PID after the later real-clock snapshot, and successful stop. No added sleep or elapsed-time assertion.

## Spec and criteria
No remaining findings. M1/M2/L1/M4 remain resolved. The complete offset real Clock in subscription-hygiene, default-realClock native discovery regression, production construction audit and explicitly deferred T-728 legacy-callback hazard retain the Coordinator-approved scope. Production Clock/permission source and the previously checked dev-manifest resolution are unchanged. C1/C3/C4/C5 source evidence is refreshed at this head: Clock/lower-tier rules, removed numeric scheduling waits, shared native-binary census, original declaration map and added native ownership control are preserved. C2 current-head timing confirmation and C6 final runtime remain pending.

A-4388 independently audited: all 65 indexed Mac logs match current committed test-file SHA-256 values, each exit zero/zero failures, five per thirteen files, all starting below load 15. The changed native account file has eight passing declarations in each run; a representative run has delayed discovery 1.084 s and pre-publication cleanup control 0.638 s. Other twelve files reuse source-identical receipts. Claimant records typecheck and tier lint green. Original five-file median sum is 86.889 s, extracted seven add 0.279 s; extra subscription-hygiene compatibility coverage remains disclosed. Prior Linux 148.232 s belongs to old 36a42528 and is not substituted for a new-head green.

Source correction clear with no remaining findings. Normal mode-free exact-head droplet verification may proceed. C2/C6 final freshness awaits that receipt; all failed old-head evidence remains historical.

Criteria: C1 verified, C3 verified, C4 verified, C5 verified.
