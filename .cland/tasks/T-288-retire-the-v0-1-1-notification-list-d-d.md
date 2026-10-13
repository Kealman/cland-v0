---
id: T-288
kind: task
title: Retire the v0.1.1 notification list, d/D and the 50-row cap from the inbox
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: E-274
blocked_by:
  - T-285
  - T-286
  - T-287
topic: topic-180
branch: t/T-288-retire-the-v0-1-1-notification-list-d-d
created: 2026-10-12T11:57:19.861Z
updated: 2026-10-12T21:25:59.945Z
closed: 2026-10-12T21:26:00.063Z
---

## Summary

The inbox's v0.1.1 notification list leaves, with its `d`, `D` and 50-row cap, now that the events view shows notifications and events. The docs and the role clauses describe the inbox, the `request` kind and the events view.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**The inbox loses its notification list.** The panel and full-width inbox show only the four sections, the events line and the archive line. The notification block goes, along with `D`, `d`'s dismissal of a notification, the 50-row cap and its "earlier · Agents log" footer, and the row-tracking that followed a selected notification. `d` keeps only the meanings the acting-from-a-row ticket gave it. The action registry, the palette and `␣?` lose the retired keys.

**The hub.** Notifications stop being an inbox section. The `Inbox` frame no longer carries them, and the `inbox.dismiss` and `inbox.dismiss_all` frames are removed. A client still sending them gets a refusal that points to the events view. The hub keeps producing what notifications recorded (verdicts, role changes, deaths, long idles, uncertain deliveries, failed turns, releases, imports) as journal records that `events.list` shows. D17 holds: not-clear verdicts and deaths are warnings in the events view and never count in needsYou. `cland inbox` no longer prints notification lines. The stub hub, the hub tests and the QA cases that asserted notifications in the inbox move their assertions to `events.list` and the events view or drop them, and the needs-you QA cases keep their meaning.

**The docs and the clauses.**

- `hub/README.md` and `nvim/README.md` describe the inbox of four sections, the `request` kind, the leave reasons and the archive, and the events view with its frame, keys and filters. The v0.1.1 notification text, the dismissal rows of the key table and the cap go.
- The role clauses tell sessions when to send a `request` to the human instead of a report: an Implementer or a Lead asking for the human's review, QA asking for a QA run, a handover to the human. This goes in the default clauses and in this project's `.cland/roles.toml`, which cland never rewrites; running role sessions pick the new clause up only on their next launch.
- `GLOSSARY.md`'s Events view entry needs no change unless the wording drifted.

**Demo.** A clear verdict shows in the events view and never in the inbox. `d` on a notification row is impossible because the inbox has none, and `D` does nothing in the inbox.

**Constraints.**

- Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project) and the fake harnesses second. Neovim runs headless on the stub hub. QA cases in `qa/cases/` still pass.
- No new seams inside the hub.
- Neovim is the host with no plugins (ADR 0005).
- Suites run through `cland verify`, the full suite here because hub tests change.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.
- Role sessions pick up the new clauses on their next launch.

## Acceptance criteria

- [x] C1. The inbox shows no notification list, no `D`, no 50-row cap and no "earlier" footer; `d` acts only on requests and messages; the registry, palette and `␣?` no longer list the retired keys.
  - done: impl-288 · 2026-10-12T20:15:02.330Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-2 · 2026-10-12T20:22:52.222Z · commit 549e1c6be41f998ccda8b5098d78403ed2a2ecad
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-4 · 2026-10-12T20:40:15.185Z · commit 23972965e8cea95c9906bcc26c5d643770601a47
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-6 · 2026-10-12T21:03:45.892Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-7 · 2026-10-12T21:25:23.005Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
- [x] C2. `inbox.list` carries no notifications, `inbox.dismiss` and `inbox.dismiss_all` are refused with a pointer to the events view, and `cland inbox` prints no notification lines.
  - done: impl-288 · 2026-10-12T20:15:03.262Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-2 · 2026-10-12T20:22:52.222Z · commit 549e1c6be41f998ccda8b5098d78403ed2a2ecad
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-4 · 2026-10-12T20:40:15.185Z · commit 23972965e8cea95c9906bcc26c5d643770601a47
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-6 · 2026-10-12T21:03:45.892Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-7 · 2026-10-12T21:25:23.005Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
- [x] C3. A clear verdict and a role change appear in `events.list` and the events view and never in the inbox; a not-clear verdict and a death appear as warnings there and never change needsYou.
  - done: impl-288 · 2026-10-12T20:15:03.836Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-2 · 2026-10-12T20:22:52.222Z · commit 549e1c6be41f998ccda8b5098d78403ed2a2ecad
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-4 · 2026-10-12T20:40:15.186Z · commit 23972965e8cea95c9906bcc26c5d643770601a47
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-6 · 2026-10-12T21:03:45.892Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-7 · 2026-10-12T21:25:23.007Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
- [x] C4. The default role clauses and `.cland/roles.toml` tell sessions to send review, QA and handover requests to the human with the `request` kind.
  - done: impl-288 · 2026-10-12T20:15:04.388Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-2 · 2026-10-12T20:22:52.222Z · commit 549e1c6be41f998ccda8b5098d78403ed2a2ecad
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-4 · 2026-10-12T20:40:15.186Z · commit 23972965e8cea95c9906bcc26c5d643770601a47
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-6 · 2026-10-12T21:03:45.892Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-7 · 2026-10-12T21:25:23.007Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
- [x] C5. Targeted tests pass (hub frame tests on a real hub, nvim headless tests on the stub hub, the QA cases that touched the inbox), `cland verify` is green, and `hub/README.md`, `nvim/README.md` and the clauses describe the inbox, the `request` kind and the events view.
  - verified: rev-23 [reviewer] · run rev-2026-10-12-288-7 · 2026-10-12T21:25:23.007Z · commit f5ed29251a0dd8eb06db3de48eef272ffb52e1d9
  - done: impl-288 · 2026-10-12T21:25:41.756Z

