---
id: T-371
kind: task
title: Tests read a Claude launch's pid before T-265's shared schedule discovers it (session-holds dying.pid null under load)
state: closed
status: done
size: XS
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-265
topic: topic-231
branch: t/T-371-tests-read-a-claude-launch-s-pid-before
created: 2026-10-14T01:55:14.928Z
updated: 2026-10-14T02:26:20.581Z
closed: 2026-10-14T02:26:20.581Z
---

## Summary

Since T-265, a Claude Code launch can return before its pid is discovered: the 250 ms discovery loop is gone, and the pid arrives on the shared 30 s schedule. `hub/test/session-holds.test.ts` "delivered verifier requests persist across restart and clear on hold, verdict, stop and death" reads `pid` from the launch result and asserts it at line 215. Under load that assertion fails.

## Evidence

- Integrated run d80d1b41 at 3dae3b5 on 2026-10-14, at a peak 1-minute load of 25.85: 1588/1589 passed, and the only failure was `assert.ok(dying.pid)` (`actual: null`) at session-holds.test.ts:215. The log is A-2173.
- The test passes alone on dev, in 7.7 s.
- T-265's risk note named this: "a new Claude session can run up to 30 s without a pid … tests that expected a pid at once may need to wait".

## What to do

1. Make the test wait for the pid through `session.list` (eventually: the row has a pid) before the SIGKILL, rather than reading it from the launch result.
2. Search `hub/test` for other tests that read a Claude launch's pid straight from the launch result, and give them the same wait.
3. This is a shared test fix: one commit, cherry-picked into every live branch that contains T-265.

## Comments

### impl-371 · 2026-10-14T01:59:46.303Z

Implemented the test-only fix: shared withDiscoveredPid helper reads session.list via eventually, matches the launch's sessionId, and allows 45 s for the default 30 s schedule (CLAND_TEST_WAIT_MS remains supported). Applied to stale launch snapshots used for death, restart, stop assertions and cleanup, including mixed-harness tests that use Claude. Kept T-265's intentional null-pid schedule assertion. Targeted reported session-holds case passed; session-events 3/3 passed; typecheck passed. Broader targeted visibility check in progress; one commit will be pushed for review.

### impl-371 · 2026-10-14T02:02:05.806Z

Pushed the single test-only commit 3f00de8b41bfde39ec3e28348bb3ffbaca109b6f and requested review from rev-23. Evidence/diff A-2175: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2175-t-371-pid-discovery-fix-and-review-evidence-at-3f00de8b.md. Typecheck passes; completed targeted checks 25/25 (session-holds 1, session-events 3, visibility 15, Claude adapter 6 including shared default schedule). Source review precedes queued verification.

### rev-23 · 2026-10-14T02:03:56.164Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-371-1
commit: 3f00de8b41bfde39ec3e28348bb3ffbaca109b6f
scope: full

Medium — hub/test/crew-launch.test.ts:144,175,184 and hub/test/session-resume.test.ts:35: the requested step-2 audit misses Claude launch/handoff/resume snapshots still used for live-PID lookup or process-replacement assertions. Null snapshot PIDs can fail correct cwd/replacement behavior. Apply exact-session PID discovery before those consumers, retaining native-context/identity/cwd/replacement assertions. The shared helper, repaired session-holds case and other 13-file changes have no further high/medium findings; intentional null-PID coverage remains intact. No numbered criteria on this item, so no criterion marks. Full verification pending corrected source clear. A-2177: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2177-t-371-source-review-missed-pooled-resume-pid-consumers.md.

### impl-371 · 2026-10-14T02:06:39.892Z

Addressed A-2177's missed crew-launch and session-resume pid consumers, plus verifier-routing's Claude QA relaunch comparison found in the renewed audit. Amended the single test-only commit to 8ed38949671b97cac624126a4907b29b77eeb300 and pushed to origin. Original assertions preserved. Corrected source: typecheck passes; targeted pooled handoff 2/2, stopped-Claude resume 1/1 and queued-QA routing 4/4 pass. Earlier unchanged source passed 27 targeted checks. Requesting renewed source review; no full verification submitted.

### rev-23 · 2026-10-14T02:07:27.305Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-371-2
commit: 8ed38949671b97cac624126a4907b29b77eeb300
scope: full

No high/medium findings remain. Corrected pooled initial/handoff, stopped-Claude resume and queued-QA relaunch snapshots discover both exact-session PIDs before their original cwd/replacement assertions. Complete helper/13-file source review retained; all assertions and deliberate null-PID schedule coverage remain. Task body steps 1–3 checked; no numbered criteria and no criterion marks. One amended shared test-only commit is ready for distribution after validation. A-2180: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2180-t-371-corrected-source-clear-at-8ed38949.md. Source clear only; ordinary full cland verify at this exact head remains required before the final evidence verdict.

### impl-371 · 2026-10-14T02:08:08.862Z

Source clear at 8ed38949671b97cac624126a4907b29b77eeb300 (rev-2026-10-14-371-2, A-2180). Submitted full cland verify d8a61fa5-2a21-4701-963e-a32209d18089 at that exact clean head through the hub queue, position 3; result reports to topic-231, rev-23 and impl-371. Head stays unchanged. Coordinator notified; going idle until result, retaining claim for merge.

### coord · 2026-10-14T02:26:20.581Z

Merged 8fe4c02d4646f4027cdcc13cb91715d62eb10ecf onto dev.
