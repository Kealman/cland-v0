---
id: T-465
kind: task
title: codex-adapter usage test compares the first usage event with a later snapshot whose rateLimitsAt differs
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-293
branch: t/T-465-codex-adapter-usage-test-compares-the
created: 2026-10-15T08:47:22.013Z
updated: 2026-10-15T13:36:34.070Z
---

## Summary

`hub/test/codex-adapter.test.ts:272` compares the first matching usage event with a later snapshot. Only `rateLimitsAt` differs (.741Z against .532Z), while all the usage, token and rate-limit values agree. It failed in T-454's gate cc871d75 (A-2787), 2026-10-15. When a second sparse rate-limit update arrives between the two reads, the timestamp moves. Compare the values without `rateLimitsAt`, or wait for the snapshot that matches the event.

## Acceptance criteria

- [x] C1. The assertion is independent of a refreshed `rateLimitsAt` and keeps its meaning for the values, and the file passes 5/5 beside a local full run.
  - done: impl-465 · 2026-10-15T12:56:00.654Z
  - verified: rev-30 [reviewer] · run rev-20261015-465-final · 2026-10-15T13:36:32.772Z · commit 495ab2da8ea76da2a97473ce2794323ed9faf3ab

## Comments

### impl-465 · 2026-10-15T12:32:19.294Z

Implementation prepared: deep equality still covers every usage property except rateLimitsAt, which refreshes on rate-limit reads/updates. Existing model, raw token, normalized total/last and rate-limit assertions are retained; no timeouts change. Test-only bug already isolated by T-454 gate cc871d75/A-2787 and confirmed in adapter timestamp refresh + FrameClient.waitFor first-match behavior, so skipping broader hypothesis/instrumentation phases. Holding all local tests pending the Coordinator's serial window/load-evidence decision (asked in topic-293).

### impl-465 · 2026-10-15T12:33:11.381Z

Committed/pushed 6612ac3c791864e8e0ac442a9b585975c4cd631a after fetching/merging origin/dev. Source review requested under Coordinator b4900603 direction to proceed before local testing. Coordinator 1ba48602 replaces E-482 loaded-full-run evidence with five serial whole-file Mac passes, quiet or loaded and labelled, plus task droplet verify. T-465 holds third Mac slot after impl-486/impl-393 and will hand to impl-463.

### rev-30 · 2026-10-15T12:34:00.124Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-465-source
commit: 6612ac3c791864e8e0ac442a9b585975c4cd631a
scope: full

Source review clear at 6612ac3c791864e8e0ac442a9b585975c4cd631a; no high, medium or low findings.

Standards: no findings against repo test guidance or the code-review smell baseline. Minimal local comparison change; copies avoid mutating captured frames or the snapshot. No new wait, timeout, test identity or duration allowance.

Spec: hub/test/codex-adapter.test.ts:272–278 normalizes only rateLimitsAt on both comparison operands. Deep equality still checks every other enumerable usage property, and explicit model/raw-token/rate-limit/normalized total and last assertions at :266–270 remain intact. Adapter notification/read paths refresh rateLimitsAt independently of values (codex.ts:581,598,611), so ignoring this timestamp implements the task's stated alternative.

Reviewed git diff 2581000178f89873857b04d9f31e425ee03df0da...6612ac3c791864e8e0ac442a9b585975c4cd631a, one commit, only hub/test/codex-adapter.test.ts. Both Standards and Spec axes reviewed directly; role prohibits sub-agents.

C1 remains unverified because its five whole-file passes and same-head gate are pending. Coordinator b4900603 explicitly allows source review before the Mac slot; 1ba48602 accepts five labelled quiet or loaded serial Mac passes plus task droplet verification. Source part is satisfied; no run evidence claimed. No Reviewer tests or edits.

### impl-465 · 2026-10-15T12:55:56.365Z

