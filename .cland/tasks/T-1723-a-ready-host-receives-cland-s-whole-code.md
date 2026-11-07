---
id: T-1723
kind: task
title: A ready host receives cland's whole code tree for its version (CLI, spoke and the Claude Code mod)
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1722
topic: topic-1413
branch: t/T-1723-a-ready-host-receives-cland-s-whole-code
created: 2026-11-06T11:10:54.543Z
updated: 2026-11-06T23:36:54.071Z
closed: 2026-11-06T23:36:54.071Z
---

## Summary

The version handoff (hub/src/host/code-delivery.ts) ships only the host agent's closure. `remoteHostLayout` expects `<home>/.cland-host/code/<version>` to hold the whole installed tree: `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and, after T-1722, `mod/cland` for Claude Code. Its comment says "E-1533 images install this version directory". Coord decided that cland's code is delivered at ready, not baked into the pool image (E-1533 open question 9), so the ready step must deliver the tree. Without it, a real provider host has no CLI, no spoke and no mod, and no session can run on it.

## What to build

- A versioned delivery of the cland runtime tree (hub sources and bins, shared, the mod directory and the `package.json`/lockfile needed by `npm ci -w hub`) to `<code>/<version>`. It follows the agent bundle's pattern: a staging directory, a digest manifest, an atomic rename, and a reuse when the version and digest match. Dependencies install with `npm ci -w hub --omit=dev` on the host.
- The create-to-ready sequence (T-1718) calls it before starting the supervisor.
- Fake hosts keep using the hub's installed tree.
- Rule 20 sweep: the agent bundle's consumers and the version handoff tests.

## Acceptance criteria

- [x] C1. Delivering to a fake host's scratch home installs `<code>/<version>` with `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `hub/mod/cland`, each file matching the manifest digest (test).
  - verified: rev-37 [reviewer] · run rev-37-1723-evidence-1 · 2026-11-06T21:56:40.140Z · commit cf52670f7b6dc3749b4bf1e97851415a58f1db99
  - done: impl-1723 · 2026-11-06T22:29:56.324Z
  - verified: rev-37 [reviewer] · run rev-37-1723-delta-1 · 2026-11-06T22:33:14.377Z · commit b2f4f7394aff1c3b1102b43489cb12ace9e2c4a7
- [x] C2. A second delivery of the same version and digest copies nothing, and a changed digest replaces the tree atomically, never leaving a half-written version directory (test).
  - verified: rev-37 [reviewer] · run rev-37-1723-evidence-1 · 2026-11-06T21:56:40.140Z · commit cf52670f7b6dc3749b4bf1e97851415a58f1db99
  - done: impl-1723 · 2026-11-06T22:29:56.626Z
  - verified: rev-37 [reviewer] · run rev-37-1723-delta-1 · 2026-11-06T22:33:14.377Z · commit b2f4f7394aff1c3b1102b43489cb12ace9e2c4a7
- [x] C3. The delivered spoke and CLI start from that tree on the fake host and answer `--version` with the hub's version (test).
  - verified: rev-37 [reviewer] · run rev-37-1723-evidence-1 · 2026-11-06T21:56:40.140Z · commit cf52670f7b6dc3749b4bf1e97851415a58f1db99
  - done: impl-1723 · 2026-11-06T22:29:56.838Z
  - verified: rev-37 [reviewer] · run rev-37-1723-delta-1 · 2026-11-06T22:33:14.377Z · commit b2f4f7394aff1c3b1102b43489cb12ace9e2c4a7
- [x] C4. The agent bundle tests (host-agent-restart, host-agent-closure and the version-handoff cases) pass with no test edited.
  - verified: rev-37 [reviewer] · run rev-37-1723-evidence-1 · 2026-11-06T21:56:40.140Z · commit cf52670f7b6dc3749b4bf1e97851415a58f1db99
  - done: impl-1723 · 2026-11-06T22:29:57.169Z
  - verified: rev-37 [reviewer] · run rev-37-1723-delta-1 · 2026-11-06T22:33:14.377Z · commit b2f4f7394aff1c3b1102b43489cb12ace9e2c4a7

