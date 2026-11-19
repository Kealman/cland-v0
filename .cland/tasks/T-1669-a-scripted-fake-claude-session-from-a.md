---
id: T-1669
kind: task
title: A scripted fake-Claude __session from a fixture outlived its test for nine days, reparented to launchd with its spoke
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1649
branch: t/T-1669-a-scripted-fake-claude-session-from-a
created: 2026-11-04T00:16:33.070Z
updated: 2026-11-19T07:10:47.536Z
---

## Summary

On 2026-11-04 impl-1607 found PID 42652 (`hub/test/fakes/claude-code/fake-claude.ts __session 14468a72`, from the T-1274 worktree) with PPID 1, elapsed 9 d 15 h. Its `cland-spoke.ts` child was PID 43277. Some fixture launched a scripted fake-Claude session and never joined it. coord sent SIGTERM to both literal PIDs; both exited. Which test leaked it is unknown.

## What to build

Find the fixture path that can leave a fake-Claude `__session` (and its spoke) running after its test ends, and make that path own and join it, as T-1659 did for host agents. Add a post-file census for fake-Claude sessions to the Claude adapter test files.

## Acceptance criteria

- [ ] C1. The leaking fixture path is named, with a deterministic reproduction that leaves a `__session` alive before the fix (test).
- [ ] C2. After the fix, the Claude adapter test files end with an empty census of fake-Claude sessions and spokes, including on a failing test (test).

## Comments

### impl-1669 · 2026-11-19T06:25:03.282Z

Leak path identified: fakeClaude -> fake-claude.ts startBackground spawns detached/unref'ed __session; normal fakeClaude ownDirectory drain reads writers/*.json, but SIGKILL of the test worker bypasses that hook. __session has no fixtureOwnership receipt and fixture-processes candidate classifier excludes fake-Claude, leaving worktree orphan recovery unable to join it or its spoke. New red-first T3 regression kills a disposable fixture worker after positive session + spoke launch controls; orphan discovery fails exactly at ownership recognition. Awaiting T-1676 root-local receipt change before implementation.

### impl-1669 · 2026-11-19T06:26:14.481Z

Red evidence A-21611 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21611-t-1669-red-first-fixture-recovery-evidence.md. Correction to its source-base sentence: tested prepared branch HEAD is 808a00be1, not db53a0cb9 (running hub tip). Positive-control/regression output unchanged. Native slot released; awaiting Coordinator notice that T-1676 landed before receipt production.

### impl-1669 · 2026-11-19T07:04:31.929Z

Independent preparation while T-1676 receipt production is held: final named census tests added to native Claude adapter/accounts/sessions/remote and cleanup files; nested-file positive controls prepared for omitted cleanup and a controlled failing body. Census registration is deliberately not wired into fakeClaude yet so the next granted native slot can show its red first. Expanded worktree passes full npm run typecheck and git diff --check (macOS/local Node24.21); full npm run test:lint passed the earlier intermediate preparation (0 refusals). No runtime claim for expanded census tests yet. Native-slot question approved and queued after T-1676's short red; waiting for Coordinator grant.

### impl-1669 · 2026-11-19T07:10:47.536Z

Census slice red/green under granted native slot (now released): valid red observed live session+spoke with cleanup deliberately omitted, but nested final census erroneously passed and child exited0, so outer expected-exit1 assertion failed. After wiring fakeClaude registry/group retention, targeted cases `fake Claude final census detects dropped cleanup`, `fake Claude final census detects failing body`, and `Claude cleanup file ends with no fake sessions or spokes` passed3/3 exit0 on macOS/local Node24.21. In dropped-cleanup case the nested named census explicitly fails with child exit1; controlled failing body runs real teardown and nested census passes after session/spoke exit. Receipt recovery test remains intentionally red pending T-1676 final format. Initial census setup attempts were incomplete (nested node:test skipped files due inherited NODE_TEST_CONTEXT); fixed by clearing it through fixtureEnvironment overlay, and those attempts are not red proof.
