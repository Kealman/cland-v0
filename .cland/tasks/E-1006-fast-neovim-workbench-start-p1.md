---
id: E-1006
kind: epic
title: Fast Neovim workbench start (P1)
state: open
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: topic-772
branch: null
created: 2026-10-20T17:00:31.060Z
updated: 2026-10-21T22:39:31.630Z
---

## Summary

P1 from the human, 2026-10-20 16:55Z: the Neovim workbench takes many minutes to start and slows the whole Mac while it loads. The explorer shows "loading the items…" for more than 5 minutes. The header says "no coordinator" and "sessions 0" while the hub is connected and holds the Coordinator and six sessions. The human: «запуск должен быть быстрым и если надо иметь ленивую подгрузку, но не так что десятками минут ждать», «весь мак жестко тормозит пока воркбенч грузится».

## Notes

These are cland-impl's measurements at 16:57–17:00Z on the live project (1,005 items):
- Neovim re-polls `hub.status`, `task.list`, `topic.history(200)`, `events.list(200)`, `session.list`, `artifact.list`, `rule.list` and `account.list` about every 30 s, in a loop that never settles.
- `task.list` carries full bodies: 1,830,013 bytes.
- The `nvim --embed` process sits at about 58 % CPU and its RSS grows past 1.6 GB.
- Materialising each poll swings the hub between 80 MB and 912 MB RSS at 100 % CPU, and its `hub.status` answers take 1.4–2.7 s.
- `.cland/tasks` holds 6,029 files, of which 5,026 are `.conflict` captures. Almost every tracker write adds another, including plain `task create` and `task edit`. That churn keeps Spotlight and iCloud indexers busy.

The epic takes priority over every other v0.2 launch and over E-412 stage 2.

## Definition of done

- [ ] C1. On a copy of the live tracker (about 1,000 items), the Neovim workbench shows the open items, the sessions and the Coordinator within 3 s of the hub connection, measured on the human's Mac and recorded as local evidence.
- [ ] C2. With the workbench idle for 10 minutes, no full re-read of the item list or any other whole-state list happens, and the hub's CPU stays near idle (local evidence).
- [ ] C3. A Neovim smoke test with a 1,000-item fixture tracker fails when startup exceeds its budget or when the explorer's first payload exceeds its byte budget.
- [ ] C4. Tracker writes from the hub and the CLI create no `.conflict` capture unless a real concurrent edit happened, and old captures are pruned by a documented retention rule (with T-452).

## Plan

```yaml
stages:
  - name: summaries, settling, quiet writes and the startup budget
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1007
      - - T-1008
      - - T-1009
        - T-452
      - - T-1010
  - name: the read loop and the startup replies
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1037
      - - T-1038
```

## Comments

### coord · 2026-10-20T17:06:48.385Z

Crew GUI rule (Coordinator, 2026-10-20 17:06Z): Neovim or browser checks for this epic run headless (nvim --headless or --embed under a scratch HOME); no GUI process starts from a crew session on the human's Mac. Live measurement on the human's own workbench is T-1010 C4 and the epic's C1, run by the Coordinator or with the human.

### coord · 2026-10-20T18:21:44.183Z

Live evidence for C4 (first half), 2026-10-20 18:21Z, measured by cland-impl after hub restart #33 (pid 7502, dev 21b33962, T-1009 live): .cland/tasks/*.conflict = 5169 before the stop and 5169 five minutes after, newest capture T-1007 at 18:13:43Z (before the restart), while the hub logged 21 task-written events and 2 dev landings. Tracker writes no longer create captures. Pruning of the existing 5169 (T-452, landed 6ec2883a) goes live at restart #34.

### coord · 2026-10-20T19:08:16.154Z

Restart #34 (19:06Z, pid 57991, dev c9ee75f0 with hub code 8ef8ff4d; cover 0334fa4a red only on T-990/T-452 fixture tests, fix-forward T-1023): T-1007 and T-452 live. T-452 pruned 1053 captures older than 7 days at start (5169 -> 4116, stable at +2 min); cland doctor warns '4116 live captures', all differing from current files, as expected for stale recovery snapshots; they age out over the next 7 days. Human asked in General to restart the Neovim workbench and report one real startup measurement for C1.

