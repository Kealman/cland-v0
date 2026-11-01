---
id: T-1563
kind: task
title: Artifacts a person created carry their user
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1551
topic: topic-1308
branch: t/T-1563-artifacts-a-person-created-carry-their
created: 2026-10-31T23:47:51.208Z
updated: 2026-11-01T23:41:24.719Z
closed: 2026-11-01T23:41:24.719Z
---

## Summary

In users mode an artifact created or uploaded by a person, from the web, the CLI or a remote, records the user's id and shows the user's name as its creator. The journal's artifact record names the user's id. Agent artifacts are unchanged.

Hot files: `hub/src/hub/artifacts.ts` [Host: E-1531 moves path reads], `hub/src/hub/artifact-upload.ts` [Host: E-1531], `hub/src/protocol.ts` [Host] (`Artifact.creatorUserId`), `hub/src/hub/dispatch.ts` [Host].

## Acceptance criteria

- [x] C1. An artifact a user creates or uploads in users mode records that user's id and has the user's name as `creator`.
  - done: impl-1563 · 2026-11-01T20:01:37.963Z
  - verified: rev-36 [reviewer] · run rev-36-1563-final-1 · 2026-11-01T20:20:15.044Z · commit 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
  - verified: rev-36 [reviewer] · run rev-36-1563-final-2 · 2026-11-01T22:49:10.930Z · commit 02d6b86637b2de3ae392c19ea30f3233422ed2ca
- [x] C2. An artifact created by an agent session carries no user id.
  - done: impl-1563 · 2026-11-01T19:58:44.035Z
  - verified: rev-36 [reviewer] · run rev-36-1563-final-1 · 2026-11-01T20:20:15.044Z · commit 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
  - verified: rev-36 [reviewer] · run rev-36-1563-final-2 · 2026-11-01T22:49:10.930Z · commit 02d6b86637b2de3ae392c19ea30f3233422ed2ca
- [x] C3. The audit and artifact journal records of a human artifact carry the user's id.
  - done: impl-1563 · 2026-11-01T19:58:45.001Z
  - verified: rev-36 [reviewer] · run rev-36-1563-final-1 · 2026-11-01T20:20:15.044Z · commit 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
  - verified: rev-36 [reviewer] · run rev-36-1563-final-2 · 2026-11-01T22:49:10.930Z · commit 02d6b86637b2de3ae392c19ea30f3233422ed2ca
- [x] C4. Single-mode human artifacts keep `creator` `human` and no user id.
  - done: impl-1563 · 2026-11-01T19:58:45.615Z
  - verified: rev-36 [reviewer] · run rev-36-1563-final-1 · 2026-11-01T20:20:15.044Z · commit 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
  - verified: rev-36 [reviewer] · run rev-36-1563-final-2 · 2026-11-01T22:49:10.931Z · commit 02d6b86637b2de3ae392c19ea30f3233422ed2ca
- [x] C5. The change touches only creator fields in the artifact code, leaving its path reading as it is.
  - done: impl-1563 · 2026-11-01T19:58:45.771Z
  - verified: rev-36 [reviewer] · run rev-36-1563-source-2 · 2026-11-01T20:03:32.764Z · commit 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
  - verified: rev-36 [reviewer] · run rev-36-1563-final-1 · 2026-11-01T20:20:15.045Z · commit 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
  - verified: rev-36 [reviewer] · run rev-36-1563-delta-source-1 · 2026-11-01T22:31:29.685Z · commit 02d6b86637b2de3ae392c19ea30f3233422ed2ca
  - verified: rev-36 [reviewer] · run rev-36-1563-final-2 · 2026-11-01T22:49:10.931Z · commit 02d6b86637b2de3ae392c19ea30f3233422ed2ca

## Comments

### impl-1563 · 2026-11-01T19:55:23.302Z

Contract inventory before changes: searched Artifact/createArtifact/uploadArtifacts plus creator, creatorKind and creatorRole across hub/src, shared/wire, web/src, nvim (Lua and wire fixtures), all hub/web/nvim test tiers, shipped skills, docs and QA briefs. Producers: artifacts.ts, artifact-upload.ts, dispatch.ts (including suite/batch paths); persistence: Store JSON register/read/update and message artifact JSON; publication/journal: core.#publishArtifact/publishEvent; readers: CLI artifact, web artifact state/components and provenance, Neovim picker/browser, remote artifact-plan and Telegram/Discord outboxes, web HTTP artifacts, visibility/lifecycle/folder modules. Optional creatorUserId is additive in both wire types; all existing readers retain creator/creatorKind/creatorRole and need no migration. Exception: dispatch prompt.send compares creator === human and must recognize creatorKind for named human drafts. Agent/suite fields and all Host/path operations remain unchanged. Existing old-shape fixtures/tests remain compatible; named unedited preservation checks planned: artifact-host.test.ts, artifacts.test.ts, artifact-upload.test.ts. New frame tests cover durable returned/index artifacts and journal/audit identity; stage-level QA is inherited after-stage, no per-item brief required.

