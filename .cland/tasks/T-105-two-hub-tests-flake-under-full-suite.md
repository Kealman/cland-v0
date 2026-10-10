---
id: T-105
kind: task
title: "Two hub tests flake under full-suite load: the deleted-project doctor sweep lock (ENOENT) and the process-row rename publication timeout"
state: closed
status: done
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-38
branch: t/T-105-two-hub-tests-flake-under-full-suite
created: 2026-10-09T20:43:35.328Z
updated: 2026-10-10T00:58:17.917Z
---

## Parent

Part of T-19. Seen in T-104's full suite on ed722e0 on 2026-10-09 at 20:41Z (A-187). Both tests pass 3 of 3 alone on ed722e0 and on dev at 7e5f959 (A-188), so they are pre-existing and load-dependent, not caused by T-104.

## What happened

1. The doctor deleted-project shutdown test failed with ENOENT, from creating the startup orphan-sweep lock folder after the project was deleted. T-76 handles ENOENT only when the project root is confirmed gone. The likely gap: the root still exists while deletion is in progress, but `.cland` or `.cland/run` is already gone. In that case the sweep reports a failure instead of skipping. Under load, the window between the root check and the deletion is wider.
2. The process-row publication test timed out after 5000 ms waiting for a frame. The launch with role qa was published, but the expected later rename event never arrived within the deadline.

## What to build

- Doctor: treat ENOENT from the sweep lock as "project removed" when `.cland` itself is gone or going, not only when the root is gone. Reproduce it deterministically by deleting `.cland` between the lock's stat and its mkdir.
- Process rows: find out whether the rename publication is lost or only late under load. If it is lost, that is a product bug: fix it, and test it with a deferred step. If it is only late, make the test wait on the event, never on a longer timeout.

## Acceptance criteria

- [ ] Each case is reproduced deterministically, then fixed.
- [ ] Both tests pass in 5 consecutive full suites under load, or the cause is shown to be outside the product.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S to M; triage first. Related: T-76 (the sweep lock), T-102 (machine-wide doctor overlap).

## Comments

### impl-105 · 2026-10-09T20:47:09.901Z

Diagnosing deterministic sweep-directory deletion and rename-publication ordering before fixes; using controlled deferred steps, no sleeps or longer deadlines. Brief specifies both files 5 times under load and one full suite at end.

### impl-105 · 2026-10-09T20:50:39.759Z

Head d0be3a3. Deterministic red evidence: A-192 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-192-t-105-deterministic-sweep-repro-red-before-fix.log; A-193 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-193-t-105-deterministic-pre-welcome-rename-repro-refused-call.log. Sweep extends confirmed removal to root/.cland/run with intact-directory ENOENT retained. Rename is a premature rejected call, not a lost accepted publication: held welcome reproduces connecting refusal; held process transport proves event emitted before successful rename response. Original process-row test now awaits its own spoke readiness and asserts rename success; existing event assertion/deadline retained. Changed early-call probe expectation true to false only to document the intended refusal contract; no original assertion weakened. Typecheck and regression files green. Running two-axis self-review then 5x affected files during one full npm test.

### rev-65 · 2026-10-09T20:54:48.526Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-105-1
commit: 0447a4e4bab19ef1ff3cf13e1af82001359ae163

Standards: clear — high 0, medium 0, low 0. Spec implementation: clear — high 0, medium 0, low 0. No ranked implementation findings.

hub/src/orphans.ts:166: confirmed ENOENT of root/.cland/.cland/run skips without recovery recreation; intact paths and failed confirmations retain the original error. hub/test/session-events.test.ts:12: deterministic welcome/publication holds retain successful rename and matching event assertions without imposing publication/reply order; original regression retains its event deadline after own-spoke readiness.

Evidence A-195: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-195-t-105-review-on-0447a4e-removal-boundary-and-rename-readiness.md. Fifteen pinned-source read-only virtual cases passed, as did diff --check; parallel Standards and Spec reviews clear. No suite run by Reviewer.

Validation gate remains pending in A-194. Five affected-file runs plus one full suite differ from the task's literal five-full-suite acceptance; reconcile or obtain that evidence before marking acceptance complete. Separate existing readiness follow-up recommended for callable MCP tools before hub welcome, including the sibling presence test's other-client readiness assumption. Standards total 0, worst none; Spec implementation total 0, worst none.

### coord · 2026-10-09T20:55:16.021Z

Coordinator decision on the stability criterion, as rev-65-105-1 asked. The item says "pass in 5 consecutive full suites under load". I accept, instead, five runs of each affected test file under load, beside a full suite, plus one full suite on the final head. Five full suites would hold the machine lock for about 50 minutes, and both causes are now deterministic and reproduced. The criterion is satisfied by this evidence once the runs report.

### impl-105 · 2026-10-09T21:08:51.076Z

Done on 0447a4e4bab19ef1ff3cf13e1af82001359ae163, pushed to local origin; working tree clean. Sweep now skips confirmed partial parent-directory removal (root/.cland/run); original intact-parent ENOENT assertion preserved. Rename flake was an ignored pre-welcome refused call, not lost accepted publication: test now awaits own spoke readiness, asserts rename success, and retains the event assertion/deadline. Both cases reproduced deterministically before fixes (A-192/A-193). No original assertions weakened; no new sleeps/longer timeouts. Standards and Spec self-reviews clear. npm run typecheck passes; final npm test passes 630 hub + 104 Neovim = 734, zero failures (A-199). Both affected files pass 5/5 complete-file runs under active suite load; sweep regression also 5/5; sampled boundary load 4.65–19.88, full-suite peak 22.89 (A-200). Final report A-201 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-201-t-105-final-implementation-and-verification.md; full log /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-199-t-105-final-full-suite-on-0447a4e-734-pass.log; stability /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-200-t-105-stability-five-runs-per-affected-file-under-load.log. No merge performed.

### coord · 2026-10-09T21:09:03.759Z

Merged 93172051dcf5b061c4ff4c06c2e15f2ba39abc33 onto dev.

### coord · 2026-10-09T21:09:09.691Z

Merged by the Coordinator through `cland merge T-105`: squash 9317205 on dev. Gate: review rev-65-105-1 clear on 0447a4e. The doctor sweep now treats ENOENT as project-removed when the root, `.cland` or `.cland/run` is confirmed gone, and intact paths keep the error. The rename test was a test readiness bug: a refused pre-welcome call, now waiting for readiness and asserting success, with no assertion weakened. Final suite on 0447a4e: 734 passed (A-199). Stability under load: the rename, sweep regression and doctor files each passed 5 of 5 (A-200), the evidence accepted in place of five full suites per the Coordinator's decision above. The readiness follow-up is T-106. impl-105 stopped.
