---
id: T-690
kind: task
title: Retag every file the lint already qualifies as T1 or T2, and record the tier share baseline
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-676
blocked_by:
  - T-682
topic: topic-450
branch: t/T-690-retag-every-file-the-lint-already
created: 2026-10-16T19:59:28.837Z
updated: 2026-10-17T17:48:08.859Z
closed: 2026-10-17T17:48:08.859Z
---

## Summary

T-679 tags everything T3 except the seven free files, for safety. T-682's lint reports, per file, the lowest tier a file already qualifies for: a grep estimate puts about 15 hub files (~10 s) in T1 and 42 (~436 s) in T2 at today's `dev`, plus the Neovim files that use only the stub hub. Tagging them is the first measurable move of the tier share, and the share recorded here is the baseline E-677's exit and E-578 read (T-662 C3).

## What to build

Retag every hub file T-682 reports as T1- or T2-qualifying, and every Neovim stub-hub-only file as T2, in one manifest change. T1 files join the hermetic phase; T2 files stay in the machine phase, so no run loses coverage. Record the tier share of a full run at the head on this item and on the epic.

## Acceptance criteria

- [x] C1. Every file the lint reports as qualifying for T1 or T2 is tagged so, and the lint reports zero findings for T1 and T2 files, proved by the lint run at the head.
  - done: impl-690 · 2026-10-17T16:11:10.130Z
  - verified: rev-30 [reviewer] · run rev-20261017-690-source-correction · 2026-10-17T16:13:19.159Z · commit 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
  - verified: rev-30 [reviewer] · run rev-20261017-690-final · 2026-10-17T17:08:37.222Z · commit 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
  - verified: rev-30 [reviewer] · run rev-20261017-690-merge-delta · 2026-10-17T17:18:05.748Z · commit fb072ca422ba587c1f0634ae0051913c84d52a63
- [x] C2. A full droplet run at the head is green with the retagged T1 files in the hermetic phase.
  - done: impl-690 · 2026-10-17T17:06:23.141Z
  - verified: rev-30 [reviewer] · run rev-20261017-690-final · 2026-10-17T17:08:37.222Z · commit 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
  - verified: rev-30 [reviewer] · run rev-20261017-690-merge-delta · 2026-10-17T17:18:05.748Z · commit fb072ca422ba587c1f0634ae0051913c84d52a63
- [x] C3. The per-tier file counts, manifest seconds and T1+T2 share are recorded on this item and on the epic as the baseline.
  - done: impl-690 · 2026-10-17T16:11:10.736Z
  - verified: rev-30 [reviewer] · run rev-20261017-690-source-correction · 2026-10-17T16:13:19.159Z · commit 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
  - verified: rev-30 [reviewer] · run rev-20261017-690-final · 2026-10-17T17:08:37.223Z · commit 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
  - verified: rev-30 [reviewer] · run rev-20261017-690-merge-delta · 2026-10-17T17:18:05.748Z · commit fb072ca422ba587c1f0634ae0051913c84d52a63

## Comments

### impl-690 · 2026-10-17T16:00:30.903Z

Baseline dev b5cd8b4f merged. Scope clarified by Coordinator in topic-450: preserve all T4 purpose entries, explicit T3 headers and spoke-readiness (known WebSocketServer lint blind spot), plus leave eight T-741 files alone. C1 measures zero tier-resource findings in retagged files; existing wall-clock findings are debt for T-684. 46 files retagged (24 to T1, 22 to T2); local checks in progress. Test code remains unchanged.

### impl-690 · 2026-10-17T16:01:31.478Z

T-690 tier-share baseline (A-4606, durable /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4606-t-690-before-after-tier-baseline-retags-and-retained-exceptions.md). Origin/dev b5cd8b4f; duration source 42ebe8a0 / A-4565. Before: T1 31 files / 19.180411 s; T2 46 / 204.968503 s; T3 222 / 4358.592670 s; T4 6 / 83.888367 s. After 46 retags: T1 55 / 108.858931 s; T2 55 / 346.158215 s; T3 189 / 4127.724438 s; T4 6 / 83.888367 s. T1+T2 manifest share rises from 4.803229% (224.148914 s) to 9.750444% (455.017146 s), total 4666.629951 s. 305 files; suite-remote-log lacks a duration baseline, so its file is counted and seconds excluded consistently with suite reporting. Full-run evidence will follow after source review and verification hold release. All retained exceptions and 30 existing wall-clock debt lines are listed in A-4606.

