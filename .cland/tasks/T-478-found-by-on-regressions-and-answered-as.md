---
id: T-478
kind: task
title: found_by on regressions and answered_as on ask answers
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by: []
topic: topic-327
branch: t/T-478-found-by-on-regressions-and-answered-as
created: 2026-10-15T09:13:19.908Z
updated: 2026-10-15T21:43:41.365Z
---

## Summary

Retrospective A-2783, START 2: escapes could not be attributed to where they were caught, and the human's answers could not be told apart from the stand-in's.

## What to build

- **`found_by`.** An item with `regression_of` takes `found_by`, one of review, cover, droplet, qa or human, through `task create`/`task edit` and the tools.
- **`answered_as`.** An ask's answer records `answered_as`: human, or stand-in with its session name. It is set from the answering client's identity, and the stand-in's relay is marked.
- **Where they appear.** Both are shown in `task view` and the journal.

## Acceptance criteria

- [x] C1. `task create --regression-of T-n --found-by cover` stores and shows found_by, and a value outside the set is refused.
  - done: impl-478 · 2026-10-15T21:13:02.013Z
  - verified: rev-30 [reviewer] · run rev-20261015-478-source · 2026-10-15T21:15:43.859Z · commit 89308cc3675def9b2afed9d94a015eacfed3e59f
  - verified: rev-30 [reviewer] · run rev-20261015-478-final · 2026-10-15T21:43:39.110Z · commit 89308cc3675def9b2afed9d94a015eacfed3e59f
- [x] C2. An ask answered from the human's shell records `answered_as: human`, and one answered by a named stand-in records `stand-in` with its name.
  - done: impl-478 · 2026-10-15T21:13:04.560Z
  - verified: rev-30 [reviewer] · run rev-20261015-478-final · 2026-10-15T21:43:39.110Z · commit 89308cc3675def9b2afed9d94a015eacfed3e59f
- [x] C3. hub/README.md describes both fields.
  - done: impl-478 · 2026-10-15T21:13:05.970Z
  - verified: rev-30 [reviewer] · run rev-20261015-478-source · 2026-10-15T21:15:43.859Z · commit 89308cc3675def9b2afed9d94a015eacfed3e59f
  - verified: rev-30 [reviewer] · run rev-20261015-478-final · 2026-10-15T21:43:39.110Z · commit 89308cc3675def9b2afed9d94a015eacfed3e59f

## Comments

### impl-478 · 2026-10-15T20:59:11.731Z

Implemented found_by across frontmatter, tracker index and task-written journal, task create/edit CLI and MCP schemas; missing regression or out-of-vocabulary values refuse, clearing regression drops attribution. Targeted new task-attribution.test.ts passes 2/2 (Mac quiet, load 2.05; longest test 0.783s). Ask identity decision pending with lead.

### impl-478 · 2026-10-15T21:10:09.138Z

Implementation committed as ea0f03f8. Followed Coordinator answer c5e97e15: human-shell --as <name> is a self-declared stand-in label; all known session shells, including Aides, remain refused. Origin persists on ask cards/messages and relays, in task view item.answers, journal and answer delivery metadata. Final ask-attribution.test.ts 3/3 passes (longest 1.683s); typecheck and shard lint pass. task-attribution and existing asks full-file reruns waiting for current Mac load limit (<10), then first source review.

### rev-30 · 2026-10-15T21:15:43.859Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-478-source
commit: 89308cc3675def9b2afed9d94a015eacfed3e59f
scope: full

Source review T-478 clear at 89308cc3675def9b2afed9d94a015eacfed3e59f, fixed point merged dev a1fa4c13. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role. The first-parent merge delta contains inherited T-471/tracker changes; reviewed own scope is the20-file diff against the merged dev parent.

C1 verified from implementation and targeted evidence: found_by vocabulary is centrally validated as review/cover/droplet/qa/human, only on a task with regression_of. CLI create/edit and MCP schemas expose the field, including explicit null/none clear on edit. Frontmatter parse/serialize, incremental/rebuilt index, views/list summaries and task-written journal carry it. Removing regression or converting task kind drops attribution, preventing stale unrelated metadata. Existing regressions remain readable without the optional field. New task-attribution2/2 reportedly covers full vocabulary round-trip, invalid types/values, public CLI create/view/edit, tools/index/list/journal, clear and kind conversion; source inspected.

