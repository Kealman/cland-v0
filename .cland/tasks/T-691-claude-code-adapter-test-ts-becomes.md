---
id: T-691
kind: task
title: claude-code-adapter.test.ts becomes Claude Code's one contract file; its permutations and negative sleeps leave the real binary
state: open
status: review
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-686
  - T-679
topic: topic-422
branch: t/T-691-claude-code-adapter-test-ts-becomes
created: 2026-10-16T19:59:35.709Z
updated: 2026-10-17T06:40:50.282Z
---

## Summary

Decision 5: one real-binary contract file per harness, plus the T3 scenarios, carry the fake harness binaries; everything else uses T-686's in-process fake adapter. This ticket defines the contract file for Claude Code and the checklist the Codex and OpenCode tickets reuse. `claude-code-adapter.test.ts` (56.2 s, 9 tests; 4 `startDaemon`, 3 `spawnSpoke`, 10 fake-binary sites, 13 numeric sleeps at f63afbac) is the frame proof for the family but also loops `CLAUDE_CONFIG_DIR` four ways through launch, stop, resume and relaunch and proves seven negatives by `sleep(k * POLL_MS)` (report-slice4 T-692, anti-pattern C). `claude-code-sessions.test.ts` (40.8 s) holds the signal-ordering proofs across real `cland hook` processes.

## What to build

- **The contract file.** `claude-code-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "claude-code" }`. Its header lists the contract steps it proves once each, through the real fake binary, real spoke, hooks and mod: launch and attach command, role clause in the first turn, inject through the mod bridge to `injected`, hook signals to session state, usage and model, stop, resume across a hub restart, relaunch. The checklist goes into `docs/agents/tests.md` for T-692 and T-693.
- **Out of the binary.** The four `CLAUDE_CONFIG_DIR` selections become one frame proof plus a T1 table test of the environment the adapter composes. Each negative wait becomes a positive barrier (the next recorded call or event) or moves to the in-process fake.
- **The hub's own composition, once.** A new T2 file proves on T-686's fake adapter, for all three flavours as one table, what the hub composes before any adapter sees it: the launch brief after the role clause, the shared-artifact envelope naming its id and durable path, and a Lead's claim with its clause. T-692, T-693 and T-695 delete the per-adapter duplicates against it.
- **claude-code-sessions.test.ts** keeps the signal-ordering and pid-reuse proofs as T3 with a header; `resume never adopts … pid` runs on `projectHub` instead of a spawned hub.

## Acceptance criteria

- [ ] C1. `claude-code-adapter.test.ts` is the `claude-code` contract entry in `tiers.json`, and its header lists each contract step with the one test that proves it.
- [ ] C2. The two files' manifest seconds fall from 97.0 s (A-3877) to 80 s or less, and the numeric sleeps in them from 14 to 0 apart from reasoned markers.
- [ ] C3. Their `startDaemon`, `spawnSpoke` and fake-binary call sites are recorded before and after, and every remaining one is in a test whose title names the process or harness behaviour it proves.
- [ ] C4. An audit of test declarations and assertions before and after maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
- [ ] C6. The new T2 composition file passes the tier lint with no child process and covers the three flavours.
- [ ] C7. `docs/agents/tests.md` carries the contract-file checklist.

## Blocked by

T-686 (in-process fake adapter), T-679 (`tiers.json` object entries).

## Comments

### impl-691 · 2026-10-17T06:32:23.401Z

Implemented shared three-flavour T2 composition (brief order for explicit/preassigned roles, artifact envelope, Lead claim/clause), adapterless refusals and idle retry policy. Added memory-only production-adapter environment table (T2 due child_process import false-positive); retained one unset-directory binary frame. Replaced hook startup sleep/spin with fd-3 release barrier and converted PID-reuse reopen to projectHub. Per Coordinator decision 2a1f74fe in topic-422, scheduler/signed-out waits stay pending T-696 Clock at first review; source untouched.

### impl-691 · 2026-10-17T06:40:44.305Z

Ready for source review at 0fb6d9f16cc3df9322b22d850b475c9487243298 (pushed origin). Evidence A-4322 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4322-t-691-assertion-migration-audit-and-5x-mac-receipts/README.md includes declaration-by-declaration assertion map, census and all 20 final serial Mac TAP receipts. Historical manifest seconds 56.219873+40.798841 → 35.014601+21.823140=56.837741; new T2 composition .517101s and env table .005697s. All touched files 5/5, start loads 5.70–13.19; typecheck/tier lint/diff check green. Removed 10 legacy allowances (120.938 allowance-seconds), no new allowance. Scheduler/auth waits explicitly deferred by Coordinator decision 2a1f74fe until T-696 Clock merges; T-696 remains in progress, production adapter untouched. QA policy scope none; Linux task verify awaits clear source verdict.
