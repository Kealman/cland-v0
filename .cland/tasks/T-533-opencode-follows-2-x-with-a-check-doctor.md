---
id: T-533
kind: task
title: "OpenCode follows 2.x with a check: doctor messages per version and a release-time range check"
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-337
branch: t/T-533-opencode-follows-2-x-with-a-check-doctor
created: 2026-10-15T20:59:18.770Z
updated: 2026-10-16T03:24:49.423Z
---

## Summary

E-424 slice 3 (tracer step 3). The adapter follows OpenCode 2.x with a check. The doctor gives each version a fitting message, and a release-time check script re-verifies the tested range and moves its upper bound.

## What to build

See E-424's "The check at each release" and "What the doctor says per version" bullets.

- **Doctor messages per version.**
  - A 2.x inside the range passes.
  - A 2.x newer than the range is reported as newer than tested.
  - 1.x gets `opencode upgrade --major`.
  - A missing binary gets the v2 installer (`https://opencode.ai/v2/install`).
  - 3.x gets a refusal naming the tested range.
- **Check script.** It lives in the repository and is built from the research's `openapi-digest.mjs`, its event-name grep and its P1 probe. It fetches the newest 2.x OpenAPI document and compares the adapter's ten operations and its event names with the tested document. It also runs a smoke against the fake provider.
- **Pass or fail.** A pass moves the upper bound in `hub/src/doctor/ranges.ts` just above the newest version that passed. A failure keeps the range and files a Bug.
- **Release skill.** The script reaches the network, so it is never part of `npm test`. The `release` skill (`.claude/skills/release/SKILL.md` and the copy `cland init` writes) runs it before the dry run.

Code: `hub/src/doctor/toolchain.ts`, `hub/src/doctor/ranges.ts`, the research probes in `docs/research/opencode-v2/` on research/opencode-v2.

## Acceptance criteria

- [x] C1. With fake binaries reporting 1.19.0, a 2.x newer than the range and 3.0.0, and with none, `cland doctor` prints the `--major` upgrade, the newer-than-tested note, the refusal naming the range and the v2 installer.
  - done: impl-533 · 2026-10-16T02:09:01.644Z
  - verified: rev-31 [reviewer] · run rev-20261016-533-source-3 · 2026-10-16T02:09:36.389Z · commit 9276d5371e124292e416b792594552f69582a2ba
  - verified: rev-31 [reviewer] · run rev-20261016-533-merge-delta · 2026-10-16T03:24:48.698Z · commit 658556abd0ec6212b33915f37b45e8a45d722d19
- [x] C2. The check script compares the newest 2.x OpenAPI document's operations and event names with the tested one, runs the fake-provider smoke, and on a pass moves the range's upper bound.
  - done: impl-533 · 2026-10-16T00:00:29.593Z
  - verified: rev-31 [reviewer] · run rev-20261016-533-final · 2026-10-16T03:22:20.391Z · commit 9276d5371e124292e416b792594552f69582a2ba
  - verified: rev-31 [reviewer] · run rev-20261016-533-merge-delta · 2026-10-16T03:24:48.699Z · commit 658556abd0ec6212b33915f37b45e8a45d722d19
- [x] C3. The check is not part of `npm test`, and the `release` skill (both copies) runs it before the dry run.
  - done: impl-533 · 2026-10-15T23:43:53.153Z
  - verified: rev-31 [reviewer] · run rev-20261016-533-source-2 · 2026-10-16T00:01:51.713Z · commit 77659eb0b7c8cae127883f3bdb6d100b2f378dd1
  - verified: rev-31 [reviewer] · run rev-20261016-533-source-3 · 2026-10-16T02:09:36.389Z · commit 9276d5371e124292e416b792594552f69582a2ba
  - verified: rev-31 [reviewer] · run rev-20261016-533-merge-delta · 2026-10-16T03:24:48.699Z · commit 658556abd0ec6212b33915f37b45e8a45d722d19

## Comments

### impl-533 · 2026-10-15T22:55:44.552Z

