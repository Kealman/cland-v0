---
id: T-63
kind: task
title: "cland release: main fast-forwards to dev, tagged with notes from the
  items, and goes to GitHub; cland sync brings GitHub back"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-2
assignee: impl-63
parent: E-20
blocked_by:
  - T-59
topic: topic-25
branch: t/T-63-cland-release-main-fast-forwards-to-dev
created: 2026-10-09T08:35:16.599Z
updated: 2026-10-10T00:58:17.709Z
closed: 2026-10-09T15:12:33.541Z
---

## Parent

Part of T-20 (slice 2, ticket 5 of 12). Spec sections 4.7, 4.9 and 7(a); ADR 0004.

## What to build

`cland release vX.Y.Z` is a `release` frame with a `release` grant for the Coordinator, from its shell, and for the human (decision D11: the human, or the Coordinator after the human answered the `release` skill's version ask; no spoke tool), and runs under the territory lock. It fetches `github` first and refuses, changing nothing, without a version, with a malformed or existing tag, with nothing in `main..dev`, without a `github` remote, or when `github/main` has commits `dev` lacks (named, with "run `cland sync`"). It then creates an annotated tag at `dev` whose message is the release notes: one line per `Item:` trailer in `main..dev` (`T-12 <title>`), then the other commits by subject. It pushes `dev`'s commit as `main` and the tag to `github` in one atomic push, and only then moves `main` locally and in the territory, so a rejected push leaves everything as it was. `--dry-run` prints the notes and the refs it would push. `cland sync` fetches `github`, fast-forwards `main` to `github/main` and replays `dev`'s unreleased commits on top in the root; a conflict aborts with the files named and `dev` unchanged, a dirty root refuses it, and it pushes nothing to GitHub. The `release` skill: commit the tracker, run `--dry-run`, ask the human for the number (the next patch, minor and major after the last tag, and a free answer), then release; the skill forbids delegating a release to a sub-agent. cland never edits the project's version files: cland's own bump of its package version is an ordinary item merged before a release. A release is one atomic push and makes no API calls; only `cland release` and `cland sync` reach GitHub.

## Acceptance criteria

- [ ] With two merged items on `dev`, `cland release v0.1.0` leaves the stand-in GitHub with `main` at `dev`'s tip and the annotated tag `v0.1.0` listing both items; local `main` and the territory match.
- [ ] Each refusal changes nothing locally or remotely: no version, `v1`, an existing tag, nothing to release, no `github` remote, `github/main` ahead with its commits named, a merge in progress, an Implementer, Reviewer or QA caller.
- [ ] A push the stand-in GitHub rejects with its own hook leaves local `main` and the tags as they were, and reports git's message.
- [ ] `--dry-run` prints the notes and the refs and changes nothing.
- [ ] `cland sync` brings a commit made on the stand-in GitHub into `main` and replays `dev`'s unreleased commits on top; with a conflict it stops, names the files and leaves `dev` as it was.
- [ ] The `release` skill is in `.agents/skills/release/` and in the Coordinator's skill list, and asks the human for the version before releasing.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents release, sync and the push rule; `AGENTS.md`'s managed block says only `cland release` pushes to `github`.

## Notes

Test seam: as the merge ticket (T-59), plus a bare repository on disk as `github`, with a `pre-receive` hook for the rejection case. Size L; `cland sync` can split off if it grows. Implementer: Codex gpt-6.1-sol.

## Comments

### coord · 2026-10-09T08:39:13.496Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/58 (a sub-issue of #20; the item is the source of truth).

### impl-63 · 2026-10-09T14:30:00.396Z

Dependencies installed with Node 24.21.0. Read T-20 decisions D1/D2/D11 and the dev migration. Building at the assigned hub-frame/real-Git seam; release and sync will use the existing async territory lock and marked runner, with one final package suite.

### impl-63 · 2026-10-09T14:39:45.841Z

First six real-Git frame/CLI checks pass: item-title release notes and annotated tag; atomic publication; sync imports/replays into root/territory; dry-run and every listed release refusal preserve refs; GitHub hook rejection preserves refs and reports hook text; only human/Coordinator shells publish; sync dirty/conflict preserves root and names files. Adding failure-after-publication and sync-follow-up regressions before documentation and final validation.

### impl-63 · 2026-10-09T14:47:45.911Z

Recovery regressions pass for GitHub success blocked by local main.lock (including hub restart), territory publication failure with later dev work, and sync territory retry. Added true-Git-trailer parsing after a prose Item-line regression, blocked release during pending sync, and required one pinned GitHub push endpoint to keep publication atomic. Release skill/default grants/docs are in place; targeted final run and internal review precede the one package suite.

### coord · 2026-10-09T14:48:09.996Z

To do at landing, by the Coordinator: this repository's .cland/roles.toml has an explicit `[coordinator]` section. Its permissions grant `merge` but not `release` or `sync`, and its skills omit `merge` and `release`. After T-63 merges, add the release and sync grants, with exact names from impl-63's report, and the two skills, in a separate visible commit on `dev`. Then release from the Coordinator's shell after the human's version ask, per D11.

### rev-65 · 2026-10-09T14:54:08.560Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-63-1
commit: a741bc144c4a996c8cd38f33a2f55dd46a32e385

High — none. Medium — none.

Low — hub/src/territory-release.ts:41 (also :35, :68, :230): adjacent resumed callbacks separately threshold parts of one continuous post-await stretch (parsing/validation, validation/command construction, receipt creation/serialization), so their combined cost near 250 ms can escape the continuous-stretch warning. Subsequent validation/assembly is bounded and small here. impl-63's announced consolidation will receive a separate delta review, as requested by Coordinator.

Standards: 0 findings (clear). Spec: 1 low (clear). No publication, recovery, refusal, sync-safety or role-ownership defect found. GitHub main/tag use one atomic leased push to a single pinned endpoint before local/territory refs move. Durable receipts recover exact published objects across restart, lost replies and tag-object GC without publishing later dev work. Sync replays in isolation, preserves root/dev on conflicts, rechecks checkout before atomic ref installation, and pushes only to territory. True Item trailers, refusal/dry-run ref preservation, release/sync grants, no spoke tools, D11's version ask/no delegation, README and existing managed AGENTS rule match the request.

Read item/earlier comments and D11, pinned diff, A-83 and all 12 real-Git test sources. A-83 reports typecheck and 12 targeted tests passing with zero failures/skips; final full suite still pending in that report. Reviewer ran no suite, no release/sync commands and made no edits.

Evidence: A-86, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-86-t-63-review-atomic-release-and-isolated-sync-at-a741bc1.md

### impl-63 · 2026-10-09T15:02:36.995Z

Final delta committed as 4fc2ac3f739d0e742cf30cdf7da721231e6b6437. Internal Standards and Spec reviews are clear after all findings were reproduced and fixed. Four recovery regressions pass (plus original 12/12 targeted); typecheck and release skill validation pass. Final one-package-suite validation starts now through npm test's own lock, durable raw log A-91. External reviewer and QA have the new head.

### rev-65 · 2026-10-09T15:05:03.880Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-63-2
commit: 4fc2ac3f739d0e742cf30cdf7da721231e6b6437

Findings by severity: high none; medium none; low none. Standards 0 (clear); Spec 0 (clear). Previous timing low is addressed.

Reviewed git diff a741bc1 4fc2ac3 against the item and recovery contracts. Sync refuses incomplete landed merge/checkout recovery before creating sync.tmp, while fully rolled-back preparations remain eligible. Merge refuses an existing sync.tmp before mutation. Shared queue/lock and this ordering preserve each operation's retry path without a circular wait or nested queued operation. The added regression checks blocked merge, same-replay sync retry, then successful merge.

Release/sync receipts are now cleared only after successful hub recording and absent follow-up. Log failure or receipt-cleanup failure retains retry state and reports record follow-up; unchanged disk/SQLite recovery readers survive a hub restart. Same-version release and same-replay sync regressions cover the new record failures. Skills retain D11's human version ask/no delegation and clarify retry order.

Read A-92 reproduction/internal review evidence, A-88 independent base QA, four new real-Git test sources and surrounding merge/territory/tracker code. git diff --check passes. Implementer reports typecheck/skill validation and original 12 plus four new targeted cases passing. Final package suite and final QA delta remain in progress in latest messages read; Reviewer ran no suite or release/sync commands and made no edits.

Evidence: A-93, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-93-t-63-final-delta-review-recovery-interlocks-and-receipt-retention.md

### qa-12 · 2026-10-09T15:11:12.417Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-63-1
commit: 4fc2ac3f739d0e742cf30cdf7da721231e6b6437

Commit: 4fc2ac3f739d0e742cf30cdf7da721231e6b6437. Run: qa-12-63-1.

Ran two scopes on git archive exports with T-63's node_modules:
- Base a741bc144c4a996c8cd38f33a2f55dd46a32e385: npm run typecheck; node --test hub/test/release.test.ts (12/12). Independent CLI matrix against a scratch project, real hub/Reviewer spoke, local bare GitHub stand-in and collaborator clone. Every cland command explicitly unset CLAND_HUB_FILE, CLAND_SESSION_ID and CLAND_SESSION_NAME. Exercised task list/view, two reviewed item merges, dry-run notes/ref invariance, annotated v0.1.0 publication and local/territory/GitHub main agreement; refusal for missing/invalid version, existing tag, empty release, missing GitHub, session identity, pending Git state and remote-ahead commits; rejected atomic push; collaborator sync/replay, dirty and conflict refusals, and zero GitHub pushes from sync. Evidence A-88 and A-94.
- Final delta 4fc2ac3: npm run typecheck; all 16 release.test.ts tests passed, zero failures/skips, including all four new recovery regressions. Independent real-daemon CLI probes passed: item mode 0444 plus atomic-write directory 0555 caused landed merge c5bbbd8258f7e5c2a6a6fdc3faea6c753f0b7057 with pending close. With collaborator main advanced, sync returned “sync-recovery: finish pending cland merge T-1 before sync rewrites its landing”; all local/territory/GitHub refs stayed identical. Restored writes; merge retry kept that exact commit, and subsequent sync retained exactly one Item: T-1 trailer.
- Final delta release recovery: supplied real daemon log sink attempted a filesystem success-record write through a regular file (ENOTDIR). CLI returned followUp:record after publication. Same-version retry completed from receipt with identical commit 7605dad3ec31cecb2d5d48dfa8da4fd6a8d3d47e and annotated tag object 1ba8fb8d9bcb6f6c6eed0ff465313e6851d09981. Bare pre-receive hook counted exactly one push across first call and retry. Third same-version call correctly refused release-tag without another push.

Shared full-suite scope: I inspected impl-63's durable A-91 log at the final head. npm run typecheck passed; npm test completed with 437/437 hub and 91/91 headless Neovim tests (528 total), zero failures/skips. Runner reports duration 483.66s, lock wait 0.01s, peak 1m load 14.12. Implementer reported exit 0 and completed cleanup. No duplicate full suite was run, per Coordinator's instruction.

Findings by severity: high none; medium none; low none in the requested scopes.

Independent raw commands, responses, scripts, checks, journal/Agents records and cleanup evidence: A-94, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-94-t-63-qa-base-and-final-delta-raw-evidence.zip (SHA256 790cbeae429d7c62c3a68276b728a343b2d714a7326110db29cef56783da9cec).
Own hubs/reviewer processes stopped, both scratch roots removed, exports/staging removed after verified artifact copy, task worktree clean. No production fixes or external GitHub writes.
Summary artifact A-97: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-97-t-63-qa-verdict-evidence-on-4fc2ac3.md.

### impl-63 · 2026-10-09T15:11:37.411Z

Implementation complete at 4fc2ac3f739d0e742cf30cdf7da721231e6b6437 (git log -1 readback). Final npm run typecheck passed; one npm test exited 0 with 437 hub + 91 nvim = 528 passing tests, no failures/skips. Raw log A-91; final report A-99; internal review A-92 and external review rev-65-63-2/A-93 clear. QA independently passed 16 release tests and live recovery checks, recording its verdict after suite completion. Task worktree clean; own baseline archive and suite scratch removed. No live push or merge. Exact Coordinator tool grants are release and sync; human-owned roles.toml untouched.

### coord · 2026-10-09T15:12:33.539Z

Merged 70a9cdebe4d813fc64912c069c27aeeff8c17a97 onto dev.

### coord · 2026-10-09T15:13:02.406Z

Merged by the Coordinator through `cland merge T-63`: squash 70a9cde on dev (gate: review rev-65-63-2 clear, QA qa-12-63-1 clear, both on 4fc2ac3). impl-63 stopped so the worktree cleanup can finish. Next: a visible roles.toml commit on dev adding the Coordinator's `release` and `sync` grants and the `merge`/`release` skills, then a hub restart on the human's decision, then the first release with the human's own version answer (D11).
