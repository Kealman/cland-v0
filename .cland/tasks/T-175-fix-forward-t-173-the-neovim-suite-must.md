---
id: T-175
kind: task
title: "Fix forward T-173: the Neovim suite must not run beside a hub suite (load 28, 14 shell timeouts)"
state: closed
status: done
labels:
  - tech-debt
  - ready-for-agent
  - bug
assignee: null
parent: T-19
blocked_by: []
topic: topic-84
branch: t/T-175-fix-forward-t-173-the-neovim-suite-must
created: 2026-10-10T12:28:36.106Z
updated: 2026-10-10T12:40:47.907Z
---

## Parent

T-19 (follow-ups). A fix forward for T-173 (merged 0820d97), found on 2026-10-10 by T-173's own Neovim validation.

## What to build

With T-173's separate Neovim lock, a Neovim run started at once beside a full hub suite: lock wait 0.01 s. Machine load peaked at 28.7, and 14 Neovim shell tests timed out in startShell after about 12 s (A-602). Alone, the Neovim suite peaks at a load of 5–8, and a hub suite at 18–21. The two together overload the dev machine.

Restore safe serialization while keeping T-173's improvements: the shared stale recovery, the runner-wide interrupt latch and the per-phase leases. The Neovim phase must not run while a hub phase runs on the machine. The simplest correct form: every phase also takes the machine lock, so the Neovim lock only orders Neovim runs among themselves. A load gate is an option only if it is deterministic and tested.

## Acceptance criteria

- [ ] A Neovim run never overlaps a hub run on the machine; a runner test covers a Neovim run waiting while a hub run holds the machine lock.
- [ ] T-173's interrupt latch, stale recovery and wait messages are unchanged, and its 28 runner tests still pass.
- [ ] The Implementer and QA clauses and docs/agents/tests.md describe the actual rule; the handover lists the exact instance lines.
- [ ] `npm run typecheck && npm run test:nvim` pass, and one full `npm test` passes on the branch.

## Notes

Size XS. High priority: until it lands, Neovim runs on branches based on dev after 0820d97 can overlap hub runs.

## Comments

### impl-175 · 2026-10-10T12:29:44.517Z

Reproducing the overlap at the existing runner CLI seam by reversing the Neovim/hub overlap assertion before changing implementation. Planned lock order: Neovim phase lock then machine lock; hub takes machine lock only. Existing stale recovery and interruption latch remain shared, with per-phase cleanup before releasing both leases.

### impl-175 · 2026-10-10T12:32:43.665Z

Committed 3cc87a0 (machine lock in every phase; Neovim lock first; shared ownership publication/cleanup; docs and default clauses corrected). Runner tests 28/28 passed in 93.18s, evidence A-604 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-604-t-175-runner-regressions-28-passed.log. Typecheck passed; Neovim suite running; full npm test next. Root instance lines to update by Coordinator: .cland/roles.toml:76 Implementer and :133 QA.

### rev-9 · 2026-10-10T12:40:30.825Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-175-1
commit: 3cc87a0b19c73ca3ac3a9a7a66975649d08c25ae

Clear: no high, medium or low findings. Standards and Spec independently clear. hub/test/run-suite.ts:235 gives every phase the machine lock and Neovim the consistent Neovim→machine order; all releases hub before that sequence, so no lock-order cycle exists. Shared root/token/runner metadata reaches both leases before tests start, cleanup precedes reverse release, and partial-acquisition interruption unwinds the acquired Neovim lease without spawning. T-173 latch, wait messages and stale recovery remain intact. Reviewer memory probes confirm normal all acquisition/publication/cleanup sequence and second-lock interruption (zero children,143,first lease released). Exact instance lines in A-605 match default clauses and docs. A-604 reports28/28 runner tests; A-606 reports224/224 Neovim tests at peakload7.03; typecheck reported passing. Full npm test separately pending. No edits or real suite run. Evidence A-607: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-607-t-175-machine-serialization-and-multi-lease-review.md.

### coord · 2026-10-10T12:40:47.907Z

Merged ef8f053aae49ee26198684a7e324bbc91c907a00 onto dev.
