---
id: T-474
kind: task
title: Merge override is limited to tracker and docs changes; a code diff needs review
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: topic-315
branch: t/T-474-merge-override-is-limited-to-tracker-and
created: 2026-10-15T09:13:18.127Z
updated: 2026-10-15T20:02:01.359Z
---

## Summary

Retrospective A-2783, STOP 3: T-289 merged code by human override without review, and it was the run's one dev break. The override remains for tracker and docs diffs only.

## What to build

`cland merge --override` refuses when the branch's diff against dev touches a path outside `.cland/`, `docs/` and `*.md`, naming the paths. Tracker and docs diffs still merge by override.

## Acceptance criteria

- [x] C1. An override merge of a branch that changes hub/src is refused, naming the files.
  - done: impl-474 · 2026-10-15T18:27:59.912Z
  - verified: rev-30 [reviewer] · run rev-20261015-474-final · 2026-10-15T20:01:55.117Z · commit 12dc3458a099d0a46868fe1c1f2e7d798c462058
- [x] C2. An override merge of a docs-only or tracker-only branch succeeds.
  - done: impl-474 · 2026-10-15T18:28:03.467Z
  - verified: rev-30 [reviewer] · run rev-20261015-474-final · 2026-10-15T20:01:55.117Z · commit 12dc3458a099d0a46868fe1c1f2e7d798c462058
- [x] C3. The merge skill and hub/README.md describe the scope.
  - done: impl-474 · 2026-10-15T18:28:08.548Z
  - verified: rev-30 [reviewer] · run rev-20261015-474-source · 2026-10-15T18:30:06.089Z · commit 3239eb5c3515a5bb44bd96eca1dc586403a25b16
  - verified: rev-30 [reviewer] · run rev-20261015-474-fixture-delta · 2026-10-15T18:57:30.353Z · commit 12dc3458a099d0a46868fe1c1f2e7d798c462058
  - verified: rev-30 [reviewer] · run rev-20261015-474-final · 2026-10-15T20:01:55.117Z · commit 12dc3458a099d0a46868fe1c1f2e7d798c462058

## Comments

### impl-474 · 2026-10-15T18:20:56.063Z

Read task, E-423 decisions and v0.1.3 spec. Implementing immutable-candidate override path gate; extending merge-policy CLI integration coverage and documenting scope in merge skill, hub README and CLI help. No per-item QA required by resolved policy.

### impl-474 · 2026-10-15T18:21:43.603Z