## Comments

### impl-288 · 2026-10-12T20:04:27.886Z

Started retirement at the existing protocol/CLI and headless UI seams. The real-hub tracer test is red because inbox.list still carries notifications. Journal notification records will stay; inbox notification storage and row actions will retire. T-284's C7 workload test remains in scope. Default clauses and this project's .cland/roles.toml will both change; running sessions receive the new clauses only when relaunched, so the Coordinator must relaunch after merge.

### impl-288 · 2026-10-12T20:15:50.880Z

C1–C4 implemented and marked done; C5 awaits final verification. Evidence: A-1616, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1616-t-288-implementation-and-targeted-verification.md. Targeted protocol, CLI, inbox actions, registry/palette/help, needs-you and THREAD-009/010 QA cases pass; bounded startup/event workload remains green. Fetched and merged current origin/dev (9f0f522, including T-279 fixture setup); resolved the stop-race test import conflict by preserving copyPreparedProject and EventsPage. Both role sources were parsed successfully. The Coordinator must relaunch running sessions after this merges to adopt the request clauses.

### rev-23 · 2026-10-12T20:20:32.441Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-1
commit: 0cdca0324d70aad1acb6bbcf27f610334eb87221

Medium — hub/test/codex-adapter.test.ts:664: since() now flushes through ui after ui.close() at line 656, so the two-spoke restart regression cannot receive its log-barrier result; use ui2 and preserve assertions.
Low — hub/src/cli/inbox.ts:10, :50; hub/README.md:218: CLI help/comments and inbox publication text still describe retired notifications/dismissals.
C1–C4 source assessment clear; C5 failed. Evidence A-1619: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1619-t-288-review-closed-restart-client-in-log-barrier.md.

Criteria: C5 failed (Post-restart codex adapter test flushes through closed ui instead of live ui2; full verification remains pending.).

### impl-288 · 2026-10-12T20:22:19.127Z

Fixed review run rev-2026-10-12-288-1 (A-1619): since() uses the live restarted ui2 for its flushLogs barrier, and stale CLI/help/README notification descriptions are corrected. The focused two-spoke restart test passes (1/1); all reconnection assertions preserved. Corrected head 549e1c6be41f998ccda8b5098d78403ed2a2ecad is pushed after fetching/merging origin/dev (already current). Evidence A-1621 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1621-t-288-review-corrections-and-restart-verification.md. Old full run 543870eb was cancelled before edits; fresh full verification and re-review follow. C5 remains pending.

### rev-23 · 2026-10-12T20:22:52.222Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-2
commit: 549e1c6be41f998ccda8b5098d78403ed2a2ecad

No high/medium findings remain. The post-restart log barrier uses live ui2 with original assertions preserved; A-1621 reports the focused restart regression passed 1/1. Stale CLI help/comment and README text are corrected.
C1–C4 verified. C5 remains unverified pending the full exact-head cland verify result. Evidence A-1622: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1622-t-288-corrected-source-review-at-549e1c6.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-23 · 2026-10-12T20:38:46.290Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-3
commit: 549e1c6be41f998ccda8b5098d78403ed2a2ecad

Medium — hub/test/review-qa.test.ts:94: assertion still requires obsolete blanket human-message prohibition; preserve mention/decision routing and test the explicit request exception.
Medium — hub/test/surface.test.ts:68: assertion still requires only Coordinator asks the human, excluding intentional requests; retain decision-question restrictions and verify the request clause.
C1–C4 source assessment retained. Full result A-1625 is 1377/1379, exit 1; C5 failed. Evidence A-1627: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1627-t-288-full-verification-stale-role-clause-assertions.md.

Criteria: C5 failed (Full verify a02908b6 exit 1: two stale default-role assertions fail; Neovim phase not reached.).

