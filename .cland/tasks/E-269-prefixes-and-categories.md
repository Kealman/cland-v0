---
id: E-269
kind: epic
title: Prefixes and categories
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-203
branch: null
created: 2026-10-12T11:35:13.656Z
updated: 2026-10-13T15:11:05.284Z
---

## Goal

Every item shows its kind in its id, and items that belong to no release gather in categories instead of under a label. An epic reads `E-107`, a release `R-228`, a category `C-216`, from one shared counter, so a number stays an item's identity and any prefix still finds it. Tech debt, Bugs, Follow-ups and Ideas become containers at the root beside the releases; agents file into them, and the Coordinator takes their work when the release has nothing unblocked. Today every id starts with `T-`, an epic prefix on a task row reads like another task, and tech debt hangs under the stand-in epic T-216 with a `tech-debt` label.

## Contents

- **§3.1 Id prefixes per kind**, whole: `R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec, `C-` category, from one shared counter, so an item keeps its number when its kind changes; any prefix with a number resolves in the hub, and the CLI, the panels and the `gi` targets accept any prefix and display the kind's own; the migration, one command that renames the item files and rewrites the references in frontmatter (`parent`, `blocked_by`), and nothing else; the titles, with the kind word stripped (`Epic: X` becomes `X`), so the release row reads `R-228 0.1.2 Working with items`.
- **§3.10 Categories, the hub side**: the container kind `category`, a root kind in `[tracker] levels` beside the release; the migration seeds Tech debt (from T-216), Bugs, Follow-ups and Ideas, and `cland task create --kind category` adds more; an item in a category is not unscheduled, since unscheduled means no container at all (§2 and GLOSSARY); agents put an item into a category with `--parent C-n`, and the clauses say when: a bug found aside, tech debt, a follow-up; the `tech-debt` label retires with the migration; idle work: the Coordinator takes category work in rank order when the release has nothing unblocked, from the categories named by `idle_from` in `crew.toml`, and an empty list means never.
- **The items panel's count line** (§3.2, §3.11): at release scope the panel ends with one line counting the categories and their open items.

Not in this epic: the explorer's categories root with its counts, its top three and its idle-work mark ("The explorer and the card"); the release scope that leaves other containers and unscheduled items to the `all` filter ("Status, fields and instrumentation"); the side panel's epic rows ("The explorer and the card").

Choices where the spec is silent:

- The command is `cland task migrate`, with `--dry-run` printing every change and writing nothing. It runs from the root's shell, the human's or the Coordinator's; it is refused while a merge or a tracker write is in flight; a second run reports nothing to do.
- The migration writes each item's own `id` with its kind's prefix together with the file name, as part of the rename. Bodies, comments, the journal, artifacts, topics, branches and worktrees keep their `T-` ids and resolve through any prefix. Tasks keep `T-`, so task branches `t/T-<n>-<slug>`, worktrees and the lanes of plans do not change.
- The kind words stripped are the kinds' own names followed by a colon at the start of a title (`Epic:`, `Release:`, `Spec:`, `Question:`, `Map:`, `Task:`), in any case; `Research:` and other words stay. A release whose title is only its version keeps the version as its title (`Release: v0.1.1` becomes `v0.1.1`).
- The seeding converts T-216 to the category Tech debt (`C-216`) and creates Bugs, Follow-ups and Ideas with the next numbers. The `tech-debt` label leaves every item; an item that carried it with no container moves into Tech debt, and a scheduled one keeps its container.
- `[tracker] levels` takes a list at a level: `levels = [["release", "category"], "epic"]`. The first kind of the first level is the release, which alone carries a version and can be the current release. A category takes the children a release takes, has no version and no status, and closes only when it has no open children, like any container. `cland init` and `cland update` write the new default.
- `idle_from` is a top-level list in `crew.toml`, by item id with any prefix (`idle_from = ["C-216"]`), validated against open categories, shown by `cland crew show` and set by `cland crew set idle_from`. The Coordinator's clause takes the lowest-ranked open, unblocked task of the first named category that has one; an epic in a category waits for promotion.
- The count line reads like `categories 4 · 23 open`; Enter on it switches the panel to the `all` filter until the explorer can take it.

## Tracer-bullet order

1. **The migration, dry run.** `cland task migrate --dry-run` prints every file rename, every rewritten `id`, `parent` and `blocked_by`, every title change, the categories it would seed and the items that would lose the `tech-debt` label, and writes nothing. Demo: on a scratch copy of the live tracker it lists `T-228` becoming `R-228`, `T-107` becoming `E-107`, T-216 becoming the category Tech debt and three new categories, and `git status` stays clean.
2. **Any prefix resolves.** The hub's id parser takes the seven prefixes with a number, and the CLI, the MCP task tools, the plan parser and the `gi` targets accept any of them while every surface displays the kind's own. Demo: `cland task view E-107`, `R-107` and `T-107` show the same epic headed `E-107`, and `gi` on `T-107` in a thread opens it.
3. **The category kind.** `[tracker] levels` takes a root kind beside the release, the parenting rule takes categories on create and link, `cland task create --kind category` works, and unscheduled narrows to items with no parent. Demo: a scratch project creates the category "Docs", files a task into it with `--parent C-n`, and the task is not unscheduled.
4. **The migration.** The command renames, rewrites, retitles, seeds the four categories, retires the `tech-debt` label and reindexes, under the refusals above. Demo: on a scratch copy of the live tracker the run matches its dry run, and a second run reports nothing to do.
5. **Agents file into categories.** The role clauses and the `qa`, `triage` and `to-tickets` skills say when to file with `--parent C-n`, and `idle_from` lands in `crew.toml`, `cland crew show`, `cland crew set` and the Coordinator's next-item rule. Demo: `cland crew set idle_from C-216` shows in `cland crew show`, and the Coordinator's clause states the idle-work rule.
6. **The count line.** The items panel at release scope ends with the categories' count line, and every row shows its kind's prefix. Demo: the headless workbench at `R-228` shows the count line at the bottom and `E-` prefixes in the parent column.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project holding the item files of `dev` from before the migration, QA runs `cland task migrate --dry-run`, then `cland task migrate`, and compares the two; a second run reports nothing to do, and `git diff --stat` shows renames and frontmatter changes only. `cland task view T-107`, `E-107` and `R-107` show the same epic; `cland task list --json` shows every kind with its prefix; `cland task create "Docs" --kind category` makes a category, and a task filed into it with `--parent C-<n>` is not unscheduled. `cland crew set idle_from C-216` shows in `cland crew show`. On the live tracker QA reads the result in the headless workbench: the release row `R-228 0.1.2 Working with items`, the count line at the bottom of the items panel, and `gi` on an old `T-` id in a thread opening the right item.

- [ ] C1. `cland task migrate` renames the item files, writes each item's own id, rewrites `parent` and `blocked_by`, strips the kind word from titles, seeds Tech debt (from T-216), Bugs, Follow-ups and Ideas, and retires the `tech-debt` label; `--dry-run` writes nothing, and a second run reports nothing to do.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C2. One shared counter allocates every new id; any prefix with a number resolves in the hub, the CLI, the MCP tools, the plan parser and the `gi` targets; every surface displays the kind's own prefix.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C3. `category` is a root kind in `[tracker] levels`; the parenting rule holds for it on create and on link; `cland task create --kind category` works.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C4. An item in a category is not unscheduled; unscheduled means no parent, in the hub, the panels and the clauses.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C5. `idle_from` in `crew.toml` is validated, shown by `cland crew show` and set by `cland crew set`; the Coordinator's clause takes category work by rank from the named categories when the release has nothing unblocked, and never with an empty list.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C6. The role clauses and the `qa`, `triage` and `to-tickets` skills file bugs found aside, tech debt and follow-ups with `--parent C-n`.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C7. The items panel at release scope ends with the categories' count line.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f
- [ ] C8. `hub/README.md`, `nvim/README.md`, `docs/agents/issue-tracker.md`, the role clauses and `cland init`'s defaults describe the prefixes, the migration and the categories.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-4 · 2026-10-13T15:10:28.026Z · commit 87b9fbe48427af89307463ca4c1300e8154bde4f

## Dogfooding

The Coordinator runs the migration on the live tracker as soon as its slice merges and commits the renamed files on `dev`: from then on the workbench, the clauses and the build's own tickets use the prefixes, and Tech debt, Bugs, Follow-ups and Ideas collect what the crew finds aside. `idle_from` stays empty during this build, since the two lanes keep the crew busy; the human may name Tech debt.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **ADRs.** 0002 (Tracker files are the source of truth): the prefixes, the kind and the categories live in the item files, and the hub indexes them. 0006 (The hierarchy is the item tree): a category is a node at the root beside the releases, led by the Coordinator.
- **Risks.** About a dozen hub sites and a handful of Neovim sites parse `T-` ids (the item file name, the plan's lanes, subscriptions, worktree names, release trailers). The item files are renamed under open task branches, so the migration runs between merges, and its slice proves that the squash of an older branch leaves the renamed files alone.
- **References.** The prototype on `prototype/explorer` draws the prefixes and resolves any of them (`motions.lua`) and stands in for categories with an open root epic; it is a reference, never merged.
- **Order.** Second in the hub lane, after "Suite spend and Linux portability"; "Status, fields and instrumentation" waits for it, and "The explorer and the card" waits for it too.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.1 Id prefixes per kind, §3.10 Categories, §3.2 and §3.11 (the count line), §2 (Unscheduled narrowed).
- Tickets: T-241 and T-245 (decided, closed into this epic); T-216 (Tech debt, converted by the migration); T-248 (the human's own task, under Tech debt).
- GLOSSARY: Category, Unscheduled, Item, Release.
- ADRs: `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0006-the-hierarchy-is-the-item-tree.md`.
- Branch: `prototype/explorer` (`nvim/EXPLORER-PROTOTYPE.md`).
- Mockups: `docs/design/main-screen/Categories.dc.html`, `Explorer.dc.html`; `screens/v012-categories.png`, `screens/v012-explorer.png`.

## Plan

```yaml
stages:
  - name: the migration, dry run
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-313
  - name: any prefix resolves
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-314
  - name: the category kind
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-315
  - name: migration, filing and the count line
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-316
      - - T-317
      - - T-318
  - name: gaps before QA
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-324
```

## Comments

### coord · 2026-10-13T02:15:28.888Z

Decision D24 (stand-in, 2026-10-13 ~02:20Z, answering the Coordinator's ask 07efe23c): T-269 is unblocked from T-268. The T-268 → T-269 edge ordered the hub lane; it did not reflect a code dependency. T-268's remainder (T-312, then T-282's droplet acceptance run, then its QA demo) is Linux-only and touches no tracker or item code. Conditions: T-269's live-tracker migration lands with a hub restart run by the stand-in, on a green integrated run and an empty queue; the Linux container slot keeps priority for T-312 so T-268 does not stall behind T-269's suites.

### coord · 2026-10-13T02:27:42.266Z

Tickets T-313 to T-318, one per tracer-bullet step (01 dry run, 02 any prefix, 03 category kind, 04 migration, 05 agents and idle_from, 06 count line). Coordinator decisions where the spec is silent:
1. The hub shows the canonical id from the item's kind as soon as T-314 merges (E-107 for an epic whose file still says T-107).
2. A kind edit keeps the number and renames the file and its id to the new prefix.
3. Hub rows stored with T- ids (claims, holds, plans, topic bindings, subscriptions, pending verifications) resolve by number. No rewrite at hub start.
4. A configured kind's prefix is its first letter. A ladder whose letters collide is refused.
5. Tech debt is T-216 in this repo. Elsewhere it is the open root container titled Tech debt, or a new one.
6. Files keep their slug.
7. cland update rewrites levels only when it holds the old default.
8. Categories have no rank and sort by number.
9. The count line follows the epic (categories N · M open), not the mockup.
10. T-318 adds a minimal categories section under the all filter, as the explorer's stand-in.
11. No new tools: roles other than the Coordinator and Aides report a find to their lead with its category.
12. The vendored triage skill keeps its bug and enhancement labels, with a pointer to the category containers.
13. Hub restarts follow the batch rule on green integrated runs. The live migration is run by the Coordinator on dev after T-316 merges, between merges, followed by the stand-in's restart.

### coord · 2026-10-13T14:22:01.875Z

Decision (stand-in, D24, 2026-10-13 ~14:23Z): E-270 is unblocked from E-269. The E-269 → E-270 edge ordered the hub lane, the same reasoning as the E-268 → E-269 unlink. E-270's stage 1 (T-328, T-329, T-333) has no ticket blockers. E-269's QA demo runs on a frozen dev. E-270 work proceeds through review and verification, but merges onto dev wait until E-269's QA verdict is recorded, so that verdict sits on the dev tip. At most four Implementers.

### qa-27 · 2026-10-13T15:10:28.026Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-13-27-4
commit: 87b9fbe48427af89307463ca4c1300e8154bde4f

| Case | Result | Command / observation | Evidence |
| --- | --- | --- | --- |
| M0 | PASS | dev87b9fbe, tracker-only edits; nine merge ancestors; seven children closed/done with merge receipts; five closed stages and matching eight criteria | [M0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M0.txt) |
| M1 | PASS | Node24; machine locks read only, queue empty, live ui.json checksum and last tracker commit captured | [M1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M1.txt) |
| M2 | PASS | node --test hub/test/migrate-plan.test.ts | [M2-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M2-1.txt) |
| M3 | PASS | node --test hub/test/task-migrate.test.ts; Coordinator amendment fb4d069b: six expected tests, including both older-branch squash cases; six pass, zero fail/skip | [M3-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M3-1.txt) |
| M4 | PASS | node --test hub/test/task-prefixes.test.ts | [M4-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M4-1.txt) |
| M5 | PASS | node --test hub/test/tracker-levels.test.ts | [M5-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M5-1.txt) |
| M6 | PASS | node --test hub/test/crew.test.ts | [M6-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M6-1.txt) |
| M7 | PASS | node --test --test-name-pattern=pin category filing hub/test/roles-snapshot.test.ts | [M7-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M7-1.txt) |
| M8 | PASS | node --test --test-name-pattern=filed into Bugs hub/test/skills-qa.test.ts; node --test --test-name-pattern=defer category filing --test-name-pattern=to-spec and to-tickets --test-name-pattern=template names hub/test/skills-tracker.test.ts | [M8-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M8-1.txt), [M8-2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M8-2.txt) |
| M9 | PASS | node --test --test-name-pattern=init writes tracker levels --test-name-pattern=peer levels hub/test/init.test.ts | [M9-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M9-1.txt) |
| M10 | PASS | node --test nvim/test/item-prefixes.test.ts | [M10-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M10-queue.json), [M10-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M10-1.txt) |
| M11 | PASS | node --test --test-name-pattern=release scope ends with live counts --test-name-pattern=category roots follow the configured ladder --test-name-pattern=Enter reaches folded categories --test-name-pattern=category tasks leave the release unscheduled fold nvim/test/vboard.test.ts | [M11-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M11-queue.json), [M11-1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M11-1.txt) |
| M12 | PASS | ITEMS-001 through qa-record.sh, exit0/PASS | [M12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M12.txt), [ITEMS-001.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/ITEMS-001.screen.txt), [ITEMS-001.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/ITEMS-001.state.json) |
| ITEMS-001 | PASS | cland --headless --qa qa/cases/ITEMS-001.lua | [ITEMS-001.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/ITEMS-001.screen.txt), [ITEMS-001.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/ITEMS-001.state.json) |
| M13 | PASS | Init empty tracker, 323 archived files from5d74dbb, local-only origin, budget2/isolated lock/new ladder/visibility override and guard-ok | [M13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M13.txt) |
| M14 | PASS | Scratch budget capped2to1, canonical IDs before rename, expected idle_from/migrate refusals all exit1; hub stopped; clean tracker, base and checksums saved | [M14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M14.txt), [M14-tree.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M14-tree.txt), [M14-db.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M14-db.txt) |
| M15 | PASS | Offline dry-run text and JSON exit0;617 lines and all exact plan counts; clean git and byte-identical tree/database checksums; no migration journal record | [M15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M15.txt), [M15-dry.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M15-dry.txt), [M15-dry.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M15-dry.json) |
| M16 | PASS | Offline migrate exit0 and byte-identical plan; exactly one human migration event with expected counts;326 files and correct category/epic/release renames | [M16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M16.txt), [M16-apply.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M16-apply.json) |
| M17 | PASS | Second apply and dry-run both nothing to do/exit0; tree checksum unchanged; still one migration event and no repair event | [M17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M17.txt), [M17-before.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M17-before.txt) |
| M18 | PASS | 320-file diff:3A238M79R; checker326files/79renamed/238inPlace/6same,exact three categories; no body changes and only expected frontmatter keys; timestamps unchanged | [M18.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M18.txt) |
| M19 | PASS | Restart canonical views identical for five refs; invalid artifact/absent refs exit1;326 items with exact kind counts/bad[];four categories,nine Tech-debt children,no retired label;release version rendering correct | [M19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M19.txt), [M19-view-107.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M19-view-107.txt), [M19-view-E-107.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M19-view-E-107.txt), [M19-view-R-107.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M19-view-R-107.txt), [M19-view-T-107.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M19-view-T-107.txt) |
| M20 | PASS | MCP T107/r107 ->E107,C216 ->C216; four canonical categories;three plan refs byte-identical with expected four stages/lanes | [M20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M20.txt), [M20-plan-E.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M20-plan-E.txt), [M20-plan-T.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M20-plan-T.txt), [M20-plan-n.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M20-plan-n.txt) |
| M21 | PASS | Shared counter327to332, question->spec keeps332; empty category closes, open-child/category-parent/version refusals; epic relinks succeed;332files/six categories | [M21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M21.txt) |
| M22 | PASS | Only parentless T329/S332 watch; category-backed T328/E330 background, with exact parent/status/layer values | [M22.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M22.txt) |
| M23 | PASS | idle_from canonical order/clause live delivery, five exact refusals with unchanged checksum, invalid hand-edit category ignored, reset empty delivers second never-take clause | [M23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M23.txt) |
| M24 | PASS | Init config/crew defaults, roles filing2/report4/idle/subtree rules, tracker migration/categories/prefix docs, triage and skills references all present;grep option helper corrected | [M24.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M24.txt) |
| M25 | PASS | A12 token null; gi on legacy T107/T216 opens canonical E107 closed and C216 open with matching titles/status/view;no search misses | [M25.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M25.txt), [M25-C216.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M25-C216.screen.txt), [M25-E107.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M25-E107.screen.txt) |
| M26 | PASS | Amended fold expectations: count5/11 atlastrow,R228header;canonical rows bad[] allsevenprefixes with epics visible;unscheduled false/true/false/true;Enter all/cursor categories;Docs rank3280then3300 and fold toggles;keys help | [M26.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26.txt), [M26-amended.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-amended.txt), [M26-all.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-all.screen.txt), [M26-amended-docs.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-amended-docs.screen.txt), [M26-amended-toggle.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-amended-toggle.screen.txt), [M26-board.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-board.screen.txt), [M26-docs.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-docs.screen.txt), [M26-keys.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-keys.screen.txt), [M26-unscheduled.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M26-unscheduled.screen.txt) |
| M27 | PASS | Read matching paragraphs: migration/refusals/rollback,prefixes/resolution,parenting/unscheduled,idle_from,counts/Enter/gi;root/template tracker and triage,skills patches,role filing2/report4 and idle/subtree rules | [M27.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M27.txt) |
| M28 | PASS | Coordinator migration confirmation; eefc0ef ancestor,tag/base6f0bbe1,backup present,onlyR228file;canonical live kinds,bad[],four categories,no retired label; external ui checksum change authorized baseline amendment | [M28.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M28.txt) |
| M29 | PASS | PartA workbench/hub stopped; PartB connected at mirrorroot, mark_read guard patched true/reads1; hub-start command false; existing-workbench listings captured | [M29.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M29.txt), [M29-existing-workbenches.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M29-existing-workbenches.txt), [M29-all-nvim-processes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M29-all-nvim-processes.txt) |
| M30 | PASS | Live board header,topbar chip,and all-tree R228 row each read R-228 0.1.2 Working with items with version once | [M30.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M30.txt), [M30-all.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M30-all.screen.txt), [M30-board.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M30-board.screen.txt) |
| M31 | PASS | Live last-content categories4/9 equals contemporaneous CLI count;rowprefix bad[] | [M31.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M31.txt), [M31-count.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M31-count.screen.txt) |
| M32 | PASS | General T-19 token; search and gi opened E-19 item closed; root task view agrees; first candidate passed | [M32.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M32.txt), [M32-gi.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M32-gi.screen.txt) |
| M33 | PASS | Guard patched true,swallowed1read; normal nvim exit; mirror only symlink/ui.json;live checksum equals M28;window audit only task.plan11 and task.view5 | [M33.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M33.txt) |
| M34 | PASS | Both nvim processes exited normally,scratch hub stopped,drivers/tails terminated;no run process remains;mirror symlink removed;captures retained then six exact owned scratch dirs removed without force;machine-lock grep empty,queue empty,only crew lock timestamp changes | [M34a-hub-stop.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M34a-hub-stop.txt), [M34a-driver-stop.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M34a-driver-stop.txt), [M34b-driver-stop.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M34b-driver-stop.txt), [M34b-processes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M34b-processes.txt), [M34b-root.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M34b-root.txt), [M34b-machine-lock-scan.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4/M34b-machine-lock-scan.txt) |

Findings ranked by severity: high — none; medium — none; low — none.

QA clear E-269 (legacy T-269). Run `qa-2026-10-13-27-4`, tested dev commit `87b9fbe48427af89307463ca4c1300e8154bde4f`. All 35 checks M0–M34 and catalogue case ITEMS-001 passed. M30 is included despite having no criterion. The 11 serial single-file test commands passed 58 tests, with zero failures or skips. No full suite was submitted.

The final source diff against the start build is empty, and dev remained at the tested SHA. Seven children were closed/done with merge receipts; all five plan stages were closed. Criteria C1–C8 are all covered and will be verified in this run.

| Criterion | Passing checks |
| --- | --- |
| C1 | M2, M3, M14–M19 |
| C2 | M4, M10, M12, M14, M19–M21, M25, M26, M28, M32 |
| C3 | M5, M9, M21, M24 |
| C4 | M11, M22, M26, M27 |
| C5 | M6, M7, M23 |
| C6 | M7, M8, M24, M27 |
| C7 | M11, M26, M31 |
| C8 | M9, M24, M27 |

Queue and isolation: before M10, the read-only queue check found impl-329 holding the machine. QA waited approximately 11.5 minutes until the queue was empty at 14:51Z. The scratch hub used its own `/private/tmp/qa-T-269-locks/suite.lock`; budget 2 was capped to 1. The root machine lock was only listed. End queue: no holder or waiters. Lock-directory timestamps changed with the crew run; the scratch logs contain no machine-lock path.

Part B audit window: 2026-10-13 15:01:16–15:06:07 UTC (17:01:16–17:06:07 Europe/Belgrade). The mirror connected with the read-mark guard active, and one mark was swallowed. The guarded audit window contains five task.view and eleven task.plan calls, with no write calls. The live ui.json checksum stayed at M28’s `cb2900d392d1cc0824bba2ca1d763c024f3a0d72`. The M1→M28 change predates QA’s live connection and was attributed to the human workbench by the Coordinator, as quoted below. M29’s exact ps pattern itself returned no other workbench; the verdict does not rely on that listing to excuse any write.

Cleanup: both workbenches exited normally; scratch hub, driver processes and tails stopped; the mirror symlink and all six owned scratch directories were removed after capture. The force-removal command was rejected by automatic review; targeted non-force removal of the six explicitly inspected directories succeeded. The driver shell exited. No run process remains. Evidence was scanned for DigitalOcean token prefixes without exposing token values; no matches.

Observation helpers: commands and Lua helpers are preserved under helpers/, including the brief’s original fenced blocks. A persistent shell kept the driver processes alive; response readers waited for each new response instead of assuming a fixed one-second delay. These do not change product assertions. No product source was edited.

Brief amendments authorized by the Coordinator:

Coordinator amendment fb4d069b-9232-4816-b1c4-50b746f99399, topic-203, 2026-10-13T14:38:11.299Z:

"This is a brief error. M3 expects six: the four named tests, plus the two squash cases T-316 added for its C5, 'an older task branch lands after migration' with container edit false and true. Six passing, zero failing and zero skipped is a PASS."

M3 ran once: six pass, zero fail, zero skip. The Coordinator will amend the brief after this verdict.

Coordinator amendment 7af2223b-eef1-4f10-a90b-db5bf8f5a9d7, topic-203, 2026-10-13T14:41:06.698Z:

"The `and ... or` idiom turns a false into the fallback, so the helper is wrong. Use your explicit if/else, which keeps false. It changes only the observation helper."

Before M26 execution, unsched.lua was changed to `if it then out[id] = items.unscheduled(it) else out[id] = vim.NIL end`, preserving the product predicate’s false result. No product code changed.

Coordinator amendment aba8d483-06f3-4721-bd65-fa52fc9e5dde, topic-203, 2026-10-13T14:46:53.054Z:

"Yes, insert `--` before the pattern. It is a typo in the observation helper, and the assertion stays the same."

M24’s initgreps uses `grep -n -- '--parent C-<n>'` to prevent interpreting the literal as an option. The Coordinator also pre-approved later helper-only corrections that preserve the intended observation; each must be noted, and expectation or product-behaviour changes still need a decision.

Coordinator amendment c76d61e6-ba85-4af9-9247-795f975b3625, topic-203, 2026-10-13T14:57:59.069Z:

"The brief assumed a fold state that `zR` does not leave, because `zR` unfolds categories too, which is reasonable."

M26(b) checks canonical row prefixes with epic rows visible; M26(d/e) judges the actual fold state. The original board had prefixes S,R,T and bad=[]; after all/zR, 321 rows covered all seven kind prefixes with bad=[]. Docs was already expanded after the original zR, showing T-328 then E-330; the prescribed za collapsed it. Supplementary all/zR and two za toggles restore and show the same rank order. Original and amended screens remain preserved.

Coordinator amendment a4d345f3-9007-4901-8af0-b7f8337841a3, topic-203, 2026-10-13T15:00:39.572Z:

"Record the change between M1 and M28 as an external write by the human’s workbench. For no-write, judge against M28’s checksum and the guarded audit window. If the checksum changes again during Part B, decide by the audit lines. Only writes by your client in the window are a FAIL."

Before Part B started, live ui.json changed from M1’s 97fa8b38d374f1679a2bd1333234b0718cb48d96 to M28’s cb2900d392d1cc0824bba2ca1d763c024f3a0d72. The Coordinator attributed this to the human’s workbench. QA had not connected any live workbench yet; Part A used its own scratch root.


Local times of migration checks (Europe/Belgrade; commands also preserve raw output):

- M14: recorded 2026-10-13T16:53:21+02:00
- M15: recorded 2026-10-13T16:53:34+02:00
- M16: recorded 2026-10-13T16:53:48+02:00
- M17: recorded 2026-10-13T16:53:59+02:00
- M18: recorded 2026-10-13T16:54:24+02:00
- M19: recorded 2026-10-13T16:54:49+02:00

Evidence artifact: A-1979, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1979-e-269-qa-demo-all-36-checks-pass-at-87b9fbe-qa-2026-10-13-27-4. Criterion marks: verified C1,C2,C3,C4,C5,C6,C7,C8 in this run; no failed marks.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-13T15:11:05.284Z

Closed on QA's clear demo (qa-2026-10-13-27-4 at 87b9fbe, evidence A-1979): 36 checks pass, C1 to C8 verified, no findings. The run made five brief amendments, all to observation helpers or fold and baseline readings, none to expectations of product behaviour.
