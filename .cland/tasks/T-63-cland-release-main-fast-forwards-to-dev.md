---
id: T-63
kind: task
title: "cland release: main fast-forwards to dev, tagged with notes from the items, and goes to GitHub; cland sync brings GitHub back"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-63
parent: T-20
blocked_by:
  - T-59
topic: topic-25
branch: t/T-63-cland-release-main-fast-forwards-to-dev
created: 2026-10-09T08:35:16.599Z
updated: 2026-10-09T14:54:08.560Z
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
