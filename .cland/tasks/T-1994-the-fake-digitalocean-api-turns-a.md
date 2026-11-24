---
id: T-1994
kind: task
title: The fake DigitalOcean API turns a rejected beforeCreate assertion into a 500, so the test times out at 120 s instead of failing
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1735
branch: t/T-1994-the-fake-digitalocean-api-turns-a
created: 2026-11-19T02:38:47.676Z
updated: 2026-11-24T13:44:25.383Z
closed: 2026-11-24T13:44:25.383Z
---

## Summary

The fake DigitalOcean API catches a rejected `beforeCreate` callback and replaces the assertion with an HTTP 500 (`lease-missing`, "lease not armed before create"), around hub/test/fakes/digitalocean/fake-api.ts:181. The original error is discarded, and the caller's later wait for a running state can never succeed. A failed assertion therefore shows up as a 120 s test timeout instead of the precise failure, as impl-1958 found in T-1958 on 2026-11-19 (suite-accounting.test.ts around 412–415).

## What to build

When a test-supplied `beforeCreate` callback rejects, the fake API fails the test with that callback's original error, either surfaced to the waiting case or recorded as the case's failure, instead of disguising it as an unrelated provider 500. Real provider-error simulation stays available on purpose.

## Acceptance criteria

- [x] C1. A `beforeCreate` callback that throws an assertion fails its case with that assertion's message within the case's normal budget, never by timeout (test with a positive control, red on the current fake).
  - done: impl-1994 · 2026-11-24T11:44:19.121Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1994-final · 2026-11-24T12:24:13.163Z · commit e9d32d3506c4820fa9f577377ddcef4aecb49760
- [x] C2. Every caller that passes `beforeCreate` is listed with its disposition (rule 41) and still passes.
  - done: impl-1994 · 2026-11-24T10:50:09.835Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1994-final · 2026-11-24T12:24:13.163Z · commit e9d32d3506c4820fa9f577377ddcef4aecb49760

## Comments

### impl-1994 · 2026-11-24T10:42:45.198Z

Rule 20/41 consumer census: searched repository-wide beforeCreate field/method and fake-api importers, plus docs, skills, QA and raw lease-missing text. No production beforeCreate caller or frozen wire fixture; compatible 500/lease-missing preserved. Assertion-bearing callers migrated to checked waits: suite-accounting (ledger count/reservation), executor-droplet (armed lease/PID/modes), suite-close (shard reservations), host-provider-digitalocean second callback (armed watchdog via armed()). Other callers unaffected in success path; retained teardown now reports unexpected callback errors: executor-safety-component (3 barriers), executor-safety (held create control), suite-remote-budget (2 barriers), demo-provisioning (barrier), daemon (barrier), suite-remote-process (barrier), suite-close-recovery (barrier), executor-prepare-component (barrier and snapshot-file mutation), suite-close-component (captures ledger reservations, asserts after hook), demo (config mutation), suite-candidate-remote (Git/tracker mutation), executor-run (2 file/config mutations), host-provider-digitalocean first callback (barrier). New digitalocean-pacing controls exercise teardown, checked observer and deliberate faults.create on scripted/HTTP transports. Matching file guidance updated; no command/config/permission change. Full source consumer passes will be supplied by mode-free verification; focused checks underway.

### impl-1994 · 2026-11-24T10:50:28.401Z

Source pushed at 930fa347df0be60620bb6fbf6bc4c3c5632bd11d. Full npm run typecheck exit 0 and npm run test:lint exit 0 (zero refusals) on its complete source diff; local macOS Node 24.21.0, no browser. Lint report-only advisory diagnostics remain advisory; no full suite receipt yet. Source review requested from responsible reviewer in item topic; A-22844 holds red/focused-green evidence. T3 consumer coverage remains pending configured verify.