### qa-676 · 2026-10-20T20:40:15.074Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-1
commit: 44097bad32444c7db96492ef15d182c819166f99
stage: summaries, settling, quiet writes and the startup budget
stage_hash: 3f42fcb95907803407ef977a825777f1bab3d7bc62f726a9a7b153524414b32c
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Command / surface (local macOS) | Result | Observation |
| --- | --- | --- | --- |
| S0 | env -i; scratch git init/commit; cland init; cland hub start | PASS | Own HOME, XDG directories, Git config and temp directory; no provider/account environment inherited; disposable project |
| M1 | node --test nvim/test/startup-budget.test.ts | PASS | 3/3, no skips; real headless Neovim, hard startup/payload budgets and both negative controls |
| M2 | node --test --test-name-pattern='summary projection bounds' hub/test/tracker-summary.test.ts | PASS | 1/1; summary bytes: open=42303, all=423905 |
| M3 | node --test hub/test/tracker-summary.test.ts; node --test hub/test/tracker-criterion-write.test.ts | PASS | Serial files, 9+13 pass; metadata omission, conflict watcher suppression and uncontested writes included |
| M4 | scratch cland task create/edit/comment; sleep 3; ls/find | PASS | Created and used T-5; all three commands exit 0; zero conflict/temp/criterion-intent files |
| M5 | scratch cland doctor; node --test --test-name-pattern='doctor counts live captures' hub/test/doctor.test.ts | PASS | One tracker-conflicts row, ok 0 live/0 differing; warn-path test 1/1 |
| M6 | scratch hub stop; plant fresh capture; hub start; sleep 5; doctor | PASS | Capture count 1 before/after doctor; warn 1 live/1 differing, item missing |
| M7 | node --test hub/test/tracker-conflict-captures.test.ts | PASS | 3/3; startup/hourly retention and canonical file preservation |
| M8 | node --test --test-name-pattern='a reconnect reads each startup list once then settles for ten fake minutes' nvim/test/shell-component.test.ts | PASS | 1/1, no skips; one startup read per list then settling with event updates |
| M9 | node --test --test-name-pattern='the header shows sessions and Coordinator while the startup items list is delayed' nvim/test/shell-component.test.ts | PASS | 1/1, no skips; header arrives independently of delayed items |
| M10 | node --test nvim/test/explorer-component.test.ts; node --test nvim/test/explorer-card-component.test.ts | PASS | Serial files, 20+15 pass, no skips; lazy closed summaries and task.view card data |
| M11 | npm run typecheck | PASS | Exit 0; hub, Neovim, shared wire and web checks; zero errors/warnings |

Findings: none in the affected stage scope.

Stage: summaries, settling, quiet writes and the startup budget.
Build: 44097bad32444c7db96492ef15d182c819166f99.
Run: qa-2026-10-20-1.
All 12 scoped checks passed; 67 test executions passed, 0 skipped/failed/cancelled, including M2's selected case repeated in M3's full file. No full suite was submitted. All test files ran serially, locally on Darwin arm64 with Node v24.21.0 and pinned headless Neovim v0.12.5. No GUI, live tracker test, provider credentials or real harness account was used.

The generated startup fixture had 1,000 items/200 open: actual connection-to-render 23.672167 ms and first payload 67,588 bytes, below enforced 3,000 ms / 131,072-byte limits. Slowed-list control measured 3,132.725875 ms and produced expected “startup budget: 3132.7 ms > 3000 ms”; body control measured 415,880 bytes and produced expected “first item payload budget: 415880 bytes > 131072 bytes”. This does not establish the separate epic C1 live-Mac measurement. M1-build.txt confirms T3 classification and NVIM_SMOKE membership.

M7 uses fake time: a real eight-day-old inode cannot be fabricated by setting mtime because retention takes the latest mtime/ctime/birthtime. M8 uses ten fake minutes; no live ten-minute CPU claim. Doctor's overall exit 1 in M5/M6 reflects intentionally missing harness installations/auth in the isolated fixture; the scoped tracker-conflicts row and targeted doctor test passed. No installation/auth action was taken.

Clean detached HEAD and refs/heads/dev matched before and after. All five items' first-parent landing commits are captured in build.txt. Scratch hub stopped normally; process scan found zero scratch processes; scratch root removed with non-force rm -r. Evidence is in S0.txt, M1.txt–M11.txt, auxiliary captures, notes.txt, build files, cleanup.txt and case-records.jsonl.

Stage covers are outside this brief. The request named A-8040 and A-8038 as complete, but task.view at both start and finish reports missing Linux droplet at tree 60732b925e28059e0de00015425d9b527bfeabf9 (macOS 53af0d11-b1ff-41b1-82ee-ff6ec41dbc3f present). This observation was sent to the lead; this stage QA report does not claim that cover is complete.

Stage verdict only: no epic criterion marks.

Durable evidence A-8045: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8045-e-1006-stage-qa-evidence-at-44097bad-s0-and-m1-m11-pass/report.md

