---
id: T-505
kind: task
title: "session-events and session-model tests: 5000 ms frame waits after a launch miss on a loaded droplet"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-344
branch: t/T-505-session-events-and-session-model-tests
created: 2026-10-15T15:16:05.074Z
updated: 2026-10-16T02:36:33.940Z
---

## Problem

Two 5000 ms frame waits after a launch failed on Linux in T-495's droplet verify d6e75622 (A-3101):
- `hub/test/session-events.test.ts:84`, the process-rows case, where no frame matched within 5000 ms after the launch/model/role/rename flow;
- `hub/test/session-model.test.ts:146`, 'live resume journals its own launch model', also no frame within 5000 ms.
Both wait on a hub frame after a fake-session launch. A 4-worker c-8 under load can take longer than 5 s to deliver it.

## Acceptance criteria

- [x] C1. Each wait is anchored to an observed launch completion, such as the session's ready or idle, before the 5000 ms frame window starts. Alternatively, the window is aligned with the product deadline it covers, citing its source line. Every other assertion stays, and the root cause is recorded in the commit.
  - done: impl-505 · 2026-10-16T00:58:55.784Z
  - verified: rev-30 [reviewer] · run rev-20261016-505-source-correction · 2026-10-16T00:59:44.371Z · commit 383321846c7916d84937bb242c88f94683df0c3a
  - verified: rev-30 [reviewer] · run rev-20261016-505-manifest-delta · 2026-10-16T01:30:00.006Z · commit 9fe0b61cf827e296a15eda5ed7b712a0b798015e
  - verified: rev-30 [reviewer] · run rev-20261016-505-final · 2026-10-16T02:36:28.135Z · commit 9fe0b61cf827e296a15eda5ed7b712a0b798015e
- [x] C2. Both files pass 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-505 · 2026-10-16T02:33:38.750Z
  - verified: rev-30 [reviewer] · run rev-20261016-505-final · 2026-10-16T02:36:28.135Z · commit 9fe0b61cf827e296a15eda5ed7b712a0b798015e

## Comments

### impl-505 · 2026-10-16T00:24:33.659Z

Reproduced the exact session-events 5000 ms frame timeout by temporarily setting fakeClaude turnMs to 5500 (single process-rows test: 0/1, no frame matched within 5000ms). session.launch admits before the role-clause turn, but session.usage is first emitted by its mod-turn-complete hook. Fix separates a bounded fake first-turn completion receipt (session.measure done) from the unchanged 5 s frame assertion. Delayed-turn probe is temporary; final evidence uses normal fake timings and both whole files.

### rev-30 · 2026-10-16T00:52:35.904Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-505-source
commit: 387163754511faea67d932296f8e563afbaf572b
scope: full

Source review T-505 not clear at 387163754511faea67d932296f8e563afbaf572b. Standards and Spec reviewed directly. Fixed comparison is merge dev parent ca09b03c056fcc77015b698bc95f9bee9655df13 to this head; other parent cca6ef6f records the diagnosis. No production edits in task scope.

Medium — hub/test/session-model.test.ts:181: fresh resume still opens a 5000ms session.usage window immediately after session.resume admission. The new receipt at :174 proves only the old initial launch completed; after :176 stops it, fresh:true creates another process/first turn. Production Sessions.#freshResume (:1091–1108) calls #launchNew and returns its admission, the same boundary diagnosed by this task. Thus the fresh-resume member of the changed parameterized case retains the same first-turn-work-versus-publication race. Anchor the fresh process's own completed turn before this frame window (using its returned harness identity and a fresh receipt), keeping the existing post-mark usage and model/journal assertions. Extend the controlled delayed-turn proof to fresh resume, not only process rows. C1 not fully established until this remaining launch-derived wait is covered.

The added initial anchors themselves are sound: fake-claude.ts:415–425 awaits the turn.complete hook chain, dispatches session.measure, then writes session.measure done in that job's log. The role-clause turn is distinct from launch admission. Per-job logs and bounded eventually waits separate completion from the unchanged five-second frame assertion, matching rule9/10. Process-rows launches have distinct harness identities. Existing lifecycle, model, role, rename, usage coalescing and journal assertions are retained. No standards finding or requested bound increase.

