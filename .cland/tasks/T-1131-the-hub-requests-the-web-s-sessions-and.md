---
id: T-1131
kind: task
title: The hub requests the web's sessions and profile need
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
topic: topic-855
branch: t/T-1131-the-hub-requests-the-web-s-sessions-and
created: 2026-10-22T15:16:14.965Z
updated: 2026-10-22T17:23:31.081Z
---

## Summary

Three hub changes the web slices consume: a session's recent messages for a human client, this browser's own sign-in record, and a refusal of a launch directory from the web edge.

## Parent

E-418 (hub work for tracer steps 3 to 5; v0.2 §3.7 serving and security; v0.1.2 §3.13).

## What to build

- **A session's recent messages.** A human client reads one session's recent messages, the ones it sent and the ones it received across topics, newest last, bounded and paged back by message number, as a session reads its own traffic with `history` today. The web edge allows it. The session's drawer (after E-417) shows it.
- **This browser's sign-in.** The web edge answers the asking browser about its own cookie session only: when it was made, when it was last used and when it expires (fixed at 30 days from the sign-in). Listing and revoking other browsers stays in the CLI, as `web.sessions` and `web.revoke` refuse the web today.
- **No directory from a page.** `session.launch` from the web edge carrying a directory is refused as CLI and Neovim only, so a page launches in the project root, or with an item in that item's task worktree. The CLI and Neovim keep their directory field.

The wire types go in the shared module with their conformance entries, and the web authority table classifies both new requests. New tests are T1 or T2.

## Acceptance criteria

- [x] C1. A human client reads a session's recent messages in both directions across topics, bounded and paged by message number, and a session's own `history` is unchanged (T2 test).
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final4 · 2026-10-22T17:21:34.850Z · commit f2254248853bddee47e8277ed56ece1beefac4a7
  - done: impl-1131 · 2026-10-22T17:23:02.706Z
- [x] C2. Over the web edge a browser reads its own sign-in's creation, last use and expiry, and the reply names no other browser's session (T2 test).
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final · 2026-10-22T16:13:19.840Z · commit a178b2620f2f697377b53cc66346e6fad6554bf7
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final2 · 2026-10-22T16:26:54.185Z · commit b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final4 · 2026-10-22T17:21:34.850Z · commit f2254248853bddee47e8277ed56ece1beefac4a7
  - done: impl-1131 · 2026-10-22T17:23:02.905Z
- [x] C3. `session.launch` with a directory from the web edge is refused with `cli-neovim-only`, and the same launch without a directory starts in the project root (T2 test).
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final · 2026-10-22T16:13:19.840Z · commit a178b2620f2f697377b53cc66346e6fad6554bf7
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final2 · 2026-10-22T16:26:54.186Z · commit b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final4 · 2026-10-22T17:21:34.850Z · commit f2254248853bddee47e8277ed56ece1beefac4a7
  - done: impl-1131 · 2026-10-22T17:23:02.995Z
- [x] C4. The web authority table classifies both new requests, and its unit test refuses a web launch directory before dispatch (T1 test).
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final · 2026-10-22T16:13:19.840Z · commit a178b2620f2f697377b53cc66346e6fad6554bf7
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final2 · 2026-10-22T16:26:54.186Z · commit b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final4 · 2026-10-22T17:21:34.850Z · commit f2254248853bddee47e8277ed56ece1beefac4a7
  - done: impl-1131 · 2026-10-22T17:23:03.137Z
- [x] C5. `hub/README.md` documents the two requests and the launch-directory refusal (docs).
  - verified: rev-31 [reviewer] · run rev-20261022-1131-source · 2026-10-22T15:30:13.597Z · commit 1a9d9298fe8331e51e36c3426031f63f9af310cd
  - verified: rev-31 [reviewer] · run rev-20261022-1131-delta · 2026-10-22T15:45:01.565Z · commit a178b2620f2f697377b53cc66346e6fad6554bf7
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final · 2026-10-22T16:13:19.840Z · commit a178b2620f2f697377b53cc66346e6fad6554bf7
  - verified: rev-31 [reviewer] · run rev-20261022-1131-delta2 · 2026-10-22T16:17:41.661Z · commit b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final2 · 2026-10-22T16:26:54.186Z · commit b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
  - verified: rev-31 [reviewer] · run rev-20261022-1131-delta3 · 2026-10-22T16:59:20.863Z · commit 68f0b004506c879886fa6a519b577b1f04350e69
  - verified: rev-31 [reviewer] · run rev-20261022-1131-delta4 · 2026-10-22T17:10:59.036Z · commit f2254248853bddee47e8277ed56ece1beefac4a7
  - verified: rev-31 [reviewer] · run rev-20261022-1131-final4 · 2026-10-22T17:21:34.850Z · commit f2254248853bddee47e8277ed56ece1beefac4a7
  - done: impl-1131 · 2026-10-22T17:23:03.331Z

