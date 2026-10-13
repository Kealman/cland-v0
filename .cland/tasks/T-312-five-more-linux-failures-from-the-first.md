---
id: T-312
kind: task
title: "Five more Linux failures from the first all-phase container run: Codex relaunch PID, OpenCode no-url rollback, three Neovim cases"
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-281
topic: topic-190
branch: t/T-312-five-more-linux-failures-from-the-first
created: 2026-10-13T01:50:19.683Z
updated: 2026-10-13T02:15:28.459Z
---

## Summary

The first Linux container run of all phases, at T-281's fba1599 on 2026-10-13, found five failures beyond T-281's five. Two are in the hub phase and three in the Neovim phase, which had never run on Linux before. T-268's C6 needs `npm run typecheck && npm test` green on Ubuntu 24.04, so each is fixed at its cause before T-282's droplet acceptance run.

## Parent

T-268: Suite spend and Linux portability. Evidence is in T-281's topic (topic-181).

## The failures

1. **Codex relaunch returns the old PID.** At `hub/test/orphan-servers.test.ts:146`, `first.pid` and `second.pid` are equal. It fails in five of five isolated runs (A-1734). A read-only observer recorded a new app-server birth each time, with a distinct PID and start ticks, so this is not PID reuse. The relaunch answer carries the old PID. This looks like a product bug in how the Codex adapter reports a relaunched child on Linux, not a test defect.
2. **OpenCode no-url rollback.** At `hub/test/adapter-native-boundary.test.ts:267`, "owned child has exited before rollback returns" is false in the full run (A-1727). The file passed alone five times in a row, 64 of 64 each (A-1729). The failure is load-sensitive: name the cause and fix it with a wait for state, never a retry or a longer sleep.
3. **Neovim: artifacts keeping** (A-1731).
4. **Neovim: prompt draft editing** (A-1731). Compare with T-300, the macOS prompt-draft flake.
5. **Neovim: thread delayed-history mode** reads `nt` where `t` is expected (A-1731).

## Constraints

- Fix each at its cause, with no weakened assertion, no skip and no retry. Name each cause in the item.
- A failure that also reproduces on macOS dev alone is a dev defect under the shared-fix rule: one commit, cherry-picked into every open branch.
- Linux runs are machine-weight. Run them only in a slot the Coordinator hands out: Docker Desktop at its current 4 CPUs, never changing its settings, `--init`, an ordinary user, and Docker quit after use.
- Suites run through `cland verify` on macOS.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`. English everywhere.

## Acceptance criteria

- [ ] C1. Each of the five failures has its cause named in the item and fixed there, with no test weakened, skipped or retried.
- [ ] C2. In the Ubuntu 24.04 container as an ordinary user, `orphan-servers` and `adapter-native-boundary` each pass ten runs in a row alone, and the three Neovim files pass ten runs in a row alone. The logs are published as artifacts in this item's topic.
- [ ] C3. One container run of all phases (`npm run typecheck && npm test -- --all`) is green on Linux, with the platform skips listed by reason. Its log is published as an artifact.
- [ ] C4. The suite is green on macOS through `cland verify`.