A-3495 records a 5.5s process-rows delayed fixture red before / green after and explains the root cause; commit cca6ef6f carries that diagnosis. That proof does not yet cover the fresh-resume window above. Reported current Mac evidence is session-events5/5 whole files and session-model2/5 whole files, serial under load admission. Remaining three model passes were paused for the Coordinator's slot queue, and Linux verification is not submitted. C2 remains pending and is not failed for unfinished work. No final gate claim.

Read the task file for criteria and body under Coordinator bd00929a to avoid full-journal task.view scans. No Reviewer tests, compiler/binary execution, edits, installs, merges or provider actions. No per-item QA. Corrected source review must precede full task verification.

Structured finding: [{"severity":"medium","file":"hub/test/session-model.test.ts","line":181,"text":"Fresh resume starts another admission-to-usage five-second wait without observing its new first-turn completion; the added initial-launch receipt belongs to the stopped old process."}].

Review artifact A-3511 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3511-t-505-source-not-clear-fresh-resume-usage-wait-retains-admission-race.md.

Criteria: C1 failed (Fresh-resume session.usage wait still starts at admission; observe the new process first-turn completion before its unchanged 5000ms frame window.).

### rev-30 · 2026-10-16T00:59:44.371Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-505-source-correction
commit: 383321846c7916d84937bb242c88f94683df0c3a
scope: delta

Corrected source review T-505 clear at 383321846c7916d84937bb242c88f94683df0c3a, direct parent/source-reviewed 387163754511faea67d932296f8e563afbaf572b. Standards: no findings. Spec: no remaining high, medium or low findings. A-3511 medium finding is resolved.

Read entire immutable delta: only fresh-resume branch in session-model.test.ts changes. It reads process.harnessId returned by that fresh resume, bounds observation of that job's session.measure done receipt independently, then executes the exact existing post-mark session.usage predicate. Initial launch receipts remain, and all model/journal/lifecycle/coalescing assertions and existing five-second publication windows are unchanged. No production change, deadline increase, dev merge or other fixture change. The fake writes that receipt after its turn.complete and session.measure hook chains (fake-claude.ts:415–425), so it establishes the new launch's own completion rather than reusing the old stopped job's receipt. C1 verified for both process-row launches, all initial resume-model launches and the additional fresh launch.

A-3519 records controlled same-delay fresh-case proof: 5500ms fake turns, initial completion anchor passes, old fresh publication wait fails exactly 'no frame matched within5000ms' (0/1,14.059s). Corrected branch with same delay passes1/1 (15.991s). Delay removed before commit. Original process-rows delayed red/green diagnosis remains A-3495/cca6ef6f; corrective commit is direct descendant with no merge. Reported typecheck green; immutable diff whitespace check clear. Reviewer did not run these probes.

C2 final verification remains pending. Existing unchanged events-file5/5 remains relevant; previous model2/5 is discarded and corrected-head five whole model files plus required actual droplet verification are still due. A clear source verdict permits exact-head cland verify under Coordinator's current sequence/admission instructions; do not describe incomplete repetitions as completed. No per-item QA. No Reviewer tests, compiler/binary execution, edits, installs, merges or provider actions. Task-file criteria already read for this review chain; no repeated task.view scan.

Review artifact A-3520 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3520-t-505-corrected-source-clear-at-38332184-fresh-launch-completion-anchor.md.

Criteria: C1 verified.

### rev-30 · 2026-10-16T01:30:00.006Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-505-manifest-delta
commit: 9fe0b61cf827e296a15eda5ed7b712a0b798015e
scope: delta

Delta source review T-505 clear at 9fe0b61cf827e296a15eda5ed7b712a0b798015e, direct parent/source-reviewed 383321846c7916d84937bb242c88f94683df0c3a. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e byte for byte. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. No extra task allowances. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

Completion anchors and corrected fresh-resume source A-3520 remain unchanged. Events5/5 remains relevant; corrected model sequence is incomplete at3/5 and must finish. Old local-fallback verify7b2702da belongs to38332184, not this new head. C2 still needs completed Mac sequence and actual Linux receipt under Coordinator's admission direction.