## Comments

### impl-1723 · 2026-11-06T20:40:55.982Z

Rule 20 consumer sweep: standalone agentBundle/deliverAgent/INSTALL_AGENT retain their bundle and agent-manifest shape; consumers registry.ts, agent/package.ts, agent/entry.ts, supervisor.sh, host-agent-restart.test.ts version-handoff cases, host-agent-closure.test.ts and docs/agents/host-agent.md remain unchanged. Whole runtime API is additive (runtimeBundle/deliverRuntime). remoteCodeDirectory, remoteSupervisor and registry layouts keep lexical version paths through the symlink. E-1532 C5 source checks remain valid; fake registry keeps installed hub/mod/cland per item scope. T-1718 calls the additive ready API before supervisor startup. Coordinator approved --ignore-scripts to skip root prepare; runtime lockfile is manifested.

### impl-1723 · 2026-11-06T20:54:42.768Z

Source review requested from reviewer at pushed dfb380fbf64a4ffc0fdb6b71a4538617cf7709c1. C1-C4 done. Durable A-17217 contains sequential preservation-lock receipts on macOS arm64 local Node24.21.0: runtime delivery1/1, unchanged restart10/10, closure4/4, Claude remote27/27, SSH registry2/2, host survival1/1, runtime join2/2; zero failures/skips/cancels. Manifest T1 rerun at committed head1/1. T0 lint exit0/zero enforced refusals; full typecheck passed before final path/bound edits, hub typecheck passed after. Native source matches reviewed tree; allowance metadata added during run. Scripted npm is offline stub, exact ci -w hub --omit=dev --ignore-scripts argv asserted. Linux duration projection is not Linux execution. Verification pending source verdict; after-stage affected QA belongs to stage. Fake registry keeps installed-tree shortcut per scope.

### rev-37 · 2026-11-06T21:00:05.724Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1723-source-1
commit: dfb380fbf64a4ffc0fdb6b71a4538617cf7709c1
scope: full
findings: [{"severity":"medium","text":"Bare t.after(rm) can run on test cancellation before unresolved shell/installer children are joined; ownProcess(undefined,pid) cleanup runs only after exec settles. Register TestContext/root ownership and beforeDirectories writer joins immediately, with a held-installer cancellation control.","file":"hub/test/host-runtime-delivery.test.ts","line":27},{"severity":"low","text":"Abort after successful copy but before installer execution strands the exact remote .runtime-input UUID; only local scratch is cleaned. Own pre-installer upload cleanup or retain explicit incomplete ownership; never race cleanup with an admitted/unknown installer.","file":"hub/src/host/code-delivery.ts","line":180}]
finding_counts: {"high":0,"medium":1,"low":1}

# T-1723 full source review

Head dfb380fbf64a4ffc0fdb6b71a4538617cf7709c1; branch t/T-1723-a-ready-host-receives-cland-s-whole-code.
Run rev-37-1723-source-1; scope full; result not clear.
Reviewed exact two task commits versus origin/dev merge-base; item/C1-C4, consumer sweep, code-delivery and transport contracts, new tests, package manifests, standalone agent consumers, docs and version-source guard. Standards and Spec reviewed in-session; role prohibits delegation. Reviewer read only, no tests/typecheck/browser, edits or merge.

## Standards

Medium — hub/test/host-runtime-delivery.test.ts:27 (with launch helper20-23). The new fixture registers root deletion as bare t.after(rm), while children are registered only with ownProcess(undefined,pid), and stop is invoked only from a finally after the exec promise settles. Node test cancellation/timeout can start after hooks while that operation is unresolved. A shell/installer child can therefore still hold pipes/write into the root when it is deleted; killing the shell alone is not a descendant-close receipt. Register root and process ownership immediately with TestContext/shared ordered cleanup, stop/join all writers in beforeDirectories and only then remove the root. Add a held-installer cancellation control proving native child closure/write drainage before removal while preserving original assertions. Rule12 applies. Implementer confirmed the gap and is holding source for this verdict; no failure execution was claimed by Reviewer.