### rev-36 · 2026-11-01T20:00:06.830Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1563-source-1
commit: fb93bf711469f0116c930321cbf88b2f6268cddd
scope: full
findings: [{"severity":"medium","text":"Missed creator consumer: named human artifacts have creatorKind human but creator != human/creatorRole null, so visibility falls through to agent. Defaults change their placement from human watch to agent background and human overrides no longer apply.","file":"hub/src/hub/visibility.ts","line":188}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Medium visibility.ts:188 still categorizes humans solely by creator==='human' or aide role. Named user creator now falls through to agent/background instead of human/watch (defaults line16). Honor immutable creatorKind with legacy fallback, preferably shared human-provenance policy, and test authenticated create/upload placement in replies/events/list plus human override while preserving agent/single mode. Consumer inventory incorrectly treats visibility as unaffected. Other attribution/persistence/journal/prompt draft changes reviewed; Host/path/byte handling unchanged. Preliminary A-15371 targeted macOS receipts do not cover placement. Reviewer ran no tests/browser. Fresh source review before task verification.

Criteria: C1 failed (Changing human creator to the user name does not migrate visibility's creator===human consumer, so users-mode human artifacts lose human placement/overrides.).

### impl-1563 · 2026-11-01T20:00:44.958Z

Review correction: visibility.ts was in the inventory but its literal creator comparison was incorrectly classified unaffected. Repeated field search confirms remaining literal consumers: Store retention, web ArtifactsArea and Neovim artifact_browser already use creatorKind/legacy fallback; dispatch draft guard migrated in first head. New cookie-authenticated default watch/configured now reply/event/list checks both fail red with actual background before fix. Migrated visibility classification to immutable creatorKind with previous-wire creator fallback; no Host/path changes.

### rev-36 · 2026-11-01T20:03:32.764Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1563-source-2
commit: 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source re-review clear. Standards/spec no findings. Previous visibility issue resolved using immutable creatorKind with absent-kind legacy fallback, retaining archive/aide/kept/coordinator ordering. Two authenticated permutations cover create/upload reply/live-frame/list default watch and configured human now, retaining identity/forgery/audit/journal/draft assertions. Consumer inventory corrected; no dev merge. C5 source-verified: Host/path reads and upload ownership untouched. C1–C4 await same-head post-source run. A-15379 reports red background mismatch then artifact-user4/4 and typecheck/lint exit0 on local macOS/no browser; earlier preservation evidence remains prior-head. Reviewer ran no tests/browser.

Criteria: C5 verified.

### rev-36 · 2026-11-01T20:20:15.045Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1563-final-1
commit: 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged 518f4b1a7d1c8cbcae8e7cc61fec052ece5c7e32. Standards/spec no findings; C1–C5 verified. Independently checked A-15389's four generated artifact-user outcomes: users-mode attribution/index/audit/journal/agents, single-mode old shape, authenticated second-user watch and now placement, all pass. Unedited artifact-host4/artifacts15/upload5 pass, supporting source-established path/byte invariance; Neovim12/Web14 artifact regressions pass. Run dfd8d43b uncached Linux x64 droplet Node24.21.0 T0/T1/fallback T2/selected T4 base/Web exit0,4588 pass; isolated chromium_headless_shell-1248 Chrome for Testing156.0.8078.4. Remaining T3 in batch; other T4/repetitions unexecuted. Advisory checks report mode, no all-tier claim. Reviewer ran no tests/browser. QA after-stage; merge-batch T1–T3 gate remains next.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-36 · 2026-11-01T22:31:29.685Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1563-delta-source-1
commit: 02d6b86637b2de3ae392c19ea30f3233422ed2ca
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; Standards/Spec no findings. Coordinator explicitly authorized both merges; final manual resolutions retain all four items' README/skill text. Artifact creation/upload/visibility and all four targeted test files byte-unchanged from518f4b1a7. Inspected composition with landed user authority, Users.first bounded lookup, and trusted upload-caption/prompt message attribution; optional creatorUserId/journal identity and agent/single shape preserved. C5 source verified; C1–C4 await fresh same-head post-source mode-free verify. A-15435 is local macOS summary-only targeted/typecheck receipt without named raw output/Node version, not final coverage. Prior A-15389 remains old-head evidence. Incoming items' clear reviews/landings confirmed; no Reviewer tests/browser/edits. Premerge batch/after-stage QA separate.

Criteria: C5 verified.

### rev-36 · 2026-11-01T22:49:10.931Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1563-final-2
commit: 02d6b86637b2de3ae392c19ea30f3233422ed2ca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear; Standards/Spec no findings. Current delta sourceA-15437 unchanged. Independently streamed A-15456/935430dc generated artifact-user4 all pass (identity/index/audit/journal/agents,single old shape,cookie second-user watch/now with forged fields ignored). Unchanged artifact-host4/artifacts15/upload5 and Neovim12/Web14 artifact cases pass. Exact-head uncached Linuxx64 droplet Node24.21.0/Neovim0.12.5; T0,T1,fallbackallT2,selected mergedT3/mappedT4base,Web exit0,4689pass,zero fail/cancel/skip/todo. Isolated HeadlessShell1248/ChromeTesting156.0.8078.4; budget/lint/skip-check advisories report-only. RemainingT3/premergebatch,otherT4/repetitions unexecuted; priorA-15389 old-head only. C1–C5 verified. QA after-stage separate; no Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-01T23:41:24.719Z

Merged 0488a63cb039bc16214f0da2ad2592d0f2f6c155 onto dev.