Five serial quiet Mac whole-file runs green at reviewed 6612ac3c, 35/35 each = 175/175; times 50.195, 50.277, 50.392, 50.099, 50.092 seconds. Admission loads 2.72, 2.42, 2.74, 2.99, 2.95; local holder null and no executing local test file before each run. Coordinator 1ba48602/b4900603 supersedes original full-run overlap requirement. Logs: A-2995 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2995-t-465-five-serial-quiet-mac-passes-175-175.txt. Window handed to impl-463. Source review rev-20261015-465-source is clear; same-head default droplet verify a3fe0258-03eb-484f-9495-825820eb4dc7 pending.

### rev-30 · 2026-10-15T13:03:41.296Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-465-linux-first
commit: 6612ac3c791864e8e0ac442a9b585975c4cd631a
scope: evidence

Evidence review not clear at 6612ac3c791864e8e0ac442a9b585975c4cd631a; accepted gate pending.

Medium — hub/test/codex-adapter.test.ts:634 and hub/test/account-limited.test.ts:138: initial-idle observations time out at 15000 ms (A-3001:3886–3900). The former is in the touched file, so this receipt does not meet the green-touched-files exception. Signatures fit the already source-reviewed T-486 launch-order root cause, which is absent from this head; no rateLimitsAt change defect established.
Medium — hub/test/suite.test.ts:1268 (harness.ts:449): live compatibility-holder case fails with no result for suite.cancel within 500ms (A-3001:3902–3907); no exact T-4xx ticket found, needs lead classification.
Medium — hub/test/heartbeat.test.ts, named tests “an idle Coordinator wakes for a heartbeat with a digest, without adding a needs-you” and “the digest includes running and queued runs and ages timeouts and ended runs without results”: A-3001:5547–5548 enforces new-test budget failures at 5.320 and 5.553 s, above 5 s. Existing-test duration notices elsewhere are separate. Lead disposition or an authorized shared allowance is pending.

Standards: source review rev-20261015-465-source stands, no new source findings.
Spec: repaired usage case passes Linux in 4.568 s. A-2995 establishes five serial quiet Mac whole-file passes at this head, 35/35 each, zero failures/skips/cancellations; quiet evidence accepted by b4900603/1ba48602. C1 source and repetition portions are supported, but verification remains pending accepted gate. No failed implementation criterion mark for unrelated launch/budget failures.

Gate a3fe0258/A-3001: exact reviewed/current branch head, host and remote typecheck green, Linux x64 c-8, exit 1; 1726 pass/3 fail/3 platform skips, zero cancelled. Neovim smoke not reached. Source changes require delta review before next verify; no Reviewer tests or edits.

### impl-465 · 2026-10-15T13:03:57.037Z

First Linux droplet a3fe0258 / A-3001 exits1: usage case green (4.568s), but touched codex-adapter file has initial-idle timeout :634 consistent with absent shared T-486, account-limited:138 also codex-idle; suite.test:1268 suite.cancel >500ms unclassified. Two heartbeat test identities exceed new-test duration budgets (5.32/5.553s). Reviewer evidence verdict rev-20261015-465-linux-first not clear; source review stands, five quiet Mac repeats stand. Reported Bugs/S suite.cancel and Tech debt/XS heartbeat allowances to lead for deduplication; asked for shared-fix disposition before next head/review/verify.

### rev-30 · 2026-10-15T13:10:10.520Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-465-delta
commit: 495ab2da8ea76da2a97473ce2794323ed9faf3ab
scope: delta

Delta source review clear at 495ab2da8ea76da2a97473ce2794323ed9faf3ab; no high, medium or low findings.

Standards: no findings. Direct stable patch-id checks match shared T-486 upstream 4db6ed9c and pick 344c530f (ae778e4f6aff3742cba1b279251e628bd2cf3e00), and heartbeat allowance upstream 5787c4ca and pick 06a48af1 (0410b99d03dff579e7e50c70a25bd3600e176030). The latter supplies reasoned allowances for the two exact Linux budget failures; other duration entries arrive unchanged with merged dev.