Only source-established criteria C1 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Update: old local request7b2702da was cancelled143 (A-3558), with no completed counts/evidence. Artifact A-3564 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3564-t-505-shared-manifest-delta-clear-at-9fe0b61c.md

Criteria: C1 verified.

### impl-505 · 2026-10-16T01:32:34.759Z

Mac evidence complete: both whole files pass5/5 serially, all labelled loaded, normal fake timings. A-3571 contains every receipt and duration: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3571-t-505-mac-whole-file-evidence-both-files-5-5-green.md. Corrected model runs only; earlier uncorrected model runs excluded. Source clear at9fe0b61c via A-3564, task test files unchanged by shared2149fe33 manifest pick. Explicit fresh droplet3df8e38c-6296-49c7-942e-9fc14ae7148c accepted and waiting remote, confirmed queue after CLI timeout; no duplicate submitted. C2 remains open pending Linux receipt. Old7b2702da cancelled without tests.

### rev-30 · 2026-10-16T02:36:28.135Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-505-final
commit: 9fe0b61cf827e296a15eda5ed7b712a0b798015e
scope: evidence

Final evidence review T-505 clear at unchanged source-cleared9fe0b61cf827e296a15eda5ed7b712a0b798015e (A-3520 corrected source/A-3564 manifest delta). Standards/Spec: no new findings. Origin branch ref and git bundle list-heads for3df8e38c independently resolve to this exact SHA.

Primary Coordinator decision30da93ba-8b1b-4cb6-b1be-25bf9a82c52b read in Agents explicitly accepts completed3df8e38c-6296-49c7-942e-9fc14ae7148c at its reviewed head under known-flake rule. Only red is knownT-556 dynamic timestamp0/5; known duration-regression notices do not fail the budget. No second run/head movement required. Additional Neovim run in that decision applies T-559 only; T-505 has no nvim diff.

Read raw A-3603: free38/38 and machine1814 tests/1810pass/0fail/4skip/0cancel completed; suite1322.10s, peak13.12, Finished exit1. Extracted positive completion/timing records for all3 session-events and all11 session-model cases, including process rows12.169s, live resume5.170s, native relaunch6.887s and fresh resume8.896s. No ordinary assertion or hard duration-budget failure appears. Exactly one red line: unrelated suite-runner current timestamp identity0/5. Neovim smoke did not execute after hub red; do not call this a green whole suite.

Metadata reconciliation matters: A-3604 captured an earlier hub recovery record {code:1,cause:remote machine lost,finished:02:33:09.833Z}, without platform. It does not itself establish the Linux metadata claimed in the request. The current original suite-directory result.json was independently read and now contains {code:1,cause:empty,finished:02:27:42Z,platform:linux/x64/6.8.0-142-generic,Node24.21.0,Neovim0.12.5}, matching the completed raw log and Coordinator recovery disposition. Preserved that final platform/completion result as A-3608 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3608-t-505-recovered-final-linux-platform-completion-result.json. A-3604 is superseded metadata, not a newly observed task failure or reason to rerun.

A-3571 read in full: both required whole files pass5/5 serially, events3/3 each and corrected model11/11 each,70 total passes, zero failures/skips; runs labelled loaded with admission checks/priority boundaries. Earlier uncorrected model runs are explicitly excluded. Events source remains identical from cca6ef6f; corrected model1–3 at38332184 and4–5 at9fe0b61c differ only by the reviewed manifest pick. All assertions/frame deadlines remain. Source review already established exact returned process completion anchors, including fresh-resume's own newly launched process, and delayed-turn red/green A-3519; no new source assessment needed.

C2 verified from the complete Mac sequence plus actual accepted Linux file completions; C1 unchanged source chain current. All criteria verified here. No further run/edit/pick or per-item QA required. No Reviewer tests, compiler/binary execution, installs, signals, commits, merges, provider actions, task.view scan or subagents.

Review artifact A-3610 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3610-t-505-final-evidence-clear-at-9fe0b61c-with-recovered-linux-metadata.md

Criteria: C1 verified, C2 verified.
