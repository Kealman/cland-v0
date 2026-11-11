---
id: T-1795
kind: task
title: The ADR, the v0.1.2 §3.13 amendment and the logins notes
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1477
branch: t/T-1795-the-adr-the-v0-1-2-3-13-amendment-and
created: 2026-11-09T12:44:13.008Z
updated: 2026-11-11T16:20:25.408Z
---

## Summary

Record spec §3.12's decision: cland stores the keys the human enters through stdin and the metadata of disk logins (names, volume and snapshot ids, states). It never reads a login disk's contents and never keeps a harness's session tokens; the local registry stays names and paths. A new ADR carries the decision, spec v0.1.2 §3.13 gets an appended amendment, and `docs/hub/logins.md` describes the implementation for agents.

## What to build

Three documents, with no existing paragraph rewritten:
- **The ADR.** A new ADR in `docs/adr/` (question 16) states what cland stores for logins and what it never stores, including the terms boundary on Claude.ai and ChatGPT credentials. It links spec v0.4 §3.7 and §3.12 and GLOSSARY's Login, Login disk and Key login.
- **The amendment.** A dated amendment appended to spec v0.1.2 §3.13 links the ADR.
- **`docs/hub/logins.md`.** A new file describing the states, binding, release, snapshots, the key store, the cards and reconciliation as built, written for agents.

## Acceptance criteria

- [x] C1. A new ADR in `docs/adr/` states what cland stores and never stores for logins, and links spec v0.4 §3.7 and §3.12.
  - done: impl-1795 · 2026-11-11T09:08:19.255Z
  - verified: rev-35 [reviewer] · run rev-35-1795-source-1 · 2026-11-11T09:14:25.420Z · commit 478f0a97988eed61c1cb5b1c71306ac143d86681
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-2 · 2026-11-11T12:33:39.058Z · commit c9c1d69e645bdb50cca5911c47c21cad4b715d25
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-3 · 2026-11-11T14:13:21.749Z · commit 50bb55fe6f9c035cec6c83060ab717c8af823ccb
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-4 · 2026-11-11T14:59:58.342Z · commit 7cdaef877eb12e0212da0059de1bb131233a473d
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-5 · 2026-11-11T16:20:25.408Z · commit acfa3d7f6ff8a45df2334b33a0917c060cd757fe
- [x] C2. Spec v0.1.2 §3.13 carries an appended, dated amendment naming logins on hosts and linking the ADR, with no existing paragraph changed.
  - done: impl-1795 · 2026-11-11T09:08:19.464Z
  - verified: rev-35 [reviewer] · run rev-35-1795-source-1 · 2026-11-11T09:14:25.420Z · commit 478f0a97988eed61c1cb5b1c71306ac143d86681
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-2 · 2026-11-11T12:33:39.058Z · commit c9c1d69e645bdb50cca5911c47c21cad4b715d25
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-3 · 2026-11-11T14:13:21.749Z · commit 50bb55fe6f9c035cec6c83060ab717c8af823ccb
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-4 · 2026-11-11T14:59:58.343Z · commit 7cdaef877eb12e0212da0059de1bb131233a473d
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-5 · 2026-11-11T16:20:25.408Z · commit acfa3d7f6ff8a45df2334b33a0917c060cd757fe
- [ ] C3. `docs/hub/logins.md` exists and covers login states, binding, release, snapshots, the key store, the login cards and reconciliation.
  - failed: rev-35 [reviewer] · 2026-11-11T12:28:38.293Z · note Current partial as-built notes retain a false startup ownership attribution for pending bindings; remaining planned stage-4 coverage is separately intentional.
- [x] C4. The closed-item wording lint passes on the three files (test).
  - done: impl-1795 · 2026-11-11T09:08:20.813Z

## Blocked by

None (can start immediately; the plan places it in the last stage, so the notes describe what landed)

## Notes

- Hot files: `docs/adr/0009-<slug>.md` (new), `docs/spec/v0.1.2.md` (an appended section only), `docs/hub/logins.md` (new).
- Tests: the closed-item wording lint (T1).
- Serves epic C10.

## Comments

### impl-1795 · 2026-11-11T09:07:45.908Z

Documentation-only scope; no shared contract, wire shape, schema, policy or logic change and no additive registration entries. Existing docs/hub/logins.md is preserved and extended, per Coordinator decision a876a500. Stage-4 as-built additions follow authorized dev landings; final C3/ready follows T-1794. Initial content assertion red: AssertionError: C1: login storage ADR is missing. Candidate wording lint on Node v24.21.0/macOS: fixture controls passed; 715 documents/1811 tracker items, 0 findings. No runtime tiers, native/browser cases or provider operations run.