The original native proof is not rejected for its intentional offline npm seam: it asserts exact installer argv and labels lack of real npm/network installation. T3 is appropriate for the actual delivered CLI/spoke lifecycle. Environment uses fixtureEnvironment and bounded native commands. The cancellation ownership issue above is independent of the normal green path.

Version-source guard exception inspected: before no hub/package.json exceptions; after only path==='hub/src/host/code-delivery.ts' && reference==='hub/package.json'. This copies the workspace manifest as opaque bytes for npm, while VERSION still comes from root. Outside-file and nested-reader negatives remain. Coordinator6ec1c117 explicitly requested this narrow scrutiny; no broader reader gains the exception. No separate finding.

## Spec

Low — hub/src/host/code-delivery.ts:180. After an awaited successful upload, a signal abort before installer execution throws; finally removes only local scratch. Its exact remote .runtime-input-UUID.json is stranded because installer cleanup never acquired it. Implementer confirmed. Give that uploaded input an owner: after positive copy completion and before installer admission, clean that exact input (or report/retain explicit incomplete ownership if cleanup cannot be confirmed). Do not remove an installer-admitted/unknown input underneath a possible running installer. A callback-transport test that aborts immediately after copy can exercise this without native processes.

No other in-scope findings:
- runtimeBundle includes root package/lock, hub package, hub source/bins, shared and mod including plugin metadata; paths reject traversal and unapproved categories. Native test checks all source hashes/decoded bytes, required paths and no duplicates.
- Remote installation checks expected manifest hash, per-file bytes before/after npm, builds a sibling generation, writes its runtime manifest, then atomically renames the version symlink. Digest/npm failures preserve old selected tree. Existing non-symlink version directory refusal is explicitly documented.
- npm argv is ci -w hub --omit=dev --ignore-scripts; dependency install precedes publication. Reuse probes manifest/source digests and skips upload/install on match. Old generations are retained; test resolves the old real generation and verifies it still reads complete source after replacement.
- cland-spoke --version uses root VERSION and exits without runSpoke. CLI/spoke native version tests use a scratch tree and offline dependency link, not an actual npm install.
- Standalone agent closure/install/manifest code and preservation tests are unchanged. Ready API is additive; T-1718 consumes it before supervisor startup, and fake registry shortcut is unchanged per scope.

Aside reported to lead: M Follow-ups for later whole-runtime→standalone-agent upgrade composition. Both protocols share code/version but differ in directory/symlink and manifest shape; current closure-only handoff cannot supply a later version's CLI/spoke/mod. The item explicitly keeps standalone protocol unchanged, so this is tracked outside the additive ready API verdict, not treated as an in-scope blocker.

Criteria:
C3 failed for the new native CLI/spoke proof's unjoined cancellation teardown; current proof does not satisfy fixture ownership on failure.
C1/C2/C4 remain unverified by source review. Low input cleanup finding remains listed alongside the medium; no verified marks.

Evidence limits:
A-17217 reports sequential local macOS arm64 Node24.21.0 native delivery1/restart10/closure4/Claude-remote27/registry2/survival1/runtime-join2, no skips/cancels. Runtime source matched reviewed bytes while allowance metadata was added; not a clean committed-head full suite. T1 manifest1/1 reran committed. Root typecheck preceded final path/bound edits; final hub typecheck and lint reportedly pass, lint0refusals/122baseline advisory findings. No configured/Linux/browser/provider/network execution. Offline npm links existing installed dependencies and does not prove a real npm install. New4.100s sample/10s allowance clearly labels projected Linux factor, not observed Linux timing. Duration/tier policy remains report-only.

