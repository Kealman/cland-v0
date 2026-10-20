---
id: T-1009
kind: task
title: Tracker writes create no .conflict capture without a real concurrent edit
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-757
branch: t/T-1009-tracker-writes-create-no-conflict
created: 2026-10-20T17:01:25.119Z
updated: 2026-10-20T17:23:53.331Z
---

## Summary

Tracker writes create a `.conflict` capture almost every time, including a plain `task create` or `task edit` with no concurrent change. `.cland/tasks` now holds 5,026 captures, and new ones are written every minute. The churn feeds the file-watch and indexing load behind the P1 slow start. A capture must mean a real concurrent edit.

## What to build

Find why a write with no concurrent edit takes the conflict path (the capture is written in `hub/src/tracker/tracker.ts`). Candidates: the hub's own write seen back through the watcher, the CLI and the hub writing the same file, or a comparison that differs only in serialisation. Fix it so only a real concurrent change, a byte change made by another writer between read and write, creates a capture. Name the cause in the item topic.

## Acceptance criteria

- [x] C1. The cause of the false captures is named in the item topic with a reproduction in a scratch project (local evidence).
  - done: impl-1009 · 2026-10-20T17:06:49.649Z
  - verified: rev-26 [reviewer] · run rev-20261020-1009-source-2 · 2026-10-20T17:15:21.701Z · commit eaf0080d947478f7eb1879d45e38d7fb6345e67c
  - verified: rev-26 [reviewer] · run rev-20261020-1009-final-1 · 2026-10-20T17:23:51.115Z · commit eaf0080d947478f7eb1879d45e38d7fb6345e67c
- [x] C2. `task create`, `task edit`, `task comment` and `task criterion` from the CLI and from the hub, with no concurrent edit, create no `.conflict` file (test per path).
  - done: impl-1009 · 2026-10-20T17:06:50.205Z
  - verified: rev-26 [reviewer] · run rev-20261020-1009-final-1 · 2026-10-20T17:23:51.115Z · commit eaf0080d947478f7eb1879d45e38d7fb6345e67c
- [x] C3. A real concurrent edit, where another writer changes the file between read and write, still creates a capture (test).
  - done: impl-1009 · 2026-10-20T17:12:22.439Z
  - verified: rev-26 [reviewer] · run rev-20261020-1009-final-1 · 2026-10-20T17:23:51.115Z · commit eaf0080d947478f7eb1879d45e38d7fb6345e67c
- [x] C4. The tracker's file watcher does not emit a `task` event for a `.conflict` file (test).
  - done: impl-1009 · 2026-10-20T17:06:51.571Z
  - verified: rev-26 [reviewer] · run rev-20261020-1009-source-2 · 2026-10-20T17:15:21.701Z · commit eaf0080d947478f7eb1879d45e38d7fb6345e67c
  - verified: rev-26 [reviewer] · run rev-20261020-1009-final-1 · 2026-10-20T17:23:51.115Z · commit eaf0080d947478f7eb1879d45e38d7fb6345e67c

## Comments

### impl-1009 · 2026-10-20T17:06:49.639Z

Root cause reproduced in a scratch tempProject/projectHub fixture with isolated HOME/XDG/Git/provider environment: an uncontested CLI criterion write left T-1-cli-writes.md.<uuid>.conflict. #replaceCriterion deliberately retained every captured source on success; automatic backlog→planned writes share it. The fix uses temporary capture sources, cleans successful sources after final original-handle validation, and promotes observed racing sources to .conflict. Concurrent editor-save protection and legacy crash-recovery intents remain. No existing captures are pruned (T-452). Targeted local macOS tests cover CLI/hub create/edit/comment/criterion, real byte races, automatic planned updates, watcher filtering, and a SIGKILL recovery boundary.

