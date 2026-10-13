---
id: T-307
kind: task
title: "The verify line: a one-line summary of the suite queue in the sessions panel header, opening the queue view"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1.2
  - ready-for-agent
  - nvim
assignee: null
parent: T-275
blocked_by: []
topic: topic-188
branch: t/T-307-the-verify-line-a-one-line-summary-of
created: 2026-10-12T21:34:31.743Z
updated: 2026-10-13T01:22:50.051Z
---

## Summary

The `verify:` line in the sessions panel header becomes a one-line summary of the suite queue: who runs and for how long, how many wait, and when the next slot frees. Enter on it, and a palette action, open the queue view in the centre. The view shows the holder, the waiters in order with their waits, and the admission ETA from the median run.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: `docs/spec/v0.1.2.md` §3.6 (decided in T-246). §3.6 adds no general queue API. No board shows the queue view, so §3.6's words and `cland verify queue --json` are the reference.

## What to build

**The source.** The view shows what the hub already sends:

- the `verification` snapshot in `hub.status`;
- the live `verification.queue` frames (`VerificationQueue` in `hub/src/protocol.ts`): holder, ordered waiters with `waitMs` and `etaMs`, and metrics with the median and p90 run and wait.

Nothing new is asked of the hub. The snapshot and event ordering that `nvim/test/verification-queue.test.ts` already guards stays as it is.

**The summary line.** It replaces today's `verify: <holder> · waiting a (3s) → b (5s) · next ETA …` in the sessions panel header (`render_sessions` in `nvim/lua/cland/panels.lua`). It is one line that never wraps, cut with the shared display-cell fitter:

- With a holder: `verify: <holder> <run time> · <n> waiting · next ~<eta>`, for example `verify: impl-3 4m · 2 waiting · next ~6m`.
  - The holder is the session name, `hand run`, or `human` once ticket 06 lands.
  - The run time is the holder's run time.
  - `next` is the holder's remaining ETA.
  - With no waiters, the `· n waiting` part is left out.
  - An unknown ETA reads `next ?`.
- With no holder and waiters, for example during admission: `verify: free · <n> waiting`.
- With nothing at all: `verify: idle`.

The run time and the waits advance without a hub frame. The clock is local, refreshed at least every ten seconds, as the inbox ages advance. Durations read `45s`, `4m` and `1h 5m`. The line keeps a place for the remote runs (`remote 2/4`) that the remote executors will add. Do not draw that part now.

**The queue view.**

- Enter on the summary line opens the queue view in the centre. So does the palette action "Open verification queue", registered in the action registry with no global key unless a free one fits the key table.
- It is a centre view kind of its own in `nvim/lua/cland/views.lua`. It shows:
  - the holder: its session or `hand run`, its item, mode, run time, remaining ETA and worktree;
  - then the waiters in order: position, session, item, mode, wait so far and admission ETA;
  - then one metrics line: the run and wait medians and p90 over the last N runs.
- It redraws on each `verification.queue` frame and on the local clock.
- When the queue is empty, it says `nothing running · nothing waiting` and keeps the metrics line.
- `q` closes it as the other centre views close.
- `␣?` and the palette list its keys.

**Demo** (the epic's words). With one suite running and two waiting, the header reads the holder, its run time and the two waiting. Enter shows the waiters in order with the admission ETA.

**Out of scope.**

- A queue API beyond `cland verify` (§3.6).
- The human's `npm test` waiting in the queue (ticket 06). This view simply shows its waiter row once that ticket lands.
- Remote executors' counts.
- Cancelling a run from the view. `cland verify cancel` stays the way to cancel.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- The Neovim UI is tested headless on the stub hub, which already emits `verification.queue`, read with `screenstring()`. A Neovim-only delta needs `npm run test:nvim` green.
- No new seams inside the hub. Helpers stay out of `hub/test/harness.ts`.
- The view's redraw on frames is coalesced once per tick (T-293).
- Every key goes through the action registry.
- Suites run through `cland verify`, and only when the queue shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. The header shows the one-line summary in each state: idle, free with waiters, a holder with waiters, a hand run, and an unknown ETA. The run time advances without a hub frame.
  - done: impl-307 · 2026-10-13T01:22:15.030Z
- [x] C2. Enter on the summary line and the palette action "Open verification queue" open the queue view in the centre. It shows the holder, the waiters in order with their waits and admission ETAs, and the metrics line, and `q` closes it.
  - done: impl-307 · 2026-10-13T01:22:15.430Z
- [x] C3. A Neovim headless test on the stub hub runs the demo: one running and two waiting give the header's holder, run time and `2 waiting`, and Enter gives the order and ETAs. The existing race test between snapshot and event still passes.
  - done: impl-307 · 2026-10-13T01:22:15.733Z
- [x] C4. `nvim/README.md` describes the summary line, its states and the queue view with its keys. The `cland verify queue` paragraph of `hub/README.md` names the panel's summary line and view as its human-facing form.
  - done: impl-307 · 2026-10-13T01:22:16.050Z

## Comments

### impl-307 · 2026-10-13T00:24:53.725Z

Implementing header summary and verification centre view from existing snapshot/events only. Headless stub-hub screen tests cover the demo; Coordinator authorized presentation-only updates to the existing race test, retaining its exact protocol sequence and moving detail assertions into the queue view.

### impl-307 · 2026-10-13T00:30:50.206Z

Pushed head 98f754647ba00819c21cbd4df761281b5bce93da. Targeted verification-view and verification-queue tests, Neovim TypeScript check and diff check pass. Fetched/merged origin/dev at 5b4797b before final evidence. Review request queued by hub. Ordinary cland verify nvim submitted as f327cdf4-5492-4cdd-b328-c6ee1b658f42, behind T-291, following Coordinator's correction permitting queued submissions.

### impl-307 · 2026-10-13T00:39:17.511Z

Per Coordinator's shared-fix instruction: cancelled queued f327cdf4 before execution, cherry-picked e215e534 unchanged as fd230d3b046c96293f53c8b583e1f65d4a75628f, fetched/merged origin/dev (already up to date), pushed, updated review request and resubmitted cland verify nvim. Automatic diff selection widens to full because the required hub/README.md change is outside nvim.

### impl-307 · 2026-10-13T01:22:50.051Z

Final exact-head hub suite bcff8924-bc67-4212-8b7d-faafa33a2bfb passed at fd230d3b046c96293f53c8b583e1f65d4a75628f: full mode, 1,713 tests passed, zero failures/skips. Log A-1723. Reviewer source assessment A-1722 clear; requested final criterion verdict with this run. C1–C4 implementer done marks recorded.