### qa-676 · 2026-10-21T09:24:58.880Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-1
commit: 479178b25c78ccbb54f908ef7cc7c05c18426cd0
stage: the read loop and the startup replies
stage_hash: 52011ad39dbe0725783cb49590f0d7075a698820a61f9adb4adccb9061af8ba8
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Surface | Result | Observation / evidence |
| --- | --- | --- | --- |
| S0 | local macOS hub-api | PASS | Clean detached requested SHA/dev; T-1037 and T-1038 merges present; pinned Neovim; scratch hub under filtered HOME/XDG/Git; S0.txt and quiet-before.txt |
| M1 | local macOS hub-api | PASS | 2/2 read-loop tests; 20 MiB frame in 64 KiB chunks decoded once in 22.9 ms; 37,888,488 allocated bytes and 46,366,720 RSS growth bytes; M1.txt |
| M2 | local macOS hub-api | PASS | 8/8 status/history/paging/fragmented-response component tests; M2.txt |
| M3 | local macOS hub-api | PASS | Thousand-item durable fixture: all eight startup replies within per-frame and total budgets; 1/1 test; M3.txt |
| M4 | local macOS hub-api | PASS | 4/4 startup budget tests, including oversized non-item reply control; M4.txt |
| M5 | local macOS hub-api | PASS | Exactly 3/3 named demand-paging and older-page reconnect tests executed; M5.txt |
| M6 | local macOS hub-api | PASS | Scratch cwd confirmed; default status 2,571 bytes; --history 2,598 bytes; both exit 0; hub/web/sessions shown; M6.txt |
| M7 | local macOS hub-api | PASS | 60/60 shell-component tests, including ten fake-minute reconnect settling and delayed-items header checks; M7.txt |
| M8 | local macOS hub-api | PASS | npm run typecheck exit 0; zero warnings/errors; M8.txt |

Findings: none.

Stage: the read loop and the startup replies.
Run: qa-2026-10-21-1.
Tested full SHA: 479178b25c78ccbb54f908ef7cc7c05c18426cd0.
Brief: qa/briefs/E-1006-stage-2.md at that build. Items T-1037 and T-1038; no added fixes. HEAD and refs/heads/dev matched the requested SHA before and after execution; detached worktree status was empty.

Actual execution: local Darwin arm64, Node v24.21.0, pinned Neovim v0.12.5. Six targeted test files, 78 test executions passed with no skips or cancellations; no full suite was rerun. Tests ran one file at a time from the detached worktree with fresh fixtures, filtered credentials, scratch HOME/XDG/Git and the system TMPDIR. CLI M6 used only the scratch hub, never the live project. Queue receipts before each test show local:none; before M1 CPU idle sampled 88.23% and 89.96%, and before M4 85.56% and 88.9% on 10 logical CPUs. No deliberate stress or local suite ran alongside these checks.

M1's hard assertions enforced <2,000 ms decode and <8×20 MiB allocation/RSS growth. Actual measurements: 22.9 ms, 37,888,488 allocated bytes, 46,366,720 RSS growth bytes. Split/coalesced/partial frame ordering and malformed-line handling also passed.

M4's baseline generated tracker had 1,000 items, 200 open. Connection-to-render was 26.860625 ms, first item payload 67,588 bytes. This is fixture-based startup measurement, not the human's live-tracker startup or the separate hub-start time. Enforced negative controls:
- slow list: 3,136.9 ms >3,000 ms, expected time-budget rejection;
- bodies included: 415,880 bytes >131,072 bytes, expected first-item-payload rejection;
- oversized rule.list: 280,077 bytes >262,144 bytes, expected per-reply rejection.
These controls passed because their expected failures were caught by the tests; they are not product failures.
M3's actual whole-command wall was 1,675 ms, with 1,379.364 ms reported for its test body. The dated duration allowance is recorded context only, not a stage timing gate. No projections are reported as measured wall.

The Coordinator's completed stage covers were already present in task.view at verification tree d026d0a84f0b25de15257e303002111bc247cbf1: Linux 6773233c-8f9c-4c8f-bf60-bfa6591f327b / A-8207 and macOS baaf13ec-e3bf-47a4-b310-db8c446d6902 / A-8211. Those are external gate receipts, not executions by this QA run. General duration report-only lines and T-1039 hub-start time are outside this stage.

Cleanup: scratch hub pid 55231 stopped through cland hub stop; no owned process remained after excluding the probe's own ancestor processes. The initial process scan matched only its own zsh parent (pid 64530); both that raw result and the corrected scan are retained. Scratch root and detached worktree removed non-force. All nine recorder lines and referenced captures were checked.

Stage QA clear. No epic criterion marks: E-1006 C1's human-Mac live-tracker measure and C2's ten-minute idle check remain for the epic DoD.

Evidence A-8214: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8214-e-1006-stage-2-qa-read-loop-and-startup-replies-9-checks-pass-at-479178b2/report.md

### coord · 2026-10-21T09:42:05.926Z

