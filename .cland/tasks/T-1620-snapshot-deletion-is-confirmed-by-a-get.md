---
id: T-1620
kind: task
title: Snapshot deletion is confirmed by a GET
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1618
topic: topic-1343
branch: t/T-1620-snapshot-deletion-is-confirmed-by-a-get
created: 2026-11-02T03:34:17.445Z
updated: 2026-11-02T16:16:19.512Z
---

## Summary

Deleting a replaced executor snapshot after `prepare`, and in snapshot recovery, counts only once `GET /snapshots/{id}` answers 404. An unconfirmed deletion keeps its record, so the next recovery deletes it again.

Hot files: `hub/src/executor/droplet/api.ts`, `hub/src/executor/droplet/prepare.ts`, `hub/src/executor/droplet/snapshot-recovery.ts`, `hub/test/fakes/digitalocean/fake-api.ts`

## Acceptance criteria

- [x] C1. The client can GET one snapshot by id, and the fake API answers it, with the same DELETE-404-while-GET-200 fault (test).
  - done: impl-1620 · 2026-11-02T15:55:04.343Z
  - verified: rev-35 [reviewer] · run rev-35-1620-final-1 · 2026-11-02T16:16:19.070Z · commit 66533d707a661352cbdd45b5b223996b51d4a1c7
- [x] C2. A snapshot deletion in `prepare` and in snapshot recovery counts only once the GET answers 404 (test).
  - done: impl-1620 · 2026-11-02T15:55:04.460Z
  - verified: rev-35 [reviewer] · run rev-35-1620-final-1 · 2026-11-02T16:16:19.070Z · commit 66533d707a661352cbdd45b5b223996b51d4a1c7
- [x] C3. An unconfirmed snapshot deletion keeps its recovery record, and the next recovery deletes and confirms it (test).
  - done: impl-1620 · 2026-11-02T15:55:05.697Z
  - verified: rev-35 [reviewer] · run rev-35-1620-final-1 · 2026-11-02T16:16:19.070Z · commit 66533d707a661352cbdd45b5b223996b51d4a1c7
- [x] C4. `executor-prepare.test.ts` and `executor-prepare-component.test.ts` pass with no test edited.
  - done: impl-1620 · 2026-11-02T15:55:05.813Z
  - verified: rev-35 [reviewer] · run rev-35-1620-final-1 · 2026-11-02T16:16:19.070Z · commit 66533d707a661352cbdd45b5b223996b51d4a1c7

## Notes

Shared files: see Hot files

## Comments

### impl-1620 · 2026-11-02T15:50:54.478Z

Rule 20 inventory: snapshot()/deleteSnapshot() provider contract is consumed by prepare.ts and snapshot-recovery.ts; Provider is derived from DigitalOceanApi in dependencies.ts. Existing API snapshot GET and fake split-answer fault shipped in T-1618, reused unchanged. Searched hub/src, hub/test, web, nvim, docs, qa and skills for deleteSnapshot/recoverSnapshot/snapshotDelete. Existing executor-prepare.test.ts and executor-prepare-component.test.ts are preservation controls and stay unedited. Recovery records are private read by snapshot-recovery.ts only; persisted seen IDs must be retried even if catalogues omit them. No wire shape changes.

### impl-1620 · 2026-11-02T15:53:41.928Z

Red-first new tests reached intended failures (Missing expected rejection at DELETE404/GET200) then passed 3/3 on macOS arm64 local scripted fake. Unedited executor-prepare-component.test.ts passes 13/13; unedited executor-prepare.test.ts passes 5/5 (native lifecycle/bytes, fake provider). Initial component run failed 'confirmed old absence completes publication: not within 15000 ms': fake loseDeleteSnapshot fault was reapplied to already-absent images on each retry; fake now answers DELETE404 for absent snapshots before applying lost-mutation reply fault. No real API/browser/full suite run. Further inventory: deadline.ts wrapper, droplet.ts sweep/status reader, historical qa/briefs/T-271.md fake cleanup caller unaffected by stronger delete boundary; web recoverSnapshotAsks is unrelated.

### impl-1620 · 2026-11-02T15:56:10.783Z

Final source head 66533d707a661352cbdd45b5b223996b51d4a1c7 pushed. Coordinator-shared docs fix merged before first source review; aggregate npm run test:lint exit0, closed-item findings0/test lint refusals0 (report-only prerequisite/build/test advisories). Root typecheck passed before docs-only merge. A-15894 captures targeted results and scope; full source review requested by role, C1-C4 done. No queued verification yet; awaits source verdict.

