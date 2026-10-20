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
updated: 2026-10-20T20:40:15.074Z
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
