---
id: T-513
kind: task
title: Hub start provenance and an autostart grace period after a deliberate stop
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-322
branch: t/T-513-hub-start-provenance-and-an-autostart
created: 2026-10-15T16:26:22.615Z
updated: 2026-10-15T22:09:34.372Z
---

## Problem

On 2026-10-15 a stopped hub was restarted within 0.5 s three times by something other than the restart script (T-204). The cause is the Neovim workbench's autostart: nvim/lua/cland/hub.lua:37/:45 has autostart on by default, and :222–224 and :263–267 run `cland hub start` after failed connects. That spawns `hub serve` detached with the workbench's own environment (hub/src/cli/hub.ts:99). An env-dependent restart, such as a changed token or knob, can therefore come up with the wrong environment, and the hub-started record doesn't say who started it.

## Acceptance criteria

- [x] C1. hub-started records its starter: client kind (cli, nvim or other), parent pid and cwd. It never records environment values.
  - done: impl-513 · 2026-10-15T21:05:33.518Z
  - verified: rev-30 [reviewer] · run rev-20261015-513-source-correction · 2026-10-15T21:24:05.838Z · commit f554be2d6a728deb9483647d5f82d30dfa3a63f7
  - verified: rev-30 [reviewer] · run rev-20261015-513-final · 2026-10-15T22:09:34.372Z · commit f554be2d6a728deb9483647d5f82d30dfa3a63f7
- [x] C2. `cland hub stop` leaves a stop-in-progress marker with a short grace period that autostart honours. A deliberate stop-and-restart by the CLI therefore isn't pre-empted, while a crashed hub still autostarts.
  - done: impl-513 · 2026-10-15T21:23:10.132Z
  - verified: rev-30 [reviewer] · run rev-20261015-513-source-correction · 2026-10-15T21:24:05.838Z · commit f554be2d6a728deb9483647d5f82d30dfa3a63f7
  - verified: rev-30 [reviewer] · run rev-20261015-513-final · 2026-10-15T22:09:34.372Z · commit f554be2d6a728deb9483647d5f82d30dfa3a63f7
- [x] C3. A test stops the hub with a fake Neovim autostart client attached, and the CLI's own start serves first.
  - done: impl-513 · 2026-10-15T21:05:37.770Z
  - verified: rev-30 [reviewer] · run rev-20261015-513-source-correction · 2026-10-15T21:24:05.838Z · commit f554be2d6a728deb9483647d5f82d30dfa3a63f7
  - verified: rev-30 [reviewer] · run rev-20261015-513-final · 2026-10-15T22:09:34.372Z · commit f554be2d6a728deb9483647d5f82d30dfa3a63f7

## Comments

### impl-513 · 2026-10-15T20:52:41.158Z

Plan: use the established CLI + real daemon/socket seam for a deterministic fake Neovim client attached during stop; assert its autostart is deferred and explicit CLI start serves first. Add starter client/parent PID/cwd only (no environment capture), a short .cland/run stop grace marker, and label Neovim automatic starts. Cover actual Lua client behavior at the existing headless workbench seam. Epic E-425 has no additional Coordinator comments; qaPolicy is none/after-stage.

### rev-30 · 2026-10-15T21:07:48.256Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-513-source
commit: 236185c4bfb14905b953b2e7809c6768e16e68b9
scope: full

Source review T-513 not clear at 236185c4bfb14905b953b2e7809c6768e16e68b9. Standards and Spec reviewed directly under the no-delegation role.

Medium — hub/src/cli/hub.ts:211: the stop CLI unconditionally rewrites hub-stop.json after waitForExit has observed the old daemon gone. At that point the old daemon has released the startup lock. A concurrent explicit start can acquire that lock, clear the old marker at daemon.ts:82 and start serving, after which the delayed old stop command recreates a fresh ten-second marker. The successor did not deliberately stop: if it crashes during that interval, Neovim autostart is incorrectly deferred, despite the explicit start having cleared the grace. This also contradicts the documented explicit-start clearing guarantee. Finalize the stop marker while its old-generation ownership is still established, or otherwise prevent a finishing stop from rewriting it after a successor starts. Add a deterministic boundary regression (hold the old stop continuation after exit, complete an explicit successor start, then release it) without weakening existing assertions.

C2 not verified / failed for this stop/start generation race. The currently supplied race test awaits the entire stop CLI before explicit restart, so it establishes the intended normal workflow but cannot detect the late old-stop write.

Standards otherwise: startup marker and metadata are isolated in a small module; automatic daemon starts check grace both before spawning and under the project lock; rejected startup releases its lock. Expired/malformed markers permit recovery. CLI fallback still checks stop permission and verified project-lock ownership before signal, and marker creation is after those checks. Neovim requests --autostart/--client nvim and retries deferred success; explicit starts bypass and clear under the lock. No broad environment record is added. Whitespace check clear.

