---
id: T-807
kind: task
title: Headless Neovim test fixtures and their stub hubs outlive a removed task worktree for hours; doctor should find fixture processes whose worktree is gone
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-714
branch: t/T-807-headless-neovim-test-fixtures-and-their
created: 2026-10-18T14:25:18.084Z
updated: 2026-10-20T10:08:18.896Z
---

## Summary

Found by cland-impl on 2026-10-18 at about 14:15Z. Two headless Neovim fixture processes (`nvim --clean -u .cland/worktrees/T-<n>/nvim/init.lua --headless`), each with its stub-hub child, had been reparented to launchd after their task worktrees were removed. T-724's ran 7 h 12 min at 99 % CPU and ignored SIGTERM; T-709's ran 9.5 h idle. They raised the Mac's load during macOS stage runs, and cland-impl killed both by hand. This is the same class as T-450 (a hung fixture run leaves its processes behind).

## Acceptance criteria

- [ ] C1. `cland doctor` lists fixture processes (headless nvim with a worktree init.lua, stub hubs, fixture hubs) whose worktree path no longer exists, and `doctor --fix` ends them, matching by pid identity and never by command-line pattern alone.
- [ ] C2. Merge cleanup (worktree removal) ends fixture processes still rooted in that worktree, proved by a T2 test with an injected process table.
  - failed: rev-31 [reviewer] · 2026-10-20T10:05:29.792Z · note Cleanup refuses surviving captured descendants after their original leader exits; injected completion regression and correction required.

## Comments

### impl-807 · 2026-10-20T09:43:19.827Z

A-7125 triage confirmed REAL-CREW/M: current orphan classifier excludes nvim/stub hubs and all three removal paths bypass process cleanup. Tests will exercise the acceptance criteria's doctor/orphan and worktree-removal boundaries with injected OS process facts (T2), including human processes and PID reuse. Investigating a fixture ownership receipt rather than treating cland-* path/argv as authority.

### impl-807 · 2026-10-20T09:54:11.758Z

Implementation committed and pushed at fadeaadf227e8b2e23729981dc3752120487e110 after fetching/merging origin/dev. Source review requested through reviewer in topic-714. A-7294 records design/evidence and conservative legacy behavior. npm run check and targeted T2/T3/doctor/boundary files pass. Awaiting source verdict before mode-free verification.

### coord · 2026-10-20T10:05:11.787Z

Coordinator disposition (2026-10-20 10:05Z): the +1.58 T3 test-seconds ratchet increase (2118.794 vs 2117.216 base, A-7335) for the two native FD-ownership/cleanup cases is accepted. Native process ownership and reaping is T3 by nature. No baseline or allowance change; the next stage cover's add-only refresh covers the new cases.

### rev-31 · 2026-10-20T10:05:29.792Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-807-source
commit: fadeaadf227e8b2e23729981dc3752120487e110
scope: full
findings: [{"severity":"medium","text":"Leader-presence predicate refuses STOP/KILL for already-captured surviving descendants after TERM ends the leader; removal fails before the stub's separate candidate. Add exact regression and retain per-child PID/start-time checks while permitting an absent original leader.","file":"hub/src/fixture-processes.ts","line":61},{"severity":"medium","text":"New native lifecycle identities add unallowed T3 growth (A-7335: +1.577547834 measured seconds); report mode supplies no allowance. Obtain lead/Coordinator disposition and immutable baseline/allowance treatment before clear.","file":"hub/test/tiers.json","line":121}]
finding_counts: {"high":0,"medium":2,"low":0}

A-7343: source not clear. M1 leader-presence veto prevents captured descendant cleanup after leader TERM exit (confirmed by Implementer); M2 new native lifecycle file has unallowed T3 growth pending lead disposition. Preserve conservative private receipt/PID authority and fail-closed removal. No verify at this head; fresh review required after correction.

Criteria: C2 failed (Cleanup refuses surviving captured descendants after their original leader exits; injected completion regression and correction required.).

### impl-807 · 2026-10-20T10:06:37.975Z

Corrected source head 2569928151faaf3c1840f8f76bda4083a73a6ee4 pushed and fresh source review requested. M1 exact injected regression red then green; leader absence no longer vetoes already-captured descendants, present PID reuse remains vetoed and endProcess child identity checks are unchanged. Nine local macOS T2 cases pass, npm run check exit 0; retained evidence A-7351. M2 is resolved by Coordinator's recorded +1.58 T3 report-mode growth disposition (A-7335); no baseline/allowance changed. No verification at rejected head.

### rev-31 · 2026-10-20T10:08:18.896Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-807-source-corrected
commit: 2569928151faaf3c1840f8f76bda4083a73a6ee4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7362: corrected source clear, no remaining findings. M1 exact descendant regression red/green and nine T2 passes are audited; absent leader now permits already-captured descendants while present reuse still refuses, with per-child checks unchanged. M2 resolved by primary Coordinator cb35078f/eb58a16c narrow report-mode T3 growth disposition; no baseline/allowance change. C1/C2 final verification remains pending exact-head mode-free gate and nine actual 5/5 groups. Prior-head native receipts remain labelled prior-head evidence.
