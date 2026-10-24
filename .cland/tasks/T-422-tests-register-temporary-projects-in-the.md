---
id: T-422
kind: task
title: Tests register temporary projects in the real host executor ledger
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-936
branch: t/T-422-tests-register-temporary-projects-in-the
created: 2026-10-14T16:43:00.822Z
updated: 2026-10-24T08:47:45.033Z
---

## Summary

The host-wide executor ledger `~/.cland/executor/spend.json` lists 24 projects. Most are temporary test projects (`$TMPDIR/cland-proj-*`, `cland-t347-real-*`, `/private/tmp/q384-*`), and one entry is `/`. Every sweep reads leases from every listed project (`hostLeases`, `hub/src/executor/droplet/spend.ts:62`). So tests leak into the human's real ledger, and the list only grows. This was read on 2026-10-14 16:42Z while answering E-271 QA.

## What to fix

- Tests that touch the executor point the ledger at a scratch path, never the real `~/.cland`.
- `rememberProject` refuses `/` and other non-project roots.
- The sweep drops a registered project whose directory no longer exists, after a grace period, instead of reading it forever.

## Acceptance criteria

- [x] C1. A full suite run leaves `~/.cland/executor/spend.json` `projects` unchanged.
  - done: impl-422 · 2026-10-24T08:46:38.455Z
- [x] C2. `rememberProject('/')` is refused, and the ledger never lists `/`.
  - done: impl-422 · 2026-10-24T07:53:42.861Z
- [x] C3. A registered project whose directory is gone is pruned from `projects` by the sweep, with an event naming it.
  - done: impl-422 · 2026-10-24T07:53:42.964Z

## Comments

### impl-422 · 2026-10-24T07:45:54.788Z

TDD receipts on local macOS working tree: C2 failed accepting `/`, then passed with pre-write validation. C3 failed retaining missing project after 24h, then passed with persisted grace/reset, write-through prune event, accounting preserved. C1 suiteUnit partial options.env reproduced writes to both primary and legacy ledgers under a hostile scratch HOME; sealed env layered after options fixes it. projectHub hostile scratch HOME/XDG/override snapshot also passes. No real HOME state modified.

### rev-32 · 2026-10-24T07:57:49.349Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-422-source
commit: 5ae37b6b50860c1ab9037a83e5257f824cff8aff
scope: full
findings: [{"severity":"medium","text":"M1: options.env XDG_* extras overwrite fixtureEnvironment's scratch defaults; its final seal resets HOME/Git but not XDG. Force/validate final fixture-owned XDG paths and cover hostile explicit overlays, retaining accounting/snapshot assertions.","file":"hub/test/suite-unit-fixture.ts","line":101}]
finding_counts: {"high":0,"medium":1,"low":0}

T-422 full source review — not clear
Replacement head 5ae37b6b50860c1ab9037a83e5257f824cff8aff; tree 63aba510686711af83b2a20c554c60b6e1816290. Supersedes requested 8d3da20c. Fixed point 77a306bfbabdd509fd6836301dfe5aa8ca93ec4f (the dev parent of pre-review merge 2e518053); inspect git diff --no-ext-diff --no-textconv 77a306bf...5ae37b6b --. Includes original implementation, pre-review dev merge and final stopped-project/startup regression additions.

## Standards
M1 (medium), hub/test/suite-unit-fixture.ts:101–104: final fixture env is positioned after ...options, but arbitrary options.env is passed into fixtureEnvironment's extra overlay. That builder sets XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_STATE_HOME and XDG_CACHE_HOME before applying extra; its final hard seal resets HOME and Git and filters credentials, but does not reset XDG_*. Consequently explicit options.env XDG values escape the owning suiteUnit root. CLAND_EXECUTOR_STATE is correctly forced local; that does not seal the other filesystem profiles. This violates rule15 and Coordinator bc930fc5's explicit requirement that HOME/XDG_*/executor state always remain scratch-owned.
The new regression poisons ambient process.env but its options.env contains only a provider token/poll control. It does not exercise explicit XDG overlays. Force/validate the fixture-owned final XDG paths and add a hostile explicit-overlay control using only scratch sentinel directories. Retain the actual accounting completion, nonempty fixture ledger, ambient primary/legacy snapshot and override absence assertions.
No other source findings. No smell finding. Test changes otherwise use classified T1/T2 seams, fake clocks, scratch machine/HOME and injected providers/process identities. Directory renames have no live writer; close precedes cleanup/snapshots. Suite persistence reopening now retains scratch root/env. No real installer/provider operation is introduced.