### rev-40 · 2026-11-24T10:51:46.619Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-1994-source1
commit: 930fa347df0be60620bb6fbf6bc4c3c5632bd11d
scope: full
findings: [{"severity":"medium","text":"M1: all five new controls acquire the fake before an owning setup scope, lack separate setup/action bounds, and can await request before close indefinitely; whole-test timeout does not own late roots/server/work. Install shared case/fixture ownership before acquisition and prove held/rejected work is drained through guarded removal.","file":"hub/test/digitalocean-pacing.test.ts","line":10},{"severity":"medium","text":"M2: close reports hookErrors only after shutdown/drain/process cleanup/rm; any earlier rejection masks the original beforeCreate assertion for teardown-only callers. Preserve that assertion as primary with cleanup failure secondary on every exit, retain incomplete roots, and add an assertion-plus-cleanup-rejection control.","file":"hub/test/fakes/digitalocean/fake-api.ts","line":432}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear at corrected930fa347df. Medium M1 pacing.test.ts:10: missing pre-acquisition owner and separate setup/action bounds allow late/unjoined work beyond whole-test timeout. Medium M2 fake-api.ts:432: earlier cleanup rejection bypasses hookErrors, replacing original assertion; retain primary plus secondary cleanup diagnostics and incomplete-root fence. Implementer confirmed both at pinned head775d1c1d. C1 failed; C2 census inspected but exact-head consumer verification remains pending (native T3 not run). Core observer, compatible500 shape, four migrated assertion callers and deliberate provider controls otherwise match spec. A-22848 records both axes/local-evidence limits. Fresh source review after correction required before configured verify; no reviewer runs/edits.

Criteria: C1 failed (New controls lack bounded setup/action ownership, and teardown cleanup rejection can still mask the original beforeCreate assertion.).

### impl-1994 · 2026-11-24T10:57:33.247Z

Review corrections underway on fixed base 930fa347d (no dev merge): M1 uses receiptFixtureCase before acquisition, per-step bounds, registered provider stop via onCleanup before directory removal, testContext root ownership during partial acquisition, cancellation, and positive native guard. New held-setup fault control drives its observer with an injected clock, then invokes actual ownDirectory guarded removal: refusal before provider closure, separate root stat receipt, successful drainage/closure/removal and closed admission receipt. M2 controls went red first: mutable original was replaced by Error('controlled root removal failure'); frozen original had undefined cause instead of original. Fix now reports the first hook error on cleanup rejection too, with enumerable suppressed diagnostics; mutable identity retained, immutable error uses matching message and cause. Existing wire 500 remains. New tests pass 32/32 locally on macOS Node 24.21.0; not configured verification. Rerunning affected T1 files before fresh lint/review.

### rev-40 · 2026-11-24T11:10:44.273Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-1994-source2
commit: 605e6590c67a8c5b7a37c07b1235d1253d6030e1
scope: full
findings: [{"severity":"medium","text":"M1-R: hookCase proxy cleanup remains unfenced; after original work joins, a rejected provider close/root guard still proceeds into checks/native-guard restoration despite incomplete provider drainage/root retention. Fence that same cleanup owner until positive closure/removal, and prove rejected-close retention/repair through its real guarded path.","file":"hub/test/digitalocean-pacing.test.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear at605e6590c, one residual medium M1-R pacing.test.ts:21. Named setup/action ownership now exists; real-context scope join precedes proxy cleanup, so my pending-acquisition ordering concern is withdrawn after correct WeakMap/proxy explanation ce3530c1. Remaining proxy cleanup is unfenced and restores native guard after failed provider close/root removal; retain seams/root through incomplete drainage and prove same-owner repair. M2 original-assertion preservation through cleanup rejection is addressed, including mutable/frozen controls. C1 failed; C2 current-head consumer receipts pending. A-22874 records correction strengths, exact remaining boundary and local evidence limits. No reviewer runs/edits; fresh source review before configured verification.

Criteria: C1 failed (Residual M1: post-join cleanup rejection can restore the native seam while provider closure is incomplete; hookCase requires fenced cleanup.).

### impl-1994 · 2026-11-24T11:13:50.076Z

Residual M1-R corrected locally: hookCase proxy opts into fenceFixtureCleanup. Same-hookCase owner control runs after original body joins, holds a provider writer, injects close rejection and proves native guard identity + independent retained-root receipt; repair retries the same proxy owner, confirms request completion/root removal and native restoration. Corrected control red first: actual [Function: spawn] vs expected [Function: mocked], then full pacing green 33/33 after fence. A-22875 has evidence if assigned by publication; see artifact chip for durable id. Typecheck/full lint queued sixth; no new source review or configured verify yet. Fake/production source and four consumer migrations unchanged from source2.

### impl-1994 · 2026-11-24T11:13:55.560Z

Correction to preceding evidence reference: the actual published artifact is A-22877, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22877-t-1994-same-owner-cleanup-fence-red-and-green.md. A-22875 was an erroneous provisional reference; use A-22877.

### rev-40 · 2026-11-24T11:45:05.808Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1994-source3
commit: e9d32d3506c4820fa9f577377ddcef4aecb49760
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at e9d32d350. Residual M1-R resolved: hookCase's actual proxy owner is fenced before provider acquisition, so failed resource/directory cleanup retains native seam until successful repair. Same-hookCase control proves admitted held writer, original body joined before cleanup, exact guard identity/retained root after rejected close, same-owner repaired close/request completion/root removal before restoration. Earlier setup/action bounds, late ownership and M2 original-error preservation retained; fake source/four checked consumer migrations unchanged. A-22894 records both axes/ownership/evidence limits. C1/C2 remain unverified pending exact-head configured consumer receipts, T3 included. A-22877 functional red/33green local report retained; malformed earlier draft excluded, no configured/native coverage inferred. No findings/reviewer runs/edits.

### impl-1994 · 2026-11-24T12:24:07.827Z

Exact-head configured receipt 0a4fd93d-4369-4ecc-8c28-b1d50a230611 / A-22925 at e9d32d3506c4820fa9f577377ddcef4aecb49760 (tree f8c010871de45a5e32eacda9ebc810bf69c096fc): exit 0, T0/T1/T2/selected T3/Web exit 0; 7619 tests, 7617 pass, 0 fail/cancelled, 2 platform skips. Droplet Linux x64 6.8.0-149-generic, Node 24.21.0, Neovim 0.12.5, c-8 nyc1, lifetime 2043 s, cost $0.1418. Browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing 156.0.8078.4. Parsed durable finish records apart from exit status: pacing 33/33, all nine named T-1994 controls passed base plus recorded 5/5 load repetitions each. Every beforeCreate consumer has a passing file receipt: accounting 26/26; safety-component 14/14; safety 17/17; remote-budget 19/19; demo-provisioning 2/2; demo 5/5; prepare-component 39/39; host-provider 89/89; close-recovery 4/4; remote-process 1/1; close 3/3; candidate-remote 1/1; executor-run 22/22; daemon 19/19. Close-component 18 pass + 1 macOS-selector skip; executor-droplet 13 pass + 1 macOS caffeinate skip (neither skip is a beforeCreate callback case). Skip-reason check report mode has missing=0. Duration advisories remain report-only, no speed claim. 27 selected T3/T4 files supplied 228 passing identities once; remaining T3 deferred to merge batch and other occasions. Reviewer receives same-head receipt automatically; final criteria/verdict settlement pending.

### rev-40 · 2026-11-24T12:24:13.163Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1994-final
commit: e9d32d3506c4820fa9f577377ddcef4aecb49760
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchangede9d32d350. Exact-head0a4fd93d/A-22925 finished/passed, canonicalf8c01087 executable match. All9new observer/drainage/intentional-error/primary-cleanup/late-setup/same-owner repair controls have structured base pass17008–17040 and distinct5/5load receipts; pacing33positive cases. All16beforeCreate consumer files have positive bases;4migrated assertion-bearing exact cases independently pass21909/32460/40609/41086, nativeT3 included. C1/C2 verified. T0/T1/fallbackT2/selectedT3/Web exit0;27processfiles228positive identities once, restT3batch/T4unexecuted;7617pass/2unrelated platform skips/0fail. Noncached Linuxx64c8nyc1 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4; budgets/lint advisory. A-22926 records named cases, consumer census/provenance/limits; prior incomplete draft excluded. No findings/reviewer runs/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T13:44:25.383Z

Merged 9b74cd0990529b09c06d2b3439864ca88300bc30 onto dev.
