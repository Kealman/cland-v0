---
id: E-425
kind: epic
title: Hub hygiene
state: open
criterion_seq: 6
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by:
  - E-387
topic: topic-369
branch: null
created: 2026-10-14T16:43:13.486Z
updated: 2026-10-16T11:05:36.275Z
---

## Summary

Tracker and docs commits stop cancelling integrated runs on `dev`, because a run's identity follows the tree it verifies rather than the head of `dev`. Orphan hook bridges get a named cause, a bounded exit and a safe sweep, and the typecheck moves to TypeScript 7 once its output matches on the whole repository.

## Goal

The hub stops spending runs and processes on changes that do not change what a run proves. On 2026-10-14 three tracker-only commits cancelled the Coordinator's integrated run mid-flight, and the run had to be counted as cover by hand (T-379); until this lands, everyone who commits on `dev` checks the verify queue first. On 2026-10-13 the machine held 64 orphan `cland hook bridge` processes bound to test projects long gone (T-311). Every verification runs the typecheck first, and TypeScript 7 typechecks the hub in 1.6 s against 18 to 26 s for TypeScript 5.9 on this machine under load (the web-stack research).

## Contents

- **§3.5 Tracker-only commits never cancel a dev run (T-379).** A run's identity follows the tree it verifies, the inputs the tree-hash cache knows: docs and tracker commits neither cancel nor invalidate an integrated run, whose result then covers the new head.
- **§3.5 Orphan hook bridges (T-311).** The cause is named, a bridge whose hub is gone exits within a bounded time, a full suite leaves no bridge behind, and the doctor sweeps the existing orphans safely.
- **§3.5 TypeScript 7** for the hub's typecheck (1.6 s against 18 to 26 s, from the web-stack research), adopted when its output matches the current one on the whole repository: the task "TypeScript 7 for the hub's typecheck: adopt it when its output matches on the whole repository", a child of this epic.

Not in this epic: the suite's own speed (E-387); the web workspace's typecheck, which v0.2 adds on whichever compiler this epic leaves; a linter, which the repository does not have.

Choices where the spec is silent:

- **One definition of the suite inputs.** It sits beside `candidateTree` in `hub/src/verification-tree.ts`: the committed tree less `.cland/tasks/`, `.cland/RULES.md` (the rulebook of "Rules and rhythm") and `docs/`. Today only `.cland/tasks/` is left out. The slice checks that no test reads the repository's own `docs/`, and the tree-hash cache, the run identity and the integrated run's cover all use this one definition (T-379's second criterion).
- **Identity by tree.** A queued or running job keeps its candidate tree as its identity. At admission and while it runs, the hub compares the new head's tree with the job's tree instead of comparing heads, so a head that moved with the same tree carries the job on. A head whose tree differs still cancels a queued job and stops a running one, as today, with the reason in the result.
- **The cover.** The result records the head it ran on and every later `dev` head with the same suite-input tree, and `cland verify queue`, the run's report and the Coordinator's batch rule (an integrated run per about three merges, D29) read the cover from it.
- **Until then.** Everyone committing on `dev` keeps checking `cland verify queue` first, the rule the rulebook's seed records. After the merge it covers only commits that change suite inputs, and the Coordinator proposes that edit to the human in an ask.
- **The bridge's cause.** The bridge reconnects until its stdout closes or its parent changes (`hub/src/cli/hook.ts`), and it retries a missing `hub.json` every 500 ms with no bound. The first slice reproduces an orphan from a test whose scratch project is removed before its session ends, names on T-311 which of these lets the bridge outlive its test, and fixes that cause in the test teardown or the bridge.
- **The bounded exit.** A bridge exits when its hub file has been missing, or has named a hub that refuses it or does not answer, for 60 seconds. A hub restart within that time keeps the bridge, since it reads `hub.json` again, as today. A test on a real hub stopped under the bridge proves it.
- **No bridge after a suite.** The runner's end-of-phase leftovers check, which E-268 set at zero, also counts `cland hook bridge` processes started during the phase and fails the phase when one is left.
- **The doctor's sweep.** `cland doctor` lists bridges whose hub file is gone, and `cland doctor --fix` ends one only when it is the user's own process, its command line is a bridge's and its hub file does not exist. A bridge whose hub file exists is never touched, even when its hub is down, which keeps the doctor's rule of never touching an ambiguous row.
- **TypeScript 7.** The task adds the TypeScript 7 compiler beside 5.9 as a dev dependency and runs both over what the root `npm run typecheck` covers: the hub's `bin`, `src` and `test`, and Neovim's `bin` and `test`. It compares their diagnostics on the clean tree and on planted errors, one per strict option in `hub/tsconfig.json`, and switches the typecheck scripts only when they match. TypeScript 5.9 stays for the two tests that use the compiler API (`hub/test/executor.test.ts` and `hub/test/tracker-container-source.test.ts`), since 7.0 ships no API. If the output differs, the task records the differences, keeps 5.9 and files a follow-up.
- **Measurements.** The typecheck times before and after, and the suite's leftover counts, are taken only when the verify queue has no holder and no waiter (T-204).

## Tracer-bullet order

1. **One definition of the suite inputs.** The exclusions listed once and used by the tree-hash cache, with the check over the test sources. Demo: in a scratch project, `cland verify` on `dev`, then a commit that changes only `docs/`, then `cland verify` again gives a cache hit naming the first run, while a commit to `hub/src/` gives a fresh run.
2. **A run's identity follows its tree (T-379).** Identity by tree at admission and during the run, and the cover in the result. Demo: an integrated run on a scratch `dev` stays in place through a tracker-only commit while queued and a docs-only commit while running, finishes green, and its report names both new heads as covered; a commit to `hub/src/` still cancels a queued run with its reason.
3. **The bridge's cause and its bounded exit (T-311).** The reproduction, the cause on T-311, the fix, and the 60-second exit. Demo: the cause is recorded on T-311, the reproduction no longer leaves a bridge, and a bridge whose hub is stopped under it exits within 60 seconds in a test.
4. **No bridge left behind, and the sweep (T-311).** The runner's leftovers check and the doctor's list and sweep. Demo: a full suite's leftovers report shows no bridge, and `cland doctor --fix` ends a planted orphan bridge while a bridge whose hub file exists stays.
5. **TypeScript 7, compared and adopted.** The comparison on the clean tree and the planted errors, the switch or the recorded differences, and the times. Demo: the comparison table on the task, and `npm run typecheck` timed on the whole repository with the compiler it now uses.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), on a droplet through the demo lease of "Rules and rhythm" where no macOS is needed, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

