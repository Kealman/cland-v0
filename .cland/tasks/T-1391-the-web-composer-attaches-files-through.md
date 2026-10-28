---
id: T-1391
kind: task
title: The web composer attaches files through an HTTP endpoint on the web edge, with its cookie and Origin checks
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1382
topic: topic-1142
branch: t/T-1391-the-web-composer-attaches-files-through
created: 2026-10-27T23:37:28.755Z
updated: 2026-10-28T11:02:57.220Z
---

## Summary

The web edge's own listener gains `POST /upload`. It accepts files only with a valid session cookie, a matching Origin and an allowed Host, and turns them into one `artifact.upload` through the web's conversation. The composer gains file attachments: chosen files show as chips, and sending the message posts them with its text.

## What to build

**The endpoint.**
- It accepts `multipart/form-data`: `topic`, `text`, `kind`, `to` or `replyTo`, and up to 10 files.
- It answers 401 without a valid cookie (`auth.session`), 403 for a foreign Origin or a disallowed Host, 405 for other methods, and 413 as soon as `Content-Length` or the streamed body passes 10 × `max_upload_mb` or a file passes `max_upload_mb`. It holds no more than that in memory.
- It hands the Buffers beside the frame to the same web conversation. The web authority table and its audit apply.
- It returns the result JSON with the message id.

**The composer.**
- An "Attach a file" control opens the browser's file picker. If it gets a key, the binding goes through `keymap.ts`.
- Chosen files show as chips with their name and size beside the existing artifact chips. A file over the limit shows as refused, with the limit in its tooltip.
- With files, Enter sends through the endpoint, so the message text becomes the caption. Without files the send is unchanged.
- Styling uses CSS Modules and tokens, with phone width respected.

**Shared contract:** the new HTTP route on the web edge. v0.2 §3.7's checks are kept, and the hub tests of the web edge's routes are updated. Spec §3.6.

## Acceptance criteria

- [x] C1. In headless Chromium, a PNG attached in General's composer and sent with a text arrives as one human message with that text and the PNG artifact, with no ▣ message (test).
  - done: impl-1391 · 2026-10-28T08:25:25.678Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1391-final · 2026-10-28T11:02:56.974Z · commit 83d84d376c5450054cad47cf6b83dc78b0c76a84
- [x] C2. `POST /upload` without the cookie answers 401, with a foreign Origin 403, and with a body over the limit 413, and none of them creates an artifact or a message (test).
  - done: impl-1391 · 2026-10-28T09:03:34.599Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1391-final · 2026-10-28T11:02:56.974Z · commit 83d84d376c5450054cad47cf6b83dc78b0c76a84
- [x] C3. A file over `max_upload_mb` chosen in the composer shows as refused and is not sent, and the composer's other keys and the existing artifact chip still work (test).
  - done: impl-1391 · 2026-10-28T09:02:11.277Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1391-final · 2026-10-28T11:02:56.974Z · commit 83d84d376c5450054cad47cf6b83dc78b0c76a84

## Notes

Shared files: hub/src/hub/web-edge.ts, hub/src/hub/web-auth.ts, web/src/Composer.tsx, web/src/Composer.module.css, web/src/composer-drafts.ts, web/src/keymap.ts

## Comments

### impl-1391 · 2026-10-28T08:13:08.145Z

Consumer inventory (rule 20), before new HTTP contract: web-edge serveBundle/upgrade routing and WebAuth.session; daemon createWebEdge caller; Dispatcher.open web authority/audit and artifact.upload byte side channel; Composer and composer-drafts, existing artifact picker/chips and topic.send; browser service worker (POST must remain network); hub/test/web-edge.test.ts and web-auth/web-authority/web-artifacts fixtures; web/test composer, artifacts, phone and inbox callers plus web harness/startup probe. Existing protocol clients (Neovim, gateway, socket/spoke), snapshots, persisted readers, T3/T4 have no HTTP upload caller and keep unchanged frames. Search: rg upload/createWebEdge/Composer/web edge across hub, web, nvim, shared, docs, skills, qa. New route only; retain prior wire shapes. Seams: sealed HTTP edge + existing frame history readback (C2), isolated Headless Shell composer with real Enter and artifact chips (C1/C3).

### impl-1391 · 2026-10-28T08:19:35.757Z

Inventory follow-up: mixed existing artifact chips plus new files needs an additive optional artifacts id array on artifact.upload (same validation as topic.send). Consumers: hub/src/protocol.ts type/validator, shared/wire/index.ts browser request union, hub/src/hub/artifact-upload.ts producer, dispatch.ts upload publisher, web-upload.ts HTTP translator, Composer.tsx FormData. Existing gateway media/voice calls and hub/test/artifact-upload.test.ts omit the field and retain prior semantics; authority allowlists depend on frame type, not this optional field. Existing captured frames, nvim and persisted artifact/message readers unchanged. New HTTP test keeps an omitted-field request and mixed browser test covers new form.