Implemented separate OpenCode version classification, v2 installer guidance and release-only network checker. Newest stable upstream is 2.0.30; read-only ten-operation wire comparison and all 15 adapter event names are compatible with 2.0.24. Offline CLI fixtures cover successful advancement and contract/smoke failures filing Bugs without changing the range. Hub typecheck is green. Waiting for the assigned Mac slot (after T-477) to run targeted files and isolated real-binary fake-provider smoke before review.

### rev-31 · 2026-10-15T23:46:04.587Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-533-source-1
commit: dc4e01286263046681bb5d7f62d53901bde97d00
scope: full

Source review not clear at dc4e01286263046681bb5d7f62d53901bde97d00, run rev-20261015-533-source-1, scope full. Fixed point c30b2666, the merged dev head named by the request. Task hold/view initially timed out but later readback confirms the hold, live impl-533 claim and C1–C3 criteria.

## Standards
Medium — hub/test/opencode-check.test.ts:1: the new test file has no entry in this head's hub/test/shards.json. docs/agents/tests.md requires every hub test to be classified, with verify and merge admission refusing unclassified files. The targeted node invocation bypasses that gate. Add a conservative machine classification (this file spawns processes/listens on sockets), then check shard lint before requesting the replacement-head review.
No additional smell-baseline findings. Rule 13 isolation is preserved by the smoke's scratch HOME/XDG/config/OPENCODE_DB and standalone server; no real OpenCode binary was run by this review.

## Spec
Medium — hub/src/doctor/opencode-contract.ts:51: every response required list is ignored. Removing required data from a success response therefore compares compatible even though OpenCodeClient.createSession, models and prompt unconditionally return/dereference response.data. A server may now legally omit it, breaking the adapter while the checker silently widens the tested range. This is wire-contract information, unlike documentation/reference renames. The originating research's wirediff retains required lists.

Read-only comparator counterexample executed against the requested worktree module: build the ten operation responses as {type: object, properties: {data: {type: object, properties: {id: {type: string}}, required: [id]}}, required: [data]}; clone and replace each outer required list with []; compareOpenCodeContract returns []. No files were changed and no suite/server/network check ran. Preserve old required-response guarantees (additions may remain acceptable), and add a regression proving their removal rejects the candidate and leaves the range unchanged.

C2 failed because this comparison can approve a breaking response guarantee loss. A happy-path fake-provider turn can still emit data and pass even when the new schema permits its absence, so smoke does not replace the contract check.

Other reviewed paths: C1 doctor handling covers old/new/missing majors with appropriate messages and skips incompatible-major auth. The checker selects stable 2.x registry versions, fetches both source-tag contracts/events, verifies binary SHA-512, runs the exact-version isolated smoke, writes the upper bound only after smoke cleanup, and files failures through cland task into Bugs. C3's opt-in command is separate from package tests; the repository release skill/symlink and init's canonical-skill copying retain the preflight guide before dry run.

A-3465 supporting evidence checked: offline checker 6/6, doctor 21/21, reported exact-version real 2.0.30 fake-provider smoke and opt-in check pass, typecheck green. These do not resolve the two source findings; no verification may run until corrected-head source review. No per-item QA criteria.
Standards: 1 medium. Spec: 1 medium.
Review artifact A-3468: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3468-t-533-source-not-clear-response-guarantees-and-shard-classification.md

Criteria: C2 failed (Response required guarantees are ignored, allowing removal of required data to compare compatible and advance the tested bound despite adapter reliance on data.).

### rev-31 · 2026-10-16T00:01:51.713Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-533-source-2
commit: 77659eb0b7c8cae127883f3bdb6d100b2f378dd1
scope: full

Corrective source review clear at 77659eb0b7c8cae127883f3bdb6d100b2f378dd1, run rev-20261016-533-source-2, scope full. Focused correction from dc4e0128 combined with the original full review; no dev merge or unrelated picks. Both medium findings A-3468 are resolved. No high, medium or low findings remain.