### impl-690 · 2026-10-17T16:09:30.562Z

Corrected baseline after source review, superseding A-4606's original 46-retag result: A-4608 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4608-t-690-corrected-baseline-30-safe-retags-and-fixture-exceptions.md). 30 safe retags: 10 to T1, 20 to T2; 22 explicit lower-qualified exceptions, naming fixtures/resources. Before unchanged: T1 31 files/19.180411s, T2 46/204.968503s, T3 222/4358.592670s, T4 6/83.888367s. Corrected after: T1 41/44.279993s, T2 61/350.370445s, T3 197/4188.091146s, T4 6/83.888367s. T1+T2 224.148914s (4.803229%) → 394.650438s (8.456862%) of 4666.629951 manifest seconds. 305 files; suite-remote-log's missing duration excluded from seconds. Existing wall-clock debt remains 29 retagged lines + permissions' one. Coordinator decision 5681ace2 authorizes retaining actual transitive resource/timer cases despite syntax qualification. New exact-manifest local runs and source re-review will follow.

### rev-30 · 2026-10-17T16:09:47.954Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-690-source
commit: cd137387cb194422b63f3c2986f46fbd0410a84c
scope: full
findings: [{"severity":"medium","text":"M1: nine proposed T1 retags execute real sockets, child processes or native ownership probes through imported helpers: codex-native, opencode-native, demo-release-component, executor-prepare-retry, remote-scripted, duration-legacy, shared-defects-report, suite-candidate and suite-accounting. The syntax qualifier does not inspect these helper paths. Retain their prior tiers under the Coordinator's resource exception policy; do not move them into the hermetic phase.","file":"hub/test/tiers.json","line":56},{"severity":"medium","text":"M2: hook-bridge-doctor and verification-workers are real process/lifecycle integrations, not eligible T2 component tests. The former spawns three hook bridges and proves targeted PID death; the latter uses remote-fixture process mode with real spoke, shell and candidate workers. Retain both prior T3 tags.","file":"hub/test/tiers.json","line":96},{"severity":"medium","text":"M3: account-coalescing, journal-flush, lifecycle-serialization, roles-session-refresh and shared-defects retain unmocked real timer paths through frameClient deadlines, eventually polling or default HubCore/createHubBase scheduling. These are hidden from syntax qualification but violate the proposed T1 boundary; retain their previous tiers. roles-session-refresh mocks intervals, but eventually polling is still real.","file":"hub/test/tiers.json","line":11}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-690 source review — not clear

Head: cd137387cb194422b63f3c2986f46fbd0410a84c.
Fixed point: incoming dev61d7d5711e6fb98142cec4a2ec078436bf6c93c5.
Scope full. Read-only review; no Reviewer tests, compiler execution, edits or delegation.

## Standards
Three medium findings; all affect the new manifest assignments, not new test code.

M1 — hub/test/tiers.json:56 and related entries. Nine proposed T1 files cross real resource boundaries through imported helpers:
- codex-native / opencode-native: scripted-codex.ts:89/108 and scripted-opencode.ts:101/125 start projectHub and real socket peers.
- demo-release-component / executor-prepare-retry / remote-scripted: remote-fixture.ts:41–55 runs actual Git children; :86/90 serves projectHub and connects in-process spoke sockets even in machine:'scripted' mode.
- duration-legacy: its :12–18 gitIn function calls verdict-git.ts:14 execFile('git').
- shared-defects-report / suite-candidate: suite-fixture.ts:17/22 serves a real socket hub and spawns a spoke, with actual tiny candidate workers; suite-support.ts:19–26 also executes Git.
- suite-accounting: its calls pass accounting=true, preserving the real executor spend/lease lock backend (suite-unit-fixture.ts:58–72). spend.ts:29 takes acquireLockWithRetry, whose native acquisition probes process identity (lock.ts:324–327).
These are not hermetic T1 tests. Retain prior tiers rather than treating the import/call syntax qualifier as transitive purity proof.

M2 — hub/test/tiers.json:96 and273. hook-bridge-doctor:16–31 starts three real hook bridge processes, verifies doctor listing preserves them and --fix kills only the intended PID. verification-workers:58/105/163 invokes remote-fixture with default process machines; it exercises real candidate/shell workers and a held shell timestamp, not just in-process fake adapter component behavior. Keep both T3. T2's CLI-under-test allowance does not turn the additional owned process lifecycle into an in-memory fixture.

M3 — hub/test/tiers.json:11,111,122,170,190. Retain account-coalescing, journal-flush, lifecycle-serialization, roles-session-refresh and shared-defects at their prior tiers due to real timer scheduling hidden by helpers:
- account-coalescing injects FakeClock into its hub, but its frameClient requests still schedule unmocked setTimeout deadlines (harness.ts:553–558).
- journal-flush mocks only setTimeout; its default-clock createHubBase still creates heartbeat/prune intervals (core.ts:372, server.ts:127).
- lifecycle-serialization uses default-clock createHubBase plus eventually's Date.now/sleep(50) polling (harness.ts:740–750).
- roles-session-refresh does mock setInterval, so no unmocked interval claim is made for it; its eventually call still polls with real setTimeout.
- shared-defects constructs default-clock HubCore (:24/26/55), which schedules the real heartbeat interval.
No timer exemption is inferred from a clean direct-file lint report.

docs/agents/tests.md Test levels distinguishes T1 fake-clock/in-memory behavior from real sockets, children and time, and T2 component behavior from real process integrations. Coordinator's already-recorded spoke-readiness exception addresses the same limitation of the qualifier. The Implementer reports primary5681ace2 expands retention to actual forbidden resources in imported helpers; the concrete source paths above independently justify retention.

## Spec and evidence
The one-file diff is exactly46 existing tier values (24→T1,22→T2). Test bodies, imports, duration data, file coverage and manifest population are unchanged; no entry is removed or added. Existing retained six exceptions and eight T-741 files are preserved. The literal syntax-qualification sweep is implemented, but C1's eligible lower-tier set must exclude the sixteen resource/timer/lifecycle cases above. No verification is authorized on this head.

A-4607 raw logs were independently audited: all51 logs are positive,295 pass in total,zero fail/cancelled/skipped. They cover all46 changed files once, five whole suite-tiers runs and one extra unchanged spoke-readiness run. These are targeted local results, not the required full droplet/hermetic-phase proof. Typecheck/tiers/report-lint passes are supplied. lint-after.json has305 rows; changed entries have zero tier-resource findings but29 existing wall-clock findings (19 assertion,10 wait). Primary c71eed1a explicitly excludes that pre-existing wall-clock debt from C1; no new finding is raised for it. The newly found transitive resources above are distinct from those disclosed direct-file debt lines.

C3 arithmetic independently reproduces A-4606 using unchanged durations.json: before T1/T2/T3/T4 file counts31/46/222/6 and seconds19.180411/204.968503/4358.592670/83.888367; current proposed after55/55/189/6 and108.858931/346.158215/4127.724438/83.888367. Total4666.629951s; lower share4.803228804%→9.750444127%. suite-remote-log is the only missing duration, counted as a file and excluded from seconds. The E-676 Coordinator comment at16:01:55.816Z records the same baseline. These numbers are correct for this rejected manifest, but must be refreshed on both item and epic after the sixteen exceptions are restored; they are not an observed full-run timing or a final eligible-tier baseline.

C1 failed pending manifest eligibility correction. C2 remains unrun/unverified. C3's current arithmetic/recording is supported, but final baseline verification waits for the revised manifest. Preserve test code and assertions, restore prior tags for these sixteen entries, refresh exception/baseline evidence, and request new-head source review. Existing verification hold remains in force.

Standards:3 medium findings. Spec: lower-tier eligibility and final baseline need correction; no missing behavioral test claim or coverage reduction. Source not clear.

Durable source review A-4609.

Criteria: C1 failed (Sixteen proposed lower-tier entries still use forbidden real fixture resources, process lifecycles or timers through helpers; retain prior tiers and refresh eligibility/baseline before re-review.).

### rev-30 · 2026-10-17T16:13:19.159Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-690-source-correction
commit: 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-690 corrected source review — clear

Head9ab2c07e6c3c0e3451f3014d422a13b35f79fb33; fixed incoming dev61d7d5711e6fb98142cec4a2ec078436bf6c93c5. Prior rejected headcd137387. Scope full (source correction); read-only review, no Reviewer test execution.

## Standards
No remaining findings. The entire correction is sixteen tier values restored exactly to incoming dev, independently compared with M1–M3 in A-4609. No later dev merge, test code, assertion, duration, entry population or other file changes. The final manifest has30 retags:10T1 and20T2. The new T1 set is close-shards, executor-admission, fake-harness-capabilities, journal-subagents, mod-bridge, roles-editor, rulebook, suite-tiers, thread-seed-plan and tracker-container-source. Source inspection distinguishes those pure/in-process/filesystem paths from the real sockets, native children/locks and timer paths now retained.

All nine M1 resource cases, both M2 native lifecycle cases and five M3 timer cases retain their previous tiers. The explicit22 exceptions also include the original native T3 headers, purpose-based qa-shipped T4 and spoke-readiness/T-743. Other T4 entries remain untouched. T-744 tracks transitive fixture lint visibility; no missing scanner feature is silently treated as a resource exemption.

## Spec/evidence
C1 verified against Coordinator exception policy5681ace2 and wall-clock scope clarificationc71eed1a. A-4611 lint.json contains305 rows. Every candidate qualifying T1/T2 is either among the30 retags or22 documented exceptions. Changed entries have zero tier-resource findings;29 existing wall-clock findings remain (19 assertion,10 wait), explicitly excluded from this manifest-only criterion and listed in A-4608. Existing eight T-741 files are unchanged.

A-4611's34 raw local logs independently show225 passes,zero failures/cancellations/skips: all30 changed whole files once, plus four additional suite-tiers runs (five total). The suite-tiers fixture includes frozen legacy/live plan assertions, and static typecheck/tier/report-lint receipts are supplied. Final report lint is329 findings in187 files, report-only. These local receipts do not establish C2 or a full hermetic phase.

C3 verified: independently recomputed unchanged duration data exactly matches A-4608. Before T1/T2/T3/T4 counts31/46/222/6 and seconds19.180411/204.968503/4358.592670/83.888367. After41/61/197/6 and44.279993/350.370445/4188.091146/83.888367. Total4666.629951 seconds across305 files; suite-remote-log has no timing and is counted only as a file. Lower-tier manifest share4.803228804%→8.456861636%, lower seconds224.148914→394.650438. The item correction and Coordinator's E-676 comment at16:10:20.206Z both supersede the old46-retag baseline. This is manifest accounting, not observed full-run wall time.

Source clear, C1/C3 verified; Standards0/Spec0 findings. C2 remains unchecked/unverified pending the normal mode-free exact-head droplet result, which must run full and show the retagged T1 entries in the hermetic phase. Source clearance does not lift the Coordinator's verification submission hold. No per-item QA requirement.

Durable review A-4612.

Criteria: C1 verified, C3 verified.

### impl-690 · 2026-10-17T17:06:23.443Z

Final verification evidence at unchanged source-cleared 9ab2c07e: droplet run 60db9eb8-c610-4ae0-8d1d-a17167317657, A-4639 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4639-suite-60db9eb8-c610-4ae0-8d1d-a17167317657-auto-at-9ab2c07.log) green; 2099 pass/0 fail/5 prerequisite skips, 0 cancelled. Linux x64, Node v24.21.0, Neovim v0.12.5, c-8 lon1, 2 machine workers, 1816s lifetime/$0.1261. T1 hermetic phase serial: 41 files/174 tests, observed test-seconds 14.301s, phase wall25.48s. Hub machine1698.35s, Neovim smoke22.13s. Normal mode-free selection was hub-only + Neovim smoke because tiers.json is outside nvim/; Coordinator d118b27a accepted this run for C2 and directed done. All12 retagged Neovim files already passed locally at final manifest (A-4611). Full-manifest baseline remains A-4608: T1+T2 8.456862%; this narrower selection reports7.902% of4337.353s. T3 ratchet4188.091s vs4358.593s base. New-tier report-only budget overages tracked as T-745 (inbox-workload, tracker-container-source, roles-snapshot, suite-tiers, merge-policy), not a blocker by Coordinator decision. C1/C2/C3 marked done; final same-head review evidence requested.

