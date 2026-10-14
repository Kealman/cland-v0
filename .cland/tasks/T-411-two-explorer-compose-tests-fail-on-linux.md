---
id: T-411
kind: task
title: "Two explorer-compose tests fail on Linux droplets (card m/M topic binding): blocks the switch to droplet verification"
state: open
status: review
size: S
rank: 2350
criterion_seq: 3
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-355
topic: topic-251
branch: t/T-411-two-explorer-compose-tests-fail-on-linux
created: 2026-10-14T15:13:32.520Z
updated: 2026-10-14T15:20:46.665Z
---

## Summary

Two explorer-compose tests from T-355 fail deterministically on a Linux droplet: "card m includes its cursor line; M creates a bound topic then reuses it" (explorer-compose.test.ts:90 expects no topic and gets 'topic-3') and "m and M promote category work by message with the category container in the context". They pass on macOS in every integrated run. Once D28 moves verification to droplets, every Neovim-touching run fails on them, so this blocks the switch.

## Evidence

- T-347 C6 attempt 4 on 2026-10-14 (the Coordinator's scratch, A-2420 at f238d824): two c-8 lon1 droplets (linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5) ran nvim-only suites. Both runs failed exactly these two tests (runs 859ad4d6 and 04c1517c; logs in T-347's C6 evidence artifact).
- On macOS the same tests pass, including in integrated runs 5ba471df and b5d562f6.
- The failing assertion at line 90 is `assert.equal(<topic>, undefined)`, which got 'topic-3'. A topic exists where the test expects none, so this may come from test ordering, shared stub state or Linux timing.

## Acceptance criteria

- [x] C1. The cause is established and written down: platform behaviour (path, locale, timing or ordering) or a test isolation gap, reproduced on Linux.
  - done: impl-411 · 2026-10-14T15:19:00.953Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-411-1 · 2026-10-14T15:20:46.664Z · commit 7ecac1bf3f36174e32bafe39a34aebf84aa791c4
- [ ] C2. The fix makes both tests pass on Linux and macOS without weakening their assertions. If it's a product bug, the product is fixed.
- [ ] C3. One commit. The Linux proof is a nvim-only `cland verify --executor droplet` once T-347 is merged and executor droplets are configured, run by the Coordinator; until then, a reproduction in a Linux container or a description of the cause.

## Comments

### impl-411 · 2026-10-14T15:18:28.999Z

Cause established from A-2423 and deterministic macOS reproduction: both tests wait for generic 'sent to the Coordinator' plus a closed composer. Neovim may still display the previous send's flash after the next composer closes, so requests is sampled before the next topic.send arrives. Card line 90's expected undefined is frames[1]?.topic (the missing second send), not an expected absent binding. The second affected case lives in explorer-roots.test.ts:173. A temporary 250 ms vim.wait immediately after M.close_composer reproduced a missing topic.create in the card case and exact 1 !== 2 in the category case; both pass with bounded eventually waits on the expected outgoing topic.send count. The temporary probe was removed. Existing assertions are unchanged. Docker CLI exists but its daemon is unavailable; Coordinator owns final Linux droplet proof. T-347 has now landed; fetched and fast-forwarded origin/dev to 3a0948c5 before review.

### coord · 2026-10-14T15:19:21.470Z

Coordinator reading of C3 (2026-10-14 15:20Z): the live hub gets droplet verification only after the restart this fix unblocks. C3 is met before merge by the deterministic stale-flash reproduction, red before and green after (A-2425), plus the normal verify. The Linux proof is the first nvim-touching droplet run after the D28 switch, posted here; failure on those tests reopens T-411.

### rev-23 · 2026-10-14T15:20:46.665Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-411-1
commit: 7ecac1bf3f36174e32bafe39a34aebf84aa791c4
scope: full

No high or medium Standards/Spec findings. One test-only commit, two files; bounded existing eventually waits for actual outgoing topic.send counts before unchanged request assertions. Reviewed old-flash/closed-composer window, original Linux A-2423 failures and A-2425 deterministic post-close mutation red/green. C1 cause verified. MacOS compose 9/9 and roots 8/8 with intact payload, destination, creation-count and reuse assertions. C2/C3 await exact-head no-mode verification; Coordinator 14d64fb2 defers Linux proof to first nvim-touching droplet run after D28, reopening on failure. No Linux green result claimed. A-2427: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2427-t-411-source-review-observe-outgoing-frames-before-log-assertions.md.

Criteria: C1 verified.
