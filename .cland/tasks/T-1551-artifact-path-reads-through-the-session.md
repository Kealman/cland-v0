---
id: T-1551
kind: task
title: Artifact path reads through the session's Host
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1299
branch: t/T-1551-artifact-path-reads-through-the-session
created: 2026-10-31T23:47:42.500Z
updated: 2026-11-01T08:31:57.625Z
closed: 2026-11-01T08:31:57.625Z
---

## Summary

`artifact.create` with a path resolves, types, lists and reads its source through the calling session's Host. The human's and the hub's own calls use the `local` host. `artifact.upload`'s checks of stored artifact files go through the `local` host.

Hot files: `hub/src/hub/dispatch.ts` (the `artifact.create` handler), `hub/src/hub/artifacts.ts`, `hub/src/hub/artifact-folder.ts`, `hub/src/hub/artifact-upload.ts`

## Acceptance criteria

- [x] C1. `createArtifact` takes the caller's Host and reads a file source's bytes, a folder source's files and the source's type through it (test).
  - done: impl-1551 · 2026-11-01T07:20:59.828Z
  - verified: rev-35 [reviewer] · run rev-35-1551-final-1 · 2026-11-01T07:45:00.287Z · commit bf6594f266ea563689e7c582994b98919db046d7
- [x] C2. A session's relative path resolves against its cwd and is read on that session's Host, and the human's and the hub's calls use the `local` host (test).
  - done: impl-1551 · 2026-11-01T07:21:00.883Z
  - verified: rev-35 [reviewer] · run rev-35-1551-source-1 · 2026-11-01T07:24:10.440Z · commit 3c259d410266f1975e72a1cbab8a0f18130142fa
  - verified: rev-35 [reviewer] · run rev-35-1551-source-2 · 2026-11-01T07:24:46.076Z · commit bf6594f266ea563689e7c582994b98919db046d7
  - verified: rev-35 [reviewer] · run rev-35-1551-final-1 · 2026-11-01T07:45:00.287Z · commit bf6594f266ea563689e7c582994b98919db046d7
- [x] C3. `artifact.upload` checks attached artifacts' files through the `local` host (test).
  - done: impl-1551 · 2026-11-01T07:21:01.763Z
  - verified: rev-35 [reviewer] · run rev-35-1551-source-1 · 2026-11-01T07:24:10.440Z · commit 3c259d410266f1975e72a1cbab8a0f18130142fa
  - verified: rev-35 [reviewer] · run rev-35-1551-source-2 · 2026-11-01T07:24:46.076Z · commit bf6594f266ea563689e7c582994b98919db046d7
  - verified: rev-35 [reviewer] · run rev-35-1551-final-1 · 2026-11-01T07:45:00.287Z · commit bf6594f266ea563689e7c582994b98919db046d7
- [x] C4. With a recording Host, an `artifact.create` with a path from a session reads only through that session's Host (test).
  - done: impl-1551 · 2026-11-01T07:21:02.709Z
  - verified: rev-35 [reviewer] · run rev-35-1551-final-1 · 2026-11-01T07:45:00.287Z · commit bf6594f266ea563689e7c582994b98919db046d7
- [x] C5. The artifacts, artifact-create-unit, artifact-folders, artifact-upload and artifact-cli test files pass with no test edited.
  - done: impl-1551 · 2026-11-01T07:21:03.711Z
  - verified: rev-35 [reviewer] · run rev-35-1551-final-1 · 2026-11-01T07:45:00.287Z · commit bf6594f266ea563689e7c582994b98919db046d7

## Comments

### impl-1551 · 2026-11-01T07:11:51.409Z

Consumer inventory before edits: createArtifact production calls are Dispatcher.#artifact and #batchArtifact; previous positional read port remains supported for artifact-create-unit.test.ts unchanged. folderFiles also serves artifact.list and localHost.listFolder; leave its native local walker to avoid recursion. uploadArtifacts called only by Dispatcher upload; bytes remain frame-owned, only stored attachment checks route local. readArtifact injection also serves attached message reads and stays compatible. Searches cover hub/src, hub/test (all tiers), nvim/test, web/test, qa and .agents; no protocol or stored artifact creator shape changes. New regression seam: public createArtifact and Dispatcher frame conversation using recording Host, per epic's approved seams.