### rev-35 · 2026-11-11T09:14:25.420Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-source-1
commit: 478f0a97988eed61c1cb5b1c71306ac143d86681
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18630 initial three-file source review: Standards0/Spec0 in Coordinator-approved initial scope. Git tree d7e261c9d5fd28de4f713018f68266508d62a68f; 73 additive lines. Original spec and notes byte-preserved, every new link/fragment resolves. ADR/spec boundary matches glossary/v0.4 and landed stage1–3 owners; pool live Codex reads and remote no-idle-poll wording supported by source. C1/C2 verified. C3 intentionally open per a876a500 for additive as-built stage4 notes after authorized landings and delta reviews; final ready after T-1794. C4 local candidate lint is reported but original producer evidence/configured receipt not reviewed, so remains unverified. No Reviewer tests/native/browser/provider experiments or runtime coverage claim. Hold released; keep claim idle per Coordinator sequence. Final criteria/configured evidence and after-stage dev QA remain separate.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-11T12:24:48.591Z

Merge-delta assessment (report-only)
{"reviewed":"478f0a97988eed61c1cb5b1c71306ac143d86681","head":"732e256d4a87d5957507ba8d95b504fc39a5739d","dev":"71962ff0913d899055a488d4179d9874fefb303c","mergeBase":"697c33ddd7e62d5e7e518ca939ecb323c3e37047","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/adr/0009-login-storage-boundary.md","docs/hub/logins.md","docs/spec/v0.1.2.md"],"devPaths":[".cland/tasks/T-1789-dead-login-signals-mark-the-login-signed.md",".cland/tasks/T-1792-cland-login-remove.md",".cland/tasks/T-1793-login-reconciliation-at-hub-start.md",".cland/tasks/T-1795-the-adr-the-v0-1-2-3-13-amendment-and.md","docs/agents/tests/hub-test-host-relaunch.test.ts.md","docs/agents/tests/hub-test-host-restart.test.ts.md","docs/agents/tests/hub-test-login-reconcile.test.ts.md","docs/agents/tests/hub-test-waiting-launch-restart.test.ts.md","docs/agents/tests/index.md","docs/hub/logins.md","hub/README.md","hub/src/host/login-reader.ts","hub/src/host/login-reconcile.ts","hub/src/host/login-release.ts","hub/src/host/logins.ts","hub/src/hub/daemon.ts","hub/test/durations.json","hub/test/host-relaunch.test.ts","hub/test/host-restart.test.ts","hub/test/host-status.test.ts","hub/test/host-stop.test.ts","hub/test/login-reconcile.test.ts","hub/test/login-records.test.ts","hub/test/login-selection.test.ts","hub/test/pool-failures.test.ts","hub/test/pool-scale.test.ts","hub/test/session-pool-placement.test.ts","hub/test/settled-login-fixture.ts","hub/test/ssh-host-fixture.ts","hub/test/tiers.json","hub/test/waiting-launch-restart.test.ts","hub/test/waiting-launch.test.ts"],"overlap":["docs/hub/logins.md"],"dependency":{"status":"known","importers":[]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-35 · 2026-11-11T12:28:38.293Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-1
commit: f9052d514522305eb4a3ba8980de1dca0134aab7
scope: delta
findings: [{"severity":"medium","text":"Standards / rule16 and Spec as-built notes: the newly exempted paragraph still says startup T-1793 owns recovery of pending bindings, but landed LoginReconciliation only pages settled bindings and skips hasPendingBinding. This contradicts the new owner section and C6's retained receipt ownership. Lead edb9083a confirms no historical/superseded disposition. Under the no-rewrite constraint, add an explicit dated correction marking that attribution superseded and naming the admitted binder/reader receipt owners; do not imply automatic startup recovery or clear pending rows. The wording-lint exemption alone does not correct the technical claim.","file":"docs/hub/logins.md","line":312}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18679 authorized T-1793 landing delta pass: Standards1medium/Spec same mismatch0additional. Merge732e256d4 authorized3914a5d3; inherited runtime/tests/docs match reviewed T-1793 and no combined conflict delta. Own44additive lines otherwise match landed order/cursors/receipts/episodes/retry/shutdown. Exemption leaves touched logins:312 pending-binding recovery attribution false (lead edb9083a), contradicting settled-only skip/fences. C3failed for this current claim, distinct from deliberately open future stage4sections. Hold released for dated additive supersession/correct receipt ownership under no-rewrite constraint, fresh committed delta review. C1/C2unchanged; C4localcandidate lintA-18673notfinalhead proof. Finalready afterT-1794 asplanned; no runtime/provenance-only rerun or Reviewer experiments.

Criteria: C3 failed (Current partial as-built notes retain a false startup ownership attribution for pending bindings; remaining planned stage-4 coverage is separately intentional.).

### rev-35 · 2026-11-11T12:33:39.058Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-2
commit: c9c1d69e645bdb50cca5911c47c21cad4b715d25
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18687 current staged delta CLEAR: Standards0/Spec0. Merge takes shared dev10711a330's exact corrected pending-binding ownership sentence and removes obsolete exemption; only logins.md changes from prior reviewed f9052d514. A-18679 current attribution finding resolved; appended Startup reconciliation owner notes unchanged. Task diff vs shared dev remains3docs/116insertions/0deletions, no runtime/test delta; ADR/spec identical to initial reviewed478f0a979, C1/C2 refreshed. Clean worktree and read-only diff check. A-18680 candidate lint narrative is not final exact-head configured evidence; C4 remains unverified. C3 remains deliberately open for later Coordinator-directed stage4 landings, not verified by this partial delta; previous failed attribution is corrected. Final readiness afterT1794 and final criteria/evidence remain separate. No Reviewer runtime/lint/native/browser/provider experiment. Hold released.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-11T14:12:12.323Z

Merge-delta assessment (report-only)
{"reviewed":"c9c1d69e645bdb50cca5911c47c21cad4b715d25","head":"50bb55fe6f9c035cec6c83060ab717c8af823ccb","dev":"a38929ae8b2ed60cc7e2a50abd02735b7f3c6094","mergeBase":"10711a330d6f90bf9d6b218e9bdefd1eb3224f76","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/adr/0009-login-storage-boundary.md","docs/hub/logins.md","docs/spec/v0.1.2.md"],"devPaths":[".agents/skills/implement/CHANGES/T-1810-terminal-release.md",".agents/skills/implement/SKILL.md","docs/agents/tests/hub-test-host-restart.test.ts.md","docs/agents/tests/hub-test-login-release.test.ts.md","docs/hub/host-providers.md","docs/hub/logins.md","hub/README.md","hub/src/host/login-release-policy.ts","hub/src/host/provision-host.ts","hub/test/host-restart.test.ts","hub/test/login-release.test.ts"],"overlap":["docs/hub/logins.md"],"dependency":{"status":"known","importers":[]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-35 · 2026-11-11T14:13:21.749Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-3
commit: 50bb55fe6f9c035cec6c83060ab717c8af823ccb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18743 current staged merge delta CLEAR: Standards0/Spec0. Coordinator e51c4c8b authorizes clean merge of landedT1810 a38929ae8. Imported runtime/tests/docs/skills byte-identical to final-reviewed3ee73e112; combined conflict diff empty. Inherited notes already accurately cover terminal destroyed provisions, independent disk/reader retry and binder receipt ownership; no duplicate prose required. ADR/spec and entire additive task appendix byte-unchanged from c9c1d69e6; task difference from landed dev remains3docs/116insertions/0deletions. C1/C2 refreshed. A18742 reports committed-head local lint0 but no original producer/configured final receipt reviewed; C4 remains unverified. C3 deliberately open for later landed stage4sections; final readiness afterT1794, final criteria/evidence separate. Clean worktree/read-only diff check. No Reviewer tests/native/browser/provider. Hold released; retain staged sequence.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-11T14:59:58.343Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-4
commit: 7cdaef877eb12e0212da0059de1bb131233a473d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18766 current staged delta CLEAR: Standards0/Spec0. Coordinator212c8af0 authorized T1789 landing merge; actual dev5baccac29 differs f10710982 only by tracker. Own delta only3docs/140insertions/0deletions, no runtime/test edits. EOF resolution byte-preserves earlier task appendix and imported Dead-login section; new24lines match landed native-error/admitted-running-session/settled-binding checks, shared markSignedOut/UUID/creating-state semantics, indexed card/notice recovery and decline behavior. Imported T1789 has rev36 final verdict at1470a7b09; differences in dev confined previously reviewed T1810 paths. ADR/spec unchanged, C1/C2 refreshed. A18762 candidate lint narrative not original/final configured evidence; C4 unverified. C3 deliberately open for remaining T1792/lane1 sections, final ready afterT1794; no runtime/QA coverage claim. Worktree clean/read-only diff check. No Reviewer test/native/browser/provider experiment. Hold released; retain staged sequence.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-11T16:20:25.408Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-5
commit: acfa3d7f6ff8a45df2334b33a0917c060cd757fe
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18800 current partial delta CLEAR: Standards0/Spec0. Coordinator97c89684 authorized T1792 landedee483c2a0 merge; inherited runtime/tests/docs/skills/wire byte-identical to rev37-reviewed efaba34f8. Task difference only3docs/164insertions/0deletions. Conflict resolution preserves prior task sections and imported removal paragraphs;24 new owner lines agree with same-store concurrency, claim/admission/shutdown, positive snapshot receipt/accounting recovery before unknown guard, atomic deleteStorage stamps/final store checks and claim-based card suppression (not reason-text authority). ADR/spec unchanged, C1/C2 refreshed. A18799 candidate lint narrative not original/final configured evidence; C4 unverified. C3 deliberately open forT1790/T1791/T1794, finalready/exact-head evidence outstanding. Clean worktree/read-only diff check; no Reviewer tests/native/browser/provider. Hold released; retain staged sequence.

Criteria: C1 verified, C2 verified.
