---
id: R-1465
kind: release
version: 0.3.1
title: Hub memory footprint
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-1262
branch: null
created: 2026-10-30T06:38:19.300Z
updated: 2026-10-31T05:19:44.996Z
---

## Goal

The hub's memory footprint fits a consumer machine that runs more than one project. The human (General, 2026-10-30 06:37Z, voice via Telegram, A-14154) asked for a 0.3.1 patch: today one hub takes 2–3 GB, so a second project's hub doubles that. The release finds what holds the memory at startup and at rest, cuts it, and adds a budget test so it cannot grow back.

## Notes

Scope by the human's asks of 2026-10-30. At 06:37Z a voice note (General, A-14154) asked for a 0.3.1 patch: one hub took 2–3 GB, and a second project's hub doubles that. In Telegram at 10:16Z the human added the twelve v0.3.0 retro items («Давай все вместе 12 лучше»). At 14:40Z, also in Telegram, the human said «делай все, все баги которые находишь, тех долг и прочее, бери в 0.3.1 и когда ничего не останется - делай релиз». So every bug, tech-debt and follow-up item found during the run went in, and that message is the release approval, on the conditions recorded on R-1465: every item landed or closed, release covers green, QA clear, dry-run notes shown in the release topic. The Coordinator `coord`, on Claude Code claude-opus-5-5, led. Implementers and Reviewers ran on Codex gpt-6.1-sol, and the QA session qa-677 recorded the epic verdicts. The release holds two epics, E-1466 and E-1468, and the items directly under R-1465. Every landing went through the hub merge queue with an `Item:` trailer. Version 0.3.1 is R-1465's recorded version (T-1496).

What the human can now do, by epic:

- **E-1466 Measure and cut the hub's memory footprint.** The hub starts in a fraction of the memory it needed.
  - T-1467 measured it first, with a script that runs a sealed hub on a scratch copy of this project's live state. On this project's history the hub held about 3.8 GB of heap at readiness.
  - The two biggest holders were cut. The hub no longer reads the whole 374 MB journal into one string at startup; it selects the startup history in bounded steps, and heap after that step fell from 744 MiB to about 116 MiB (T-1477). It no longer loads and keeps every archived suite job; it loads only active suite jobs and summaries, and reads an archived job in full by id. Heap after the suite-history stage fell from 3,567 MiB to 889 MiB (T-1476).
  - T-1478 measured a scratch hub at rest for 30 minutes and found no growing site. It added a memory budget report that compares heap and RSS at readiness and after a fixed rest against a budget. The budget is report-only (rule 27): heap 256 MiB, RSS 768 MiB. The human agreed it on 2026-10-30 21:08Z (ask 53ad10db, answered under the standing permission of 2026-10-28).
  - The probe's copied hub is isolated from the live suite paths and recovery state, so a measurement cannot touch live run files (T-1483). The measure-memory analyzer test got a dated duration allowance (T-1491).
  - Integrated figures on the live project, recorded on R-1465: after restart #64 the live hub's footprint was 969 MB at +50 s and 943 MB at +10 min, against 4,796 MB on the pre-fix hub #63. The live hub was 1,255 MB at 2 h under a busy crew.
  - QA clear: qa-2026-10-31-677-1466-2 (A-14831) at e5b310a78. Readiness heap 125.2 MiB, RSS 565.1 MiB. At rest heap 130.8 MiB, RSS 560.1 MiB. Observed rest maxima 149.8 / 588.3 MiB. All of it is within 256 / 768. The demo was rerun after e5b310a78 re-owned the analyzer test's duration allowance from E-1466 to E-880. That commit changes nothing else. The run before it, qa-2026-10-31-677-1466 (A-14815) at 7f0e3353b, was clear too: readiness 170.0 / 585.8 MiB, rest 134.0 / 351.1 MiB. The earlier demo, qa-2026-10-30-677-1466 (A-14729) at 3cc3d62e8, was also clear. It saw a transient rest heap sample of 294.3 MiB. The report did not show that sample, and T-1495 was filed for it.
- **E-1468 Coordinator delivery never goes silently deaf.** The cause is in the deaf-bridge RCA (A-14159) of the 06:53–07:34Z incident of 2026-10-30, when the human's Telegram answer waited 41 minutes for an idle Coordinator. Now:
  - The Claude Code poll never turns a pushed idle into busy (T-1469).
  - A held human delivery drains on any idle observation and on a timer, not only on an idle edge (T-1470).
  - A relaunch leaves one harness process. Spokes, hooks and bridges bind to a fresh per-launch id, so a process from an earlier launch is refused (T-1471).
  - A live harness that holds deliveries for over 5 minutes shows `deaf` in `cland session list`, `hub.status` and the workbench, and the human is told. This replaces the `inject-stalled` alert, which fired on replays after hub restarts (T-1472).
  - `cland session retry` also forces a held queued delivery (T-1473).
  - The hub detects the Claude daemon's 60-minute idle retirement (T-1474).
  - The bridge and flush logs say what happened: `bridge-closed` is no longer logged for non-current bridges, and `flushed` counts sent messages (T-1475).
  - QA clear: qa-2026-10-31-677-1468 (A-14810) at 7f0e3353b, 131 passes in six sequential file runs. It replays the incident's sequence, the one-harness-per-launch check and the `deaf` state with `session retry`, on fake clocks. No real Claude daemon ran.