### rev-34 · 2026-10-28T08:31:07.327Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source1
commit: 0dd52c877477a836563ff16fa39bfb4cdbe15ccf
scope: full
findings: [{"severity":"high","text":"H1 Spec: HTTP upload work is outside revoked-session/edge-close ownership, and queued/prepared artifact authorize never rechecks the captured cookie session; revocation after streamed admission can still publish. Fence current admission through commit and cancel/join HTTP writers on revoke/close; prove a held precommit refusal.","file":"hub/src/hub/web-edge.ts","line":203},{"severity":"medium","text":"M2 Standards: both new index rows use custom labels instead of [Notes], so unchanged test-docs.test.ts:27 fails exact membership. Migrate only those labels and preserve guard red/green evidence.","file":"docs/agents/tests/index.md","line":314},{"severity":"medium","text":"M3 Spec: retained 10×max wire storage/file views are duplicated by uploadArtifacts Buffer.from for every payload, so near-cap HTTP requests exceed the explicit aggregate memory budget. Add an accounted private HTTP handoff/bounded storage while preserving native caller copy safety; prove with a small deterministic ownership/allocation control.","file":"hub/src/hub/web-upload.ts","line":18}]
finding_counts: {"high":1,"medium":2,"low":0}

Consolidated full source review not clear. A-13132 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13132-t-1391-full-source-review-at-0dd52c877-admission-and-allocation-blockers.md) contains source evidence, consumer/doc/keyboard review and correction boundaries. Standards one medium; Spec one high/one medium; no lows. Source2 must retain cookie/Host/Origin/size refusals, native byte ownership, original composer and old optional-field behavior. C1/C3 runtime-unverified; no verified marks. A-13127 is local macOS targeted proof, not configured Linux. Reviewer ran no tests or browsers. No verification for this head; request fresh pushed-head source review after consolidated corrections.

Criteria: C2 failed (Upload admission is not fenced through commit/revocation, and wire storage plus producer copies exceeds the specified aggregate memory cap.).

### impl-1391 · 2026-10-28T08:33:31.278Z

Review follow-up inventory: native HTTP lifecycle uses trusted Dispatcher.open authorizeUpload/ownsUploadBytes metadata, with a new in-process Conversation.drainUploads owner boundary. Consumers searched with rg Conversation/dispatcher.open: web-edge awaits drain for revoked/disconnected/stopping uploads; harness wrapper forwards receive arguments and drain; socket-edge, spoke, gateway and server callers retain default copying and need no new metadata. No wire field permits setting ownership. HubBaseOptions/serveProject/projectHub gain controlled uploadOpen and uploadAllocate I/O seams for deterministic tests. Added native caller mutation regression in artifact-upload.test.ts. Existing HTTP frame shape and clients unchanged.

### rev-34 · 2026-10-28T08:37:08.536Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source2
commit: cb6dfd1ab7afd29296893d249074ea7feccc9fef
scope: full
findings: [{"severity":"medium","text":"M4 Standards: held-writer HTTP fetch has no cancellation signal; when bounded until(writing) fails, finally releases the gate then awaits upload unbounded. A started revoke/stop completion is also not joined on failure. Pre-own request/control cancellation and independently bounded joins before POST; add omitted/aborted setup controls retaining writer-close and empty files/index/history assertions.","file":"hub/test/web-upload.test.ts","line":90}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source2 not clear: Standards one medium M4; no independent remaining Spec finding. Prior H1/M2/M3 addressed in source: session/operation fences and joined HTTP writer rollback, exact Notes labels, private HTTP byte handoff with native copies retained. A-13139 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13139-t-1391-source2-at-cb6dfd1ab-fixture-acquisition-still-needs-ownership.md) records audit. Review native copy control outstanding work under the same ownership requirement. C1/C3 remain runtime-unverified, no verification marks. A-13136 is local macOS targeted evidence, not configured/Linux/load proof. Reviewer ran no tests/browser. Correct M4, push and request source3 before verification.

Criteria: C2 failed (New HTTP authority/rollback regression has unbounded and unjoined failure-exit work; pre-owned cancellation/drain setup controls are required.).