## Comments

### impl-1131 · 2026-10-22T15:26:09.141Z

Implemented separate human session.history pages (numeric seq, sent/received membership, 50-message and byte limits), web.session timestamps derived only from the authenticated cookie identity, and web launch cwd refusal before dispatch. TDD reds observed: launch policy expected cli-neovim-only but got undefined; session.history and web.session initially returned missing authority classification. Final working-tree targeted evidence on local macOS: web-authority-unit T1 5/5 and web-authority T2 37/37; npm run check includes report-only test lint, no suite receipt yet. Fixtures use tempProject/projectHub, sealed environments and fake adapters/time. Docs and implement skill updated; no role clause expansion.

### rev-31 · 2026-10-22T15:30:13.598Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-source
commit: 1a9d9298fe8331e51e36c3426031f63f9af310cd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear on Standards and Spec, no findings; A-9211. Sent/delivered numeric session pages preserve own history; web.session is bound to authenticated cookie identity with projected timestamps and fixed expiry; own cwd fields are refused before replay/dispatch. Wire conformance, authority tests and matching docs/skill reviewed. C5 established; C1–C4 final runtime evidence pending. A-9204 local targeted summaries are supporting narrative, not a configured suite receipt. Preserve original commands/stdout/exits/source attribution without transcription-only reruns. Proceed with mode-free verification at this unchanged head; no merge authorization.

Criteria: C5 verified.

### rev-31 · 2026-10-22T15:32:29.916Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261022-1131-unavailable
commit: 1a9d9298fe8331e51e36c3426031f63f9af310cd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Historical e098d0fc/A-9215 is not clear: auto exit1, droplet size c-8 unavailable in lon1/nyc1/sfo2. Counts/platform unavailable; only host check output retained. No behavioral phase ran, projections are not passes. Source-clear A-9211/C5 remains applicable; no source finding. A-9218 preserves the exact failure and limits. Replacement c5acff9b already admitted; this verdict does not prejudge that pending run or ask for another. Restore claimant marks with supported evidence before final settlement; no merge authorization.

Criteria: C1 failed (Run e098d0fc did not execute T1/T2/Web: c-8 unavailable in all configured regions; behavioral evidence unavailable, no source failure established.), C2 failed (Run e098d0fc did not execute T1/T2/Web: c-8 unavailable in all configured regions; behavioral evidence unavailable, no source failure established.), C3 failed (Run e098d0fc did not execute T1/T2/Web: c-8 unavailable in all configured regions; behavioral evidence unavailable, no source failure established.), C4 failed (Run e098d0fc did not execute T1/T2/Web: c-8 unavailable in all configured regions; behavioral evidence unavailable, no source failure established.).

### impl-1131 · 2026-10-22T15:40:47.688Z

Configured local darwin arm64 verification c5acff9b at 1a9d9298 completed T1/T2 exit 0 and Web exit 1 solely on copied live tracker snapshot expected /S1/ for closed E-416 (A-9242); this is the shared defect fixed by Coordinator eacb0e27. Per posted instruction merged origin/dev (only shared test plus tracker), pushed a178b262 and requested delta source review before next exact-head run. No T-1131 production edits, no merge enqueue.

### rev-31 · 2026-10-22T15:44:29.964Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261022-1131-shared-web-failure
commit: 1a9d9298fe8331e51e36c3426031f63f9af310cd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Historical local c5acff9b/A-9242 not clear; A-9250. T1/T2 passed with all six task-new5/5 groups, but Web failed exact /S1/ on closed E-416. Matches Coordinator's shared eacb0e27 defect, not a T-1131 source finding. Mac darwin arm64, T3 deferred, lint/budgets report-only. New a178b262 delta review requested separately; historical failure is not a pass. Restore claimant C1 mark before final settlement.

Criteria: C1 failed (Required configured gate c5acff9b failed shared Web snapshot /S1/ assertion on closed E-416; own C1/T1/T2 identities pass, no owning defect established.).

### rev-31 · 2026-10-22T15:45:01.565Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-delta
commit: a178b2620f2f697377b53cc66346e6fad6554bf7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, A-9252; no findings. Only non-tracker change is Coordinator-authorized shared web/test/items.test.ts fix, byte-identical eacb0e27; T-1131 implementation/tests/docs unchanged from A-9211. C5 carried forward, C1–C4 final run pending. Historical local failed shared fixture receipt A-9250 and capacity A-9218 remain failed/incomplete; six owned5/5 groups do not make that overall run pass. Proceed with new-head mode-free verification under existing capacity/local instructions. No merge authorization.

Criteria: C5 verified.