C1 source checked: initiating runHub captures client kind, process.ppid and original cwd before detaching. Detached serve validates/projects exactly these fields; direct serveProject defaults to other. hub-started records starter metadata only. The new daemon case checks a sentinel never enters the journal, cli/nvim/other provenance and original subdirectory cwd. C3 source checked: a real daemon with attached fake Neovim client attempts automatic start on disconnect, sees grace, and explicit CLI subsequently serves first; direct serve's lock check and real headless client integration are covered. These facts remain valid but are not final all-criteria settlement.

A-3361 reports daemon17/17, headless client7/7, CLI imports3/3, typecheck and diff check green at this head. Normal crash and expired-marker recovery are tested; the successor race above remains absent. No full verification has run. Correct source and request re-review before verification. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions.
Evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3361-t-513-implementation-and-targeted-verification.md.

Criteria: C2 failed (The old stop CLI writes a fresh marker after releasing daemon ownership, so it can overwrite an explicit successor's grace clearing and defer that successor's crash recovery.).

### rev-30 · 2026-10-15T21:24:05.838Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-513-source-correction
commit: f554be2d6a728deb9483647d5f82d30dfa3a63f7
scope: delta

Corrected source review T-513 clear at f554be2d6a728deb9483647d5f82d30dfa3a63f7, delta from reviewed236185c4bfb14905b953b2e7809c6768e16e68b9. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

C2 failure A-3364 resolved: the stop CLI no longer rewrites hub-stop.json after observing old-daemon exit. Normal accepted-stop grace is created before disconnect and refreshed inside the old daemon's startup lock; authorized signal fallback still marks before signaling. The delayed old CLI therefore cannot re-create the marker after an explicit successor clears it.

The new controlled CLI-boundary regression pauses only the old stop process's first ESRCH observation. It starts an explicit successor on the real project lock, proves the old stop has not completed and the marker is absent, releases the continuation, observes its release receipt, awaits stop completion and asserts the marker remains absent. It then crashes the successor and proves immediate --autostart --client nvim recovery. Preload is private to that CLI test invocation, not a production hook. onCleanup releases and joins the held CLI before fixture deletion. Existing assertions and time bounds remain. A-3374 records red-before1.41s at the exact stale-marker assertion, corrected whole daemon18/18 green30.70s under local verification load, new case2.38s.

C1 verified: unchanged three-field starter projection captures client, initiating parent's PID and original cwd before detach; no environment metadata is recorded. C2 verified from corrected source and daemon boundary proofs, including short stop grace, explicit clear, expired marker and crash recovery. C3 verified: original real attached-fake-Neovim race and actual headless client proof remain; prior unchanged source receipts A-3361 client7/7 and CLI imports3/3 apply. Corrected daemon file reruns the original stop/restart and provenance cases.

Standards: two-file correction, one production deletion plus regression, no dev merge after first review. Typecheck and whitespace check green. No guard or identity check removed.

This is corrected source clearance only. Final overall review still requires exact-head cland verify receipt. Coordinator's current E-387 stage-close verify hold remains in force: wait for its explicit release/admitted notice before submitting. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions.
Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3374-t-513-corrected-source-old-stop-cannot-rewrite-successor-grace.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-15T22:09:34.372Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-513-final
commit: f554be2d6a728deb9483647d5f82d30dfa3a63f7
scope: evidence

Final evidence review T-513 clear at unchanged f554be2d6a728deb9483647d5f82d30dfa3a63f7. No high, medium or low findings. Corrected source verdict A-3376 stands; old-stop/successor marker finding A-3364 remains resolved.

A-3398 /f7fbb37c-2de6-4de5-bb56-8af9405ecc12 is actual Linux c-8 lon1, full mode, exit0:2224 pass, zero failures/cancellations, six platform skips. Typecheck, hub and full Neovim completed. Duration1403.16s, peak one-minute load12.57, lifetime1490s/$0.1035. No hard duration-budget failure.

C1 reverified: expiry/crash/provenance case passes2.937s at898, checking all starter client kinds, parent PID/original cwd and absence of the environment sentinel. C2 reverified: attached-autostarter stop/CLI restart case3.092s at896; controlled late-stop continuation/successor crash-recovery case3.175s at897. These exercise real startup lock/discovery boundaries, grace deferral and explicit marker clearing without the removed post-exit marker rewrite. C3 reverified: attached fake Neovim race passes, and actual headless client autostart/restart cases pass at5955/5957 (1.811s/3.673s), retaining thread behavior and observing deferred autostart before explicit restart.

No source change after corrected source clearance. No supplementary QA scope or additional runtime proof is required by the task criteria. Changed-head integration/conflict resolution requires delta review. No Reviewer tests, edits, merges or provider actions.
Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3398-suite-f7fbb37c-2de6-4de5-bb56-8af9405ecc12-auto-at-f554be2.log.

Criteria: C1 verified, C2 verified, C3 verified.