C2 source checked, final runtime mark pending: independently confirmed Coordinator c5e97e15 explicitly chooses human-shell self-declaration, not an Aide/session permission expansion. actorOf gives a session shell its own identity before considering --as. Dispatcher #asSession still treats known/stale/own-shell identities as sessions and leaves topic.answer refused; only the human path accepts an unknown label and validates its name. Submitted answered_as/by fields are ignored. Asks derives human or stand-in/name, persists it on ask/message in the existing transaction, clears it when send failure reopens the ask, and copies upstream origin on ask.answer while setting relayed_by to the current lead. Agent-only decisions remain unattributed. Legacy rows have no manufactured origin. Additive nullable SQLite columns preserve history, task view exposes attributed answers in its bound topic without frontmatter mutation, and journal/spoke/native delivery metadata retain origin. New ask-attribution3/3 reportedly covers human, stand-in, known sessions including Aide refusal, invalid labels, forged metadata, relay and restart. Existing asks11/11 green is reported. Targeted source/evidence is encouraging; exact merged-head verification must still pass before final clearance.

C3 verified: README documents both fields, supported CLI/MCP values/clearing, journal/task-view placement, human-shell self-declaration and unchanged session refusals, relayed_by and legacy unattributed state. CLI help matches. No unrequested authenticated-stand-in claim.

Standards: explicit domain validators remain in the tracker/ask modules; protocol/store additions are optional/additive, and permission admission stays at the existing Dispatcher seam. Two new files are classified machine in shards. Existing ask-card assertion is updated only for the intentional human attribution field. No removed behavioral assertions/bounds, no duration allowance/baseline change. Whitespace check against merged dev clear. A-3363 describes the design; final targeted results are recorded in task comments/request. Typecheck/shard lint passed before the dev merge; requester notes post-merge typecheck pending. Report that result and let exact-head verify's host/worker typecheck establish final build evidence.

Source clearance permits one no-mode cland verify at this head under current admission/budget rules. Final C2/all-criteria verdict awaits an acceptable same-head receipt; no per-item QA criteria. No Reviewer tests, edits, merges or provider actions.

Criteria: C1 verified, C3 verified.

### impl-478 · 2026-10-15T21:16:03.961Z

Source review clear (rev-20261015-478-source) at 89308cc3675def9b2afed9d94a015eacfed3e59f; post-merge typecheck/shard lint green. Submitted exact-head no-mode verify a2471eef-5a2e-4ceb-b0ce-c17e58e349ee, queue position 1, report topic-327 to Reviewer rev-30 and Implementer. Waiting for hub receipt; C2 final runtime mark remains with Reviewer.

### impl-478 · 2026-10-15T21:43:22.750Z

Exact reviewed head 89308cc3675def9b2afed9d94a015eacfed3e59f passed no-mode verification a2471eef-5a2e-4ceb-b0ce-c17e58e349ee: full, local darwin arm64 fallback, 2239/2239 tests, exit 0, including Neovim. Log A-3391 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3391-suite-a2471eef-5a2e-4ceb-b0ce-c17e58e349ee-auto-at-89308cc.log). Reviewer received same-head result; waiting final C2 verdict. No source/head changes.

### rev-30 · 2026-10-15T21:43:39.110Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-478-final
commit: 89308cc3675def9b2afed9d94a015eacfed3e59f
scope: evidence

Final evidence review T-478 clear at 89308cc3675def9b2afed9d94a015eacfed3e59f. No high, medium or low findings. Source review A-3370 stands at the unchanged merged head.

A-3391 /a2471eef-5a2e-4ceb-b0ce-c17e58e349ee is actual local Darwin arm64 after hub fallback, not Linux. Full selection exits0:2239 pass, zero failures/cancellations/skips. Typecheck, hub and full Neovim completed. Duration1153.88s, peak one-minute load20.87. No hard duration-budget failure; regression notices are informational.

C2 verified: human-shell origin test passes0.913s at611; named stand-in/known-session refusal/relay/restart test1.732s at612; forged-metadata/human-relay test0.716s at613. These public paths confirm Coordinator c5e97e15's self-declaration model: human-shell --as labels a stand-in, known hub sessions and Aides remain refused, persisted origin survives restart and is copied by relay with relayed_by. Human answers stay human; submitted origin fields do not override the derived value.

C1 reverified: vocabulary/frontmatter round-trip and invalid-orphan attribution test passes at3380; CLI/MCP/index/edit/journal regression-discovery test passes1.061s at3381. Source validation, clearing and kind-conversion behavior remain unchanged. C3 reverified: both field/trust-model documentation remain current.

This exact-head full run resolves the previously pending merged-head runtime evidence; earlier post-merge typecheck/shard lint reports were green as well. The item does not require a separate Linux receipt; no Linux provenance is claimed for this fallback result. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions. Changed-head integration/conflict resolution requires delta review.
Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3391-suite-a2471eef-5a2e-4ceb-b0ce-c17e58e349ee-auto-at-89308cc.log.

Criteria: C1 verified, C2 verified, C3 verified.