### rev-35 · 2026-11-02T15:57:17.953Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1620-source-1
commit: 66533d707a661352cbdd45b5b223996b51d4a1c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1620 full source review at 66533d707a661352cbdd45b5b223996b51d4a1c7 against origin/dev merge-base. Live claimant impl-1620; request d8dd1763-8b5f-4444-b219-cd11697c14ae.

Standards: no findings. Reviewed complete diff, all deleteSnapshot/recoverSnapshot callers and provider/deadline wrappers, prepare retirement checkpoints, fake API fault ordering, new T2 test, unedited prepare controls, documentation/index/tiers and kept skill change record. Shared #confirmedDelete is reused unchanged; obsolete private DELETE-only helper is removed. Persisted recovery shape remains compatible.

Spec: no findings. Existing snapshot-by-id client/fake route supplies C1's read boundary. DELETE success or DELETE404 cannot settle deletion unless the by-id GET returns404. Prepare checkpoints previous/candidate and submitted retirement before mutation; unconfirmed exceptions keep the recovery record and usable replacement. Retirement recovery retries previous id even if catalogue omits it. Cleanup checkpoints every discovered id before effects and retries retained seen IDs independently of list membership; current/previous published images remain protected. Recovery forgets only after confirmed deletions plus existing action/catalogue settlement conditions.

Tests: three scripted-provider T2 identities cover retirement and cleanup DELETE404/GET200, durable record reload and hidden catalogue ids, four attempts through GET404 settlement, repeated absent deletion, and actual prepare lifecycle retaining retirement ownership and replacement pointer. Fake absent DELETE now returns404 before the lost-response mutation fault, accurately allowing a retry after the first effect. Assertions in both existing prepare files remain unchanged. Fixtures use disposable roots/shared sealed environments and fake clock; new tests add no native transport/browser.

C1–C4 remain unverified pending post-source-clear same-head queued outcomes for new3/component13 and exact-head native prepare5 preservation receipt. Local A-15894/reported typecheck/lint/targeted results are supplementary and not queued/full suite coverage. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

### impl-1620 · 2026-11-02T16:15:56.222Z

Exact-head queued 419d9d82 passed at 66533d707: A-15896, 4803/4803, T0/T1/fallbackT2/Web; Linux c-8/sfo2 x64 Node24.21 Nvim0.12.5 workers2, HeadlessShell156.0.8078.4/1248. Independently read named snapshot3/component13 pass rows. T3 deferred batch/T4 unexecuted; advisory gates report-only. Exact-head macOS arm64 Node24.21 native prepare targeted5/5 exit0 captured A-15897; both C4 files unedited. Final evidence review requested; claim retained.

### rev-35 · 2026-11-02T16:16:19.070Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1620-final-1
commit: 66533d707a661352cbdd45b5b223996b51d4a1c7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1620 final evidence review at 66533d707a661352cbdd45b5b223996b51d4a1c7. Scope: evidence. Source remains clear under rev-35-1620-source-1 / A-15895; current branch tip equals reviewed head.

Standards: no findings. Spec: no findings. C1–C4 verified.

Actual named outcomes independently streamed from A-15896: snapshot confirmation 3 pass (retirement and cleanup retain ownership through repeated DELETE404/GET200, reload durable records, retry hidden catalogue ids and settle at GET404; real prepare lifecycle retains retirement record and replacement pointer); unchanged prepare-component 13 pass; shared deletion confirmation 7 pass; test-docs 4 pass. These establish C1–C3 and the component half of C4.

A-15897 records all five generated native executor-prepare case names passing, native command exit 0, zero fail/cancel/skip/todo, at committed reviewed head/source tree 8f6991067d95930f7ad3ad01a9812a0a342890f5. Local macOS Darwin arm64 Node v24.21.0, fake provider and isolated fixtures, no browser/real cloud API. Named controls include reusable preparation/replacement, optional pins, runner-key hook and shutdown cancellation/drainage. Together with queued component13 and independently empty preservation-file diff, C4 is fulfilled. Local targeted receipt is not Linux native or full T3 evidence.

Queued run 419d9d82-5e9b-45c4-bc3e-2af88a808663 / A-15896: exit 0, 4803 pass, zero fail/cancel/skip/todo. T0/T1/fallback all T2/Web completed; T3 deferred to merge batch, T4 unexecuted. This is task verification, not full merge-batch coverage.

Recorded queued provenance: runner tree c42ac3dc3187c9963ae9a1f057759e5d91df4983, uncached droplet c-8 sfo2, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. Isolated Chrome Headless Shell /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing 156.0.8078.4. Host typecheck at runner tree was not repeated remotely. Budget/lint/ratchet/skip-reason checks report-only; skips [] / missing reason count 0. Executor lifetime 993 s / $0.0690 are billing facts, not suite wall time. Projections do not establish execution.

QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