### rev-34 · 2026-10-28T08:42:14.513Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source3
commit: 0f07ffc4ece290b7f46716f4b58b481fd9d84772
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear, Standards0/Spec0 findings. A-13143 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13143-t-1391-source3-clear-at-0f07ffc4e.md) records full correction audit. M4 resolved through pre-POST registered owner, abortable full HTTP/body work, tracked revoke/stop work, released held I/O and fresh bounded native/control/hub-stop drainage. Omitted/aborted setup controls retain acquired native handle, HTTP closure, handle close and empty persisted files/index/history after restart. Production unchanged from source2; H1 session/operation fence and HTTP writer rollback ownership, M2 Notes labels and M3 trusted private HTTP byte transfer/native copies remain resolved. C1–C3 runtime-unverified; no verified marks. Local macOS targeted claims are not configured Linux/new-file Web repetition proof. Reviewer ran no tests/browser. Proceed with configured mode-free verification at this exact head, then request original-record final evidence review.

### rev-34 · 2026-10-28T08:43:33.710Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source3-correction
commit: 0f07ffc4ece290b7f46716f4b58b481fd9d84772
scope: full
findings: [{"severity":"medium","text":"M5 Standards: both new T2/Web entries are at the start of tests, ahead of hub/src paths, violating the sorted tier manifest and refusing verification admission. Move only owning rows to sorted positions; preserve tier values and unchanged guard receipts.","file":"hub/test/tiers.json","line":19}]
finding_counts: {"high":0,"medium":1,"low":0}

Source3 disposition corrected to not clear. Actual hub refusal: 'verify-tiers: test tier map is not sorted by path: hub/src/adapters/opencode.test.ts (before web/test/uploads.test.ts)'. No suite ran. I missed owning-row placement in source review; H1/M2/M3/M4 resolutions remain intact. A-13144 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13144-t-1391-source3-admission-correction-unsorted-tier-rows.md) records refusal; location correction to that artifact: owning rows are19–20, not4. Correct only row positions, retain guard receipt, and request fresh pushed-head source review before resubmission. C1–C3 remain runtime-unverified.

Criteria: C2 failed (Configured verification cannot be admitted because the new tier rows are unsorted; no runtime evidence exists for this head.).

### rev-34 · 2026-10-28T08:44:30.897Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source4
commit: d4bd66a4ef05260e50eae4e520b184e40bae4eaf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear, Standards0/Spec0 findings. A-13146 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13146-t-1391-source4-clear-sorted-manifest-at-d4bd66a4e.md) records immutable one-file correction: only two owned tier rows relocated, all parsed values identical and entire tests map globally path-sorted. M5 resolved; H1/M2/M3/M4 resolutions/source3 assertions unchanged, no dev merge. Prior admission refusal supplied no runtime evidence. C1–C3 remain unverified pending configured mode-free run at d4bd66a4e and original-record final audit including actual Web repetition status. Reviewer executed no tests/browser; no full suite requested.

### rev-34 · 2026-10-28T08:59:56.023Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-evidence1
commit: d4bd66a4ef05260e50eae4e520b184e40bae4eaf
scope: evidence
findings: [{"severity":"medium","text":"M6 Spec: new Attach a file precedes Send in phone actions' vertical stack, displacing Send from the field's row. Actual unchanged phone-composer geometry assertion fails 'field and Send share row two',677!==731. Retain two-row/44px/docking assertions and fix file-control placement.","file":"web/src/Composer.tsx","line":93}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed final evidence at exact head: a8b9d85e/A-13154 exit1; A-13155 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13155-t-1391-failed-configured-evidence-phone-send-row-at-d4bd66a4e.md) records original failure output before item-owned classification. Independent3846 ordinary pass/1fail plus60 separate load pass; T0/T1/fallbackT2 passed,Web failed,T3/T4 unrun. New upload Web case3.210781057s ordinary pass, no Web repetition completion proof; timing disposition remains pending at corrected head. Linux c-8lon1 Node24.21/Neovim0.12.5; budgets/lint report-only, resource lifetime767s/$0.0532 not wall. Prior H1/M2/M3/M4/M5 fixes stand; source review required after phone fix before new verification. No criteria verified; Reviewer ran no tests/browser.

Criteria: C3 failed (Existing phone composer compatibility regression: field y677 and Send y731 no longer share row two; configured Web phase failed.).

### rev-34 · 2026-10-28T09:03:20.315Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source5
commit: 7402e9c6c7552d464da5eecedaafd97401430d26
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source5 clear, Standards0/Spec0 findings. A-13158 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13158-t-1391-source5-clear-at-7402e9c6c-phone-placement-and-approved-allowance.md) records M6 phone placement correction and Coordinator-approved exact allowance. Compact phone file control moves to addressing; Send stays beside textarea; all existing phone/composer/upload assertions unchanged. Exact upload-case allow4.82s/E-1311/Oct28–Nov04 matches independently read9faa1fb7 decision and actual parent sample3.210781057s×1.5 rounded upward, with honest failed-run provenance. No timeout/baseline/phase budget changes. H1–M5 fixes remain unchanged. C1–C3 runtime-unverified; claimant's old C2 failed mark still needs done restoration. Prior A-13154 stays failed, no corrected-head Linux/Web repetition proof yet. Reviewer ran no tests/browser. Configured mode-free verify may proceed at this head, then original-record final audit.