- **Also directly under R-1465.**
  - Verification and the merge queue:
    - `cland verify` runs the tier lint and the T3 header check locally before submitting, so a refusal costs seconds (T-1453).
    - Merge batches and task verifies widen test selection for sibling-merge interactions (T-1454). The batch side is report-only.
    - The queue checks queued members against each other at enqueue, and a drop notice names the conflicting member (T-1456).
    - Packaging checks: an install-shaped CLI smoke, a `site/` import boundary, and a refusal to start Web probes without a current `web/dist` (T-1458).
    - Every suite log ends with one provenance footer (T-1460).
    - A macOS load-gate repetition failure of a test green in recent covers gets one automatic rerun (T-1461).
    - The hub confirms a merge-delta review when the dev merge is conflict-free and the files are disjoint. It is report-only, and the Reviewer's verdict is still required (T-1462).
    - Periodic dev T3 skips a run when a newer integrated or stage cover just passed (T-1464).
    - Git auto-maintenance is off in the repository configuration (T-1459).
    - The Executor interface declares `prepare` and `reap`, so the droplet backend implements all nine operations through it (T-373).
  - Delivery and routing:
    - A review request addressed to the role `reviewer` no longer stays queued while reviewers are idle. It had waited 49 minutes (T-1487).
    - A Telegram album of audio files gets each file transcribed (T-1433).
    - A non-interactive `cland setup` re-run waits briefly for a paired Discord or Telegram remote to reconnect before it reports `ok`. It had reported `open` while the gateway was reconnecting (T-1502).
  - Parallel work and process:
    - The files where parallel lanes kept conflicting are split: one file per skill CHANGES entry, palette help per area, one module per `usage.ts` command, and the test guide index derived from the directory (T-1455).
    - The release skill asks for a conditional release approval in daytime (T-1463).
  - Site and docs:
    - The landing page, README and features page name Telegram and Discord remote control (T-1479).
    - The site onboarding guard no longer rejects the Aide's conditional root commit (T-1480).
    - The landing page's feature carousel is a grid of all features (T-1482).
    - T-1479 (landing and README name Telegram and Discord) and T-1480 (the site onboarding guard) reached GitHub through `cland publish` on 2026-10-30, each after the human's approval. T-1482 goes live with this release's push to `main`.
  - Tests and fixtures:
    - Installed verify parses duration identities with TypeScript pruned (T-1484).
    - The Inbox archive window no longer mixes the fixture clock with the real clock (T-1485).
    - T4 load repetitions no longer log duplicate finish-only progress rows (T-1489).
    - The batch interaction scanner no longer falls back on every web test (T-1492).
    - A `claude-code-schedule` T2 case no longer spawns a real process probe (T-1451).
    - Capability refusals stay one line after T-1453 (T-1490).
    - The `journal-subagents` startup-selection test got a duration allowance after a soak spike (T-1497).
    - The admission fixture's socket path fits macOS's limit (T-1499).
  - Closed without a merge:
    - T-1457 was already delivered by T-761, which made `test:tiers` refuse a task-owned duration allowance (evidence A-14244, Reviewer clear rev-20261030-1457-final1).
    - T-1264 was closed as not triggered. `cland qa lint` reported nothing unresolved on any of the 104 committed briefs.
    - T-1268 was closed with original production receipts: T-1322's A-12269 and A-12293 show a real new Web file passing 10 of 10 repetitions at two workers (evidence bundle A-14444).
  - T-1496 moved the root `package.json` and both lockfile version fields to 0.3.1.