### impl-690 · 2026-10-17T17:06:38.427Z

Coordinator explicit C2 decision 339687cc (2026-10-17T17:06:30Z): C2 is met by exact-head diff-selected run60db9eb8/A-4639 (all hub including T1 hermetic plus Neovim smoke) together with A-4611's local green runs of all12 retagged Neovim files. D29/D53 reserves verify all to Coordinator; the first integrated cover after merge supplies full Neovim phase with new tags and Coordinator will record that run on T-690. No additional task-head run required.

### rev-30 · 2026-10-17T17:08:37.223Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-690-final
commit: 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-690 final same-head evidence review — clear

Reviewed head 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33 remains the branch tip. Current full source correction rev-20261017-690-source-correction / A-4612 verifies C1/C3 with no remaining findings. The manifest-only source, tests and duration data are unchanged. Task view confirms C2 claimant done and passed exact-head droplet run 60db9eb8-c610-4ae0-8d1d-a17167317657. Read-only evidence review; no Reviewer test execution.

## C2 accepted coverage
Primary Coordinator decision 339687cc-ddc8-4a1f-b7c5-fd3dd9c7d62d at 17:06:30Z was read directly in topic-450. It explicitly accepts this normal diff-selected hub run with its T1 phase and Neovim smoke together with the local final-manifest runs of all twelve retagged Neovim files. It reserves the full Neovim package at the new tags for the first integrated cover after merge, which the Coordinator will record on T-690. No additional task-head all run is required. This is the recorded disposition of C2's literal full-run wording, not a claim that A-4639 executed full Neovim.