(The suite-input and run-identity part of this demo moved to E-579 with T-379, by the human's decision of 2026-10-16, ask 396ec11a.) In a scratch project, QA starts a fake Claude Code session whose scratch project is then removed, and reads its bridge gone within 60 seconds. With a planted orphan bridge and a live bridge whose hub file exists, `cland doctor` lists only the orphan and `cland doctor --fix` ends only the orphan. QA reads the leftovers report of the latest full suite with no bridge. QA runs `npm run typecheck`, reads the compiler in use and its time, and reads the comparison table on the TypeScript 7 task.

- [ ] C3. The cause of the orphan bridges is named on T-311, and a bridge whose hub is gone exits within 60 seconds, proved by a test on a real hub stopped under it.
- [ ] C4. A full suite run leaves no `cland hook bridge` process behind, checked by the runner's leftovers check, and `cland doctor --fix` ends only bridges whose hub file is gone.
- [ ] C5. TypeScript 7 runs the repository's typecheck when its diagnostics match 5.9's on the clean tree and on the planted errors, with both times recorded; otherwise the differences are recorded on the task, 5.9 stays and a follow-up is filed.
- [ ] C6. `hub/README.md` (the doctor, the typecheck) and `docs/agents/tests.md` describe the bridge sweep and the compiler in use; T-311 and the TypeScript 7 task are closed. The suite-input and run-identity lines moved to E-579 with T-379 (human decision 2026-10-16, ask 396ec11a).

## Dogfooding

Once the identity slice merges and the hub restarts, the Coordinator's tracker and docs commits stop cancelling its integrated runs, and the rulebook's rule about the verify queue narrows to commits that change suite inputs. Every verification after the TypeScript 7 switch spends about 20 seconds less on its typecheck. The doctor's sweep replaces any cleanup of bridges by hand.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The `opencode` CLI never runs inside a session until T-296 lands. The DigitalOcean token is never stored.
- **ADRs.** 0003 (The hub is a per-project daemon): a client of a hub that is gone exits on its own, so a stopped hub leaves nothing behind.
- **Risks.**
  - A path wrongly left out of the suite inputs would let a run cover a head it never tested; the exclusions are three, listed once, and the check over the test sources guards them.
  - The doctor's sweep must never end a live session's bridge, which is why it touches only bridges whose hub file is gone.
  - A new dev dependency changes the lock file, so the droplet snapshot is prepared again once (its key includes the lock's hash).
  - TypeScript 7.0 has no API, so anything that imports `typescript` stays on 5.9.
- **Size.** About four sessions on the v0 scale.
- **Order.** Second in the suite lane, after E-387 "Test speed: structural". Its `blocked_by` edge stands for lane order until the `follows` relation exists (spec §4); E-387's in-process hub and sharded runs also change the runner and the queue that this epic touches. "Release v0.1.3 from the item" waits for this epic.

## Links

- Spec: `docs/spec/v0.1.3.md` on `dev`, §3.5 and §4; `docs/spec/v0.1.md` §4 (D29, the batch rule).
- Tickets: T-379, T-311 and the TypeScript 7 task, children of this epic; T-233 (the tree-hash result cache), T-278 (teardown by process group), E-268 (the leftovers check).
- Research: `research/web-stack` (`docs/research/web-stack.md`, section 3's side finding and the list's item 11).
- Code: `hub/src/verification-tree.ts` (`candidateTree`), `hub/src/hub/suites.ts`, `hub/src/hub/suite-worker.ts`, `hub/src/cli/hook.ts` (the bridge), `hub/src/cli/doctor.ts`, `hub/src/orphans.ts`, `hub/test/run-suite.ts`, `hub/tsconfig.json`, `nvim/tsconfig.json`.
- ADR: `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- GLOSSARY: Executor, Hub, Spoke.

## Plan

```yaml
stages:
  - name: hub lifecycle and process hygiene
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-513
        - T-488
        - T-476
      - - T-311
      - - T-427
      - - T-548
      - - T-559
      - - T-562
        - T-567
        - T-491
```

## Comments

### hub · 2026-10-16T10:55:25.801Z

demo df159ade-30c3-4486-9cf1-029ea09c9dce created: droplet cland-v0-df159ade, commit 133ce00862a55cd6abf246a5df248c1da9af2fc4, deadline 2026-10-16T11:44:16.592Z.

### hub · 2026-10-16T11:03:09.922Z

demo df159ade-30c3-4486-9cf1-029ea09c9dce destroyed: lifetime 52884 ms; cost $0.0042.

### hub · 2026-10-16T11:05:36.275Z

demo 7799a2e0-38d7-4c75-986e-599f118b906d created: droplet cland-v0-7799a2e0, commit 133ce00862a55cd6abf246a5df248c1da9af2fc4, deadline 2026-10-16T11:54:39.057Z.
