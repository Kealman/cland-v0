---
id: E-273
kind: epic
title: Release v0.1.2 from the item
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-272
  - E-276
topic: null
branch: null
created: 2026-10-12T11:35:14.174Z
updated: 2026-10-12T11:35:19.765Z
---

## Goal

v0.1.2 "Working with items" ships from its release item T-228: `cland release --item T-228` publishes version 0.1.2 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective artifact records the run with the per-model data the new records hold. Two pieces of tech debt go with it: T-253 makes the hub fail fast on a tracker storage stall while it serves, and T-254 keeps a cancelled suite attempt from superseding green cache evidence.

## Contents

- **T-254**: a cancelled suite attempt (by its requester, by the requester's death, or by a head change before admission) no longer supersedes green evidence for its tree; a failed attempt (a test failure, a worker crash or a timeout) still does.
- **T-253**: when a tracker storage operation stalls past its deadline while the hub serves, the hub logs the abandoned operation, tells the sessions and the workbench, and exits non-zero, so a supervisor or the human restarts it; no tracker mutation admitted after the stall commits before the exit (D23, accepted in §4).
- **The release** (§4, Definition of done, as for v0.1.1: D16 and D19 of v0.1 §4): every other epic of T-228 closed on its QA demo; T-228's `## Notes` written from the item and its epics; `cland release --item T-228 --dry-run`, its notes and version 0.1.2 shown in an ask; `cland release --item T-228`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run, as A-96 was for v0, with the per-model data the records of §3.12 allow.

Not in this epic: findings of the QA demos or the release that need the human's decision; they go to Bugs or Follow-ups and wait for the human.

Choices where the spec is silent:

- The epic closes before the release: `cland release --item` refuses a release with an open child (v0.1 §3.1), so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on T-228, as v0.1's release epic T-117 closed before v0.1.0 went out (D19).
- T-254 and T-253 are hub work with no tie to the Neovim lane: the Coordinator may take them as soon as "Accounts and limits" closes, while "The explorer and the card" finishes; the release steps wait for every other epic.
- The notes go in T-228's `## Notes`, written by the Coordinator: the goal, one paragraph per epic on what the human can now do, the run's decisions, the checks deferred to a later release, and the known issues filed in the categories.
- The version is the human's recorded 0.1.2 (T-228's `version` and §4); the Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- One full local suite on macOS on the `dev` tip of the dry run covers the macOS-only cases that remote runs skip ("Remote executors").
- The retrospective is a folder artifact: the report, a script adapted from the research's `extract.py` that also reads the usage, size, `regression_of`, launch-model and verdict-scope records, and its CSVs. It reports the §3.12 metric set where the records allow, within size classes, and names what they cannot show yet: one Implementer model in this build.

## Tracer-bullet order

1. **A cancelled attempt keeps green evidence (T-254).** The suite cache takes the newest attempt for a tree and mode that was not cancelled. Demo: green, then cancelled, then a request on the same tree gives a cache hit naming the green run, while green, then failed, gives a fresh run.
2. **Fail fast on a serving-time stall (T-253).** A tracker storage operation stalled past its deadline while serving makes the hub log it, tell the sessions and the workbench, and exit non-zero. Demo: a held write in a test makes the hub exit with an error naming the operation and the item, and no later mutation is on disk.
3. **The notes and the dry run.** T-228's `## Notes` written from the item and its closed epics, a green local suite on macOS, and the dry run. Demo: `cland release --item T-228 --dry-run` prints version 0.1.2 and the notes, with every other epic of T-228 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item T-228`, and QA's post-release check of the tag. Demo: tag `v0.1.2` is on GitHub `main`, T-228 is closed, and QA's verdict on T-228 is clear.
5. **The retrospective.** After the release: the folder artifact of the run with the per-model data and the script that made it. Demo: the artifact shows, per role and per model, the tasks, first-pass yield, rounds to the first clear review, findings by severity, escaped defects through `regression_of` and cost per landed task, within size classes.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project, QA reproduces both pieces of tech debt through the CLI: a green run, a cancelled run and a new request on the same tree give a cache hit naming the green run, and a failed run in place of the cancelled one gives a fresh run; a tracker write held past its deadline while the hub serves makes the hub exit non-zero, naming the operation and the item. On `dev`, `cland task list --under T-228 --state open --json` lists only this epic; QA reads T-228's notes and `cland release --item T-228 --dry-run` with version 0.1.2, and the latest full local suite on macOS is green on that tip.

- [ ] A cancelled attempt no longer supersedes green evidence for its tree, a failed attempt still does, and `hub/README.md`'s cache paragraph states the rule (T-254).
- [ ] A stalled tracker storage operation while serving makes the hub exit non-zero with the operation and the item named, no mutation admitted after the stall commits, and `hub/README.md` describes the restart path (T-253).
- [ ] Every other epic of T-228 is closed on a clear QA verdict, and no open item other than this epic remains under T-228.
- [ ] T-228's `## Notes` describe the release by epic, the run's decisions, the deferred checks and the known issues, and `cland release --item T-228 --dry-run` shows them with version 0.1.2.
- [ ] A full local suite on macOS is green on the `dev` tip of the dry run.

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item T-228` on the answer; QA checks that tag `v0.1.2` is on GitHub `main` and records its verdict on T-228; the retrospective artifact follows and is linked from T-228.

## Dogfooding

The release runs on what the build shipped: the notes come from the item and its epics as the explorer shows them, the final suites run on droplets, the per-model numbers come from the records "Status, fields and instrumentation" added, and the human follows the release in the inbox and the events view.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item T-228` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in T-228's file.
- **Risks.** T-253's exit must not lose a write it admitted before the stall; a refused release (an open child, a dirty root) is fixed before it is retried, never overridden.
- **Order.** Last: it waits for "Accounts and limits" and "The explorer and the card", the ends of the two lanes.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §4 The release (Definition of done, D23 accepted), §3.12 (the metric set); `docs/spec/v0.1.md` §4 (D16, D19, D22, D23).
- Tickets: T-253 and T-254, children of this epic; T-228, the release item; T-227 (the v0.1.1 release, the model for this one); T-117 (the v0.1 release epic); T-103 (the stall detection T-253 completes).
- Branch: `research/model-performance` (`docs/research/model-performance.md`, `extract.py`).
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.