### impl-1551 · 2026-11-01T07:16:06.199Z

Additive Host.fileType approved by Coordinator answer e7724cde-1596-4cf0-bc15-f1da821dde08: no-follow file/directory/symlink/other/missing, ENOENT+ENOTDIR missing, other errors reject. Implementation is local.ts; Host literals inherit localHost so gain the member. Shared host-contract.ts exercises member and host-contract-coverage.test.ts discovers it dynamically. Sessions adds stable-session-id lookup delegating existing process placement; current placement remains local. Additional legacy readArtifact consumers identified: visibility-component, prompt-races, roles-snapshot and item-lead tests; their injected port remains honored in regular creation and message attachment reads. No frame or persisted shape changes. Host docs and skill edited in existing Host section with provenance change note.

### rev-35 · 2026-11-01T07:24:10.440Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1551-source-1
commit: 3c259d410266f1975e72a1cbab8a0f18130142fa
scope: full
findings: [{"severity":"low","text":"The guide still requires 'all six' wrapper receipts although the new fileType case makes seven. Say all registered cases or update the count so verification includes the new member.","file":"docs/agents/tests/hub-test-host-local-contract.test.ts.md","line":28}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear: no high/medium findings. Standards low: native Host contract guide:28 still says six wrapper receipts though fileType adds a seventh; update count or say every registered case. Spec: no findings. Captured-session-id Host selection, relative cwd resolution, local human/hub reads and local upload checks match scope; frame bytes/creator fields unchanged. Additive fileType native failure/no-follow semantics and T1 member guard covered in source. Legacy read ports retained. C2/C3 source verified; C1/C4/C5 final evidence pending. Require all seven native Host cases (wrapper unchanged, helper changed), four recording Host artifact cases and five unchanged preservation files. No Reviewer execution; QA after-stage.

Criteria: C2 verified, C3 verified.

### rev-35 · 2026-11-01T07:24:46.076Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1551-source-2
commit: bf6594f266ea563689e7c582994b98919db046d7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear. Standards/Spec: no findings. Complete delta is native Host guide count six→seven, resolving prior low. Full production/test review A-15218 carries forward, no runtime/test change. C2/C3 source verified; C1/C4/C5 final evidence awaits same-head verify, actual four recording Host cases, seven native wrapper identities and five unchanged preservation files. A-15216 local counts are pre-verdict evidence on identical source; publish exact named native outcomes/exit/provenance if task selection defers wrapper. No Reviewer execution; QA after-stage.

Criteria: C2 verified, C3 verified.

### rev-35 · 2026-11-01T07:45:00.287Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1551-final-1
commit: bf6594f266ea563689e7c582994b98919db046d7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Standards/Spec no findings. Evidence A-15239 (corrects arithmetic in A-15238). Same-head89a866dc / A-15237 exit0:4560 pass,zero fail/cancel/skip/todo. Actual named outcomes include four artifact-host cases and34 unchanged C5 preservation cases (15/2/7/5/5). T0/T1/all fallback T2/Web and selected T4 base complete; T3/remaining T4/repetitions unexecuted, not full premerge cover. Linux x64 droplet Node24.21.0,Neovim0.12.5,isolated Headless Shell1248/Chrome Testing156.0.8078.4; runner tree69999b5f separately recorded. A-15220 seven native Host named passes,exit0,Darwin arm64 local Node24.21.0; compared execution1f9233a1 to reviewed head: only docs/index differ, production/wrapper/helper identical. Budget/lint/ratchet report-only,no cache/skips. C1–C5 established. No Reviewer execution; affected after-stage QA and Coordinator full premerge cover remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-01T08:31:57.625Z

Merged 19b2d5c4a71804b2365241d9297802a169914b91 onto dev.
