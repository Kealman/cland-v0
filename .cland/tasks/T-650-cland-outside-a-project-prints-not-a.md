---
id: T-650
kind: task
title: 'cland outside a project prints "not a cland project: run cland init" and starts no hub'
state: open
status: ready
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-609
topic: topic-533
branch: t/T-650-cland-outside-a-project-prints-not-a
created: 2026-10-16T16:24:00.374Z
updated: 2026-10-18T20:44:56.397Z
---

## Summary

Today `cland` (and `cland open`) in any folder starts a hub there, which creates `.cland/` in a folder that was never a project. Both now look for the project first: when the folder belongs to no project with `.cland/`, they print "not a cland project: run cland init", exit 1, and start no hub and write nothing (spec v0.1.4 §3.2, "What comes next"; Q-599 resolution 6).

## What to build

- In `hub/src/cli/open.ts` (`runOpen`, which `cland` with no command on a terminal runs, `hub/bin/cland.ts`): resolve the project root as today, with T-609's rule that HOME is never one; when that root has no `.cland/`, write `not a cland project: run cland init` to stderr and return 1 before `runHub(['start'])`.
- Opening from a subfolder or a task worktree of a project keeps working as today.
- `cland open <dir>` applies the same check to `<dir>`.
- Other commands are unchanged (`cland hub start` in a folder without `.cland/` stays as it is; an open question in the README).
- `hub/test/open.test.ts`'s existing test runs on a folder with only `.git`; it now runs `cland init` first.
- The hub README's open section names the line.

## Acceptance criteria

- [x] C1. `cland open` in a plain scratch folder exits 1 with `not a cland project: run cland init` on stderr, and no launcher runs (open.test.ts with the stand-in launcher).
  - done: impl-650 · 2026-10-18T20:11:00.794Z
  - verified: rev-30 [reviewer] · run rev-20261018-650-final · 2026-10-18T20:44:54.749Z · commit 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e
- [x] C2. After that run the folder holds no `.cland/`, no hub process exists for it, and ticket T-639's `snapshot` of the scratch HOME is unchanged.
  - done: impl-650 · 2026-10-18T20:11:01.148Z
  - verified: rev-30 [reviewer] · run rev-20261018-650-final · 2026-10-18T20:44:54.749Z · commit 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e
- [x] C3. A folder inside a Git repository that has no `.cland/` gets the same line.
  - done: impl-650 · 2026-10-18T20:11:01.571Z
  - verified: rev-30 [reviewer] · run rev-20261018-650-final · 2026-10-18T20:44:54.749Z · commit 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e
- [x] C4. A folder under a scratch HOME that still holds a legacy `~/.cland/` gets the line, and HOME is not opened as a project.
  - done: impl-650 · 2026-10-18T20:11:01.977Z
  - verified: rev-30 [reviewer] · run rev-20261018-650-final · 2026-10-18T20:44:54.749Z · commit 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e
- [x] C5. `cland open` from a subfolder of an initialised project starts the hub and the launcher on the project root as before.
  - done: impl-650 · 2026-10-18T20:14:02.163Z
  - verified: rev-30 [reviewer] · run rev-20261018-650-final · 2026-10-18T20:44:54.749Z · commit 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e

## Comments

### impl-650 · 2026-10-18T20:07:42.254Z

Using the requested CLI seam in open.test.ts: isolated scratchMachine HOME/Git/XDG, stand-in launcher, filesystem snapshot before/after refusal. Lowest tier: T2 for CLI refusals; existing successful open remains a T3 hub-start lifecycle scenario. C1–C4 refusal proof precedes the guard; C5 initializes its project before launch.

### rev-30 · 2026-10-18T20:12:43.887Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-650-source
commit: 2460d171811d69737ace30cc7e7fc4980ceb8d37
scope: full
findings: [{"severity":"medium","text":"M1: scratchMachine snapshots host env before isolateVerification clears provider/account defaults; initIn uses that stale copy to start a real hub, bypassing old clandWithEnv isolation and permitting credential-backed startup sweep/probes. Isolate before capture or supply equivalent isolated env, retaining startup/reuse assertions.","file":"hub/test/open.test.ts","line":61}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. M1: changed startup fixture captures machine.env before isolateVerification initializes account isolation; initIn later launches the hub using that pre-isolation copy, unlike old clandWithEnv. A present parent provider token/account directories survive and can reach startup sweep/probes. A-5559 records exact producer/consumer chain, both axes and host evidence limits. Production guard/spec otherwise matches request. Preserve scratch snapshots and startup/reuse assertions while restoring pre-capture isolation or equivalent isolated child env; use planted environment control. No verification before replacement source review.

Criteria: C5 failed (The revised real-hub startup fixture passes a pre-isolation environment copy to initIn, allowing inherited provider/account configuration into startup.).

### impl-650 · 2026-10-18T20:14:14.576Z

Corrected source-review M1 at 9810ca43: ensureAccountFixture precedes environment capture for every open fixture. Planted provider/account boundary control failed before correction, then passed both helper and actual CLI child assertions. Host npm run check exit 0 and open.test.ts 4/4 (4.231 s), raw artifacts A-5560/A-5561. Fresh source review requested before verification.

### rev-30 · 2026-10-18T20:14:44.705Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-650-source-correction
commit: 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 9810ca43. M1 resolved: every open fixture awaits account/provider isolation before scratch environment capture; planted boundary assertions and actual CLI help-process probe prove isolated child defaults. Production/refusal/README unchanged and all startup/reuse/snapshot assertions retained. A-5564 records both axes, correction chain and raw A-5561 host4/4 plus A-5560 check evidence. C1–C5 await accepted exact-head runtime. No findings or per-item QA; one normal mode-free verify may follow.

### rev-30 · 2026-10-18T20:44:54.749Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-650-final
commit: 9810ca43f0fcca61a00f010d19996ccdd5e6bf7e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged 9810ca43. Independently audited A-5583/2f7b6977: all four open cases positive, three new identities15/15 repetitions; full hub+Neovim smoke2286 pass/2291 total, zero fail/cancelled, five prerequisite skips. Refusal snapshots/no discovery/launcher, explicit paths/Git/legacy HOME and initialized startup/exit/PID reuse execute. Corrected provider/account boundary control passes. A-5584 records both axes, C1–C5 mapping, retained M1/correction chain and inherited report-only diagnostics. All criteria verified; no findings or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
