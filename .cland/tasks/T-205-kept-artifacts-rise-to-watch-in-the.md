---
id: T-205
kind: task
title: Kept artifacts rise to watch in the shared classifier
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1
  - ready-for-agent
assignee: impl-205
parent: T-115
blocked_by:
  - T-190
  - T-193
topic: topic-113
branch: t/T-205-kept-artifacts-rise-to-watch-in-the
created: 2026-10-10T20:08:34.923Z
updated: 2026-10-11T06:50:52.296Z
---

## What to build

Split from T-193 on 2026-10-10. Spec §3.6 says a kept artifact rises to the watch layer. T-193 adds artifact provenance and the `kept` flag; T-190 adds the shared visibility classifier. Once both are on dev, the classifier places kept artifacts (and their artifact events) in watch and unkept ones in background, for the hub's projections and Neovim alike.

## Acceptance criteria

- [x] C1. A kept artifact and its creation event classify as watch; an unkept agent artifact as background; the human's and an Aide's as T-193 defines.
  - done: impl-205 · 2026-10-11T03:32:58.548Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-1 · 2026-10-11T03:36:02.540Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-2 · 2026-10-11T03:53:17.945Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-3 · 2026-10-11T05:25:48.184Z
- [x] C2. Hub frame-protocol and headless tests cover keep, unkeep and restart.
  - done: impl-205 · 2026-10-11T03:32:58.617Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-1 · 2026-10-11T03:36:02.540Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-2 · 2026-10-11T03:53:17.945Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-3 · 2026-10-11T05:25:48.184Z
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-205 · 2026-10-11T06:49:30.739Z
  - verified: rev-14 [reviewer] · run rev-20261011-205-4 · 2026-10-11T06:50:31.976Z

## Notes

Size XS. Blocked by T-190 and T-193.

## Comments

### impl-205 · 2026-10-11T03:28:11.963Z

Implementing the kept-artifact watch classification in task worktree. Acceptance criteria establish the test seams: hub frame protocol and Neovim headless projections, covering keep, unkeep and restart.

### impl-205 · 2026-10-11T03:32:58.685Z

Implementation committed at 4630bf8, integrated with origin/dev 75b133d at efcaa7a. Kept artifacts use the watch cell; creation chips share the current artifact layer; cached thread history updates on artifact changes. Targeted visibility and headless artifact files both pass (9 tests each), including keep, unkeep and restart. Typecheck passed before integration. C3 awaits the mandated full suite.

### rev-14 · 2026-10-11T03:36:02.540Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-205-1
commit: efcaa7ab5b7da200ee661d35a7420b5833d6b09c

No high or medium findings. Standards and Spec axes clear: kept artifacts/chips share the classifier; immutable human/Aide provenance, age/archive precedence and project overrides remain correct. Current attachment metadata and generation-guarded Neovim refresh update cached placement. Independent in-memory Visibility boundary diagnostic passes. C1 verified by source/diagnostic; C2 verified as real protocol/headless keep/restart/unkeep coverage in the added tests. A-1010 reports targeted files 9/9 each; C3 remains unverified pending complete current-head package evidence. No exception applies. Evidence A-1013 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1013-t-205-review-clear-at-efcaa7a-c1-c2-verified-c3-pending.md.

Criteria: C1 verified, C2 verified.

### impl-205 · 2026-10-11T03:51:21.574Z

A-1017 failed prompt history plus the T-210 load-sensitive verifier test. Applied final Coordinator contract at 3025b53: only creation chips resolve current metadata, sent attachments preserve publication facts and moved paths still resolve. Net prompt-races fixture unchanged; all 6 tests pass. Verifier test passes alone on corrected head (1/1), and on detached dev 75b133d. Corrected branch is pushed; requesting fresh review and full suite. C3 remains open.

### rev-14 · 2026-10-11T03:53:17.945Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-205-2
commit: 3025b538be900456d16d299271cdfd86c50b59bd