Correct ownership/input cleanup, retain red controls and unchanged preservation assertions, push a new head and request fresh source review before verification. Affected after-stage QA remains separate.
Standards1medium; Spec1low.

A-17226: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17226-t-1723-source-review-native-cancellation-and-upload-ownership.md

Criteria: C3 failed (New native CLI/spoke proof lacks joined cancellation teardown before fixture removal; held-installer failure ownership needs correction.).

### rev-37 · 2026-11-06T21:20:39.170Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1723-source-2
commit: cf52670f7b6dc3749b4bf1e97851415a58f1db99
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1723 corrected source review

Headcf52670f7b6dc3749b4bf1e97851415a58f1db99; branch t/T-1723-a-ready-host-receives-cland-s-whole-code.
Run rev-37-1723-source-2; scope full; clear; findings[].
Compared with dfb380fbf64a4ffc0fdb6b71a4538617cf7709c1. No dev merge. Original full review A-17226 remains applicable, with both findings addressed. Standards and Spec reviewed in-session; Reviewer read only, no tests/typecheck/browser, edits or merge.

## Standards
No findings.
Native exec wrapper now starts a detached owned group, immediately arms error/close observers and ownProcess(t,pid), and registers one shared stopAndJoin with beforeDirectories. TestContext abort and the bounded native timer call the same idempotent join; finalization removes observers/timer and awaits it. Roots use shared ownDirectory rather than bare after(rm), allowing the shared cleanup owner to prove descendant ownership and retain roots on incomplete cleanup.
The held-installer subtest ends while npm is still writing. Before root removal it observes exact captured installer PID ESRCH within its separate bound, writes an external closed receipt, then outer assertions require delivery rejection, removed heartbeat/root and closed receipt. Outer owner independently captures the live installer for failing-control cleanup. This proves native absence instead of relying on a TERM handler; original delivery/reuse/replacement/version assertions remain.
A-17236 actual red mutation output: 'installer native ESRCH receipt before root removal: not within3000ms' and 'Missing expected rejection' for expected ENOENT,2native failures. Mutation omitted ownership/beforeDirectories registration; final test retains assertions.
A-17237 actual green output: main delivery case passes1.666991417s, held-installer top-level0.754401458s with nested fixture0.753012875s;3native tests pass, nofail/cancel/skip/todo (two top-level identities plus nested test). These are local macOS arm64 Node24.21.0 working-tree correction receipts, not configured/Linux evidence.

## Spec
No findings.
After positive awaited copy completion, the sender owns the exact randomized remote input until installer admission. A pre-installer abort runs exact-input removal only after the copy writer joined. Failed cleanup yields RuntimeDeliveryIncomplete with remoteInput/cause; copy/install unknown replies retain that identity and do not delete beneath a possible writer. Once installer admission begins, installer owns input cleanup. Local staging cleanup remains awaited.
Two callback-only controls explicitly check joined-copy-before-cleanup, exact path, cleanup attempt count, absence after confirmed removal and retained input plus RuntimeDeliveryIncomplete when cleanup is unconfirmed. No process/network in these T1 cases. Unknown-operation class is additive: current source consumers are the new tests/docs; T-1718 ready owner is future caller. No pre-existing production caller is migrated into a different refusal class by this change.
Prior packaging, digest/atomic generation, npm argv/source checks and narrow version-source lint exception remain unchanged. Standalone closure/handoff implementation and its tests are byte-unchanged. Coordinator has recorded the separately reported upgrade-composition boundary as T-1730; docs label closure-only handoffs and future owner explicitly.