## Spec
C1 remains blocked by M1. Coordinator f248e85e explicitly reconciles merge evidence to approved hostile scratch HOME/XDG/legacy regressions around real ledger activity, suiteUnit partial-env, projectHub, suite-persistence and a fresh configured mode-free task receipt. The literal full-suite real-ledger projects-count comparison is Coordinator-owned local macOS stage landing evidence, not a pre-merge condition. Do not call a T0–T2/Web task receipt a full-suite run.
C2 source looks sound: before a ledger write, rememberProject canonicalizes paths and refuses filesystem roots/HOME including aliases, missing/relative/file/non-cland paths. Valid aliases register once. Sweeps apply the same validation to invalid legacy registrations.
C3 source looks sound: missing observations persist across restarts; 24h grace resets on return; unreadable errors defer; pruning writes primary/legacy before emitting executor-project-pruned and retains entries/reservations. Tombstones exclude retained accounting roots from hostLeases scans while missing; valid returning roots rejoin projects before provider cleanup, and rememberProject removes the old marker. Last tests explicitly retain initialized projects without hub discovery/lock past48h and re-register a seeded pruned root at projectHub startup.
The docs/help/per-test notes match the registry behavior; implement skill uses its existing metadata.changes=CHANGES with the matching entry. No role grants change.

Evidence: A-10443 reports six local macOS arm64 targeted files, 58 tests, and check pass with test lint report-only/132 findings/zero refusals. Replacement request reports executor-spend20/20 and account-fixture-env5/5; final check was still running. These are supplemental summaries with working-tree provenance, not configured suite/Linux evidence; no verification has run. Preserve original tool/stdout/exits/timing with source attribution, without reruns solely for transcription. No criterion verified by this source pass; fail C1 only for M1, leave C2/C3 runtime pending. qaPolicy none/after-stage, no QA brief.
Reviewer read source/Git/docs/artifacts only, no tests, browser, edits, installer, live ledger mutation or delegation. Both review axes completed in-session.
Standards: one medium finding. Spec: C1 blocked by M1; C2/C3 source paths accepted, execution pending.
Durable audit A-10464: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10464-t-422-full-source-review-at-5ae37b6b.md

