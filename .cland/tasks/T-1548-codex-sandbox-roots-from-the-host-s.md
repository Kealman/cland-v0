---
id: T-1548
kind: task
title: Codex sandbox roots from the Host's realpath
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1546
topic: topic-1314
branch: t/T-1548-codex-sandbox-roots-from-the-host-s
created: 2026-10-31T23:47:41.861Z
updated: 2026-11-02T01:05:05.042Z
closed: 2026-11-02T01:05:05.042Z
---

## Summary

`threadPolicy` and the worktree git-dir lookup compute every path handed to Codex through the session's Host: the writable roots, their `.git` directories, the cwd's own git directory, and the network allow-list's socket directories. On the `local` host the profile is byte-identical to today's.

Hot files: `hub/src/adapters/codex.ts`

## Acceptance criteria

- [x] C1. `threadPolicy` takes the session's Host and resolves the writable roots, the cwd, the project's `.cland` directory and the temp directories through its realpath (test).
  - done: impl-1548 · 2026-11-01T23:45:07.472Z
  - verified: rev-35 [reviewer] · run rev-35-1548-final-1 · 2026-11-02T00:03:04.027Z · commit 5015ac9b9eef71fb629617bda67d867fcb51b496
- [x] C2. The `.git` directory checks use the Host's statDirectory, and a linked worktree's `.git` file is read through its readFile (test).
  - done: impl-1548 · 2026-11-01T23:45:07.584Z
  - verified: rev-35 [reviewer] · run rev-35-1548-final-1 · 2026-11-02T00:03:04.027Z · commit 5015ac9b9eef71fb629617bda67d867fcb51b496
- [x] C3. On the `local` host the thread policy and `-c` overrides are byte-identical to today's for a writable root, a linked worktree inside it, a symlinked root and `network = local` (test).
  - done: impl-1548 · 2026-11-01T23:45:07.695Z
  - verified: rev-35 [reviewer] · run rev-35-1548-final-1 · 2026-11-02T00:03:04.027Z · commit 5015ac9b9eef71fb629617bda67d867fcb51b496
- [x] C4. A test with a Host whose realpath maps paths into another tree shows every sandbox path taken from that Host (test).
  - done: impl-1548 · 2026-11-01T23:45:08.008Z
  - verified: rev-35 [reviewer] · run rev-35-1548-final-1 · 2026-11-02T00:03:04.027Z · commit 5015ac9b9eef71fb629617bda67d867fcb51b496
- [x] C5. `codex.ts` no longer imports `realpath` or `stat`.
  - done: impl-1548 · 2026-11-01T23:45:08.121Z
  - verified: rev-35 [reviewer] · run rev-35-1548-source-1 · 2026-11-01T23:46:18.234Z · commit 5015ac9b9eef71fb629617bda67d867fcb51b496
  - verified: rev-35 [reviewer] · run rev-35-1548-final-1 · 2026-11-02T00:03:04.027Z · commit 5015ac9b9eef71fb629617bda67d867fcb51b496

## Comments

### impl-1548 · 2026-11-01T23:42:44.847Z

Consumer inventory: threadPolicy production calls are CodexAdapter spawn and relaunch; direct test callers are codex-adapter.test.ts, codex-workspace-git.test.ts and roles-template-component.test.ts (searched hub/src and hub/test, docs, skills and fixtures). Preserve the exported call shape with an optional trailing Host defaulting to local; production explicitly passes its captured session Host. Host already supplies realpath, statDirectory and readFile: no shared Host contract change or double migration required. Tests use the ticket's threadPolicy seam plus the existing recording Host/ScriptedCodex seam; hub-local socket creation remains local per A-15078.

### impl-1548 · 2026-11-01T23:44:37.091Z

Inventory correction/closure: exact direct threadPolicy callers are roles-template-component.test.ts and codex-workspace-git.test.ts; codex-adapter.test.ts consumes serialized native policy, not the exported helper. All remain unedited; optional trailing Host preserves previous call shape. Other CodexAdapter consumers (hub/src and hub/test including colocated tests), docs/skills and QA fixture references keep their constructor and Host shape unchanged. Added mapped Host/public helper and adapter spawn/relaunch tests. No wire/schema/admission change. A-15492 records pre-change fixture capture and red-to-green output.

### rev-35 · 2026-11-01T23:46:18.234Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1548-source-1
commit: 5015ac9b9eef71fb629617bda67d867fcb51b496
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards/Spec no findings. Captured session Host passed through spawn/relaunch policy; roots/Git checks/linked bytes/project-state/cwd/temp socket policy reads use existing Host methods, local default preserves exported helper shape and local semantics. Hub-local creation boundary retained. New registeredT2 tests compare independently captured four-scenario local bytes, exact mapped Host output/inputs and scripted spawn/relaunch argv; serialization proof, not native sandbox enforcement. Old direct helper callers and four Codex preservation files unchanged; matching docs/skill provenance updated. C5 source verified: no realpath/stat import. C1–C4 await exact-head queued mode-free evidence and named new3/Host lifecycle/preservation/older helper controls; A-15492 local red-green supplemental only. A-15493 details complete source review. No Reviewer execution/browser/edits; QA after-stage separate.

Criteria: C5 verified.

### rev-35 · 2026-11-02T00:03:04.027Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1548-final-1
commit: 5015ac9b9eef71fb629617bda67d867fcb51b496
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C5 verified. Exact-head uncached6e8cd810/A-15494 exit0,4632 pass, zero fail/cancel/skip/todo. Actual named sandbox3 confirms local byte fixture/mapped Host policy/spawn+relaunch argv; recordingHost19, Codex native35/delivery22 and old helper roles-template3 pass. Local A-15497 at same head/Git tree2ba4acd626976ca0a7cde2a3f946500b5e3b98cc has unedited adapter13/workspaceGit1 named outcomes/native exits0, Darwin arm64 Node24.21/no browser. T3 fake executable+real spoke; T4 synthetic Seatbelt Git paths, not native Codex/Landlock enforcement. Remote Linux x64 droplet Node24.21/Neovim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4, candidate treef211939a9d41718caf9ab76fe0143471a1f60560. T0/T1/allT2/Web complete, T3 deferred/T4 unexecuted remotely; report-only advisories retained. A-15498 provenance/limits. QA after-stage/merge batch separate. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-02T01:05:05.042Z

Merged 65bb98e377cb0ca7fa7eeb0fbb424d6d4dc43f4f onto dev.