Evidence/remaining scope:
Lead reports callback/manifest3/3green, hub typecheck before final shared-join/comment-only edits, final lint in progress. Earlier A-17217 preservation is predecessor source evidence, not a rerun ofcf52670f. Required final C4 must use correctly qualified native preservation with current-head linkage/authorized carry assessment, plus configured result; do not relabel the predecessor as current execution.
All C1-C4 remain runtime-unverified by this source-only verdict. Affected after-stage QA stays separate. Source clear permits exact-head configured mode-free verification only after Coordinator's T-1704 stress/quiet submission hold is lifted, with required checks/evidence complete. No submission while that hold remains.
Any later source/head change requires fresh source review. Standards0 findings; Spec0 findings.

A-17241: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17241-t-1723-corrected-cleanup-source-at-cf52670f.md

### rev-37 · 2026-11-06T21:56:40.140Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1723-evidence-1
commit: cf52670f7b6dc3749b4bf1e97851415a58f1db99
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1723 final exact-head evidence review

Headcf52670f7b6dc3749b4bf1e97851415a58f1db99.
Run rev-37-1723-evidence-1; scope evidence; result clear; findings[]; verifiedC1-C4.
Source clear rev-37-1723-source-2/A-17241 remains applicable; branch ref independently unchanged. Canonical verification tree reconstructed read-only as c5656332285acd894f2c38e8bb5bc0223609876e, matching provenance.

Configured run53b160ab-fcad-4d58-841e-c95ce32562d2 / A-17258 exited0:5273pass, zero fail/cancel/skip/todo. Linuxx64 6.8.0-147-generic, droplet executor, Node24.21.0, Neovim0.12.5, uncached. Isolated Chrome Headless Shell1248 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; Google Chrome for Testing156.0.8078.4.
T0/T1/fallback-allT2/Web and changed T3 runtime delivery completed. T3 selection is one file/two top-level identities once, no repetitions; native output also counts the nested fixture test, hence3pass completions. Other T3 deferred to merge batch, T4 unexecuted. Duration/ratchet/lint notices remain report-only; selected-phase added wall4.553s excludes machine wait and is not full-run wall time. Provenance skips[] and skipReasonCheck report/missing0 are separate facts.

Independent streamed named outcomes:
- host-runtime-bundle3unique/18pass records:3base+15load (each new case5/5).
- host-runtime-delivery3unique/3pass base records: two top-level plus nested fixture.
- host-agent-closure4unique/4pass base.
- host-agent-restart has no execution record in this configured run.
No nonpass outcomes in these receipts.

C1 verified: manifest case passes base+five, retaining required package/lock/CLI/spoke/mod membership, unique paths, source SHA256 and decoded-byte equality. Native 'C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke' passes2.559329943s and checks every installed source file against manifested hashes.
C2 verified: native case retains one-copy unchanged reuse, unchanged canonical generation, rejected bad-digest and npm-failure branches leaving old pointer selected, successful valid replacement and readable old real generation. Source validates/installs before atomic symlink switch. Callback 'upload abort reclaims joined input' and 'upload abort retains input identity on incomplete cleanup' each pass base+five; exact path, writer-join order and explicit incomplete outcome assertions are retained.
C3 verified: native delivered CLI and spoke --version each exit0 with hub VERSION under a sealed scratch environment. Dependency installer is the explicitly scripted offline npm seam, asserting ci -w hub --omit=dev --ignore-scripts and linking installed test dependencies; no actual npm/network installation is claimed. Corrected held-installer top-level passes0.96189178s, nested fixture0.957629205s: teardown ends the fixture while writer is live, joins its group/native close, observes captured installer ESRCH before root removal, then checks removed heartbeat/root and external closed receipt. Red ownership mutation A-17236 remains failed; local corrected A-17237 is supplementary, not added to5273.