No high or medium findings. Standards/Spec clear against the final Coordinator contract: creation chips resolve current metadata, ordinary attachments retain publication facts, moved paths still resolve. Net prompt fixtures unchanged. Independent actual memory HubCore/Store diagnostic confirms kept creation watch, current unkeep/archive metadata, retained prompt sent facts and moved paths. C1/C2 reverified from corrected source and retained real protocol/headless coverage; A-1019 reports prompt6/6, creation/headless1/1 each and isolated verifier1/1. C3 remains unverified pending complete current-head package evidence. Only conditional T-210 verifier exception is authorized; no exception applied here. Evidence A-1020 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1020-t-205-creation-only-metadata-correction-clear-at-3025b53-c3-pending.md.

Criteria: C1 verified, C2 verified.

### impl-205 · 2026-10-11T04:33:13.059Z

Full rerun A-1031 at 3025b53: typecheck completed, hub 1132/1133 pass, sole failure the permitted T-210 load-sensitive case. Complete same-head standalone pass output is A-1032. Full runner stops on hub failure, so submitted suite nvim on the same clean reviewed head to establish both phases. C3 remains open pending that result.

### impl-205 · 2026-10-11T05:23:35.424Z

Authorized test-only fixture hardening committed at 73d3352: graph waits for hub.status levels + full task list before :Cland graph; palette waits for normal mode after visible error recovery. Every existing assertion retained; no production code changed in this delta. Each case passed 10 standalone runs; four-worker batch passed all 4 selected cases (graph, palette, kept artifact, message layers). Integrated origin/dev da0d0c4, including T-210 fix, at clean pushed dcd0e5d. Requesting delta review and one full suite with no exceptions.

### impl-205 · 2026-10-11T05:24:41.406Z

A-1073 aborted before test phases on TS18048 in the new graph readiness callback. Captured the fixture count before that callback at 9d962d0; runtime wait/assertions unchanged. npm run typecheck passes. Latest origin/dev is already integrated, corrected branch clean and pushed. Requested fresh delta review and submitted replacement suite all with no exceptions.

### rev-14 · 2026-10-11T05:25:48.184Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-205-3
commit: 9d962d090c2e33fa7d11ae9cbaefdf8a8452b462

No high, medium or low findings. Both axes clear: graph/palette waits preserve every assertion; local itemCount capture resolves narrowing without behavior change. Integrated visibility retains inbox.plan and artifacts.kept, creation-only current metadata and ordinary attachment facts remain unchanged.
C1/C2 reverified. Independent real-memory HubCore/Store diagnostic passes on this head; A-1069 full commands/output establish each fixture10/10 and four-worker batch4/4 with zero bad counts. C3 pending complete 9d962d0 package evidence; A-1073 stopped at typecheck before tests and no exception applies. Evidence A-1078 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1078-t-205-fixture-and-dev-integration-clear-at-9d962d0-c3-pending.md.

Criteria: C1 verified, C2 verified.

### impl-205 · 2026-10-11T06:49:30.974Z

Final suite A-1104 at clean reviewed/pushed 9d962d0 exits 0: typecheck, hub and Neovim completed; 1389/1389 pass, zero failures/cancellations/skips/todo. All criteria marked done; requesting final C3 verification. No exceptions applied.

### rev-14 · 2026-10-11T06:50:31.976Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-205-4
commit: 9d962d090c2e33fa7d11ae9cbaefdf8a8452b462

No findings. C3 verified from complete A-1104: typecheck and both hub/Neovim phases passed, hub 1135/1135 + Neovim 254/254 = 1389/1389, exit 0, zero failures/cancellations/skips/todos, no exceptions. Complete log scanned and pinned head matches clean worktree plus pushed origin branch. C1/C2 retain rev-20261011-205-3 verification/A-1078 at this identical head. Final fresh clearance; all criteria verified. Evidence A-1105 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1105-t-205-final-c3-verification-clear-at-9d962d0-1389-tests.md.

Criteria: C3 verified.

### coord · 2026-10-11T06:50:52.296Z

Merged 6b74cdc35b7ad2e41499a65c5038f92ef04686a1 onto dev.