Findings of the run, each fixed on `dev` before the release:
- T-1490: dev went red between two landings. T-1453 added source locations to admission errors, T-1484 expected a one-line refusal, and the two landed in separate T1-only batches that ran neither T3 file. T-1454's sibling-merge selection exists for this class (found by a Reviewer from source, confirmed by the Coordinator).
- T-1484: an installed `cland` could not run `cland verify` on a project with duration identities, because TypeScript is pruned (found by T-1458's packaging guard).
- T-1485: phone-asks went red everywhere at about 2026-10-30 12:00Z with no code change, because the fixture pinned a clock at 2026-10-23 and the real clock aged the departure out of the 7-day window.
- T-1487: a review request to the role `reviewer` sat 49 minutes with four idle reviewers, the class T-1426 fixed in v0.3.0.
- T-1480: the site guard had been red since T-1275 (2026-10-25) and blocked every site build (found by T-1479).
- T-1491, T-1497 and T-1499 are performance and fixture defects of this release's own work. The T-1467 analyzer test ran 5.1–5.3 s on Linux droplets against a 5 s budget. The `journal-subagents` test ran 11.7 s in the nightly soak against 5 s, after T-1477. The admission socket path was 105 characters against macOS's 104-byte limit, after T-1484, and it failed the macOS stage cover.
- T-1492: after T-1454 went live, every batch's interaction report listed the Web test files as fallbacks (found on a droplet).
- T-1489: duplicate finish-only rows in a T4 suite log (found by a Reviewer while reconciling T-1454's evidence).
- T-1502: the first 0.3.1 release cover (70e41a22 at e5b310a78) went red on one test, `setup-remote-component` Discord repair=false: `'open' !== 'ok'` on a slow droplet shard. The Telegram step had the same single-sample check (regression of T-1371).
- T-1483: the memory probe's copied hub could reach live suite paths and recovery state (found by impl-1478 before anything was measured).
- Held-delivery evidence, folded into T-1470 on 2026-10-30 19:20Z: the journal showed seven deliveries to the Coordinator acked but not injected. One was about 10 h late (merge-batch:334e3a59, T-1477). Six were about 3 h 39 min late (acked 15:37Z). They went out together at 19:16Z. The held-delivery class therefore covers agent reports to a session as well as human messages.

Decisions of the run:
- The human, 2026-10-30 06:37Z (voice note A-14154): a 0.3.1 patch, version 0.3.1, to cut the hub's memory.
- The human, 2026-10-30 10:16Z (Telegram): the twelve v0.3.0 retro items T-1453–T-1464 go into 0.3.1.
- The human, 2026-10-30 14:40Z (Telegram): every bug, tech-debt and follow-up item that can complete goes in, and the release follows when nothing is left. T-1486 and T-1488 stay in Follow-ups because each needs a day of recorded evidence after its report-only predecessor lands.
- The human, 2026-10-30 21:08Z (ask 53ad10db, through the standing yes of 2026-10-28): the memory budget is heap 256 MiB and RSS 768 MiB, report-only. Basis: measured maxima of 166.6 MiB heap and 586.0 MiB RSS (A-14690), so the budget is about 1.5×.
- Coordinator: T-1264 closed as not triggered, because its own trigger (real briefs needing literal title validation beyond the lexer bounds) did not occur.
- Coordinator: in the quiet-machine slots for T-1478, waived its own swap ≤80 % precondition when the allocated swap was stale (macOS keeps it; memory pressure level 1, no swap-outs), with abort conditions on `kern.memorystatus_vm_pressure_level` ≥ 2, load1 > 6 or any swap-out. The first live attempt stopped because the guard read the transient `vm.memory_pressure` counter; the guard was corrected and the runs completed.
- Coordinator: for T-1455, the docs/help conflict was waived under rule 6 until the split lands.
- Coordinator: several carries of a green verify from a parent head, with targeted post-merge evidence and a clear delta review, were accepted under rule 6 (T-1470, T-1472, T-1473, T-1478). None counts as a full verify at its final head.

Deferred, filed as follow-ups (none blocks the release):
- T-1486: switch hub-confirmed disjoint merge deltas from report to enforce, after recorded assessments show what it would have waved through.
- T-1488: switch batch interaction selection from report to run, on recorded batch evidence. A typical hub change adds about 290 T2 and Web files to a T1-only batch.
- T-1493: pin the authoritative request head at verifier admission.
- T-1494: let verifiers decline or release an accepted request without a verdict. It needs a role-tool change and a relaunch.
- T-1495: the memory budget report shows the interval maximum and says whether the limit applies to endpoints or to the whole interval.
- T-1498: the `journal-subagents` startup-selection test is slow on fresh occasion droplets. The soak ran 11.7 s and a stage shard ran 13.8 s against T-1497's 12.5 s allowance. The cause is probably a cold disk on a new droplet.
- T-1500: other Unix-socket test fixtures are not safe under a deep TMPDIR on macOS.
- T-1501: re-test the OpenCode adapter against OpenCode 2.2.x. The informational check (`npm run check:opencode`, 2026-10-31 05:20Z) found 2.2.5 against the tested 2.0.24, with 12 schema differences: ten in `GET /api/session/{sessionID}/form` and two in `GET /api/session/{sessionID}/message/{messageID}`. The check does not block releases.

Not verified:
- The memory figures are single samples on one Mac (the live-hub readings and the QA probes). They are not a distribution, and the pre-fix and post-fix hubs differ in data.
- E-1466 C2 has no same-probe pre-fix at-rest "before". The "before" is the startup-readiness reading of the earlier probe (3,833.65 MiB heap, 1,633.4 MiB RSS at c8defa34d), not a controlled at-rest comparison. The fix is shown by the startup drop and the at-rest budget, not by a fixed-leak claim. No leak is excluded either; positive historical RSS slopes remain recorded. The budget is report-only and is not enforced.
- The budget endpoints pass, but the rest heap is not proven continuously under 256 MiB: A-14729 saw a transient 294.3 MiB sample (T-1495).
- Hub memory on Linux and under other project sizes was not measured. All probes ran on this Mac.
- E-1468 QA ran on fake clocks and fake harnesses in scratch homes. No real Claude daemon, remote or browser ran, and the 60-second and 5-minute bounds come from the fake clock, not from wall time. The workbench checks (M6) were out of scope.
- T-1470, T-1472, T-1473 and T-1478 landed on parent-head full verifies with targeted evidence at the final head (rule 6), not full verifies at their final heads.
- The adapter was not re-tested against OpenCode 2.2.x (T-1501).
- Cover receipts:
  - Release cover cb18ecff (A-14850) at 20637bf7e on Linux x64 droplets (2 shards, Node v24.21.0): 6,161 pass, 0 fail, 9 skipped, with T3, T4 and Web.
  - Stage covers at 552255beb: Linux droplet 95712ae6 (A-14825; 6,151 pass, 0 fail) and macOS local 22d726c2 (A-14829, 2 workers; 6,159 pass, 0 fail).
  - The first release cover, 70e41a22 at e5b310a78, went red on T-1502's race. Shard-2 stopped after T2.
- No full macOS cover ran after 552255beb. Two commits followed. e5b310a78 changes one allowance owner string. T-1502 changes setup's remote readiness, and its tests passed on macOS locally: focused 33/33, and native Discord component cases 10 runs, 70/70.

Baseline before the release:
- Version 0.3.1 is the human's choice (same message: «сделаем patch release 3.1 с оптимизацией»).
- Observed: hub 88459 (restart #60, v0.3.0) at 3.0 GB RSS 80 s after start on this project (about 1,460 tracker items, 14,000 artifacts); earlier hubs ran 2.8 GB at rest (pid 35680 on 10-29). The hub starts with an 8 GB heap cap after the restart-#22 OOM (T-912).

## Comments

### coord · 2026-10-30T14:40:40.187Z

Human, 2026-10-30 14:40Z via Telegram (General msg remote-328802bf): «Ок, я на сегодня ухожу уже, так что делай все, все баги которые находишь, тех долг и прочее, бери в 0.3.1 и когда ничего не останется - делай релиз». Recorded as the human's scope decision and conditional release approval for 0.3.1: every open Bug, Tech debt and Follow-up that can complete moves in (T-1484, T-373, T-1264, T-1268, T-1451, T-1433). T-1486 and T-1488 stay in Follow-ups because each needs a day of recorded evidence after its report-mode predecessor lands. Release when nothing open remains under R-1465, following the release skill with T-1463's conditional approval: conditions are every item landed or closed, release covers green, QA clear, dry-run notes shown in the release topic.

### coord · 2026-10-30T19:16:03.663Z

Integrated memory measurement, hub restart #64 (2026-10-30 19:04:47Z stop → 19:05:27Z serving, stop to serve 41 s). Hub pid 79176 on dev a10718ea5, which carries T-1476, T-1477, T-373, T-1454, T-1490, T-1489, T-1491 and T-1462. Measured by cland-impl on the live project history, on this Mac, with an 8 GB heap cap.

| point | RSS | footprint |
| --- | --- | --- |
| +50 s | 1,196,000 KB | 969 MB |
| +10 min (19:15:30Z; one droplet run active, load 2.3) | 980,464 KB | 943 MB |

For comparison, hub #63 (dev before T-1476 and T-1477) had a 4,796 MB footprint at +50 s. The startup footprint is down about 5×.

These are single samples per point on one machine, so they are not a distribution. T-1478 still owns growth at rest and the budget report. The earlier observation, hub 17875 at 5.3 GB after 2 h 43 min, is a growth figure and is not comparable to these startup readings.

### coord · 2026-10-31T05:19:44.996Z

Live hub memory after restart #64, for the record: pid 79176 at 2026-10-30 21:07Z, 2 h 02 min after start, under a busy crew. RSS was 769 MB and footprint 1,255 MB (`footprint 79176`). For comparison, the pre-fix hub 17875 had a 5.3 GB footprint at 2 h 43 min, and hub 48336 had 8.2 GB at 88 min. These are single readings on one Mac.