## Standards
The new process/socket-using opencode-check.test.ts is now classified machine in hub/test/shards.json. A-3484 reports shard lint and typecheck passing; reviewed diff check passes. No additional documented-standard or smell findings. Role disables delegation; both axes reviewed here.

## Spec
Required response guarantees are retained: at opencode-contract.ts:61-69, every previously required response field must still occur in the new required list. The exception is only the exact GET /api/event text/event-stream wrapper id, which OpenCodeClient's ServerEvent type makes optional and its parser never consumes. Required data and nested response guarantees are not exempt. The new ten-operation regression removes required data and expects ten errors; SSE counterexamples accept optional id but reject optional data.

C1 verified from source and supporting fake-doctor cases: 1.x upgrade --major, missing v2 installer, newer 2.x warning and incompatible 3.x range refusal. C3 verified: live checker is an opt-in npm command, offline fixture tests make no upstream/model call; release skill points to the preflight before dry run, the .claude view is a symlink to canonical .agents/skills/release, and init copies that canonical directory including its guide.

C2 source path reviewed: stable newest 2.x discovery, both source-tag operation/event comparison, SHA-512-verified exact-version binary and isolated fake-provider smoke, success-only range advancement and failure Bug filing through cland tracker remain intact. No parent/default user OpenCode data is used. The stricter tagged 2.0.24→2.0.30 comparison passes as reported in A-3484; unchanged real 2.0.30 smoke/full release-check evidence remains A-3465.

A-3484 checked: corrective whole-file test 7/7, no failures/skips/cancellations, 3.967 s; labelled loaded Mac beside non-Coordinator local verify, admission load 10.08 and no other targeted process. Earlier A-3465 doctor 21/21 stands, unchanged. C2 remains unverified pending the exact-reviewed-head verification result. No Reviewer server/network/suite execution or edits in this pass.

Source clear does not lift the Coordinator's current verification hold; submit only after its release. No per-item QA criteria.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3491: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3491-t-533-corrected-source-clear-at-77659eb0.md

Criteria: C1 verified, C3 verified.

### rev-31 · 2026-10-16T01:08:01.006Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-533-evidence-1
commit: 77659eb0b7c8cae127883f3bdb6d100b2f378dd1
scope: evidence

Medium — hub/test/account-poller.test.ts:255 and hub/src/doctor/toolchain.ts:72,94: old exact passive-URL exception does not cover the new installer guidance; mandatory source guard fails at account-poller.test.ts:265. Update only the exact passive literals, preserving the boundary guard. Corrected-head source review is required before another verify.

Same-head A-3523 / bbfee74e exited 1: 1859/1862 cases passing, hub stopped before Neovim. Checker cases and their load repetitions pass, but external suite-timeouts/territory-lock failures, dynamic-title load gate 0/5 and duration budgets also prevent a final clear gate. C1 failed; C2 remains pending; C3 source evidence unchanged. Full evidence and categorized asides: A-3531, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3531-t-533-evidence-not-clear-exact-passive-url-guard.md.

Criteria: C1 failed (New doctor installer guidance breaks the mandatory provider-boundary source guard because its exact passive-literal exceptions were not updated.).

### rev-31 · 2026-10-16T02:09:36.389Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-533-source-3
commit: 9276d5371e124292e416b792594552f69582a2ba
scope: delta

Corrective delta source clear; A-3531/C1 integration finding resolved.77659eb0..9276d537 changes only account-poller.test.ts exact passive literals and shared durations.json. Standards: no findings. Two exemptions match only doctor/toolchain.ts human-facing installer/remedy strings; recursion, forbidden-provider/credential list and replace-once semantics remain unchanged, so a new access site still fails. Duration file exactly matches Coordinator-posted2149fe33, including authorizede0d3be63 allowances. Diff check passes. Spec: no findings; doctor/checker/contract guarantees/isolated smoke/release preflight source remains unchanged fromA-3491.