C1 live evidence: the human's Mac, 2026-10-21 09:40:37Z, dev 7c5e4028 (hub pid 92080 with T-1038, Neovim with T-1037), relayed by the stand-in cland-impl.
- The human's words: «О, запустился почти сразу». Exact seconds will follow if they measured.
- `nvim --embed` peaked at 46 MB RSS and 7.6 % CPU. On the failed 06:26Z run it reached 8.4 GB at 100 % and ran out of memory.
- Hub RSS was 678 MB, with one CPU spike to 28 % for under 5 s and no macOS memory pressure.
- Hub audit of the Neovim spoke, 09:40:37–09:41:24Z: the startup set was issued exactly once, against three times each in the failed run. The calls were subscribe, topic.list, hub.status, role.list, inbox.list, rule.list, session.list, artifact.list, task.list, account.list and events.list once each; topic.history, account.poll, task.view and topic.read twice each; task.plan 12 times; topic.send once.
- C2: cland-impl's 10-minute idle sampler is running on this Neovim, and its figures follow.

### coord · 2026-10-21T09:43:08.904Z

C1 figure from the human, relayed by the stand-in cland-impl at 09:4xZ on 2026-10-21: «Ну он запустился меньше чем за 3с, точнее посчитать не успеваю». The workbench was usable in under 3 s on the human's Mac with the live tracker (1,036 items), too fast to time more precisely. Together with the 09:40Z samples above, I consider C1 met. The epic's QA demo verifies C1 from this local evidence; C2 waits for the 10-minute idle sampler.

### coord · 2026-10-21T09:52:44.616Z

C2 live evidence: the human's live workbench idle-sampled for 10 minutes, 2026-10-21 09:41:49–09:51:50Z, by the stand-in cland-impl. Read-only ps and journal, dev 7c5e4028, hub pid 92080.

- Neovim (`nvim --embed`, pid 14642): RSS 35 MB after 11.5 min, and CPU 0.0–0.2 % at every per-minute sample.
- Neovim spoke requests in the 10 minutes: task.plan 84, topic.read 7, task.view 6, topic.send 4, account.poll 2. None of task.list, hub.status, session.list, events.list, topic.history, artifact.list, rule.list or account.list was re-read, so the C2 condition of no full re-read of the item list or any other whole-state list holds.
- The task.plan calls are event-driven, not polling: nvim/lua/cland/plan.lua `M.get` refetches an epic's plan only when that epic's `updated` changes, or when a child item invalidates it. During the window the crew was changing items in the open epics constantly.
- Hub CPU per minute: 2.6, 90.7, 30.4, 35.8, 13.3, 17.2, 16.6, 49.9, 12.2 and 9.4 %; RSS 390–945 MB. The journal shows the crew's load, not the workbench's: cli 284 requests, nvim 103, unattributed 89, suite 2. Three implementers, QA and the reviewers were working.

Reading: the workbench's own idle load is negligible, and the hub's CPU in the window came from crew traffic. A crew-quiet control sample would prove that clause directly; the stand-in has offered one.

### coord · 2026-10-21T20:03:06.364Z

C2 quiet sample, 2026-10-21 19:51:24–20:01:24Z, taken by cland-impl, read-only, on the human's live workbench (nvim --embed 45730) and hub 63790.
- Workbench half met: zero nvim-spoke requests in 10 minutes, so no whole-state re-reads. nvim RSS stayed flat at 47–48 MB, and CPU was 0% in 8 of 10 samples.
- Hub half not met: steady hub CPU was about 9–12%, with spikes of 67.7% and 42%. The cause is the hub's own idle work, chiefly `session-archive-sweep` scanning 248 rows about every 15 s (41 events), plus the hourly P90 computation. T-1084 fixes it, and C2 is re-sampled afterwards.

### coord · 2026-10-21T22:30:54.650Z

C2 re-sample after T-1084 and hub restart #40, 2026-10-21 22:19:37–22:29:37Z, taken by cland-impl, read-only.
Setup: hub pid 39496 at 008fc731; the human's live workbench nvim --embed 45730, which reconnected to the new hub by itself at 22:17:39Z.
- Workbench half met again: zero nvim-spoke requests in 10 minutes, nvim RSS flat at 47–50 MB, CPU 0% in 8 of 10 samples.
- Hub half met: per-minute CPU 2.9, 1.3, 1.9, 3.0, 3.6, 0.9, 1.6, 91.0, 1.5, 1.6%. The single 91% reading coincides with an executor sweep and a message burst at 22:27:30Z, and the readings right after were 1–4%. RSS fell from 1,015 to 869 MB. session-archive-sweep fired 2 times (41 before T-1084). The residual 1.5–3% is crew message and droplet traffic from two running verifies (T-1081, T-1073), not idle work.
Before (dbb1604f): steady 9–12%.
