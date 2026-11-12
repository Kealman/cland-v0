---
id: T-1795
kind: task
title: The ADR, the v0.1.2 §3.13 amendment and the logins notes
state: closed
status: done
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
updated: 2026-11-12T06:48:28.244Z
closed: 2026-11-12T06:48:28.244Z
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
  - verified: rev-35 [reviewer] · run rev-35-1795-source-1 · 2026-11-11T09:14:25.420Z · commit 478f0a97988eed61c1cb5b1c71306ac143d86681
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-2 · 2026-11-11T12:33:39.058Z · commit c9c1d69e645bdb50cca5911c47c21cad4b715d25
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-3 · 2026-11-11T14:13:21.749Z · commit 50bb55fe6f9c035cec6c83060ab717c8af823ccb
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-4 · 2026-11-11T14:59:58.342Z · commit 7cdaef877eb12e0212da0059de1bb131233a473d
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-5 · 2026-11-11T16:20:25.408Z · commit acfa3d7f6ff8a45df2334b33a0917c060cd757fe
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-6 · 2026-11-11T18:09:50.359Z · commit cc47bce80c424124d78c40fdaa0310cd240f17da
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-7 · 2026-11-11T19:37:03.133Z · commit 7e8782d583b3c654e1900dd568b0d66b193823e5
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-9 · 2026-11-11T21:36:35.812Z · commit ead9f7b7968ebc8a7f25f849a0bc0a71a6540695
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-10 · 2026-11-12T00:18:14.091Z · commit 1b5b4eeb5a2127413372707187af7367c6e6e124
  - done: impl-1795 · 2026-11-12T02:16:04.878Z
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-12 · 2026-11-12T02:22:06.888Z · commit 4ede548a9bdf95edf26d3eba8f3c157120727e55
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-13 · 2026-11-12T02:44:13.792Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b
  - verified: rev-35 [reviewer] · run rev-35-1795-final-1 · 2026-11-12T03:08:04.263Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b
- [x] C2. Spec v0.1.2 §3.13 carries an appended, dated amendment naming logins on hosts and linking the ADR, with no existing paragraph changed.
  - verified: rev-35 [reviewer] · run rev-35-1795-source-1 · 2026-11-11T09:14:25.420Z · commit 478f0a97988eed61c1cb5b1c71306ac143d86681
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-2 · 2026-11-11T12:33:39.058Z · commit c9c1d69e645bdb50cca5911c47c21cad4b715d25
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-3 · 2026-11-11T14:13:21.749Z · commit 50bb55fe6f9c035cec6c83060ab717c8af823ccb
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-4 · 2026-11-11T14:59:58.343Z · commit 7cdaef877eb12e0212da0059de1bb131233a473d
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-5 · 2026-11-11T16:20:25.408Z · commit acfa3d7f6ff8a45df2334b33a0917c060cd757fe
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-6 · 2026-11-11T18:09:50.360Z · commit cc47bce80c424124d78c40fdaa0310cd240f17da
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-7 · 2026-11-11T19:37:03.133Z · commit 7e8782d583b3c654e1900dd568b0d66b193823e5
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-9 · 2026-11-11T21:36:35.812Z · commit ead9f7b7968ebc8a7f25f849a0bc0a71a6540695
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-10 · 2026-11-12T00:18:14.091Z · commit 1b5b4eeb5a2127413372707187af7367c6e6e124
  - done: impl-1795 · 2026-11-12T02:16:06.227Z
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-12 · 2026-11-12T02:22:06.889Z · commit 4ede548a9bdf95edf26d3eba8f3c157120727e55
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-13 · 2026-11-12T02:44:13.793Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b
  - verified: rev-35 [reviewer] · run rev-35-1795-final-1 · 2026-11-12T03:08:04.263Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b
- [x] C3. `docs/hub/logins.md` exists and covers login states, binding, release, snapshots, the key store, the login cards and reconciliation.
  - done: impl-1795 · 2026-11-12T02:21:04.391Z
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-12 · 2026-11-12T02:22:06.889Z · commit 4ede548a9bdf95edf26d3eba8f3c157120727e55
  - verified: rev-35 [reviewer] · run rev-35-1795-delta-13 · 2026-11-12T02:44:13.793Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b
  - verified: rev-35 [reviewer] · run rev-35-1795-final-1 · 2026-11-12T03:08:04.263Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b