A-3591 whole account-poller10/10 green36.647s, guard23.837ms; admission localnone/load4.42/refined pgrepclear. PriorA-3465/A-3484 supporting proof unchanged. C1/C3 reverified at newhead; C2 awaits same-head post-source gate. Earlier A-3523 is not a passing gate. No per-item QA criteria, edits or Reviewer tests.
Artifact A-3592: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3592-t-533-corrective-delta-source-clear-at-9276d537.md. Proceed with requested no-mode/no-executor verify at exacthead.

Criteria: C1 verified, C3 verified.

### rev-31 · 2026-10-16T02:31:11.171Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-533-evidence-2
commit: 9276d5371e124292e416b792594552f69582a2ba
scope: evidence

Evidence not clear: same-head localDarwin72c333a4/A-3596 exit1,1861pass/1fail,Neovim not reached. Medium gate blocker—suite-timeouts.test.ts:179 one cleanup warning not within15000ms, sameT-555 signature as firstA-3523. Same-test repeat requires explicit Coordinator disposition, not classification alone or blind retry. Known sharedsuite-runner timestamp0/5 remains(T-556; posted576404e8).

Task-owned source guard now passes41.249ms; checker7/7 and all seven5/5 load repetitions pass. No new task-owned source defect established and no criterion failed by this external-only evidence pass; C2 remains unverified pending acceptable gate/disposition, C1/C3 current source marks stand. Duration regression notices are not new budget failures. T-488's separate snapshot fixture integration does not apply to this head. No Reviewer edits/tests.
Artifact A-3599: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3599-t-533-second-gate-not-clear-repeated-t-555-and-t-556.md.

### rev-31 · 2026-10-16T03:22:20.391Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-533-final
commit: 9276d5371e124292e416b792594552f69582a2ba
scope: evidence

Final evidence clear at unchanged9276d537 under explicit Coordinator84236741 mixed-platform gate. No high/medium findings. Linux4844575a/A-3635:1859pass/0fail/3skip; only red knownT-556timestamp0/5. T-555 cleanup-warning case passes9.551s; provider source guard passes; checker7cases and each5/5 load repetitions pass. Exacthead matches source-3/A-3592. No new duration-budget failures.
Paired localA-3596 is samehead1861pass/1fail, only knownT-555 plusT-556, own cases/repetitions green. This is the exact pair authorized by84236741, not two droplet receipts or an overallgreen fullrun. Both stop after hub, so no Neovim completion claimed; task has no nvim code diff. Final gate uses this item-specific explicit mixed-platform disposition. C2 verified from reviewed checker/smoke source, prior isolated real2.0.30 proofA-3465/A-3484 and current ordinary/repetition evidence. C1/C3 current source marks stand; all3criteria verified. No per-item QA or Reviewer edits/tests.
ArtifactA-3636: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3636-t-533-final-evidence-clear-under-explicit-mixed-platform-gate.md.

Criteria: C2 verified.

### rev-31 · 2026-10-16T03:24:48.699Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-533-merge-delta
commit: 658556abd0ec6212b33915f37b45e8a45d722d19
scope: delta

Landing merge delta clear at658556ab(parents final9276d537,dev58696d945). Explicit Coordinator751bda69 authorizes merge/package union and retainingA-3596/A-3635 without new suite. Combined diff manual resolution onlypackage.json:keepscheck:opencode anddevtypecheck wrapper. Relativedev adds only opt-in check script, test unchanged. T-533 doctor/contract/smoke/checker/tests/release-skill/PATCHES blobs unchanged from9276d537; README ownparagraph/shards machineentry preserved. JSON parses,diffcheckclear; fullhub+Neovim typecheck/shardlint green reported. Standards/Spec:no findings.
AllC1–C3 reverified at currenthead via unchanged source and explicit carried final evidenceA-3636/A-3596/A-3635. Original mixed-platform gate exception/noNeovimcompletion disclosure retained; no new green suite claimed. No Reviewer edits/tests or per-itemQA.
ArtifactA-3643: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3643-t-533-landing-merge-delta-clear-at-658556ab.md.

Criteria: C1 verified, C2 verified, C3 verified.