Spec: original source review rev-20261015-465-source stands. hub/test/codex-adapter.test.ts:272–278 is byte-for-byte unchanged since 6612ac3c; comparing against merged base 5787c4cafb564fc468bbb04343df4a81db82a5ac leaves only that seven-line task diff. Shared adapter eventSequence ordering fix and its fake/role-integrity probe match the reviewed T-486 design and introduce no new conflict with the usage comparison. T-335 and other inherited dev changes introduce no additional task-local diff.

A-3008 provides post-integration Codex file 35/35, no failures/skips/cancellations, 50.104 s. Prior five serial quiet file passes A-2995 remain labelled and supported by Coordinator b4900603/1ba48602. No Reviewer tests or edits.

C1 remains unverified pending accepted new-head Linux gate. Coordinator ea71c380 requires a new first receipt at this head; old red A-3001 is not a qualifying receipt at this new head. T-494 classifies its separate suite.cancel failure, but does not make the prior own-file failure clear. Proceed with default droplet verify after this source verdict.

### impl-465 · 2026-10-15T13:10:24.485Z

Coordinator ea71c380 dispositions applied: shared T-486 + heartbeat duration picks with matching stable patch-ids, followed by conflict-free origin/dev merge. Pushed reviewed head495ab2da8ea76da2a97473ce2794323ed9faf3ab. Required quiet post-pick codex-adapter.test.ts run green35/35 in50.104s (A-3008), load1.79, holder null, no other local test file. Delta source review rev-20261015-465-delta clear. Submitted new first-receipt default droplet verify at exact reviewed head; prior five-pass Mac evidence A-2995 stands. T-494 now tracks the suite.cancel flake.

### impl-465 · 2026-10-15T13:36:15.799Z

Same-reviewed-head droplet c0d20215 / A-3028 green at495ab2da8ea76da2a97473ce2794323ed9faf3ab: exit0;1751 passed,0 failed,0 cancelled,3 macOS platform skips; hub-only mode plus Neovim smoke complete, typecheck green. Linux c-8 lon1,4 machine workers,1398.29s suite,peak load12.47,lifetime1492s,cost$0.1036. Prior five serial quiet Mac file passes A-2995 and post-shared-fix35/35 A-3008 remain. Waiting for Reviewer's final same-head verdict; no further changes/tests needed.

### rev-30 · 2026-10-15T13:36:32.772Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-465-final
commit: 495ab2da8ea76da2a97473ce2794323ed9faf3ab
scope: evidence

Final review clear at 495ab2da8ea76da2a97473ce2794323ed9faf3ab; no unresolved T-465 source findings.

Standards: source/delta verdicts rev-20261015-465-source and rev-20261015-465-delta stand, no findings.
Spec: C1 verified. Only rateLimitsAt is normalized; all other usage values retain deep comparison and explicit assertions. Five serial quiet Mac whole-file passes A-2995 (35/35 each) are accepted by Coordinator b4900603/1ba48602; post-integration whole-file A-3008 is also 35/35. Same-head Linux usage regression passes in 4.276 s (A-3028:793).

Gate c0d20215-4c57-488e-bc26-fc473287dce1 / A-3028 is green at the exact source-reviewed/current branch head. Host and remote typecheck, hub suite and Neovim smoke complete; Linux x64 c-8, exit 0, 1751 pass/0 fail/3 platform skips/0 cancelled. Three skips are macOS-only sandbox-exec edge/spawn-census and idle-sleep inhibitor cases. Neovim smoke 12/12. No duration-budget failures; existing duration regression notices do not fail this receipt.

Earlier A-3001 remains recorded red at its old head and is not needed for the accepted gate. C1 verification completes the item review. No Reviewer tests or edits.

Criteria: C1 verified.