### rev-26 · 2026-10-20T17:09:21.013Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-1009-source-1
commit: e24b1ded755ce29939dc4a010482952d31bb12f4
scope: full
findings: [{"severity":"high","text":"Recovery unconditionally deletes .tmp captures after EEXIST, losing a real editor save made through the captured inode after generated live publication and before a crash. The intent lacks an expected hash. Generic-error cleanup at line 2150 can likewise delete changed/unvalidated bytes after publication. Retain/promote such sources and test both boundaries.","file":"hub/src/tracker/tracker.ts","line":702}]
finding_counts: {"high":1,"medium":0,"low":0}

Source not clear. A-7745 contains separate Standards/Spec audit at e24b1ded against fixed base 237caa0c. No independent Standards finding; one high Spec data-preservation finding: startup .tmp unlink at line 702 deletes a concurrently edited captured inode when a generated canonical file already exists, and generic-error cleanup at line 2150 has the same unsafe deletion. Existing SIGKILL test covers only absent-path recovery. Persist validation evidence, retain changed/unvalidated bytes, and add crash-after-live-publication and injected generic-read-error regressions while preserving quiet-write cleanup. C1 cause is correctly identified; C2 paths and C4 watcher filtering have explicit source coverage, but no criterion verification is settled on this not-clear pass. A-7739 is a local targeted-summary artifact, not raw exact-head gate proof; original retained stdout was requested without transcription reruns. Implementer confirmed both gaps and will submit a corrected head. No Reviewer execution or edits.

Criteria: C3 failed (Crash-after-publication recovery and generic I/O-error cleanup can delete the only captured copy of a concurrent edit.).

### rev-26 · 2026-10-20T17:15:21.701Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1009-source-2
commit: eaf0080d947478f7eb1879d45e38d7fb6345e67c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear. A-7772 records Standards and Spec delta; M1/C3 data-preservation finding is resolved. Capture intents persist expected hashes; startup and generic-error cleanup delete only validated unchanged bytes, promote observed changes, and retain unreadable/unvalidated sources. New T1 cases cover existing-live-path clean/changed/unvalidated/legacy recovery and readable/unreadable post-publication I/O errors; actual T3 SIGKILL covers both absent path and changed source after live publication, preserving the original identity. No assertion/tier/allowance was weakened. A-7764 includes raw local macOS receipts: equivalent corrected implementation at f700f114 summary8/8, criterion13/13, planned12/12; exact eaf0080d crash2/2 and check exit0. Read-only diff confirms only the crash identity changed between those heads. Direct local receipts are not accepted Linux/full task evidence. C1 cause/reproduction and C4 watcher source exclusion established; verify C1/C4. C2/C3 final execution settlement awaits fresh mode-free exact-head task verification. C3 done restored by claimant; no Reviewer tests or edits.

Criteria: C1 verified, C4 verified.

### rev-26 · 2026-10-20T17:23:51.115Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1009-final-1
commit: eaf0080d947478f7eb1879d45e38d7fb6345e67c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at exact reviewed eaf0080d. A-7797 audits accepted mode-free 889b67a2/A-7794: Linux c8 lon1 two workers, exit0,2070/2070 ordinary passes, zero failures/skips/cancellations, plus40 distinct load repetitions all passing. C2 quiet CLI/hub create/edit/comment/criterion identity passes ordinary1.052454s and5/5(max1.094320s); all13 criterion and12 planned-stage identities pass, including real save races. C3 four startup variants and two post-publication I/O-error variants pass ordinary and5/5(maxT1repeat.066499s); prior data-loss finding remains resolved. C4 watcher no-read/no-task-event case passes ordinary and5/5(max.053562s). C1 diagnosis/local evidence remains A-7739/A-7755/A-7772. T1 and full fallbackT2 including Neovim actually execute green; T3 does not. Exact-head local macOS crash2/2/check receipts remain A-7764; no Linux nativeT3 proof claimed. Existing lint/budgets report-only; host header references separate check95ba40bd not repeated. Lifetime403s/$0.0280. Verify C1–C4; no remaining findings, QA none. No Reviewer rerun or edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