A-4639 raw receipt independently finishes exit 0. Host npm run check/typecheck/report-only lint then phases:
- Hub hermetic serial: 41 files, 174/174 passing tests, zero failure/cancellation/skip; 25.48s wall, one worker, resource free. The 174 positive timing records precede the free-phase boundary. All ten newly retagged T1 files are present there: close-shards, executor-admission, fake-harness-capabilities, journal-subagents, mod-bridge, roles-editor, rulebook, suite-tiers, thread-seed-plan, tracker-container-source.
- Hub machine: 1918 tests, 1913 pass, zero failures/cancellations, five unrelated prerequisite skips.
- Neovim smoke: 12/12 passed, zero failure/cancellation/skip.
Total 2104 tests / 2099 passed / 0 failed / 0 cancelled / 5 skipped. All eighteen retagged hub files have actual positive timing receipts. Every six reported load-gated identities passes 5/5; no partial gate or hard duration failure.

A-4611 local final-manifest evidence was already audited for source; the twelve retagged Neovim raw logs were checked again: account-poll, events, explorer-summary, graph, inbox-actions, inbox-sections, session-archive, session-resume, ui, vboard, verification-queue and verification-view total 68/68 passed, zero failures/cancellations/skips. These are local runs, distinct from Linux smoke, and form the second part of the explicit accepted C2 coverage.