- [x] C4. The closed-item wording lint passes on the three files (test).
  - done: impl-1795 · 2026-11-12T02:16:06.657Z
  - verified: rev-35 [reviewer] · run rev-35-1795-final-1 · 2026-11-12T03:08:04.264Z · commit 90410ef27b35fbbb7c21ee306412adc03f80467b

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

### hub · 2026-11-11T18:07:30.409Z

Merge-delta assessment (report-only)
{"reviewed":"acfa3d7f6ff8a45df2334b33a0917c060cd757fe","head":"818a867ca5b4e7f11b49fedaff25f06d8090091a","dev":"e744bc339f09d092ec04e1d3e968b65ae07f8e94","mergeBase":"ee483c2a0210d2e0f333f51cfcdc768093ecdb30","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/adr/0009-login-storage-boundary.md","docs/hub/logins.md","docs/spec/v0.1.2.md"],"devPaths":[".agents/skills/implement/CHANGES/T-1790-login-signin.md",".agents/skills/implement/SKILL.md",".cland/tasks/T-1790-cland-login-signin-in-place-and-the-one.md",".cland/tasks/T-1792-cland-login-remove.md",".cland/tasks/T-1795-the-adr-the-v0-1-2-3-13-amendment-and.md",".cland/tasks/T-1813-native-fake-host-end-to-end-dead-login.md",".cland/tasks/T-1814-login-add-treats-a-dispatcher.md","docs/agents/session-permissions.md","docs/agents/tests/hub-test-login-add-component.test.ts.md","docs/agents/tests/hub-test-login-list.test.ts.md","docs/agents/tests/hub-test-login-remove.test.ts.md","docs/agents/tests/hub-test-login-resignin-native.test.ts.md","docs/agents/tests/hub-test-login-signed-out.test.ts.md","docs/agents/tests/hub-test-login-signin-recovery.test.ts.md","docs/agents/tests/hub-test-login-signin.test.ts.md","docs/agents/tests/hub-test-login-snapshots.test.ts.md","docs/agents/tests/index.md","docs/hub/logins.md","hub/README.md","hub/src/adapters/sessions.ts","hub/src/cli/help.ts","hub/src/cli/login-terminal.ts","hub/src/cli/login.ts","hub/src/cli/usage/login.ts","hub/src/host/login-add.ts","hub/src/host/login-cards.ts","hub/src/host/login-release.ts","hub/src/host/login-signals.ts","hub/src/host/login-signin.ts","hub/src/host/login-snapshots.ts","hub/src/host/logins.ts","hub/src/host/provision-host.ts","hub/src/hub/daemon.ts","hub/src/hub/dispatch.ts","hub/src/hub/web-authority.ts","hub/src/protocol.ts","hub/test/durations.json","hub/test/fixtures/cli-usage/commands.json","hub/test/login-add-component.test.ts","hub/test/login-list.test.ts","hub/test/login-metadata-owners.ts","hub/test/login-release.test.ts","hub/test/login-remove.test.ts","hub/test/login-resignin-native.test.ts","hub/test/login-signed-out.test.ts","hub/test/login-signin-recovery.test.ts","hub/test/login-signin.test.ts","hub/test/login-snapshots.test.ts","hub/test/tiers.json","shared/wire/index.ts"],"overlap":["docs/hub/logins.md"],"dependency":{"status":"known","importers":[]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-35 · 2026-11-11T18:09:50.360Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-6
commit: cc47bce80c424124d78c40fdaa0310cd240f17da
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18819 current partial delta CLEAR: Standards0/Spec0. Coordinator9b1ac986 authorized T1790 landed44a2775c9 single merge; inherited runtime/tests/sharedwire/skills/nvim/web/docs-agents byte-identical to reviewed3683b2f7b. Own commit adds26 EOF lines only; prior task/imported sections preserved. Dedicated preparePoolLogin/prepareExistingLoginSignIn, begin/finishSignIn, snapshotHostIdentity, indexed startup recovery and exact-machine deletion settlement/removal fence agree with landed implementation;3 case-guide links resolve. Against landed dev task nontracker diff only3docs/190insertions0deletions (ADR34+spec12+logins144), ADR/spec unchanged fromprior. C1/C2 refreshed. A18818 candidate static-lint narrative qualified,not original/final configured receipt; C4 unverified. C3 deliberately open forT1791/T1794, finalready/exacthead evidence outstanding. Clean fixed head/read-only review; no Reviewer tests/native/browser/provider. Hold released; retain staged sequence.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-11T19:37:03.133Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-7
commit: 7e8782d583b3c654e1900dd568b0d66b193823e5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18864 current partial delta CLEAR: Standards0/Spec0. Coordinator517ba3d3 authorized T1794 landed6aa8c95df merge; inherited runtime/tests/skills/sharedwire/docs-agents/nvim/web byte-identical to rev36 source/final-cleareddd4650fa7. Append conflict preserves prior task sections and imported Relaunch section;16 new owner lines match post-finishSignIn hook and captured live/unarchived generation admission inside resume lifecycle slot, superseding stop/archive/resume, committed-login failure reporting and no fresh conversation. Task nontracker difference only3docs/206insertions0deletions;ADR/spec unchanged, C1/C2 refreshed. A18861 candidate wording-lint narrative qualified,not final configured proof; C4 unverified. C3 remains open for updated sequence T1815/T1791/T1814, T1795 last. Clean head/read-only review; no Reviewer execution/edit. Hold released; retain staged claim and final evidence boundary.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-11T21:32:17.881Z

Merge-delta assessment (report-only)
{"reviewed":"7e8782d583b3c654e1900dd568b0d66b193823e5","head":"b7870fd1484ac7a3ca245247714c7d4ca9d1b19a","dev":"065cf1416ed6487f0103059f1e7aea7dccceca1e","mergeBase":"7d50d44b3cb488c998fea8df24bfe89ca274e9a5","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/adr/0009-login-storage-boundary.md","docs/hub/logins.md","docs/spec/v0.1.2.md"],"devPaths":[".cland/tasks/T-1791-signing-in-from-a-card.md",".cland/tasks/T-1795-the-adr-the-v0-1-2-3-13-amendment-and.md",".cland/tasks/T-1815-an-agent-owned-interactive-sign-in.md",".cland/tasks/T-1818-host-restart-reads-the-live-host-s-login.md","docs/agents/host-agent.md","docs/agents/tests/hub-test-accounts-policy.test.ts.md","docs/agents/tests/hub-test-host-agent-signin-op.test.ts.md","docs/agents/tests/hub-test-host-restart.test.ts.md","docs/agents/tests/index.md","docs/hub/ssh-host.md","hub/README.md","hub/src/accounts/registry.ts","hub/src/host/agent-client.ts","hub/src/host/agent/closure.json","hub/src/host/agent/login-disk.ts","hub/src/host/agent/processes.ts","hub/src/host/agent/server.ts","hub/src/host/agent/signin-command.ts","hub/src/host/agent/signin-redactor.ts","hub/src/host/agent/signin-types.ts","hub/src/host/agent/signin.ts","hub/src/host/agent/state-paths.ts","hub/src/host/host.ts","hub/src/host/login-signin.ts","hub/src/host/signin-client.ts","hub/src/host/ssh-host.ts","hub/test/accounts-policy.test.ts","hub/test/durations.json","hub/test/host-agent-client.test.ts","hub/test/host-agent-signin-op.test.ts","hub/test/host-contract-coverage.test.ts","hub/test/host-contract.ts","hub/test/host-restart.test.ts","hub/test/signin-client.test.ts","hub/test/signin-command.test.ts","hub/test/signin-owner.test.ts","hub/test/signin-redactor.test.ts","hub/test/tiers.json"],"overlap":[],"dependency":{"status":"known","importers":[]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-35 · 2026-11-11T21:35:27.069Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-8
commit: 9f93ee62f1b82d678ccc3d9f67374fbab54cb442
scope: delta
findings: [{"severity":"medium","text":"The new generic Host.signIn section says every incomplete outcome retains an interrupted writer fence. That fence belongs to renewal prepareExistingLoginSignIn/interrupt(); new-login preparation has no interrupt and retains creating row/disk ownership instead. Lead bb930d62 confirms no unconditional owner/disposition. Qualify the new paragraph by existing caller ownership, preserving no cleanup/success authority from elapsed time or carrier closure; do not invent a second new-login fence or implement future T1791/T1814 behavior.","file":"docs/hub/logins.md","line":977}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18889 complete delta8 NOT CLEAR: one medium conditional ownership wording finding, no others. Coordinator dac18876 authorized once-merge T1815/T1818. Inherited runtime/tests/skills/transport match reviewed T1815 2b2add0f2 except two host-restart test/guide files, which match reviewed T1818 0679105b1. New39 lines otherwise match bounds/redaction/pinned close/checkpoint/refusals/lease/shutdown/retirement source. Prior reference exact prefix; ADR/spec unchanged; task nontracker difference only3docs245add/0delete. C1/C2 prior source proof preserved, C3 future sections and C4/final evidence remain open. A18888 candidate wording narrative qualified, no Reviewer run. Clean9f93ee62f/tree0e395e81. Complete pass releases hold for narrow docs correction/fresh exact-head review; keep staged last-landing claim.

Criteria: C3 failed (New interactive sign-in notes incorrectly apply the renewal interrupted-writer fence to new-login outcomes; qualify existing caller ownership. Later T1791/T1814 sections remain intentionally staged.).

### rev-35 · 2026-11-11T21:36:35.812Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-9
commit: ead9f7b7968ebc8a7f25f849a0bc0a71a6540695
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18891 current partial delta CLEAR: Standards0/Spec0. Sole paragraph correction resolves A-18889: renewal retains interrupted writer fence; new-login preparation retains creating row/disk ownership without invented second fence; no cleanup/success authority from elapsed time/carrier closure. One commit/one paragraph only since9f93ee62f; no dev merge/runtime/test changes. Delta8 authorized T1815/T1818 import freshness and remaining as-built notes carry unchanged. ADR/spec unchanged, C1/C2 refreshed. Candidate wording-lint observation qualified, not final exact-head configured evidence. C3 later T1791/T1814 coverage and C4/final evidence/readiness remain open under last-landing sequence. Clean ead9f7b79/tree1bb10cbe; no Reviewer execution. Hold released, retain staged claim.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-12T00:14:17.704Z

Merge-delta assessment (report-only)
{"reviewed":"ead9f7b7968ebc8a7f25f849a0bc0a71a6540695","head":"106e3f9205b0837bf138c5fda91b14db5881de4a","dev":"91fcb511303389cb84ce9dffb904910916a1855a","mergeBase":"065cf1416ed6487f0103059f1e7aea7dccceca1e","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/adr/0009-login-storage-boundary.md","docs/hub/logins.md","docs/spec/v0.1.2.md"],"devPaths":[".agents/skills/implement/CHANGES/T-1791-login-cards.md",".agents/skills/implement/SKILL.md",".cland/tasks/T-1791-signing-in-from-a-card.md",".cland/tasks/T-1795-the-adr-the-v0-1-2-3-13-amendment-and.md","docs/agents/host-agent.md","docs/agents/tests/hub-test-discord-api.test.ts.md","docs/agents/tests/hub-test-hub-cards.test.ts.md","docs/agents/tests/hub-test-login-card-recovery.test.ts.md","docs/agents/tests/hub-test-login-card-signin-owner.test.ts.md","docs/agents/tests/hub-test-login-card-signin-remote.test.ts.md","docs/agents/tests/hub-test-login-card-signin.test.ts.md","docs/agents/tests/hub-test-login-wait.test.ts.md","docs/agents/tests/hub-test-telegram-api.test.ts.md","docs/agents/tests/index.md","docs/hub/asks-and-the-inbox.md","docs/hub/logins.md","docs/hub/ssh-host.md","hub/README.md","hub/src/host/login-add.ts","hub/src/host/login-card-intents.ts","hub/src/host/login-card-signin.ts","hub/src/host/login-signin-output.ts","hub/src/hub/daemon.ts","hub/src/hub/dispatch.ts","hub/src/hub/hub-cards.ts","hub/src/hub/server.ts","hub/src/hub/store.ts","hub/src/remote/discord-api.ts","hub/src/remote/discord.ts","hub/src/remote/gateway.ts","hub/src/remote/ingress.ts","hub/src/remote/secret-answer.ts","hub/src/remote/signin-link.ts","hub/src/remote/state.ts","hub/src/remote/telegram-api.ts","hub/src/remote/telegram-prompts.ts","hub/src/remote/telegram.ts","hub/test/discord-api.test.ts","hub/test/durations.json","hub/test/fakes/discord/fake-api.ts","hub/test/fakes/messenger.ts","hub/test/fakes/telegram/fake-api.ts","hub/test/harness.ts","hub/test/host-create-fixture.ts","hub/test/hub-cards.test.ts","hub/test/login-card-fixture.ts","hub/test/login-card-recovery.test.ts","hub/test/login-card-signin-owner.test.ts","hub/test/login-card-signin-remote.test.ts","hub/test/login-card-signin-trace.ts","hub/test/login-card-signin.test.ts","hub/test/login-wait.test.ts","hub/test/telegram-api.test.ts","hub/test/tiers.json","qa/briefs/E-1535-stage-1.md","qa/briefs/E-1535-stage-3.md"],"overlap":["docs/hub/logins.md"],"dependency":{"status":"known","importers":[]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-35 · 2026-11-12T00:18:14.091Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-10
commit: 1b5b4eeb5a2127413372707187af7367c6e6e124
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18912 current partial delta CLEAR: Standards0/Spec0. Request cites Coordinator613b1929 single-merge authorization; imported T1791 runtime/tests/skills/QA/shared docs byte-identical to reviewed26b09338a/A18905, landing3cf treeadd45685. Clean merge106e3f920; appended44lines only after imported reference, prior interactive section exact, no duplicate heading. Task nontracker delta only3docs290add/0delete;ADR/spec unchanged,C1/C2 refreshed. Added orchestration/secret-memory-only answer/registry/redaction/deletion obligation+retry+join/expiry/unknown cuts/bounded recovery notes match landed source. ExplicitHTMLmarker reserves T1814; no unlanded recovery claim. A18911 candidate local wording observation qualified727docs/1817items0findings,not finalC4proof. Clean1b5b4eeb5/tree001e8e06;no Reviewer execution. Holdreleased; stagedclaim retained. C3 T1814section and C4/final exact-head evidence/readiness remain open; T1795 lands last.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-12T02:15:25.208Z

Merge-delta assessment (report-only)
{"reviewed":"1b5b4eeb5a2127413372707187af7367c6e6e124","head":"78ff7798a0afd118bdc19574ace8ee10d143a351","dev":"99356638a9319380a3e4695d04ccbd7c6dcc2854","mergeBase":"91fcb511303389cb84ce9dffb904910916a1855a","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/adr/0009-login-storage-boundary.md","docs/hub/logins.md","docs/spec/v0.1.2.md"],"devPaths":[".cland/tasks/T-1795-the-adr-the-v0-1-2-3-13-amendment-and.md",".cland/tasks/T-1814-login-add-treats-a-dispatcher.md","docs/agents/host-agent.md","docs/agents/tests/hub-test-login-add-component.test.ts.md","docs/agents/tests/hub-test-login-add.test.ts.md","docs/agents/tests/hub-test-login-card-signin-owner.test.ts.md","docs/agents/tests/hub-test-login-host-pin.test.ts.md","docs/agents/tests/hub-test-login-signin.test.ts.md","docs/hub/logins.md","docs/hub/ssh-host.md","hub/README.md","hub/src/host/login-card-signin.ts","hub/src/host/login-signin.ts","hub/src/host/logins.ts","hub/src/hub/dispatch.ts","hub/test/login-add-component.test.ts","hub/test/login-add.test.ts","hub/test/login-card-signin-owner.test.ts","hub/test/login-host-pin.test.ts","hub/test/login-signin.test.ts"],"overlap":["docs/hub/logins.md"],"dependency":{"status":"known","importers":[]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-35 · 2026-11-12T02:20:13.617Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-11
commit: 47998ff8f0a6ebb7af5385941251f5a1457f9908
scope: delta
findings: [{"severity":"medium","text":"Inherited unconditional cleanup-on-authority-change instruction conflicts with landed T1814 post-capture attach/mount/publish interruption and retained disk. New EOF section does not explicitly dispose of it; no historical exception(ff70bae3). Add dated explicit correction distinguishing pre-capture failure from captured exact-machine interruption, respecting no-rewrite constraint.","file":"docs/hub/logins.md","line":119},{"severity":"medium","text":"Inherited pin-only-after-confirmed-cleanup/incomplete-cleanup-retains-pin claim is false after interruption: preparePoolLogin unpins signed-out rows while private exact-machine sign_in retains disk/native authority. No recorded qualification(ff6a72b7). Explicitly correct transient busyHost pin versus durable fence; pin release is not cleanup.","file":"docs/hub/logins.md","line":155},{"severity":"medium","text":"Canonical mountedOpenCodeDatabase owner and exact source-policy allowance moved to host/agent/state-paths.ts; accounts/registry.ts only re-exports it. No prior disposition(403799ce). Explicit dated correction must name canonical edit/policy owner while preserving valid registry-import compatibility guidance.","file":"docs/hub/logins.md","line":128}]
finding_counts: {"high":0,"medium":3,"low":0}

A-18934 delta11 NOT CLEAR: Standards0/Spec3medium, all lead-confirmed. Imported T1814 runtime/tests/shared docs byte-equal reviewedc111a20aa/landing1dcb32ec4; citedCoordinator6f8b2fd2 single-merge78ff7798a, clean47998ff8f/treeb56bcdcd. Own appended shared recovery section matches landed owner; no task production/tests. ADR/spec unchanged since prior source-clear; source C1/C2 intact. Three current inherited descriptions lack explicit dated supersession, violating C3as-built. Hold released for consolidated docs-only correction under no-rewrite constraint/fresh source review; no new merge or runtime/native/provider/QA experiment. A18933 candidate-local wording narrative not final C4; final same-head configured evidence remains pending, staged claim retained.

Criteria: C3 failed (Three inherited current cleanup/pin/canonical-helper ownership claims remain inconsistent with landed as-built implementation.).

### rev-35 · 2026-11-12T02:22:06.889Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-12
commit: 4ede548a9bdf95edf26d3eba8f3c157120727e55
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18936 final-source delta12 CLEAR Standards0/Spec0. Clean4ede548a9/treef73baca461e863597ca6dbe444a0da9da4d664d5; one file25add0delete, no merge/source/test delta. Nearby dated correction explicitly supersedes all three A18934 claims, preserving original paragraphs: post-capture interruption/exact-machine authority, transient busyHost pin versus retained durable fence, canonical agent/state-paths helper/policy versus registry compatibility re-export. Earlier T1814 imported source/tests/shared docs and new shared CLI/card recovery section retained unchanged; no unlanded marker. Unchanged ADR/spec amendmentC1/C2 refreshed; final as-built referenceC3 now source-verified. C4/final exact-head configured evidence pending; candidate-local narrative not substituted. Hold released for mode-free verify at exact head; no native/browser/provider rerun or extra merge requested. Three-doc task, QA affected/after-stage on dev, fullT3batch/T4stage separate; staged claim retained.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-35 · 2026-11-12T02:44:13.793Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-delta-13
commit: 90410ef27b35fbbb7c21ee306412adc03f80467b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18938 delta13 CLEAR Standards0/Spec0. Exact six docs86add2delete, clean90410ef27/treef9c1297e2c3809c039f08088d705304b3608bc3f; citedCoordinatorcf546e55 scope. Four T1 guides checked against actual client6/command1/owner4/redactor1 generated/literal case identities, injected/memory/directory boundaries, final assertions and cleanup. Index4rows eachonce; card-owner native-loss/setup-failure exact suffixes now correct. No tests/runtime/config/manifest/merge changes; ADR/spec/as-built logins including dated corrections unchanged, no marker,C1–C3 refreshed. A18937 candidate-local wording731docs1817items0/index-current qualified; C4/final exact-head configured proof pending. Prior46866833 is4ede-head evidence only. Holdreleased for fresh mode-free verify at90410ef27; no native/provider/browser/QA rerun or extra merge. After-stage QA/fullT3/T4 split and staged last-landing claim retained.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-35 · 2026-11-12T03:08:04.264Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1795-final-1
commit: 90410ef27b35fbbb7c21ee306412adc03f80467b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18942 FINAL CLEAR allC1–C4,0findings. Source A18936/38 stands: ADR/spec unchanged additive content and links, complete landed reference/no marker, dated cleanup/pin/canonical-owner corrections, exact T1/card guides. Actual same-head df8e426a/A18940 host gate npmcheck T0 exit0: wording fixture diagnostics passed731docs1817items0findings, guide index current. Host gate not repeated on droplet; do not relabel it Linux. Streaming audit6203base test/690base file passes, separate125load test+125load file passes,0negative/skip. Four T1 guides12cases plus2card-owner suffixes positive; A18941 references agree. Manifest218T1/413T2/7T3/52Web full files pass;254T3/17T4 unexecuted task coverage. SelectedT3 20identities onebase49.502s addedwall; notfullsuite. Git treef9c1297e2c3809c039f08088d705304b3608bc3f; normalized5cf18f329f07492aa3379dfd5c863c83cb55a9fc independently rebuilt matchesprovenance; cleanhead. Linuxx64 Node24.21/nvim0.12.5,c8lon1,2workers1101s/$0.0765,HeadlessShell1248 ChromeTesting156.0.8078.4 exactbinary retained. Reportlint122/59+budget/ratchet advisory remain report, notC4failure. Prior46866833/A18939 cancelled143/Webpartial unused. No localnative/provider/browser/Reviewer execution. RemainingT3batch/T4stage/affected-after-stageQA separate; holdreleased, stagedclaim untilnormalmerge.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-12T06:48:28.244Z

Merged a03cd7b970bb18b1dee041d5972cf72a19db2f0b onto dev.
