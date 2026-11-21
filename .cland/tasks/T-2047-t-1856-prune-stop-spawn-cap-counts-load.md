---
id: T-2047
kind: task
title: "T-1856 prune stop spawn cap counts load-dependent exit-polling rounds: macOS epic cover red at ps=19 > 18 although stops completed"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1856
topic: topic-1692
branch: t/T-2047-t-1856-prune-stop-spawn-cap-counts-load
created: 2026-11-21T03:46:20.633Z
updated: 2026-11-21T05:01:16.958Z
closed: 2026-11-21T05:01:16.958Z
---

## Summary

The macOS epic cover 58b6b31c at dev b9573ba7b (A-22311) failed two of T-1856's prune stop cases (territory and legacy-ordinary) on the test's own spawn cap: "single-Git cancellation batches native probes: at most 18 ps, 8 pgrep, 24 perl and 48 total probe spawns; actual ps=19, pgrep=6, perl=19, total=44" and "actual ps=19, pgrep=7, perl=21, total=47". The stops themselves completed. The ps count includes exit-polling snapshot rounds, which grow with how long the killed process takes to die under load (peak 1-minute load 8.2). So a fixed total cap is load-sensitive, and the case is red on a busy Mac although behaviour is correct. This blocks the macOS full cover that closes six epics.

## What to build

Make the cap test what T-1856 meant, that probes are batched and not per-PID: bound the spawns per inspection round and the PIDs or rows per round, and bound the number of rounds by the stop's deadline rather than a fixed total. Keep the full-table-scan prohibition and every native assertion. No production change unless the extra rounds prove a real defect.

## Acceptance criteria

- [x] C1. Under injected slow exit (extra polling rounds) the case passes when probes stay batched per round, and still fails if any round spawns per PID or scans the whole table, shown red first on the current cap (test).
  - done: impl-2047 · 2026-11-21T03:58:09.838Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-2047-final · 2026-11-21T04:34:40.453Z · commit d60197284bcd58c35918aaaa44f82a33fc90e5de
- [x] C2. The prune-process-lifecycle file passes 5/5 under the two-worker load gate on macOS (test).
  - done: impl-2047 · 2026-11-21T03:58:10.143Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-2047-source1 · 2026-11-21T04:02:09.342Z · commit d60197284bcd58c35918aaaa44f82a33fc90e5de
  - verified: rev-40 [reviewer] · run rev-40-20261121-2047-final · 2026-11-21T04:34:40.453Z · commit d60197284bcd58c35918aaaa44f82a33fc90e5de

## Comments

### impl-2047 · 2026-11-21T03:51:11.545Z

Scope: test-only correction, no production or wire/persisted contract changes. Consumers searched: native lifecycle assertion, prune-inspection-trace and per-file guide; trace type remains additive-compatible, retention ceiling rises from64 to512 to retain bounded polling evidence. Pure trace replay was run red against the exact old aggregate cap, then green with negative per-PID/whole-table/deadline-round controls. Native endProcess held-exit case and macOS C2 5/5 gate await Coordinator native slot.

### impl-2047 · 2026-11-21T03:59:45.681Z

Implemented/pushed d60197284bcd58c35918aaaa44f82a33fc90e5de (tree a227049108b691aee1a06a8fbbb3e8e29e49d6c4). Scanned evidence A-22318 retains red/green and logs. C1 actual endProcess held-exit reproduces old-cap red; per-round replacement and pure negative controls pass. C2 production two-worker load gate at this head: base7/7, all seven identities5/5, exit0, local macOS arm64 Node24.21, no browser, initial load4.59 peak4.81. Full typecheck and full test:lint pass (zero refusals; existing report-only advisories). Both criteria done; reviewer request delivered. Configured verification pending clear source verdict and Coordinator window; Linux/Web unexecuted.

### rev-40 · 2026-11-21T04:02:09.342Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2047-source1
commit: d60197284bcd58c35918aaaa44f82a33fc90e5de
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards0/Spec0 findings. Six test/docs-only files; shared per-round grammar retains full-scan/65row/native-close/lock/unowned-signal/liveness/no-later-write assertions. Caller/signal probes separated; snapshot rounds bounded by recorded stop deadline and20ms shortest production poll;512trace ceiling with omitted/open receipt refusal. Pure per-PID Perl/ps/pgrep/fullscan/excess-round negatives retained. ActualendProcess synthetic held-exit control proves15postKILL polls,>18ps andexactabsence; A-22318 old-cap red AssertionError retained, earlier development failures not passing evidence. C2 independently verified from structured C2.log: all7named identities1base+5loadgate pass each, workers2gate/1base, no fail/skip; macOSarm64 Node24.21, no browser. Artifact head/tree matches reviewed commit. Targeted quiet Mac45.55s excludes0.20lockwait,31.74gate overlaps; no Linux/Web/configured/speedup claim. Per-file docs/tier entry match; lint/typecheck reportedgreen,advisories report-only. C1 final pending exact-head configured mode-free verification in authorized window. Reviewer ran no tests/native/browser.

Criteria: C2 verified.

### impl-2047 · 2026-11-21T04:34:11.730Z

Configured run136e84e8-dd6a-4b64-9cf3-ec51410eea2e passed at reviewed d60197284 (A-22327). T0 local host passed; Linux x64 droplet Node24.21 T1, fallback all-T2, changed T3 file once (7 passing identities, no repetitions), and Web passed. Browser: Google Chrome for Testing156.0.8078.4, isolated Chromium headless shell1248. Remaining T3 deferred to merge batch; no T4 proof claimed. Timing budgets/ratchet and lint advisories are report-only, not enforcement success claims. Droplet c-8 ams3 lifetime1547s, cost$0.1075. Initial admission reachability failure retained; Coordinator authorized one availability retry, which admitted this run. Reviewer receives same-head result automatically for final C1 settlement.

### rev-40 · 2026-11-21T04:34:40.453Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2047-final
commit: d60197284bcd58c35918aaaa44f82a33fc90e5de
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings. A-22327/run136e84e8 binds reviewedhead/canonicaltree4a1982adea70f15bf85ca1e4eda3ee027c1ef7dd; independent diff finds only excludedtracker/rulebook differences. C1 positive structured finishes: extra-poll6119,negativeperPID/fullscan/excess6124,Linuxshape6129,heldnativeexit37190,crash37195 andall5native stoproutes37201–37226. Old-cap red and retained native/row/ownership assertions reviewedsource1. C2 retains separately audited Mac A-22318: all7identitiesbasepass+5/5 two-worker gate at same source, not Linux repetition proof. Configured T0/T1/fallbackallT2/selectedT3/Web exit0,7242pass1Mac-onlyselector skip0fail/cancel. SelectedT3file7identities onebaseexecution/no repeats;remainingT3batch,T4unexecuted. Noncached Linuxx64 c-8ams3 Node24.21.0 Nvim0.12.5;Web HeadlessShell1248/CfT156.0.8078.4. Hostcheck not repeated remotely;lint/budgets/T3ratchet report-only including0.221s growth advisory, no performance clearance. EarlierAPI-refused submission was unexecuted. Reviewer ran no tests/native/browser.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T05:01:16.958Z

Merged 51590a6771fb2d12099f85549124da907982c735 onto dev.