## Baseline and disclosed follow-up
C1/C3 remain current under the primary exception policies recorded in A-4612: thirty resource-safe retags, twenty-two explicit retention exceptions and pre-existing wall-clock debt excluded from the manifest-only resource criterion. New-tier budget overages are report-only and explicitly tracked by the Coordinator as T-745 (inbox-workload, tracker-container-source, roles-snapshot, suite-tiers and merge-policy); they are not silently treated as performance compliance.

Full-manifest baseline remains A-4608 and the corrected item/epic record: T1/T2/T3/T4 counts 41/61/197/6; seconds 44.279993/350.370445/4188.091146/83.888367, total 4666.629951s. Lower share is 8.456861636%, from 4.803228804%. The selected run's 7.902% of 4337.353s is a narrower selection population, not a replacement baseline. Missing suite-remote-log duration remains explicitly named. No baseline rewrite.

Supplied executor accounting: Linux x64 6.8.0-142-generic, c-8 lon1, Node24.21.0 / Neovim0.12.5, two machine workers, lifetime 1816s, cost $0.1261. Suite 1745.98s, peak one-minute load 8.59, load-gate extra wall 1.63s; machine 1698.35s and smoke 22.13s. T3 ratchet 4188.091s versus base 4358.593s. All five suite skips concern macOS-only or absent real OpenCode prerequisites.

Final evidence clear under the explicit C2 disposition; findings []; all C1–C3 verified across source and this evidence. Full Neovim integrated-cover obligation remains with the Coordinator. No per-item QA; no further task run requested. Standards: 0 remaining findings. Spec: 0 remaining findings under the recorded disposition.

Durable review: A-4641.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-690 · 2026-10-17T17:14:10.417Z

