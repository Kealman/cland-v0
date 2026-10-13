---
id: E-269
kind: epic
title: Prefixes and categories
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T11:35:13.656Z
updated: 2026-10-13T12:05:53.803Z
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

- [ ] `cland task migrate` renames the item files, writes each item's own id, rewrites `parent` and `blocked_by`, strips the kind word from titles, seeds Tech debt (from T-216), Bugs, Follow-ups and Ideas, and retires the `tech-debt` label; `--dry-run` writes nothing, and a second run reports nothing to do.
- [ ] One shared counter allocates every new id; any prefix with a number resolves in the hub, the CLI, the MCP tools, the plan parser and the `gi` targets; every surface displays the kind's own prefix.
- [ ] `category` is a root kind in `[tracker] levels`; the parenting rule holds for it on create and on link; `cland task create --kind category` works.
- [ ] An item in a category is not unscheduled; unscheduled means no parent, in the hub, the panels and the clauses.
- [ ] `idle_from` in `crew.toml` is validated, shown by `cland crew show` and set by `cland crew set`; the Coordinator's clause takes category work by rank from the named categories when the release has nothing unblocked, and never with an empty list.
- [ ] The role clauses and the `qa`, `triage` and `to-tickets` skills file bugs found aside, tech debt and follow-ups with `--parent C-n`.
- [ ] The items panel at release scope ends with the categories' count line.
- [ ] `hub/README.md`, `nvim/README.md`, `docs/agents/issue-tracker.md`, the role clauses and `cland init`'s defaults describe the prefixes, the migration and the categories.

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
