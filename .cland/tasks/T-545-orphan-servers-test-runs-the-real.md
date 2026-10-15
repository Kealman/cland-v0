---
id: T-545
kind: task
title: orphan-servers test runs the real opencode serve against the user's default OpenCode data (rule 13)
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - bug
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-339
branch: t/T-545-orphan-servers-test-runs-the-real
created: 2026-10-15T22:54:35.623Z
updated: 2026-10-15T23:01:29.099Z
---

## Summary
Found by rev-30 on T-499 (2026-10-15 22:53Z). `hub/test/orphan-servers.test.ts`, 'real OpenCode serve left behind is swept by hub start' (about :200–211), runs `opencode --version`, then starts a real `opencode serve` through `leftoverOpenCode(t, root, 'opencode', {})`. Both inherit HOME, XDG and the OpenCode config and database. On the Coordinator's Mac, OpenCode is installed and the user's default `~/.local/share/opencode/opencode.db` exists, so every local full suite and every local run of this file touches the user's real OpenCode data. That's what rule 13 forbids: the service can resume the user's mid-turn sessions (#51213). Droplet runs are unaffected, since they have no user data.

## Acceptance criteria
- [x] C1. The test gives both the version probe and the leftover serve a scratch HOME, XDG_DATA_HOME, XDG_CONFIG_HOME and OPENCODE_DB under its temp project, and asserts the serve's database path is inside it. Its sweep assertions are unchanged.
  - done: impl-545 · 2026-10-15T23:00:46.301Z
  - verified: rev-30 [reviewer] · run rev-20261015-545-source-correction · 2026-10-15T23:01:25.386Z · commit 3847de333f92437fb78af6e873d2702f0ab05630
- [x] C2. A grep of hub/test and nvim/test for every other spawn of the real `opencode` binary finds none left without the same isolation, and the list of call sites goes in the review request.
  - done: impl-545 · 2026-10-15T22:58:45.616Z
  - verified: rev-30 [reviewer] · run rev-20261015-545-source-correction · 2026-10-15T23:01:25.386Z · commit 3847de333f92437fb78af6e873d2702f0ab05630

## Comments

### coord · 2026-10-15T22:56:46.403Z

Known exposures to record, so the human can judge them. Before the fix, every local Mac full run included this case and its real `opencode serve` on the user's default data. Tonight's: impl-493's local verify 229a8eb5 (full, passed 1864/1864, about 22:35–22:55Z), impl-544's local fallback 71ef9a43 (hub-only, admitted 22:54Z, left to finish rather than cancelled, because a cancelled local run wedged the lock on 2026-10-15), and earlier local covers on 2026-10-14/15. No cland session runs on OpenCode in this crew; whether the human had OpenCode sessions mid-turn is for the human to check.

### coord · 2026-10-15T22:57:23.132Z

Correction to the exposure note, from impl-545's finding at 22:56Z: `harness.ts` imports `account-fixture-env.ts`, which puts the fake OpenCode first on PATH. So this "real-binary" case has been spawning the fake `opencode`, not the installed one. The past local runs most likely never touched the user's real OpenCode data. The rule-13 gap was latent: it would have become real as soon as the test reached the installed binary. impl-544 cancelled its local fallback 71ef9a43 at 22:55:40Z anyway, and the lock is clean afterwards (local: none). T-545 now isolates first, then lets the test reach the real binary.

### impl-545 · 2026-10-15T22:58:50.479Z

Implemented and pushed 63d3cad440ec371204cdaa456285f891c0f34172. Scratch HOME/XDG_DATA_HOME/XDG_CONFIG_HOME/OPENCODE_DB shared by version probe, real serve, and startup hub. Containment assertion precedes commands. Removed only fake OpenCode child PATH entry (Coordinator approved) so real case reaches installed binary. Safe red and real green recorded in A-3433, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3433-t-545-safety-regression-and-call-site-audit.md. Explicit absent-binary run skipped cleanly. Hub typecheck green. First whole-file Mac pass 24/24, 0 skips, 80.592s; remaining four serial passes in progress. Audit found no other real binary candidates.

### rev-30 · 2026-10-15T23:00:12.241Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-545-source
commit: 63d3cad440ec371204cdaa456285f891c0f34172
scope: full

Source review T-545 not clear at 63d3cad440ec371204cdaa456285f891c0f34172, parent 75017065fcd76fe166628c7c7f1e3cba56840c99. Standards and Spec reviewed directly under the no-delegation role.

## Standards
Medium — hub/test/orphan-servers.test.ts:217 (also helper :177, called at :221): both child environments spread process.env, retaining OPENCODE_CONFIG and OPENCODE_CONFIG_CONTENT. account-fixture-env.ts clears OPENCODE_DB and harness binary overrides but does not remove these config overrides. Thus setting scratch HOME/XDG_CONFIG_HOME does not confine the real binary's configuration when the host exports an explicit OpenCode config/file or inline configuration. Existing production code recognizes this boundary: adapters/opencode.ts:120–121 excludes both because they may belong to another server, and adapters/opencode/server.ts supplies its own config. Rule 13 requires scratch configuration before executing the installed binary. Sanitize the actual final probe/serve environments, or override both with fixture-owned configuration, and assert this before launching. Do not merely remove variables from the partial env and then merge process.env back in the helper.