Authorized conflict-only dev merge a038ae0b completed/pushed asfb072ca422ba587c1f0634ae0051913c84d52a63 (reviewed parent9ab2c07e, incoming dev55fde1ac). Only conflict tiers.json; all30 own retags exactly preserved, all other entries/tags verbatim dev, sorted; no retagged test source changed on dev. test:tiers/test:lint passed; suite-tiers5/5 (0.633/0.596/0.618/0.659/0.555s). A-4646 durable evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4646-t-690-conflict-only-dev-merge-exact-30-retags-and-phase-checks. A-4608 share8.456862% and seconds unchanged; new dev5 files without duration data make counts43/64/197/6,310 total. Conflict-only delta review requested. Coordinator explicitly preserves verification60db9eb8 and requires no task verify rerun; first integrated cover after merge supplies full phases. Budget follow-up T-745.

### rev-30 · 2026-10-17T17:18:05.748Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-690-merge-delta
commit: fb072ca422ba587c1f0634ae0051913c84d52a63
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-690 conflict-only merge delta — clear

New head fb072ca422ba587c1f0634ae0051913c84d52a63, parents reviewed 9ab2c07e6c3c0e3451f3014d422a13b35f79fb33 and incoming dev 55fde1ac66c63962a0a371402d946e414618d0d4. Branch tip confirmed. Primary Coordinator a038ae0b-c32e-43de-b8ee-aac45055f459 was read directly: this rule11 conflict merge is authorized, exactly thirty retags must be retained, all other incoming entries preserved, and no verify rerun is required. Earlier exact-source receipt 60db9eb8 stands; integrated cover follows merge.

## Standards
No findings. Independent three-way structural comparison proves:
- relative to incoming dev, the only changed file is hub/test/tiers.json;
- same entry population, exactly thirty reviewed value substitutions and no additions/removals;
- every non-retagged entry and descriptor equals incoming dev;
- every retag equals reviewed 9ab2c07e and entries remain sorted;
- all thirty retagged test bodies are byte-identical to reviewed 9ab2c07e.
Inherited source/fixture changes are verbatim dev; no manual implementation change exists outside the manifest. Incoming configuration/process-cleanup seams improve injected/native probe separation; suite-unit's default provider behavior remains unchanged when its new receipt-only option is omitted. Earlier C1 exception/resource review remains applicable; this is not a new syntax-only automatic downgrade.

A-4646 supplies green test:tiers (43 free hub /229 machine), report-only lint (323 findings /182 files), and five whole suite-tiers logs independently showing 8/8 each, forty passes, zero failures/cancellations/skips. All ten new T1 paths still qualify T1 in the supplied lint. No retagged body was changed by dev, matching the Coordinator's conditional reader-run requirement. The incoming native-process.ts blank EOF is inherited byte-for-byte, outside the own resolution; no own whitespace change.

## Spec / freshness
C1 refreshed at this merged head: the exact thirty eligible retags and twenty-two retained resource/purpose exceptions are preserved. T-744 remains the transitive-lint follow-up; no resources are waived by a clean syntax qualifier.

C2 refreshed under the explicit no-rerun merge disposition, carrying A-4639 and final A-4641 rather than falsely claiming a new merged-head Linux receipt. Original exact-source green run had all ten new T1 files in 41-file/174-test hermetic phase, all eighteen retagged hub files executed, and Neovim smoke green. A-4611's twelve local Neovim files total68/68 green. Primary339687cc's full-Neovim integrated-cover obligation remains with the Coordinator; a038ae0b explicitly retains these receipts across this conflict-only merge.

C3 arithmetic independently recomputed from merged manifest and duration data. Incoming dev adds five untimed files, so final population310 and counts T1/T2/T3/T4=43/64/197/6, versus incoming33/49/222/6. Seconds remain44.279993/350.370445/4188.091146/83.888367, total4666.629951s. Lower share8.456861636% remains unchanged from A-4608; it is not a new observed runtime metric. Timing source/files/tests are structurally unchanged from the reviewed branch. Six missing duration files are explicitly named in A-4646 and independently reproduced: demo-cap, executor-run-rules, project-probes, suite-close-component, suite-remote-log and suite-stage-rules. Original A-4608 item/epic baseline is historical at305files; A-4646 records the incoming-dev and merged population increment with unchanged share.

Earlier final A-4641 and source A-4612 still support all unchanged behavior/resource claims. Budget debt remains T-745. No per-item QA. Delta clear, findings[], all C1–C3 freshness verified at fb072ca4 under the primary retained-evidence disposition. No additional task verification requested. Standards0/Spec0 findings.

Durable review: A-4653.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-17T17:48:08.859Z

Merged a1fb7a242913baba0ba4db9105779570a96820e0 onto dev.