### impl-288 · 2026-10-12T20:39:44.755Z

Corrected the two stale role-clause assertions reported by full suite A-1625 and review A-1627. surface.test.ts keeps Coordinator decision-question routing and mention restrictions, and checks explicit request/no-to/subtype/subject instructions in defaults and project clauses (including Lead). review-qa.test.ts keeps verifier workflow and ordinary-message restrictions with the request exception. Focused surface 3/3, review/QA clause 1/1, and real-spoke any-role request validation 1/1 pass; typecheck passes. Evidence A-1628: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1628-t-288-role-clause-test-corrections.md. Test-only correction pushed at 23972965e8cea95c9906bcc26c5d643770601a47; origin/dev fetched and merged (already current). C5 awaits corrected-head full suite and re-review.

### rev-23 · 2026-10-12T20:40:15.186Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-4
commit: 23972965e8cea95c9906bcc26c5d643770601a47

No high/medium findings. The two stale role tests now cover the explicit request exception, preserving ordinary-message mention scope, Coordinator decision questions and verifier workflow assertions. Production behavior is unchanged; focused tests in A-1628 pass. C1–C4 verified; C5 awaits complete exact-head cland verify including Neovim. Evidence A-1629: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1629-t-288-request-clause-assertion-review-at-2397296.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-23 · 2026-10-12T21:00:51.069Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-5
commit: 23972965e8cea95c9906bcc26c5d643770601a47

Medium — nvim/test/shell.test.ts:1969: openInbox requires MESSAGES TO YOU, absent in the failing unknown-count case despite INBOX/ask/approval/events/archive already rendered; fix readiness/fixture while preserving all count and row assertions.
C1–C4 source assessment retained. A-1633 completes all phases at 1679/1680, exit 1; C5 failed. Evidence A-1634: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1634-t-288-full-verification-inbox-readiness-wait-fails.md.

Criteria: C5 failed (Full verify e5bb0b58 exit 1: unknown-count shell case times out in openInbox's messages-header wait before count assertions run.).

### impl-288 · 2026-10-12T21:03:17.750Z

Fixed A-1633/A-1634's unknown-count test readiness failure. openInbox now waits for the common ask/approval row instead of an optional message section; the final no-number snapshot wait requires response rows to clear before asserting retained needsYou. All original count and row checks remain, production and fixture contents unchanged. Focused unknown-count case passes 1/1; complete nvim/test/shell.test.ts passes 83/83. Evidence A-1635 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1635-t-288-inbox-readiness-and-count-regression-verification.md. Two-line test correction pushed at f5ed29251a0dd8eb06db3de48eef272ffb52e1d9 after fetch/merge origin/dev (already current). C5 awaits new-head full verification and review.

### rev-23 · 2026-10-12T21:03:45.892Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-6
commit: f5ed29251a0dd8eb06db3de48eef272ffb52e1d9

No high/medium findings. Shared readiness waits for the common ask row; separate message-section coverage remains. Missing-number snapshot wait now proves old response sections cleared before retained-count assertions. All original count/row assertions preserved; A-1635 reports focused 1/1 and complete shell 83/83 pass. C1–C4 verified; C5 awaits exact-head full green result. Evidence A-1636: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1636-t-288-inbox-readiness-correction-review-at-f5ed292.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-23 · 2026-10-12T21:25:23.008Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-288-7
commit: f5ed29251a0dd8eb06db3de48eef272ffb52e1d9

No high/medium findings. C1–C4 source assessment retained; C5 verified by full exact-head cland verify 84a4c958 in A-1642: typecheck and all phases, hub-free 30/30, hub-machine 1349/1349, Neovim 301/301, total 1680/1680, zero skips/cancellations, exit 0. Retirement, role-clause, restart, unknown-count and THREAD-009/010 cases pass. Evidence A-1644: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1644-t-288-final-review-complete-green-verification.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-288 · 2026-10-12T21:25:42.654Z

Complete verification is green at unchanged pushed head f5ed29251a0dd8eb06db3de48eef272ffb52e1d9: cland verify all run 84a4c958-13aa-419e-9714-125a0cc7e52d, exit 0, all 1680 tests passed with no skips or cancellations. Exact-head typecheck, hub free/machine phases and Neovim all passed. Durable log A-1642: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1642-suite-84a4c958-13aa-419e-9714-125a0cc7e52d-all-at-f5ed292.log. Reviewer rev-23 recorded clear rev-2026-10-12-288-7 with C1–C5 verified; A-1644: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1644-t-288-final-review-complete-green-verification.md. C5 marked done; all criteria complete. Claim retained until merge. Coordinator relaunch of running sessions after merge is required to adopt the updated default/project request clauses.

### coord · 2026-10-12T21:25:59.945Z

Merged bbf7d08986e05173df7250fd2347b1aadd5c0c6f onto dev.
