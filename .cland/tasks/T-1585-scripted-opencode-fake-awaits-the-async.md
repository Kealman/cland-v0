---
id: T-1585
kind: task
title: Scripted OpenCode fake awaits the async adapter close
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
regression_of: T-1545
found_by: review
topic: topic-1313
branch: t/T-1585-scripted-opencode-fake-awaits-the-async
created: 2026-11-01T22:33:25.214Z
updated: 2026-11-01T23:41:39.692Z
closed: 2026-11-01T23:41:39.692Z
---

## Summary

The scripted OpenCode fake's `lifecycle.close` calls the now-async `adapter.close()` without awaiting it before the lifecycle close, so fixture ownership can be released before the adapter drains. Await the adapter close first, as T-1546 does for Codex.

## What to build

In `hub/test/fakes/scripted-opencode.ts`, the wrapped `lifecycle.close` awaits `adapter.close()` and then the original close, and returns that promise. Tests that use the fake keep their assertions. A regression proves that a close with a pending adapter drain does not release fixture ownership early.

Found by the T-1546 reviewer (A-15441, 2026-11-01 22:33Z) after T-1545 made adapter close async.

## Acceptance criteria

- [x] C1. The scripted OpenCode fake's close awaits `adapter.close()` before the lifecycle close and returns the combined promise.
  - done: impl-1585 · 2026-11-01T22:39:58.647Z
  - verified: rev-35 [reviewer] · run rev-35-1585-source-1 · 2026-11-01T22:41:50.556Z · commit 11051573caebc3ba2aa7c17f76c37f3f7378b20f
  - verified: rev-35 [reviewer] · run rev-35-1585-final-1 · 2026-11-01T22:58:58.571Z · commit 11051573caebc3ba2aa7c17f76c37f3f7378b20f
- [x] C2. A test holds the adapter drain open and proves that fixture ownership is released only after the drain finishes.
  - done: impl-1585 · 2026-11-01T22:39:58.786Z
  - verified: rev-35 [reviewer] · run rev-35-1585-final-1 · 2026-11-01T22:58:58.571Z · commit 11051573caebc3ba2aa7c17f76c37f3f7378b20f
- [x] C3. Every test that uses the fake passes unchanged.
  - done: impl-1585 · 2026-11-01T22:39:59.310Z
  - verified: rev-35 [reviewer] · run rev-35-1585-final-1 · 2026-11-01T22:58:58.571Z · commit 11051573caebc3ba2aa7c17f76c37f3f7378b20f

## Comments

### impl-1585 · 2026-11-01T22:38:40.307Z

Red-first receipt: new test `scripted OpenCode close retains lifecycle ownership until the adapter drain finishes` failed before the fix with AssertionError `lifecycle must retain ownership during adapter drainage`, actual ['lifecycle closed'], expected []. The held adapter close was released and restart joined in finally. Consumer inventory: direct imports opencode-native.test.ts, fakes/remote-approval-harness.ts, self; indirect consumers telegram-approvals.test.ts, discord-cards-fixture.ts -> discord-cards.test.ts and telegram-polling-restart.test.ts. Only scriptedOpenCode's wrapped close changes; ScriptedOpenCode class users retain the existing shape/behavior.

### impl-1585 · 2026-11-01T22:41:27.418Z

Head 11051573caebc3ba2aa7c17f76c37f3f7378b20f committed and pushed to origin. Local macOS Node 24.21.0 targeted tests: opencode-native 32/32, telegram-approvals 23/23, discord-cards 68/68, telegram-polling-restart 9/9. npm run typecheck passed. npm run test:lint exit 0, 0 refusals; existing 123 report-only findings/60 files and known T-1484 advisory. Artifact A-15448 holds red-first evidence and consumer inventory. Source review requested; mode-free hub verification pending clear source verdict. No browser run or full local suite. Fetch/merge dev up to date, merge-tree clean.

### rev-35 · 2026-11-01T22:41:50.556Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1585-source-1
commit: 11051573caebc3ba2aa7c17f76c37f3f7378b20f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards/Spec no findings. Async scriptedOpenCode wrapper awaits adapter then original lifecycle close and returns combined promise: C1 verified. Held-drain regression observes entry before checking no early lifecycle release, releases/joins in finally and asserts final receipt order; explicit5s test bound and bounded setup. Original consumer assertions unchanged; direct factory versus indirect class consumer inventory inspected. C2/C3 await exact-head mode-free verify with named OpenCode32/Telegram approvals23/Discord68/restart9 outcomes. A-15452: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15452-t-1585-source-review-at-11051573.md. A-15448 targeted local reports/static checks are not suite evidence. Reviewer ran no tests/browser. QA none by item policy.

Criteria: C1 verified.

### rev-35 · 2026-11-01T22:58:58.571Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1585-final-1
commit: 11051573caebc3ba2aa7c17f76c37f3f7378b20f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C3 verified. Exact-head uncached queued90ddb59e/A-15470 exit0,4606 pass, zero fail/cancel/skip/todo; T0/T1/all fallback T2/Web completed, T3 deferred/T4 unexecuted. Actual timing outcomes OpenCode32 incl held-drain ownership regression, Telegram approvals23, Discord68 all pass; preserved assertions unchanged. A-15471 supplies nine named local restart outcomes/native exit0 with explicitly reconstructed dirty-tree identity (not original runner stamp), and source inventory confirms its path uses only unchanged ScriptedOpenCode class, never changed factory. Linux droplet Node24.21/Neovim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4; local restart macOS Node24.21/no browser. Report-only advisories retained. Source verdict remains unchanged; no full T3 claim. QA none. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-01T23:41:39.692Z

Merged 60f68921a7284696e32c70fdd108e4b165aea38c onto dev.
