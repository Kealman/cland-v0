---
id: T-551
kind: task
title: Demo recorder rejects the cases' capture names and hides the error behind a bare catch
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-459
topic: topic-347
branch: t/T-551-demo-recorder-rejects-the-cases-capture
created: 2026-10-16T00:31:47.114Z
updated: 2026-10-16T02:29:58.808Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, cases D2–D5, at cdad9cdc). All four headless cases came back BLOCKED with "demo execution or capture collection failed" and no captures. Two causes:
- `.agents/skills/qa/qa-demo-record.ts:32` throws "invalid capture name" unless a capture's name starts with the case id. The cases (RULEBOOK-001, RULEBOOK-002, EVENTS-001, FOLLOWS-001) call `qa.dump` with lowercase names such as `rulebook-rows`, which the local `qa-record.sh` accepts.
- The recorder's bare `catch` drops the error, and the remote side deletes the captures before local validation, so nothing explains the BLOCKED result.
Separately, the delivered `hub/bin` on the droplet has no executable named `cland` (only `cland.ts`), so `command -v cland` fails there, although the qa skill says the remote PATH includes the delivered hub/bin for `cland --headless --qa`.

## Acceptance criteria
- [x] C1. The demo recorder accepts exactly the capture names the local recorder keeps (explicit qa.dump names, with no case-id prefix), keeps its basename and path-safety check, and refuses a name collision with a named error. A case that passes locally records the same capture files through `cland demo exec`.
  - done: impl-551 · 2026-10-16T00:53:22.469Z
  - verified: rev-31 [reviewer] · run rev-20261016-551-source · 2026-10-16T00:56:32.267Z · commit b2565458f289f047042b944636e41d2af9fcec28
  - verified: rev-31 [reviewer] · run rev-20261016-551-delta-1 · 2026-10-16T01:19:42.904Z · commit c9ba8073f73562ddd947e5b496afb262c6958363
  - verified: rev-31 [reviewer] · run rev-20261016-551-delta-2 · 2026-10-16T02:29:58.808Z · commit 1eed1f408777792f46bb2ab2f1303da452ea53e2
- [x] C2. Any recorder failure reports its actual error and the remote stderr in the BLOCKED record instead of a generic message, and captures are kept until local validation succeeds.
  - done: impl-551 · 2026-10-16T00:53:23.868Z
- [x] C3. On a demo lease, `cland` resolves on PATH to the delivered build (a `cland` launcher in hub/bin or an equivalent), and a test or the qa skill shows `cland --headless --qa` working there.
  - done: impl-551 · 2026-10-16T00:53:25.022Z
  - verified: rev-31 [reviewer] · run rev-20261016-551-source · 2026-10-16T00:56:32.267Z · commit b2565458f289f047042b944636e41d2af9fcec28
  - verified: rev-31 [reviewer] · run rev-20261016-551-delta-1 · 2026-10-16T01:19:42.904Z · commit c9ba8073f73562ddd947e5b496afb262c6958363
  - verified: rev-31 [reviewer] · run rev-20261016-551-delta-2 · 2026-10-16T02:29:58.808Z · commit 1eed1f408777792f46bb2ab2f1303da452ea53e2

## Comments

### impl-551 · 2026-10-16T00:35:29.648Z

Read task and E-423 Coordinator decisions. Confirmed red at existing CLI/demo seam: node --test --test-name-pattern='the demo recorder runs a headless case remotely' hub/test/demo.test.ts. Changing fixture capture to rulebook-rows.screen.txt reproduces exit 2 BLOCKED, generic error, evidence []. Minimal naming fix pending green Mac window (load gate currently >15). Proposed rule and C1 filename ambiguity sent to item lead in topic-347.

### impl-551 · 2026-10-16T00:55:03.500Z

Implemented and pushed b2565458f289f047042b944636e41d2af9fcec28. C1 follows Coordinator clarification: exact basenames, no prefix; collisions refused with named error. C2 saves message/stderr/remote_output to runs.jsonl and acknowledges deletion only after exclusive local writes/read-back; C3 adds executable hub/bin/cland. Targeted demo file 8/8 green (A-3512), new test 5.567 s with duration allowance. Root/standalone TypeScript and shell syntax checks pass. Requested source review; an additional untampered skills-qa compatibility file awaits Mac admission. No verify before clear source verdict.

### rev-31 · 2026-10-16T00:56:32.267Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-551-source
commit: b2565458f289f047042b944636e41d2af9fcec28
scope: full

Source review clear at b2565458f289f047042b944636e41d2af9fcec28, run rev-20261016-551-source, scope full. Reviewed b2565458^...b2565458 (five files). No high, medium or low findings.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, lifecycle rules or smell baseline. Remote evidence uses realpath containment; local names remain basename-only and exclusive writes refuse overwriting/collisions. Sources are retained through copy/read-back validation. The existing demo exec seam and fake-machine fixture test the behavior without new hub hooks. New measured 5.567 s failure-recovery case has a reasoned duration allowance. Diff check passes. Both axes reviewed here because the role disables delegation.

