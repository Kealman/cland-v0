---
id: T-118
kind: task
title: "The v0.1 release item: the release kind, the parenting rule, list --under and the path header; v0.1 created and its epics re-parented"
state: closed
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by: []
topic: topic-41
branch: t/T-118-the-v0-1-release-item-the-release-kind
created: 2026-10-09T21:56:01.700Z
updated: 2026-10-09T23:02:55.277Z
---

## Parent

T-107 (v0.1 release and status), slice 1 of 6. Spec `docs/spec/v0.1.md` §3.1 (Levels, Parenting rule, The release item, Tools, Migration).

## What to build

The tracker gains the `release` kind. Its frontmatter carries `version`, semver without the `v`, optional at creation. Its body has a `## Notes` section. The hub enforces the parenting rule on create and on link, with the default levels `release` › `epic`: an epic's parent is a release or none; a leaf's parent is any container or none; a parent that breaks the rule is refused. `cland task list --under T-n` lists a subtree. `cland task view` shows the path, release › epic › task, in its header. The MCP task tools mirror the CLI: `task.create` with `kind: release` and `version`, `task.list` with `under`, and the path in `task.view`.

Then the ticket performs the migration on this repository. It creates the v0.1 release item, version `0.1.0`, with a goal and a `## Notes` section taken from spec §1 and §4. It re-parents every epic labelled `v0.1` (T-107 to T-117) under it, through the hub. No release item is made for v0.0.1, and the v0 epics stay unscheduled. T-19 stays open as the parent of the v0 follow-ups.

In this slice the levels are the built-in default. Reading them from `[tracker] levels` is slice 2.

## Acceptance criteria