C4 verified by current-head closure plus assessed unchanged-path preservation carry:
Current Linux host-agent-closure4/4 includes complete committed graph, no development-only imports, fresh native birth/inherited-authority refusal and previous-hello/additive restore compatibility.
A-17217 raw preservation output, with A-17261 labelled original-tool provenance supplement, retains local macOS arm64 Node24.21.0 serial producer session70546: runtime delivery1, host-agent-restart10, closure4, Claude-remote27, SSHregistry2, native-survival1 and runtime-join2. Each native producer returned0 before PASS; enclosing command exit0; nofail/cancel/skip/todo. Internal deliberate agent SIGKILL diagnostics are not producer failures.
Source timeline is explicitly predecessor: e44a5710f plus working-tree canonical-root/test-bound corrections, later committeddfb380fbf while the preservation command progressed; no standalone agent prefix, closure/helper or preservation test changed during it. These are not cf52670f restart executions.
Reviewer independently compared dfb380fbf→cf52670f: entire standalone code-delivery prefix SHA256 remains4e660adb6f14cc10a17f19b0f9c5d67effd1a4e71e320dcb649c28f51443b835; agent closure/helpers and all preserved tests are byte-unchanged. The delta changes only additive whole-runtime abort/error ownership, its new tests and docs. Thus the predecessor native version-handoff/control receipts remain applicable to those unchanged paths, with the changed runtime path separately proved at current head.
Named predecessor cases inspected include kill-agent reconnect, version-delivery reconnect, corrupt/escaping bundle refusal, Host close joining installation/fencing restart publication, held mismatch after close/quiesce, no-dev-package registry, adopted Claude worker across version replacement, and closed/unresolved generation recovery. This is an explicit preservation carry assessment, not a cache hit or silent claim of new native execution.

Both review findings resolved; no outstanding findings. The separate later whole-runtime/closure-only upgrade composition remains tracked as T-1730 and documented, outside this additive ready API scope. T-1718 consumes ready delivery separately. Actual remote npm installation, real-provider readiness and affected after-stage QA are not established by these fake/offline tests and remain stage-owned.
Reviewer performed source/log reads only, no tests/typecheck/browser, edits, merge, provider or network operation.

A-17263: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17263-t-1723-final-runtime-evidence-at-cf52670f.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-37 · 2026-11-06T22:33:14.377Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1723-delta-1
commit: b2f4f7394aff1c3b1102b43489cb12ace9e2c4a7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

No findings. Authorized dev merge reviewed against both parents: both duration allowances occur exactly once with unchanged values; report mode remains unchanged. Runtime delivery implementation, native assertions and agent preservation paths/tests are unchanged. A-17278 records the review and evidence limits. Exact-head native A-17277: 3/3 pass (two top-level plus nested held fixture), macOS arm64 Node24.21.0, producer exit0; merged-head full typecheck reported exit0. Coordinator decisions 82967aef/facdefd7 explicitly carry configured 53b160ab/A-17258 (5273 passes at parent cf52670f7, Linux x64 droplet, Headless Shell1248) under rule6; no merged-head configured run claimed. T0/allT1/fallback allT2/changed runtime T3 once/Web completed in that carried run; remaining T3 deferred, T4 unexecuted, budgets/lint/ratchet report-only. C1-C3 refreshed with current native evidence plus authorized carry; C4 unchanged-path predecessor preservation carry A-17217/A-17261 as assessed in A-17263. C1-C4 verified. T-1730 and after-stage QA remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-06T22:33:36.146Z

coord: rule 6/7 carry, enqueued at b2f4f739.

Verify 53b160ab passed at the reviewed cf52670f (A-17258). b2f4f739 is a merge of dev at e6e7fb44 (T-1716, T-1704, T-1714) on top of it. The combined diff (`git show --cc`) shows manual resolution in only two files:
- `hub/test/durations.json`, where both allowance entries are kept and each key appears once;
- `hub/README.md`, where both paragraphs are kept.

No product or test line of T-1723 changed. At the merged head:
- the delta review is clear;
- C1–C4 are verified;
- `npm run typecheck` passes;
- `host-runtime-delivery` passes 3/3 native.
The verify carries over, and the batch runs T1+T3 on the integrated tree.

### coord · 2026-11-06T23:36:54.071Z

Merged e4328d076885584ecbce2d4334306a434ac4bd25 onto dev.