## Spec
C1 verified. qa-demo-record.ts drops only the case-prefix requirement and preserves exact capture basenames, as Coordinator 8a19927a-b155-4705-9398-f4524aeb0bfb requires. Empty/dot/parent/path names are rejected; duplicate basenames get a named error, existing destinations fail with path-bearing EEXIST. Regression collects lowercase rulebook-rows.screen.txt plus the case-named file with exact names/content.

C2 source reviewed: remote spawn/parsing/collection errors are caught with their actual message, stderr and recovery directory. The local catch emits BLOCKED with message/stderr/remote_output; qa-record.sh copies those fields into the persisted runs.jsonl object. Remote removal is a separate acknowledgement after every exclusive local write is read back and compared. Errors before acknowledgement leave the remote source directory available; a successful flow verifies removal. Local-copy EEXIST, malformed JSON and duplicate-name regressions inspect both printed and persisted diagnostics, recover retained remote bytes, then clean their sources. C2 remains unverified pending the same-head gate.

C3 verified. hub/bin/cland has Git mode 100755 and forwards argv to its delivered sibling cland.ts. Demos.exec already prepends the delivered hub/bin to PATH; the real demo test checks command -v resolves there and invokes cland --headless --qa successfully, rather than invoking cland.ts directly.

A-3512 checked: whole demo.test.ts 8/8 pass, no skips/cancellations, 31.404 s; changed success case4.461 s and failure-recovery5.567 s. Initial C1 and diagnostic-specific C2 red evidence is recorded by the lead (A-3500); typecheck, standalone helper TypeScript, sh -n and diff checks green reported. Untouched skills-qa compatibility evidence is pending and can be supplied alongside the gate; it does not change this source verdict.

No source changes beyond the requested scope; no Reviewer edits/tests or real remote actions. Source clear permits the requested no-flag same-head verification subject to current Coordinator admission instructions. No per-item QA criteria.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3515: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3515-t-551-source-clear-at-b2565458.md

Criteria: C1 verified, C3 verified.

### impl-551 · 2026-10-16T01:18:59.484Z

Coordinator shared baseline 2149fe33 applied after source review per rule 11. New head c9ba8073 (pushed) differs from source-cleared b2565458 only in hub/test/durations.json. Refreshed baseline retained exactly plus own measured allowance; net file delta against shared commit is four lines. Requested delta review; no implementation/test changes or local rerun. Await clear before new verify.

### rev-31 · 2026-10-16T01:19:42.904Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-551-delta-1
commit: c9ba8073f73562ddd947e5b496afb262c6958363
scope: delta

Delta source clear: b2565458..c9ba8073 changes only hub/test/durations.json. Compared with Coordinator-posted 2149fe33 (A-3493 / integrated a06020a3), exactly the original sorted four-line 5.567s allowance remains. Its parsed value equals b2565458; removing it yields equality with shared manifest. JSON parsing and diff check pass. Standards: no findings. Spec: no findings. Implementation/test inputs unchanged, preserving A-3515 source analysis and A-3512 supporting proof. C1/C3 reverified at this head; C2 remains pending same-head gate. Initial hold attempt timed out and was not retried during backoff. No Reviewer edits/test execution.
Artifact A-3551: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3551-t-551-manifest-delta-source-clear-at-c9ba8073.md.

Criteria: C1 verified, C3 verified.

### impl-551 · 2026-10-16T01:48:59.066Z

Delta source clear rev-20261016-551-delta-1 at c9ba8073. Shared baseline 2149fe33 applied; refreshed file retained exactly plus own existing 5.567s allowance. Additional existing hub/test/skills-qa.test.ts compatibility file passed16/16 in7.182s (A-3578), following Coordinator Mac order and refined cwd/load guard. Demo targeted file remains8/8 green (A-3512). Current queue shows original a53c3d9c still running remotely at b2565458; holding replacement verification for T-556 shared fix. No implementation/test changes since initial source clear.

### impl-551 · 2026-10-16T02:29:05.740Z

Picked posted shared fix576404e8 as1eed1f40; only delta is suite-runner stable test names (+4/-2). Pushed and requested delta source review. No implementation changes or additional local test runs. Coordinator's phantom-holder restart hold remains; no verify submission until restart release.

### rev-31 · 2026-10-16T02:29:58.808Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-551-delta-2
commit: 1eed1f408777792f46bb2ab2f1303da452ea53e2
scope: delta

Delta source clear: c9ba8073..1eed1f40 changes only suite-runner.test.ts+4/-2, exactly matching posted576404e8. Standards/Spec: no findings. Stable timestamp scenario name with ISO runtime value in body preserves prior assertions/bounds/cleanup. No T-551 implementation/test changes. Prior source A-3515/A-3551 remains; demo8/8 A-3512 and skills-qa16/16 A-3578 inspected. T-556 proof A-3593 is Mac52/52 plus exact-name5/5 under explicit batch Linux deferral; no green task Linux gate claimed. C1/C3 reverified, C2 pending same-head final gate.
Coordinator61dd1845 hold remains: submit once with explicit droplet/fresh only after next hub restart notice. Olda53c3d9c timeout/phantom is not evidence. Diff check clear; no Reviewer edits/tests.
Artifact A-3594: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3594-t-551-shared-stable-name-delta-source-clear-at-1eed1f40.md.

Criteria: C1 verified, C3 verified.