- [ ] `cland task create --kind release --version 0.1.0 "…"` creates a release item; a malformed version is refused.
- [ ] Linking an epic under a task, or a release under an epic, is refused on create and on link, with the rule named; a leaf under a release or an epic is accepted.
- [ ] `cland task list --under T-n` lists the subtree, and `cland task view` shows the path from the release in its header, both in the CLI and through the MCP tools.
- [ ] The v0.1 release item exists in this repository, and `cland task list --under` it lists the eleven v0.1 epics; the v0 epics have no release.
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` describe the release kind, the parenting rule, `--under` and the path header.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Tests through the hub's frame protocol and the CLI against a temporary project (`hub/test/harness.ts`); no new seams inside the hub. ADR 0002: the fields live in the item files and the hub indexes them. The migration on this repository runs through `cland task` once the code is merged and the hub restarted; the Coordinator runs it, or the Implementer documents the exact commands in its report.

## Comments

### impl-118 · 2026-10-09T21:58:04.745Z

Implementation started on the claimed task branch. I will cover release/version persistence, default parenting enforcement, subtree/path CLI and MCP behavior, docs, and exact post-merge migration commands for the Coordinator.

### impl-118 · 2026-10-09T22:01:43.020Z

Release/version persistence, shared default parenting checks (including kind-edit bypass guards), descendant filtering, and CLI/MCP ancestry headers are implemented. Focused red→green tests passed for the first three slices. Map children follow the approved question/task exception. Migration remains post-merge/restart, with commands to follow in the report.

### impl-118 · 2026-10-09T22:04:12.911Z

Review head: 59961e26c063e14b3bd953d161b2e0e59c003ee1, pushed to local origin. npm run typecheck passed. Focused tests passed: tracker-hierarchy 4/4; tracker 16/16; native boundary 2/2; release no-worktree targeted case 1/1. Full npm test is running against this unchanged committed tree. Post-merge migration commands: artifact A-220, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-220-t-118-post-merge-migration-commands.md.

### rev-65 · 2026-10-09T22:09:02.769Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-118-1
commit: 59961e26c063e14b3bd953d161b2e0e59c003ee1

Medium — .cland/artifacts/A-220-t-118-post-merge-migration-commands.md:9: unconditional task.create makes another 0.1.0 release on a full rerun and reparents all eleven epics to it, violating the requested idempotence; query/reuse the existing release and refuse ambiguity before creating.
Low — hub/src/tracker/tracker.ts:892: converting an unparented task to release does not add the spec's ## Notes section, although release creation does.
Low — hub/test/tracker-hierarchy.test.ts:85: isError alone accepts transport/permission failures as a successful parenting refusal check; assert the named parenting rule in error content.

Standards: 0 findings. Spec: 1 medium, 2 low. Core parenting/version/subtree/ancestry behavior is clear. Actual pinned pure helpers passed 36 parenting and 25 version cases in memory. No suite run, per request. Full evidence: A-227, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-227-t-118-review-of-59961e2-migration-rerun-and-release-completeness.md.

### impl-118 · 2026-10-09T22:12:22.795Z

Fix round head baf6ecc02aff3cc5a2468e462c6e1a8d91ee2108, pushed to origin. Review fixes: migration now lives in hub/bin/migrate-v01-release.ts and is idempotent (reuse one open 0.1.0 release, refuse multiple naming ids/titles, create only when absent, skip already-parented epics). Release conversion adds Notes using the same helper as creation. MCP negative parenting test asserts the named rule. npm run typecheck passed; hierarchy 5/5 and migration 1/1 passed. A-230 supersedes A-220. The initial full suite on 59961e2 was cancelled at the Coordinator's request to free the lock; one full suite is now queued on baf6ecc.

### rev-65 · 2026-10-09T22:14:23.544Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-118-2
commit: baf6ecc02aff3cc5a2468e462c6e1a8d91ee2108

High: none. Medium: none. Low: none. All three rev-65-118-1 findings are resolved: migration reuses one open 0.1.0 release and refuses ambiguity before writing; creation/kind conversion share Notes normalization; MCP refusal asserts the parenting rule.

Standards: 0 findings. Spec: 0 findings. Actual pinned pure helpers passed 36 parenting, 25 version, four Notes and four Notes-idempotence cases in memory. Actual pinned migration body passed six virtual-CLI scenarios, including a full rerun with zero writes, duplicate-match refusal naming both IDs with zero writes, partial-link resumption, missing-epic preflight, link interruption/restart, and a closed prior release. Every migration write uses cland task through the hub; no direct item-file writes.

No suite, actual migration or filesystem changes by Reviewer. Post-merge migration remains the Coordinator's step via A-230. Evidence A-231: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-231-t-118-resolution-review-of-baf6ecc-clear.md.

### impl-118 · 2026-10-09T22:38:27.653Z

Workflow correction head 42b3998e4f6744efb02cc3c26ae371115989dd27, pushed to origin. The full run on baf6ecc exposed one stale to-spec/to-tickets assumption: task children under a spec. A targeted replay reproduced the exact parenting-rule refusal. Per Coordinator decision, both guides now direct tickets to the source spec's epic/release (or none), with the source spec named on the body's Parent line. Updated workflow coverage passes all six skills-tracker tests (including epic/release/unscheduled cases); npm run typecheck passes. The superseded suite was stopped through its T-118 runner after cwd verification and cleanup. Queuing one full npm test on 42b3998 now.

### rev-65 · 2026-10-09T22:40:08.212Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-118-3
commit: 42b3998e4f6744efb02cc3c26ae371115989dd27

High: none. Medium: none. Low: none. Both tracker guides follow the approved workflow decision: tickets use the source spec's epic/release or no parent, while the body's Parent line retains the source-spec reference. Updated real-CLI test cases cover all three parents, blocker edges, no native spec children, source references and an unchanged source file.

Standards: 0 findings. Spec: 0 findings. Production/migration source is unchanged from the clear baf6ecc review. Repeated 36 parenting, 25 version and eight Notes/idempotence checks against the pinned helper source in memory; all passed. No suite, workflow writes or file changes. Evidence A-242: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-242-t-118-workflow-resolution-review-of-42b3998-clear.md. A-230 remains the Coordinator's post-merge migration step.

### impl-118 · 2026-10-09T23:00:15.749Z

Implementation complete at 42b3998e4f6744efb02cc3c26ae371115989dd27, pushed to origin; worktree clean. npm run typecheck passed. Final npm test passed: 645 hub + 104 Neovim tests = 749, zero failures/skips; suite 635.43s, lock wait 547.93s. Evidence A-247: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-247-t-118-full-npm-test-on-42b3998-passed.log. Current review rev-65-118-3 is clear on this exact head. Post-merge/restart repository migration remains the Coordinator's step using the idempotent hub/bin/migrate-v01-release.ts and A-230 (supersedes A-220); no actual item migration has been run by the Implementer.

### coord · 2026-10-09T23:00:39.227Z

Merged f59cad6c66d68aa7bcab520f7904761f42bf4b0c onto dev.

### coord · 2026-10-09T23:01:06.761Z

Merged by the Coordinator through `cland merge T-118`, after `cland push`: squash f59cad6 on dev. Gate: review rev-65-118-3 clear on 42b3998, after rev-65-118-1 (migration rerun; Notes on kind conversion; MCP refusal messages) and rev-65-118-2 (clear on baf6ecc). Decisions made during the item and approved by the human's stand-in:
- a map takes `question` and `task` children only;
- `spec` is a leaf, and tickets cut from a spec go under its epic or release with the source spec named in the body.
Full suite on 42b3998: 645 hub and 104 Neovim tests passed (A-247); report A-249. The migration, `hub/bin/migrate-v01-release.ts` (A-230), runs after the hub restarts on this code; its result is recorded here. impl-118's first stop was refused because its process identity could not be verified at that moment; the retry succeeded.

### coord · 2026-10-09T23:02:55.277Z

Migration run after the 9ddfd79 restart (hub pid 69005): created release item T-130 "Release: v0.1" (version 0.1.0); T-107 to T-117 re-parented under it; script verified eleven epics and changed no v0 item. Checked: list --under T-130 --kind epic shows all eleven; T-19 open with no parent; one release item. Tracker committed d122bb2 and pushed.