### rev-31 · 2026-10-22T15:46:21.775Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261022-1131-capacity2
commit: a178b2620f2f697377b53cc66346e6fad6554bf7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Verification not run (capacity), A-9255; c6b437bb/A-9254 has no executed test phase or platform/count result. No code finding; A-9252 source/C5 remains current. Authorized same-head local9f85e943 already admitted; await its evidence without duplicates. C1 mark records incomplete required gate, not a defect. Restore claimant mark before final settlement; no merge authorization.

Criteria: C1 failed (Verification not run (capacity): c6b437bb executed no phase because c-8 unavailable; no functional finding.).

### rev-31 · 2026-10-22T16:13:19.840Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-final
commit: a178b2620f2f697377b53cc66346e6fad6554bf7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, A-9285; C1–C5 verified, no findings. Exact unchanged a178b262: authorized local9f85e943/A-9281 exits0,2452/2452,zero fail/cancel/skip;T0/T1/all-T2 hub+Neovim/Web complete. Raw six new identities each have five distinct successful load ids and explicit5/5. Local darwin arm64 workers4/Web2; lint/budgets report-only, T3 deferred/noT4 or stageQA claim. A-9221 development capture limits qualified. Historical no-execution capacity A-9215/A-9254 and old-head shared-Web failure A-9242 remain failed/incomplete; successful final result is new-head only. Source A-9211/A-9252 current; no merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-22T16:17:41.661Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-delta2
commit: b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge source clear, A-9291; no findings. Coordinator ccf4d62c permits one dev merge. Exact37-entry metadata union, all guidance retained; only manual combined-diff resolution is provenance. Owned code/test/shared-wire/docs patch remains identical to original reviewed patch; imported integration-facing changes do not alter history/profile/cwd authority paths. C5 carried forward. Old A-9281/A-9285 remains old-head proof; C1–C4 await fresh mode-free verification at b6c9e92e with actual executor/phase attribution. No merge enqueue.

Criteria: C5 verified.

### rev-31 · 2026-10-22T16:26:54.186Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-final2
commit: b6c9e92e9a9d49ef94694f95bba8bebf7d93aa22
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear after authorized dev merge, A-9308; C1–C5 verified, no findings. Exact unchanged b6c9e92e:304fd849/A-9306 automatic local fallback exits0,2473/2473,zero fail/cancel/skip,T0/T1/all-T2/Web complete. Six owned identities each have five distinct raw load-gate passes and explicit5/5. Source A-9291 covers metadata union and integration; old A-9281/A-9285 remains old-head proof. Actual local darwin arm64 workers4/Web2; lint/durations report-only,T3 deferred/noT4/stageQA claim. No merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-22T16:59:20.864Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-delta3
commit: 68f0b004506c879886fa6a519b577b1f04350e69
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear at 68f0b004; Standards and Spec: no findings. A-9350 records authorized merge, exact parent policy/test/wire/provenance retention and unchanged owned security boundaries. C5 verified. C1-C4 await fresh same-head mode-free configured verification; prior A-9306 belongs to b6c9e92e. A-9346 is supporting local static output, not a new suite receipt.

Criteria: C5 verified.

### rev-31 · 2026-10-22T17:10:23.382Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261022-1131-web-duration
commit: 68f0b004506c879886fa6a519b577b1f04350e69
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Historical run not clear; A-9365. Linux f41bed98/A-9363 T1/T2 exit0 and all assertions pass, but Web enforced area-slots duration gate exits1. Report-only budgets distinguished. Six owned identities have actual5/5; no whole-gate pass. Source A-9350 clear. New f2254248 shared-fix delta reviewed separately; restore claimant C1 before final settlement.

Criteria: C1 failed (Required configured f41bed98 failed shared Web area-slots duration gate 6.818s >5s; owned assertions/load groups pass, no source defect established.).

### rev-31 · 2026-10-22T17:10:59.036Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-delta4
commit: f2254248853bddee47e8277ed56ece1beefac4a7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-9366. Coordinator ae6368ad authorizes shared ec539bca allowance merge. Only test-related delta is dated9s area-slots allowance; owned source/tests/docs unchanged. Imported upstream executor restoration retained. C5 verified, C1-C4 await fresh mode-free exact-head verification. Historical A-9363/A-9365 remains failed overall; no source defect.

Criteria: C5 verified.

### rev-31 · 2026-10-22T17:21:34.850Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261022-1131-final4
commit: f2254248853bddee47e8277ed56ece1beefac4a7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-9378, C1-C5 verified. Exact reviewed f2254248 configured b25b05af/A-9377 exits0,2509/2509,zero fail/cancel/skip,T1/all-T2 hub+Neovim/Web complete. Six owned identities each have five distinct successful raw load IDs plus explicit5/5. Linux c8 lon1 workers2/Web4, host T0 gate9244597b not repeated remotely. Lint/nominal budgets report-only; shared5.818s area-slots passes reviewed9s allowance. Source A-9350/A-9366 current; historical A-9363 remains failed. T3/T4/stageQA deferred, no merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