Coordinator decision 6dbb6897 (topic-315) supersedes the original broad allowlist: permit only .cland/tasks/**, .cland/RULES.md, docs/**, GLOSSARY.md, README.md files, qa/briefs/**; reject everything else, including configuration and skill Markdown. Check both rename paths and deletions. Keep the list in one commented constant and document it.

### rev-30 · 2026-10-15T18:30:06.089Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-474-source
commit: 3239eb5c3515a5bb44bd96eca1dc586403a25b16
scope: full

Source review T-474 clear at 3239eb5c3515a5bb44bd96eca1dc586403a25b16, fixed point fa00e57a43857bc2a70be077cbd858cf7cc495bb. No high, medium or low findings. Both axes reviewed directly under no-delegation role.
Standards: the single commented MERGE_OVERRIDE_PATHS constant follows Coordinator 6dbb6897's narrowed scope: .cland/tasks/**, exact .cland/RULES.md, docs/**, exact GLOSSARY.md, README.md basenames and qa/briefs/**. It does not broadly admit .cland configuration or arbitrary Markdown/skill paths. Typed MergeError includes code and every refused path.
Spec: scope check runs in squashTask's immutable-candidate callback before commit preparation/refs/checkout mutation, and repeats with existing validation before landing. Paths come from base-tip to merged candidate tree. --no-renames enumerates deleted sources and added destinations, so moving code into docs or docs into code cannot hide the disallowed side; standalone deletions also count. Normal reviewed merges remain unchanged. Existing authorization, conflict, dirty checkout, lane/freshness, compare-and-swap and recovery protections remain. Reconciliation of already landed receipts is not treated as new override work.
C3 verified: merge skill, hub README and CLI help state the narrowed allowlist, human-shell restriction, named refusal and unchanged conflict/Git safety.
C1/C2 test review: integration tests cover typed frame and CLI mixed code/config/skill refusal, all paths reported, refs unchanged, root code absent and task open; both rename directions and deletion; allowed docs/GLOSSARY/nested README/QA briefs and tracker/rulebook-only merges; prior permission test now uses a genuinely allowed README. All four new tests are below five seconds. A-3254 is whole-file 12/12, zero failure/cancel/skip. Source runtime criteria C1/C2 remain unverified until accepted exact-head post-source suite evidence.
Diff whitespace passes; requester reports typecheck green. No per-item QA required. Source clear permits the requested fresh exact-head verification within Coordinator throttle. No Reviewer tests, edits, merges or provider calls.

Criteria: C3 verified.

### rev-30 · 2026-10-15T18:52:49.085Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-474-linux-first
commit: 3239eb5c3515a5bb44bd96eca1dc586403a25b16
scope: evidence

Evidence review T-474 not clear at source-reviewed 3239eb5c3515a5bb44bd96eca1dc586403a25b16. A-3270/3123e5d2 is actual Linux c-8, exit 1: 1763 pass/33 fail/3 platform skips. Typecheck passes; Neovim smoke is not reached. The new override refusal, rename/deletion and docs/tracker acceptance cases are green (A-3270:1676–1680), but the integrated gate fails deterministically.

Medium — hub/test/crew-launch.test.ts:134–137 and hub/test/release.test.ts:25–31 (also follows.test.ts:81/:165, push.test.ts:134, session-archive.test.ts:15, session-stop-races.test.ts:38/:88 and tracker-native-boundary.test.ts:124): existing lifecycle/merge/release fixtures override branches containing arbitrary shipped.txt/parser.txt/merge.txt/other.txt/protected.txt/done.txt. The new scope restriction correctly refuses them, so the fixtures never reach the behavior they claim to test. A-3270 has 32 explicit merge-override-scope error blocks across these seven files. This is task-caused test compatibility work, not an outside known flake and not an acceptable first receipt under the two-known-failure rule. Preserve the narrow production scope; update incidental fixture paths or establish appropriate reviewed merge evidence. If code-like override is the point of a fixture, assert refusal rather than moving the file.

Medium — hub/test/session-stop-races.test.ts:147: the remaining reported failure times out waiting for a descendant probe before checking the preceding merge response; the preceding shipped.txt override is refused, so the merge-triggered stop never begins. Requester identifies the same fixture cause in topic message 490f129a. It should not be classified as an independent T-485 pidAlive flake on this evidence.

Standards: scoped production behavior remains consistent with the reviewed contract; the suite's fixture assumptions were not fully migrated. Spec: the direct C1/C2 cases pass and C3's documentation verification stands, but no final C1/C2 marks are added while the required integrated gate is red. No criterion is failed speculatively: this verdict records the demonstrated gate/fixture defect.

Confirmed Coordinator f2ede105: only incidental paths may move, code-override fixtures must become refusal tests, and every conversion must be listed with file:line in the next review request. Requester is already making that correction. A changed head requires a fresh source/delta review before another full run; this own-failure receipt is excluded from final gate pairing. No unchanged retry. No Reviewer edits, tests or provider calls.
Correction to A-3272's file count: the failures span seven test files, not eight.

### impl-474 · 2026-10-15T18:56:34.540Z

Fixed all 33 first-Linux own failures by migrating seven unrelated incidental override fixtures to permitted README.md/GLOSSARY.md paths; product policy unchanged. 12dc3458 pushed. All seven whole-file targeted runs green (103 tests) plus typecheck. A-3273 contains complete converted fixture file:line audit and logs, including the masked descendant-probe cause. Delta source review requested; next verify waits for source clear.

### rev-30 · 2026-10-15T18:57:30.353Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-474-fixture-delta
commit: 12dc3458a099d0a46868fe1c1f2e7d798c462058
scope: delta

Delta source review T-474 clear at 12dc3458a099d0a46868fe1c1f2e7d798c462058, fixed point source-reviewed 3239eb5c3515a5bb44bd96eca1dc586403a25b16. No high, medium or low findings.

Standards: the exact diff contains seven fixture files plus shared durations.json. Product code, merge allowlist, immutable candidate checks, CLI/help/skill documentation and dedicated merge-policy tests are byte-identical to the previous source review. Every fixture conversion listed in A-3273 was examined. Only payload paths and corresponding content/hold-regex references change; test names, assertion counts and timing bounds remain. No conditional bypass or fabricated verdict is added.

Spec/fixture audit under Coordinator f2ede105 and e7a8d846: crew-launch:134/:247 remains pool/stop_after lifecycle; follows:93/:170/:171/:204 retains the same disjoint versus overlapping path graph and final concurrent surface validation; push:138 retains unpublished-dev refusal followed by landing; release helper callers and direct worktree cases retain publication/sync/ref/recovery semantics and matching reads; archive:29 still starts its window after real merge; stop-races:69/:142 still trigger real post-merge stop including descendant identity race; native-boundary:130 still proves review refusal, actual landing and same-commit recovery under the native guard. These payload types are incidental. README.md versus GLOSSARY.md preserve necessary distinct paths. No intentional code-override case was moved into the allowlist. Existing policy cases continue to exercise real hub/src, configuration, skill Markdown, deletion and both rename directions as refusals.

Evidence: inspected A-3273 index/audit and all seven complete logs: follows11, crew10, push12, release18, archive9, stop-races14, native-boundary29 = 103 pass, zero fail/cancel/skip. The masked post-merge descendant-probe case now completes green. Typecheck is reported green and diff whitespace check is clear. These targeted logs resolve the demonstrated fixture blocker; they do not replace the required post-source full verification. The artifact transparently records the short independently started T-396 worker-fixture overlap and subsequent coordination.

Manifest: parsed comparison preserves all prior files/tests/allow values and all metadata, adding only five measured shared exceptions already reviewed elsewhere: four T-394 coverage/cache/close/report fixture allowances plus 7cdf2dd0 over-cap clause 5.133s. No own fixture allowance, assertion-bound change, production source import or dev merge occurred. Shared commit title refers to earlier requested allowances already present in the base; the actual five-entry delta was examined directly.

C3 documentation reverified at this head. C1/C2 runtime final marks remain pending an acceptable exact-head post-source suite receipt. A-3270's 33 own fixture failures are excluded from gate pairing; this correction needs a new first receipt, not an unchanged retry. Source clearance permits the next directed full verification within current Coordinator executor/load rules. No Reviewer tests, edits, merges or provider calls.

Criteria: C3 verified.

### rev-30 · 2026-10-15T19:26:10.444Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-474-corrected-linux-first
commit: 12dc3458a099d0a46868fe1c1f2e7d798c462058
scope: evidence

T-474 corrected-head evidence review not clear at unchanged source-reviewed 12dc3458a099d0a46868fe1c1f2e7d798c462058. A-3294/c7535028 is actual Linux c-8, exit1:1795 pass/1 fail/3 platform skips, no cancellation. Typecheck and hub phases complete; Neovim smoke is not reached after hub red.

Own corrected fixture and policy files complete without failures. In particular all12 merge-policy cases complete; code/config/skill refusal, both rename sides/deletions and allowed docs/tracker merges are green (A-3294:1744–1747). Migrated crew/follows/push/release/archive/stop-races/native-boundary cases also finish; the previous33 scope-related failures do not recur. No new T-474 source defect is established.

Medium gate blocker / aside Bugs S — hub/test/executor-safety.test.ts:148/:206: same-name hubs preserve each other's in-flight keys and conservatively age legacy keys fails with "remote result: not within 20000 ms" (A-3294:4126–4132). Case wall103.247s, file211.476s, overall peak1m15.75. The duration-regression notices describe this slow failed test; they do not establish a distinct new hard allowance failure. No exact known-item classification is supplied by this receipt. Root cause is not established from timeout alone.

Lead must classify/deduplicate this outside-task failure before it counts as a known-only receipt or authorizes a second attempt. Do not classify it as the earlier startReplyLost PROCESSWRAP leak simply because both use remote fixtures. Keep the reviewed head fixed while awaiting disposition; do not submit an unchanged retry automatically.

C1/C2 direct behavior is supported by own Linux execution, and C3's source fact remains, but final runtime marks wait for accepted gate evidence. No criterion is failed speculatively because the only failure is outside the task diff. A-3270 remains excluded as own failed fixture migration; A-3294 is the first post-correction receipt candidate, not a final clear. No Reviewer tests, edits or provider calls.

### rev-30 · 2026-10-15T20:00:40.374Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-474-corrected-linux-second
commit: 12dc3458a099d0a46868fe1c1f2e7d798c462058
scope: evidence

Second corrected-head evidence review T-474 not clear at unchanged source-reviewed 12dc3458a099d0a46868fe1c1f2e7d798c462058. A-3313/fb5a0840 actual Linux c-8 exits1:1792 pass/4 fail/3 platform skips, no cancellation. Typecheck/hub complete; Neovim smoke not reached after hub red. Policy/refusal/rename/docs/tracker cases pass (A-3313:1674–1677), and no migrated task fixture fails.

Failure identities differ from first eligible A-3294's same-name-key remote-result timeout. First receipt was classified/accepted under Coordinator ebd9c1f0. Original A-3270 remains excluded. This second receipt needs classification of its remaining outside reds before final pairing.

Medium gate blocker / outside Bugs S — hub/test/executor-prepare.test.ts:198: failed-replacement case completes functional path but projectHub after-cleanup check sees PROCESSWRAP (A-3313:4072–4098, check at hub-resources.ts:30). Do not assume the exact T-523 startReplyLost ownership without lead deduplication.

Medium gate blocker / outside Bugs S — hub/test/executor-safety.test.ts:289 (case:264): all executor leases finish releasing is not observed within15000ms (A-3313:4100–4106). Root cause is not established; it differs from first receipt's same-name-key timeout.

Medium gate blocker / outside Bugs S — hub/test/session-usage.test.ts:88 (case:75): coalesced burst/rate-limit journal contains duplicate [24,9], actual four rows versus expected three (A-3313:4108–4134). It differs from the earlier T-495 initial limits-only row and needs explicit family classification.

Known outside Bugs S — hub/test/account-limited.test.ts:265: count1!=2 in failed-poll-backoff case (A-3313:4055–4070), established T-493 family.

No new T-474 source defect; C1/C2 own behavior remains green and C3 source fact stands. No criterion is failed speculatively. Final runtime marks await lead classification and accepted gate disposition; no third run or outside-task edits requested. Current Coordinator cover/restart hold continues (86210b22 replaces failed cover with d5feb268; no local tests/new verify until restart notice).

No Reviewer tests, edits or provider calls.

### rev-30 · 2026-10-15T20:01:55.117Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-474-final
commit: 12dc3458a099d0a46868fe1c1f2e7d798c462058
scope: evidence

Final evidence review T-474 clear at unchanged source/delta-reviewed 12dc3458a099d0a46868fe1c1f2e7d798c462058. No high or medium task finding remains.

Coordinator0f6b0db6-f3a1-4990-93d6-9f5f0bf91537 independently confirmed in topic history: A-3294 + A-3313 are accepted gate receipts; failure identities are disjoint, all classified and all changed cases green in both. Current task branch resolves to the same head.

First corrected receipt A-3294/c7535028: actual Linux c-8, exit1,1795pass/1fail/3 platform skips. Sole red executor-safety:206 same-name-key remote result timeout is T-524, previously accepted under ebd9c1f0.
Second corrected receipt A-3313/fb5a0840: actual Linux c-8, exit1,1792pass/4fail/3 platform skips. Known reds: account-limited:265 count1!=2 T-493; executor-prepare:198 PROCESSWRAP cleanup T-523; executor-safety:289 lease release >15s T-524; session-usage:88 extra duplicate[24,9], newly filed E-482 regression of T-495 (Coordinator notes a real duplicate write remains possible). These identities do not repeat the first test. Both overall suites remain red; final acceptance uses the explicit recorded pair rule, not an assertion that the unrelated behavior is harmless.

Policy and seven migrated fixture files pass in both receipts, including mixed code/config/skill refusal, rename/deletion checks and docs/tracker acceptance. Typecheck/hub complete; Neovim smoke was not reached after hub red. T-474 has no own Neovim diff and the recorded two-receipt disposition applies. A-3270 is explicitly excluded: its own33 obsolete-fixture failures were fixed and source-reviewed; it is not part of this pair. A-3273's103/103 targeted files remain supporting evidence.

C1 verified: immutable candidate path gate refuses hub/src and every disallowed code/config/skill path, names them, preserves refs/root/task, and retains both rename sides/deletions. C2 verified: allowed documentation, README/GLOSSARY/QA briefs, tracker/rulebook-only branches merge by human override; existing Git/conflict/auth gates remain. C3 reverified: merge skill, README and CLI help describe Coordinator6dbb6897's narrowed allowlist. Product policy is unchanged by the incidental fixture migration.

No new run/head change requested. Current cover/restart hold86210b22 continues for subsequent routing. No Reviewer tests, edits or provider calls.

Criteria: C1 verified, C2 verified, C3 verified.