## Spec
C1 fails on the same medium isolation gap. The four required HOME/data/config/database paths are otherwise scratch-owned, OPENCODE_DB containment is asserted before commands, PATH removes only the repository fake directory, absence still skips, and sweep assertions remain byte-identical. But host explicit config may still be read; enabling the installed binary makes that relevant to this isolation repair. Add a safe adversarial environment assertion with scratch sentinel config inputs to demonstrate neither override survives into either child; do not execute the user's configuration to reproduce.

C2 audit is documented in request and A-3433. Independent immutable grep across hub/test and nvim/test confirms the only direct real-binary candidates are this probe and leftover serve; other helper callers use OPENCODE_FAKE/wrappers, default harness workers prepend the fake directory, and territory-cli uses an absent binary. No separate C2 failure is established. No criteria are verified on this not-clear pass.

A-3433 records safe red-before-containment, installed-binary green (1.057s, not skipped), absent-binary skip, typecheck and one 24/24 whole-file pass. Those do not test inherited explicit-config contamination and do not establish final verification. Remaining real-binary attempts were requested to hold; Implementer confirmed stopping the serial runner before further attempts in 3cc1af73. Corrected source review must precede renewed real-binary validation and the task verify.

Diff check clear. One test file only; no Reviewer tests, binary execution, edits, compiler execution, process signals, merges or provider actions. Evidence A-3433: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3433-t-545-safety-regression-and-call-site-audit.md.

Standards: 1 medium finding; Spec: the same isolation defect fails C1.

Review artifact A-3434 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3434-t-545-source-not-clear-inherited-explicit-opencode-config-escapes-isolation.md.

Criteria: C1 failed (Probe and serve still inherit OPENCODE_CONFIG/OPENCODE_CONFIG_CONTENT through process.env, allowing host configuration despite scratch HOME/XDG paths.).

### rev-30 · 2026-10-15T23:01:25.386Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-545-source-correction
commit: 3847de333f92437fb78af6e873d2702f0ab05630
scope: delta

Corrected source review T-545 clear at 3847de333f92437fb78af6e873d2702f0ab05630, parent reviewed 63d3cad440ec371204cdaa456285f891c0f34172. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

C1 verified by source. A-3434's inherited-config finding is resolved: the test writes an empty JSON config inside its scratch config directory, then supplies explicit OPENCODE_CONFIG to that file and OPENCODE_CONFIG_CONTENT='{}'. Both the version probe (:224) and leftover serve helper (:177, called :228) merge this same env AFTER process.env, so ambient file/inline overrides cannot win. Startup hub receives the same scratch env. HOME, XDG_DATA_HOME, XDG_CONFIG_HOME and OPENCODE_DB remain under the temp project. DB/config containment and inline ownership assertions execute before either command. Only the fake OpenCode directory is removed from child PATH; other path entries remain. Existing optional binary skip, 20-second listening bound, 15-second sweep bound and sweep/public diagnostic assertions are unchanged. Owned server cleanup remains registered through ownProcess before fixture directory cleanup.

C2 verified by source audit and the request's explicit list. Prior immutable grep/A-3433 remains applicable: the only direct real-opencode candidates in hub/test and nvim/test are this probe and serve. All other leftoverOpenCode callers use OPENCODE_FAKE or wrappers. The listed execution families select repository fakes through explicit overrides/fake-first harness PATH; adapter-native-boundary substitutes children, territory-cli selects an absent binary, remaining references are static/UI stubs or metadata. Correcting this case adds no execution site.

Standards: correction is seven added lines in the existing test, no production/helper/global environment mutation, no new identity or baseline. The final env spread order is inspected at both raw child boundaries; overriding a partial env is not undone by a later ambient merge. Diff check clear; hub typecheck reported green. This source correction does not need execution against host config to demonstrate the boundary.

Source clearance permits the planned five fresh serial same-head whole-file Mac validations, including safely planted scratch host config overrides, under current Coordinator admission rules, followed by the exact-head diff-selected task verification. Runtime validation on this corrected head is still pending; this is not a final suite clearance. Earlier two whole-file passes/third interrupted attempt are explicitly superseded by Implementer. Preserve the real case's non-skipped evidence on the Mac and the optional absent-binary skip separately. No per-item QA criteria.

Evidence A-3433 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3433-t-545-safety-regression-and-call-site-audit.md, earlier finding A-3434. No Reviewer tests, binary/compiler execution, edits, signals, merges or provider actions.

Review artifact A-3435 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3435-t-545-corrected-source-clear-at-3847de33-fixture-owned-explicit-opencode-config.md.

Criteria: C1 verified, C2 verified.
