---
id: T-312
kind: task
title: "Five more Linux failures from the first all-phase container run: Codex relaunch PID, OpenCode no-url rollback, three Neovim cases"
state: open
status: in progress
criterion_seq: 5
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
updated: 2026-10-13T03:12:26.413Z
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
- [ ] C5. C5. The hub-phase hang of freshness.test.ts in the first T-312 Linux all-phase run (2026-10-13 ~03:00Z, worker idle in epoll while every other worker had finished) has its cause named in the item and fixed there, with no timeout raised, no skip and no retry. The file passes ten runs in a row alone in the Ubuntu container, and the evidence of the hang is published as an artifact in this item's topic.

## Comments

### impl-312 · 2026-10-13T02:22:43.643Z

Codex relaunch cause: the frame is ok but its value is found:false ('no rollout found for thread id'), returning the retained stopped row; the PID comparison hid that reason. fake-codex persisted turns>0 only at turn completion. Linux termination is faster than the default 300 ms fake turn; a 10 s fake first turn deterministically reproduces the identical old-PID failure on macOS (A-1741), while ordinary dev baseline passes. Real contract source: upstream openai/codex commit 12cca49c81c8aa6a37a5cc4e39964ee3b70f9458, codex-rs/core/src/session/mod.rs, record_user_prompt_and_emit_turn_item calls ensure_rollout_materialized after recording first user input, before model completion: https://github.com/openai/codex/blob/12cca49c81c8aa6a37a5cc4e39964ee3b70f9458/codex-rs/core/src/session/mod.rs#L5036-L5095 . The fake now persists at first turn start; regression keeps the 10 s turn (so completion cannot make it green) and explicitly requires resume.value.found before comparing PIDs. No production PID reporting change is needed.

### impl-312 · 2026-10-13T02:29:22.234Z

OpenCode no-url rollback cause: endProcess confirms OS process disappearance (and excludes zombies) before Node/libuv necessarily delivers the native ChildProcess exit receipt. Under load, LaunchFiles.rollback removed resources and rejected spawn while exitCode and signalCode were still null. The existing native adapter-boundary seam now gates only that receipt while retaining real child/OS identities/signals, and checks session resources cannot be undone early. It fails before the fix and passes after it. LaunchFiles now captures the exit promise when owning a native child, and awaits it after verified termination before resource undo; recovered durable receipts without a native ChildProcess continue using OS proof. Unchanged original no-url assertion retained; complete adapter-native-boundary file passes 65/65. A-1742 was archived as superseded: its first diagnostic also counted termination-lease cleanup; final red proof narrows the observation to this fixture's session resources.

### impl-312 · 2026-10-13T02:31:10.332Z

Three Neovim causes: (1) artifacts keeping waited only for the artifact-list count, which arrives independently of topic.history. A held real protocol history response proves count=1 with thread messages=0; early zR has no run to open, then history creates the default closed fold (A-1748). Test retains the count wait and now also waits for the actual artifact message and rendered folded run before zR, retaining keep/unkeep/restart/palette assertions. (2) prompt draft issued :Cland prompt immediately after nvim listening, before the hub welcome/connect handshake. The command correctly refuses 'prompt: the hub is not connected'; the originally issued command never becomes a draft after welcome (A-1747). Test now waits hub:connected before the one command. This is the same T-300 case/cause: load makes the handshake lag behind the immediate RPC command. (3) delayed-history test asserted Terminal mode immediately after startinsert; A-1731's line 606 fails BEFORE releasing history, with native terminal-normal nt. The test now waits for the requested mode before retaining the original exact assertion and releasing history; all post-history mode/focus/tail/status assertions remain. Protocol-gated red source A-1746 and green A-1749; no permanent seam added. Artifacts file passes 9/9; thread validation in progress.

### impl-312 · 2026-10-13T02:33:58.330Z

Pinned Neovim's own help confirms delayed-history precondition: v0.12.5 runtime/doc/insert.txt :startinsert (lines 2032–2039) starts Insert/Terminal mode just after executing the command, and inside a function/script only after it finishes. The Linux failure was the pre-history mode assertion at line 606, before snapshot release. The exact mode assertion remains and now follows a state wait. Fixed complete macOS files: adapter-native-boundary 65/65, codex-adapter 35/35, artifacts 9/9, thread 24/24; typecheck passes after correcting the test fault injection's readonly-field typing. Temporary UI protocol relay source was preserved as A-1746 and removed from the repo.