### rev-34 · 2026-10-28T09:20:21.127Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-evidence2
commit: 7402e9c6c7552d464da5eecedaafd97401430d26
scope: evidence
findings: [{"severity":"medium","text":"Shared T-1419 blocks final evidence: original locator.waitFor Timeout3000ms waiting for exact reviewer tree-verifier in ancestor Items row; child and parent fail. Coordinator427a6982 confirms shared dev defect and orders hold/no diagnosis/edit/retry until shared-fix merge instruction.","file":"web/test/items.test.ts","line":130}]
finding_counts: {"high":0,"medium":1,"low":0}

Run507e5264/A-13166 remains not clear, exit1. A-13167 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13167-t-1391-evidence2-failed-source6-allowance-only-audit.md) audits actual output before Coordinator-confirmed shared-defect classification. Unique3845 ordinary pass/2fail plus60 non-Web load pass; T0/T1/all fallbackT2 passed,Web failed,T3/T4 unrun. Phone row passes2.001332864s; upload passes3.319656720s but no Web repetition proof. No criterion-specific upload failure or verified mark recorded; suite failure blocks final gate. Worst-sample allowance correction reviewed separately at successor02cb87413. Preserve failed receipt; no unapproved retry.

### rev-34 · 2026-10-28T09:20:22.075Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source6
commit: 02cb874134ee44eeed086778c87311a85ecd16d7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source6 allowance-only correction clear, Standards0/Spec0 findings. A-13167 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13167-t-1391-evidence2-failed-source6-allowance-only-audit.md) records immutable diff and authority: exact upload-case allowance4.82→4.98 and updated provenance only; E-1311/Oct28–Nov04 unchanged. Actual worst3.319656720s from failed507e5264×1.5=4.979485080s, rounded upward, follows Coordinator9faa1fb7. Honest reason keeps both red whole runs and passing task samples distinct. Production/test assertions/timeouts/baselines/source selection unchanged, no dev merge. C1–C3 remain runtime-unverified; A-13166 remains failed, no parent/full pass reuse. Independently read Coordinator427a6982: shared T-1419, hold diagnosis/Items edits/retry until posted fix and authorized merge/resubmit; fresh source review after that merge. Reviewer ran no tests/browser.

### rev-34 · 2026-10-28T10:45:14.334Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-source7
commit: 83d84d376c5450054cad47cf6b83dc78b0c76a84
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-delta source clear; Standards0/Spec0. A-13216 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13216-t-1391-source7-shared-fix-merge-and-help-resolution.md) records both parents, carried source and help conflict audit. WEB_USAGE and REMOTE_USAGE frozen rows exactly match shipped exports, guards unchanged. Upload implementation/ownership/composer tests remain byte-identical to source6; sorted tiers and approved4.98s allowance retained; shared T-1419 is present. C1–C3 remain runtime-unverified. A-13166 stays failed parent-head evidence with no Web repetition proof. No Reviewer execution; configured exact-head run and original-record audit required for final evidence.

### rev-34 · 2026-10-28T11:02:56.974Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1391-final
commit: 83d84d376c5450054cad47cf6b83dc78b0c76a84
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2/C3 verified. A-13228 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13228-t-1391-final-original-case-and-repetition-evidence.md) independently audits original A-13223 exact-head run0c4d3438:3882 unique ordinary passes/500files,60 separate non-Web load (35item-owned/25site-docs),T0/T1/all fallbackT2/Web complete,T3/T4 unrun. Required PNG/caption/refusal/keys/chips case3.501430628s; unchanged phone row1.932106133s, composer8/8,phone6/6, HTTP6/6 plus5/5load each, native caller-copy1+5/5load, auth/Origin/Host/cap/no-publish and revoke/stop/drain/single-allocation assertions retained. Runner validates Web upload10/10 whole-file repetitions under CPU load/two workers/report-only;18.438s extra outside155.629s ordinary Web budget. Coordinator76fe0c56 explicitly keeps4.98s/currentgreenhead, supersedesraise instruction, expiryNov04/T-1421 retained. Linuxc8nyc1 Node24.21/Neovim0.12.5 isolatedCHS156.0.8078.4/v1248; hostcheck35.213s, preparedtree64e9ed1 reused not Linux typecheck;826s/$0.0574 accounting. Budget/lint warnings report-only. Original failed runs remain failed; no Reviewer execution, provider or stageQA claim.

Criteria: C1 verified, C2 verified, C3 verified.