Criteria: C1 failed (suiteUnit's explicit options.env XDG_* overlays can escape the fixture-owned scratch paths; regression covers inherited environment only.).

### rev-32 · 2026-10-24T08:00:19.343Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-422-source-2
commit: 9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-422 corrected full source review — clear
Head 9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0; tree 2af3f1b903abfebf383d5b8d6a4327531cccabd9; sole parent 5ae37b6b50860c1ab9037a83e5257f824cff8aff. Three-file correction, no dev merge. Full accepted original source scope is documented in A-10464; this pass audits its complete M1 correction.

## Standards
No outstanding findings. M1 resolved: suiteUnit removes caller XDG_* option extras before fixtureEnvironment establishes the fixture's XDG paths. HOME/Git reset in the shared builder and forced local executor state remain; the sealed env still follows the final options spread. Arbitrary provider/account credentials are filtered before the explicit injected synthetic provider is restored.
Both partial and hostile explicit-path controls now assert HOME and all four XDG owners, then exercise real accounting to completion, assert nonempty fixture ledger entries, stop the writer and retain the before/after primary/legacy scratch HOME snapshot and absent inherited override assertions. Hostile paths are scratch-owned. The matching per-test note describes the final layering. No production registry/accounting source changed and no new native process/provider operation was introduced.

## Spec
No outstanding findings. C1's explicit-overlay gap is closed; other approved isolation seams (projectHub/pruned startup and suite-persistence reopening) remain unchanged. C2 validation and C3 persisted grace/pruning/restoration/accounting behavior remain accepted as reviewed in A-10464. Stopped initialized projects continue to survive without a running hub.
Coordinator f248e85e accepts the scratch-ledger proofs plus fresh configured mode-free task receipt for pre-merge C1. The real-ledger projects-count before/after a full local macOS stage cover remains Coordinator-owned landing evidence, not a pre-merge condition; no T0–T2/Web receipt will be called full-suite proof.
All C1–C3 claimant done marks are current. Execution-dependent verification remains pending the post-source configured mode-free receipt at this exact head, so no verified criterion is asserted now. qaPolicy none/after-stage, no per-item QA brief.

Supplemental request evidence: local macOS arm64 affected suite-accounting + executor-run-rules25/25 and npm run check pass, test lint report-only132 findings/59files/zero refusals. Earlier six-file59/59 remains attributed to 5ae37b6b. These are targeted/local summaries, not configured/Linux or full-suite evidence. Preserve original command/stdout/exit/timing attribution without transcription reruns.
Reviewer performed source/Git/docs reads only; no tests, probes, installs, browser, edits, live ledger changes or delegation.
Standards: 0 outstanding findings. Spec: 0 outstanding findings.
Durable audit A-10466: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10466-t-422-corrected-source-review-at-9a10dabe.md

### rev-32 · 2026-10-24T08:26:03.845Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-422-evidence-1
commit: 9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0
scope: evidence
findings: [{"severity":"medium","text":"M2: configured executor integration coverage fails/stalls: admission cleanup and held-provider cancellation fail; shared-cap test times out and worker cleanup hangs. Diagnose narrow sealed cases and retain safety/cancellation/zero-reservation assertions and bounds; root cause not established by partial log.","file":"hub/test/executor-admission-lock.test.ts","line":81}]
finding_counts: {"high":0,"medium":1,"low":0}

T-422 configured evidence review — not clear
Source-reviewed head 9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0; tree 2af3f1b903abfebf383d5b8d6a4327531cccabd9. Configured mode-free run f947dbf4-5163-4409-873e-b593b8811365, raw log A-10520. Overall exit124: “stalled: no output for 10 min”.

Actual failure receipts before classification:
- A-10520:6679–6681: assertion failures drain acquisitions asleep on either admission lock — outcome fail, 0.1374851s, followed by “✖ assertion failures drain acquisitions asleep on either admission lock”.
- A-10520:9862–9864: two protocol projects reserve against one cap and confirmed release replaces the reservation — timedOut:true, outcome cancelled, 240.001207343s.
- A-10520:9865: cancelling while provider sizes are held joins reservation before reporting and leaves zero reserved spend — outcome fail, 120.200249365s.
Final watchdog says the safety test/file remains stuck and the suite-close file remains in flight. Worker end-of-file assertion stacks are absent from this interrupted log; no specific assertion value or root cause is fabricated.

## Standards
M2 (medium), hub/test/executor-admission-lock.test.ts:81 (also executor-safety-component.test.ts:356 and suite-close-component.test.ts:235): configured executor regression coverage fails/stalls, so the new sweep/isolation behavior is not yet integration-safe. Reproduce these narrow cases at sealed scratch/injected seams, identify the actual failure and restore their existing safety/cancellation/zero-reservation receipts and cleanup. Source inspection identifies new sweep/ledger-lock work as an audit target, not an established diagnosis. No evidence warrants an unchanged-head flaky retry, relaxed bounds or assertions, native provider calls or a shared-infrastructure classification.
M1 remains source-resolved at9a10dabe. The new targeted isolation and registry cases pass in the observed phases; their success does not clear the unrelated integration failures.

## Spec
C1 fails the pre-merge requirement for a green configured mode-free task receipt under Coordinator f248e85e. Earlier approved scratch-ledger proofs remain valid but cannot replace the failed receipt. C2/C3 receive no final verification marks from this failed partial pass. The literal real-ledger/full local macOS stage comparison remains Coordinator-owned landing evidence, with no real-HOME mutation by Reviewer.
Fix requires fresh source review before another run if head changes.

Observed scope: Linux x64 6.8.0-142-generic c-8 lon1 cland-v0-5a48355b, Nodev24.21.0/Neovimv0.12.5, workers2. T1 exit0, command62s/shard57.42s, executor794pass. Hub T2 partial, Neovim/Web unrun; T3/T4 unrun/deferred. Independently parsed test finishes:1842 ordinary passes,2 ordinary failures,1 timed-out cancellation,40 passing load-gate finishes. Hub completed-before-interruption aggregate1884 =1842pass+40loadpass+2fail, excluding that cancelled/in-flight test. The headline794passes only covers completed T1, not the interrupted overall run. Later projected times are not runtime.
Hostcheck gate39c54baccc526579a7600d7909fdba1b33faa99b reused/not repeated remotely. Generic lint/timing/ratchet diagnostics report-only,132findings/59files,1missingbaseline; no overall pass, duration or coverage claim. Droplet lifetime1174s/cost$0.0815; CPU iowait/steal unavailable, not zero.
Reviewer read source/logs/Git only, with no tests, edits, installs, browser, live-ledger changes or delegation. qaPolicy none/after-stage.
Standards:one medium evidence blocker. Spec:C1 failed; no final criterion verified.
Durable audit A-10524: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10524-t-422-failed-and-stalled-configured-evidence-at-9a10dabe.md

Criteria: C1 failed (Required configured mode-free run f947dbf4 exits124 after two T2 failures and a timed-out/hung shared-cap case; later phases unrun.).

### rev-32 · 2026-10-24T08:40:25.036Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-422-source-3
commit: 0a403c821ed841813d7661a950ed1859b7e3ba03
scope: full
findings: [{"severity":"medium","text":"M3: raw t.after hooks here and line148 are outside scratchMachine's earlier resource-before-directory ownership hook. Failure/cancellation can remove the root before releasing/draining a live sweep writer. Register owned cleanup before starting sweep; retain completion and unchanged-ledger assertions.","file":"hub/test/executor-spend.test.ts","line":121}]
finding_counts: {"high":0,"medium":1,"low":0}

T-422 M2 correction source review — not clear
Head0a403c821ed841813d7661a950ed1859b7e3ba03; tree4d36711a80015b2ef406370f00b45af66f91522f; sole parent9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0. No dev merge. Accepted original/M1 source scope A-10464/A-10466 carried; failed configured A-10520/A-10524 remains failed/partial.

## Standards
M3 (medium), hub/test/executor-spend.test.ts:121 and148: both new held-ledger tests register raw t.after cleanup after scratchMachine has already installed process-cleanup's ownership hook. That ownership hook runs resources/hubs/directories/checks (process-cleanup.ts:58–64); the newly added hook does not join its resources/hubs phases. On failure/cancellation the registered directory removal can precede the later hook that releases the holder, advances the fake clock and awaits the live sweep writer. This violates rule12 and contradicts the new documentation's failure-cleanup guarantee.
Register lock/executor/sweep drainage with onCleanup or beforeDirectories before starting the sweep; preserve safe release/abort order, completed sweep receipt and final ledger-byte/registration assertions. Drainage must still run for failure/timeouts before the scratch directory is removed. Do not rely on the normal success path having already completed.
No other source findings. New production timing is otherwise sound: one timing object carrying clock/wait/process table reaches both migration load and registry transaction; DropletExecutor supplies its existing abortable #wait. Shutdown can reject a held retry without acquiring the foreign holder's ledger. No validation, reservation/tombstone/accounting or credential policy was loosened.
Admission setup now observes the flushed durable executor-sweep record with zero failures before acquiring its own held lock. The observer's bounded polling reads persisted history; because it can read the completed receipt after publication, it cannot miss a frame. Original contention/cancellation/zero-resource assertions remain. Matching per-test notes/index use valid repository .test.ts headings. No independent smell finding.

## Spec
C1 remains blocked by M3's unsafe failure cleanup in the new integration proof. M2's missing wait/clock pairing and status-as-startup-receipt causes are source-resolved, subject to runtime revalidation. C2/C3 source behavior remains accepted; no final criterion verification now. All claimant done marks current.
Coordinator f248e85e's pre-merge C1 scope remains approved scratch-ledger proofs plus fresh configured mode-free receipt; full local stage/real-ledger count comparison is separate Coordinator-owned landing evidence. Coordinator03b17a54 additionally requests scratch1159-project initial lock-hold measurement in the ready report; no such timing is claimed here.

A-10549 explicitly retains the failed Linux/partial raw provenance, sealed local baseline comparisons and precise diagnosis: held-ledger control timed out2000ms before injecting the wait; later control green31ms, original shared-cap file12/12; admission setup reproduction “another hub holds the project's lock” atoldline37. New local macOS correction-tree admission4/4, suite-close9/9, safety12/12, spend23/23 and check pass (report-only lint132/59, zero refusals) are supplemental local summaries, not a configured/Linux pass. No fresh configured run has occurred.
Reviewer source/Git/docs/artifact reads only, no tests, edits, browser, installs, live ledger change or delegation. qaPolicy none/after-stage. Fix M3, preserve original output attribution without transcription reruns, and request fresh source review before verification.
Standards:one medium finding. Spec:C1 blocked by M3; C2/C3 execution pending.
Durable audit A-10556: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10556-t-422-m2-correction-review-at-0a403c82.md

Criteria: C1 failed (New held-ledger proof cleanup is outside resource-before-directory ownership, allowing live sweep writers during fixture removal on failure.).

### rev-32 · 2026-10-24T08:47:45.033Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-422-source-4
commit: 5c0f0527aebf63314ad35ff9ea743e1d077feee1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-422 M3 corrected full source review — clear
Head5c0f0527aebf63314ad35ff9ea743e1d077feee1; tree99ebc4f62f722717e67b9b6fe83ce5a93058dc8b. Corrections ff7802fd and5c0f0527 since source-reviewed0a403c82; no dev merge, no production delta. Carry A-10464/A-10466/A-10556 accepted source scope.

## Standards
No findings. M3 resolved: the three held-registry controls now register onCleanup resources before assigning/starting their sweep promises. Holder release, fake-clock retry progression, sweep drainage and executor closure therefore precede scratchMachine's owned directory removal, including failure/cancellation. The normal completion/registration/unchanged-holder-ledger and deferred-sweep assertions remain.
The controls moved intact into existing T2 executor-admission-lock.test.ts because process-cleanup's ownership helper belongs at that admitted component seam. No tier guard exemption or new process is introduced. T1 spend validation/grace/accounting tests retain their classification and assertions. Matching notes move with the tests; their heading/index links remain correct.
M2's injected abortable timing and durable startup sweep receipt are unchanged. M1's final XDG ownership seal remains. No validation, accounting, grace, reservation, cancellation or cleanup assertions were weakened. No independent smell finding.

## Spec
No outstanding source findings. C1–C3 are implementation-done but all verification remains pending a fresh configured mode-free receipt at this exact head. Existing A-10520 remains failed/partial and is not replaced by local targeted checks. Coordinator f248e85e's real-ledger/full local stage before-after comparison remains separate landing evidence, not pre-merge C1.
Coordinator03b17a54's1159-project lock timing request is addressed in A-10565/A-10560: sealed scratch-ledger program/source reviewed, source0a403c82 with identical production at5c0f0527, local macOSarm64 Node24.21.0, one measurement on1,159registrations (1,156missing,2valid,1invalid root), primary/legacy write-through. Reported registry wall139.989333ms; maxcontinuous primary84.647209ms, totalprimary120.626043ms over two acquisition intervals. This is instrumentation from successful lock-file link to completed removal, not whole-hub startup, concurrent-hub guarantee, Linux timing or suite evidence. Permission to infer spare acquisition headroom does not create a measured startup result.

Local request evidence: admission7/7, spend20/20 and npm run check pass (test lint report-only132/59/0refusals). Earlier safety12/12 and suite-close9/9 retain M2 production-tree attribution. The rejected intermediate T1 ownership import was corrected by moving controls to T2; no guard bypass. Preserve original raw output/exit/timing/source attribution without transcription reruns.
No configured verification yet at5c0f0527. qaPolicy none/after-stage, no brief.
Reviewer performed read-only source/Git/docs/artifact checks, no tests, probes, installs, browser, live-ledger mutations or delegation; both axes completed personally.
Standards:0 findings. Spec:0 findings.
Durable audit A-10571: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10571-t-422-m3-corrected-source-review-at-5c0f0527.md
