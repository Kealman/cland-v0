# Issue tracker: cland

Issues, specs and tickets for this repo live as **items** in cland's own tracker: one Markdown file per item in `.cland/tasks/` (`<id>-<slug>.md`), committed with the work. Use the `cland task` CLI for every operation; in this repo run it as `node hub/bin/cland.ts task …` from the repo root (or put `hub/bin/cland.ts` on PATH as `cland`). Ordinary commands talk to the project's hub (the offline `task migrate` command requires it stopped), so a hub must be running: if a command says `no hub running`, run `node hub/bin/cland.ts hub start`. Don't write item files by hand when a command can do it.

From a linked Git worktree, the CLI follows its `.git` file to Git's common directory and finds the main worktree's `.cland/hub.json`, even when the worktree is outside the project folder. A copied `.cland/` without `hub.json` does not become a separate project. `CLAND_HUB_FILE`, when set by a launched session or explicitly, overrides discovery from any directory. All tracker writes go through that hub into its root's `.cland/tasks` — the main worktree's item files, never the working session's worktree copy. `cland hub start` starts the cwd's resolved project hub and does not use this override.

- The number is an item's identity; the displayed id uses its kind's prefix: `R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec and `C-` category. Configured containers use their first letter, and colliding container letters within the configured ladder are refused. Every item command accepts any recognized prefix in either case, or a bare number: `T-107`, `R-107`, `e-107` and `107` find the same epic and return `E-107`. Unknown numbers and unrelated prefixes such as `A-` are refused. There is no `#<n>` auto-linking. Its file is `.item.path` in `cland task view T-<n> --json`, relative to the repo root.
- A task has `status`: `backlog` (the creation default), `planned`, `in progress`, `review`, `qa`, `ready` or `done`. Containers, questions, specs and maps have none. Status lives in frontmatter and is returned by view, list and the existing `task` event; the UI reads it. A done task is closed; every other status is open. Once an epic plan is accepted and approval permits work, the hub sets its current stage's open backlog tasks to `planned`, including blocked tasks, and advances to the next stage after its merges and required stage QA. Each task moves once per stage entry; hand statuses stay. Without a plan, the Coordinator or the human sets `planned` by hand.
- The hub persists status through the tracker queue: an Implementer's new claim and a not-clear verdict set `in progress`; close and merge set `done`; reopen without an explicit status sets `backlog`. Existing tasks gain a status when indexed: a closed task is `done`, an open claimed task is `in progress`, and another open task is `backlog`. Hand-edited status and state are re-indexed and kept consistent.
- The Coordinator, the human and an Aide may set any status with `cland task edit T-n --status <status>` or MCP `task.edit`'s `status`. Setting `done` closes the task and releases its claim; a different status reopens it at that status. An Implementer may set only `review` on its own live claimed item, with no other fields in that edit, when handing it over. Assignment alone does not grant this right. The permission table refuses other sessions, even if their role grants the whole `task.edit` tool. A simultaneous `--state` and `--status` must agree. `ready` uses the merge gate’s own verdict evaluation. During pending patch-id freshness the last settled status remains; unchanged patches keep ready, changed or failed checks return it to in progress. Reviewer and QA take a separate `cland task hold T-n` (or MCP `task.hold`) beside the Implementer claim, setting review or qa; `--release`, their verdict, stop/death or item close releases the hold. Holds appear in view/list and task events.
- New items use the kind's prefix in their file name and frontmatter id, from one shared counter. A kind edit keeps the number and file slug and renames both the file prefix and frontmatter id. Legacy files are readable before migration: their canonical ids, parent and blocking references already show the target kinds' prefixes. Two files with one number produce a visible warning and a `task-duplicate-number` log record; the file whose prefix matches its kind wins.
- An item's `kind` is `release`, `category`, `epic`, `spec`, `task`, `question` or `map` (default `task`).
- Every `cland task` command takes `--json`. Read results with `--json` and `jq`; the plain output is for humans.
- UI frames may request `task.list` with `projection: "summary"` and `state: "open"` or `"closed"`. This omits bodies, comments, verdict history, plans, verification and index bookkeeping; it includes criteria counts, hub-resolved `open_blockers` and the latest verdict per kind with its original round. Neovim loads open rows and their ancestor chain first; fully closed containers and tasks use bounded parent pages on expansion/search, and card detail through `task.view`. Container summaries and task events also carry `child_counts` (`total`, `done`, `statuses`, `work`) from the complete index before filtering. Progress counts direct containers for releases and direct tasks otherwise; release work counts descendant tasks. Parent events update counts after child changes without a list re-read. Open summaries also carry bounded verdict reasons, Decision previews and agents' text outlines. Open snapshots and deltas also include created/branch/regression/follows and a compact latest verify receipt (result, head, executor, state, finished and cached flag); ordinary summary task.list replies omit those transport-only fields to keep the first payload lean. Closed rows fetch these card facts and original verdict round/scope through bounded by-id summary pages. Planned containers retain their stage states and complete merged/total/status counts even when closed. The default list and CLI `task list --json` retain their fields and include these additive counts. See `hub/README.md` for the retained ordering fields.
- You act as `$CLAND_SESSION_NAME` (role `$CLAND_ROLE`) when cland launched your session, else as `human`. `--as <name> [--role <r>]` overrides. "Yourself" below means `${CLAND_SESSION_NAME:-human}`.

The container ladder is configured in `.cland/config.toml`: `[tracker] levels = [["release", "category"], "epic"]`. A string is a level of one kind, so the old flat form still parses. Kinds at a level take any kind at the immediately preceding level as parent; leaves take any container. The first kind of the first level alone owns release versions and current-release selection. Other root kinds are led by the Coordinator. Kind names must be unique, exclude leaves and map, and have distinct first-letter prefixes. `cland init` writes the new default; `cland update` upgrades only the old default `["release", "epic"]` and reports custom ladders as kept. Restart the hub to apply a ladder change.

To open an item topic from a shell, run `cland topic create "<title>" --item T-<n> [--json]`. It uses the same `topic.create` frame and role rules as the tool: an Implementer may open only its own item's topic. The hub writes both the topic binding and the item's `topic` field. If the item already has a topic, use the existing topic named by the refusal. The human and unrestricted topic creators may omit `--item` for an unbound topic. Session shell identity takes precedence over `--as`.

## Conflict capture retention

Finalized `<item>.md.<uuid>.conflict` captures are retained for seven days since their latest modification, inode metadata change or creation (the latest of mtime, ctime and birthtime); exactly seven days is still retained. Using the latest timestamp protects a freshly captured or promoted editor source with an old item mtime. The hub schedules asynchronous pruning after tracker startup/recovery and once per hour after each pass, outside the task request queue. Only regular files with that exact capture shape are eligible; canonical `<item>.md` files, symlinks, directories, `.tmp` sources and capture-intent markers are never deleted by retention. Sources named by active capture intents are preserved; malformed/unreadable intents stop that pass conservatively, with failures logged and retried on the next hourly pass. `cland doctor` reports a `tracker conflicts` row with the number of live regular captures and the filenames whose bytes differ from their current item file (including a missing item). It warns when any differ, and never prunes, including with `--fix`. Recover differing bytes before they expire; copy any source needed for longer outside `.cland/tasks`.

## Task size, Summary and regressions

Every newly filed task needs `--size XS|S|M|L`, an ex-ante size class assigned by whoever files it. Other kinds take no size. The CLI and MCP refuse a task without it: `a task needs a size: XS, S, M or L`. `task create` and `task edit` refuse XL with instructions to split the task; existing XL files remain readable. Split L tasks into 2–3 M tasks when planning. To keep an L task, the Coordinator records a reason with `cland task plan set <epic> --file plan.yaml --allow-large T-n=reason`, repeated for each L task. CLI and MCP (`allow_large: { "T-n": "reason" }`) append these decisions to the plan-history reason, retained across restarts. Every set needs the reasons again. `cland task edit T-<n> --size L` changes the class; it cannot clear it. Converting away from task removes task-only fields, like status. Existing unsized files remain readable, and GitHub imports and hub-internal creates remain sizeless.

Write a `## Summary` of one to three sentences in each new item's body. When a task reworks landed work, file it with `--regression-of T-<landed>`; the target must be a closed task with a landing receipt on dev. Any recognized prefix or bare number resolves, and reads show the canonical target id. `cland task link T-<n> --regression-of T-<landed>` sets the link; `cland task link T-<n> --regression-of none` clears it. Non-task, open, unlanded and self targets are refused. Both fields live in frontmatter and reach list, view and task events through the index.

## Backfilling task sizes

The Coordinator runs this during the hub restart carrying the size feature, using the migration safeguards below: a git tag, a stopped-hub `hub.db` copy, dry-run count review, idempotent rerun and old-id resolution. Prepare a JSON file mapping ids to classes, then run `cland task migrate --sizes sizes.json --dry-run --json`, inspect `sizes` and `unresolved`, and run `cland task migrate --sizes sizes.json --json`. A second apply reports nothing to do; unresolved items may remain.

The map contains explicit human or Coordinator decisions, with no title, label or effort heuristic. Select open tasks under the current release and the categories. The migration fills only missing sizes on open tasks; it preserves existing sizes and skips closed tasks. Unsized open tasks without an assignment stay unsized and appear as unresolved. Unknown ids, non-task assignments, duplicate aliases and invalid classes refuse before any write. The usual root-shell, hub-stopped, lock and unfinished-write checks apply.

For E-270 the suggested assignments are `{"T-328":"M","T-329":"S","T-330":"L","T-331":"L","T-332":"M","T-333":"M","T-334":"S"}`. Closed tickets are skipped. Other tasks need their author's decision. Test on a scratch copy; apply to the live tracker only in the Coordinator's maintenance window. Restart the hub and relaunch all role sessions afterward, the Coordinator included, to load the schemas and clauses.

## Migrating prefixes and categories

From the project root's human shell or the Coordinator's session, with the hub stopped, run `cland task migrate --dry-run` to inspect the plan, then `cland task migrate` to apply it. Add `--json` for the plan object; preview and apply share the planner and return the same format. It works directly on item files and `hub.db`, holding the hub startup lock until completion. A running hub refuses both commands; its `task.migrate` frame also refuses. No MCP migration tool is added.

The plan lists file renames preserving existing slugs, each item's kind prefix, rewritten `parent` and `blocked_by`, title changes and unresolved references left as written. It strips leading kind words such as `Epic:`, converts the open root Tech debt container to a category (or seeds it), seeds Bugs, Follow-ups and Ideas on the shared counter, retires every `tech-debt` label and moves unparented labelled items into Tech debt. Existing open root categories are reused by their cleaned titles.

The `closed` part backfills closed items missing their frontmatter time. Sources, in order: the landing receipt's `merged_at`, the latest journal `task-written` record with `op: close`, then the receipt commit's Git committer time. Preview names each source as `closed T-n: <ISO time> (receipt | journal | commit)`. Existing `closed` fields stay untouched; items without a valid source remain under `unresolved`, including on a nothing-to-do rerun. A closing-time-only apply changes only the `closed` frontmatter line, preserving the body, comments and other timestamps. The live backfill uses the same tag, database backup, preview/count check, idempotent rerun and old-id checks as the prefix migration, in the restart window that carries its merge.

Apply renames each file before atomically replacing its frontmatter, so interruption leaves one file per number. References-only changes are written in place. It rebuilds the affected index and records one `task-migrated` journal event with counts and caller through the log tap. Preview writes no item, index or journal record. A clean second run reports `nothing to do` and writes nothing; a partially migrated tree gets only its remaining changes. If the last file was published before an interrupted index write, apply repairs the derived index even with an empty file plan, leaving every item file unchanged. Preview never repairs the index. A pending temporary write or criterion capture must be recovered before retrying.

Both modes refuse a linked worktree or subdirectory, any caller other than the human or Coordinator, an on-disk territory/merge lock, tracker lock or temporary write, a pending criterion capture, an unfinished merge receipt, and pending `cland sync` or `cland release` recovery. A ladder without root `category` refuses with instructions to run `cland update` and restart the hub. These are on-disk checks, since the migration requires the serving hub to be stopped.

Bodies, comments, existing timestamps, journal history, artifacts, topic bindings, branches and worktrees keep their original bytes and ids. Task filenames keep `T-`. Every old `T-<n>` reference keeps resolving by number after restart, including CLI and MCP task operations, topic bindings, inbox and journal references and `gi` in a thread. Older task branches can still squash-merge; an edit to a renamed container follows Git rename detection or refuses with `merge-conflict`, rather than creating a second item file.

### Live-tracker procedure and rollback

The Coordinator performs the live migration on `dev` after this slice merges, with a green integrated verification and an empty suite queue. Implementers use temporary projects and scratch copies only.

1. Run `cland update` to provision the root category ladder. Arrange the stand-in's maintenance window and stop the hub (`cland hub stop`).
2. On the root's clean `dev`, create `git tag pre-migration` and copy `.cland/hub.db` beside it as `.cland/hub.db.pre-migration`. Stop must have completed before the copy; keep the tag and database backup until acceptance.
3. Run `cland task migrate --dry-run --json` and keep its output as an artifact after restart. Inspect the plan, then run `cland task migrate --json` and compare it with the preview. Run once more to confirm `nothing to do`.
4. Restart the hub on the migrated tree (`cland hub start`) and relaunch every role session: their previously delivered clauses and briefs carry the old ids. Check old ids resolve and the category tree agrees with the plan.
5. Commit the renamed item files on `dev` and publish with `cland push`.

To roll back within minutes, stop the restarted hub and all role sessions. Preserve any later work first. Restore the pre-migration tracker tree with `git restore --source=pre-migration --staged --worktree -- .cland/tasks` (this also removes newly seeded tracked files; remove any still-untracked migration-created category files named by the kept plan). Restore `.cland/hub.db.pre-migration` over `.cland/hub.db` and remove obsolete `.cland/hub.db-wal` and `.cland/hub.db-shm` only while the hub is stopped. Keep the append-only journal. Commit the restored tracker if the migration was committed, restart the hub and relaunch roles. The tag restores the item files; the database copy restores hub state and its index together.


## GitHub Issues: retired

The items were imported from this repo's GitHub Issues (`Kealman/cland-v0`) with `cland task import-github --all` (#38). The import gave each of issues #1–#42 the item of the same number (`T-23` is #23), so the `#<n>` references in the imported bodies and comments name the same items. An imported item carries `github: {repo, number, url}` in its frontmatter (`.item.github` in `view --json`).

The GitHub Issues served as the human-facing mirror until v0 was done. At the human's request, every open issue was closed on 2026-10-09, after the v0.0.1 release, and the mirror is retired:

- The tracker is the only source of truth. Create, close, relabel and re-link items only with `cland task`; make no matching change on GitHub.
- Do not run `cland task import-github` on this repo. A refresh rewrites state, labels and edges from the issues, so it would close items that are still open here, such as `T-19`.
- Create new work as items only, never as GitHub issues.

## Conventions

- **Create an item**: `cland task create "<title>" --kind <kind> --label <l> --body-file - <<'EOF'` … `EOF`. `--label` repeats; tasks also require `--size XS|S|M|L`. `--parent T-<p>` and `--blocked-by T-<b>` (repeats) set the edges at creation. The new id is `.item.id` in the `--json` result (`created T-<n>  <path>` in plain output).
- **Plan a release**: `cland task create "v0.1" --kind release --version 0.1.0 --body-file <file>`. `version` is semver without the `v`, optional at creation; `cland task edit T-<n> --version 0.1.0` sets it later (`--version none` clears it). The body holds the goal and `## Notes`; creation and kind conversion add an empty Notes section if absent. A malformed version, or a version on another kind, is refused.
- **Read an item**: `cland task view T-<n> --json`: frontmatter fields, the root-to-item `.item.ancestry` (entries with `id`, `kind`, `title`, including the item), `.item.body`, `.item.comments` (`author`, `at`, `text`), `.item.claim`. The plain header joins the ancestry with `›`; `.item.path` stays the file path. `closed`, when present, is its frontmatter closing time: hub close, merge and edits to closed/done set it, reopen clears it, and a hand close without it stays unresolved. `criteriaCounts` gives exclusive total/done/verified/stale/failed counts beside the full `criteria` array. A task's `verify` is the latest job matching its number or branch, with id, state, result, head, finished time, artifact and optional cache provenance.
- **List items**: `cland task list --state open --json`, with `--label <l>` (repeats; every label must match), `--kind <k>`, `--assignee <a>`, `--under T-<p>`. `--under` returns every descendant (excluding the named root), including those under closed ancestors, before the other filters; an unknown root is refused. Drop `--state` for open and closed items. Results sort by effective rank, then numeric id. An absent rank is the numeric id times ten, so new and legacy items retain creation order without a rewrite. Views, summaries and `task` events carry `rank_set: true` only when the file names an explicit rank (including a `task.rank` write); otherwise the field is omitted. A summary carries indexed frontmatter fields; it omits `github` (the imported issue reference), `criterion_seq` and `plan_approval` (internal bookkeeping), as well as the body and comments. Use `view` to read those fields and the full item. Filter further with `jq`, for example items with no label: `cland task list --state open --json | jq '[.items[] | select(.labels == [])]'`. Summaries and `task` events carry `closed`, `criteria: {total, done, verified, stale, failed}` and, for tasks, `verify`, without a view per row. Failed marks win over current verification, stale verification, then done; checkboxes alone are open. Verification counts only at the exact branch tip, the landed receipt tip after branch cleanup, or `dev` for planning containers. Verify-only updates have no event text or extra session delivery.
- **Rank siblings**: `cland task rank T-n --top`, `--before T-m` or `--after T-m` (exactly one), mirrored by MCP `task.rank` with `id` and `top`, `before` or `after`. Tasks and configured containers below the root level may carry an explicit safe integer `rank`; a new item has no explicit rank. The reference must have the same parent (including a null parent). An item already in the requested position is unchanged. Sparse moves write only the moved item; dense intervals scan outward once on each side and renumber only the smaller feasible window. The response names `changed` ids and ordered `siblings`. Ranking uses the tracker queue; a sibling changed during its file awaits refuses the stale move. The default Coordinator chooses the lowest-ranked unblocked `planned` task in the current release, the open top-level container with the lowest semver version. Move an item to the top to prioritize it.
- **Make an item a sub-item of a parent**: `--parent T-<p>` on `create`, or `cland task link T-<c> --parent T-<p>` afterwards (`--parent none` clears it). The hub enforces the default parenting rule on create and link: a release or category has no parent; an epic takes a release, a category or none; a leaf (`task`, `question`, `spec`) takes any container or none. A category has no version, status or rank, and closes only with no open children; it needs no planning-level QA verdict. Create one with `cland task create "Docs" --kind category` and file work into it with `--parent C-n`. Unscheduled means no parent at all: items in a category are not unscheduled. A map stays outside the ladder and has no parent; it takes `question` and `task` children and refuses containers and other leaves. Kind edits also refuse invalid parent/child relationships. Existing imported/hand-edited trees remain readable; unrelated edits do not rewrite them. The direct children of a parent: `cland task list --json | jq '[.items[] | select(.parent == "T-<p>")]'`.
- **Blocking edges**: native. `--blocked-by T-<b>` on `create`, or `cland task link T-<n> --blocked-by T-<b>` afterwards (repeats; adds to the existing edges); `--unblock T-<b>` removes one. An item is unblocked when every item in its `blocked_by` is closed.
- **Comment on an item**: `cland task comment T-<n> --body-file - <<'EOF'` … `EOF`, or `cland task comment T-<n> "<text>"` for one line. Review verdicts require `--scope full|delta|evidence` (MCP `scope`); QA carries none.
- **Apply / remove labels**: `cland task edit T-<n> --add-label <l> --remove-label <l>` (each repeats). `--label` instead replaces the whole set. Labels need no setup: any string is a label.
- **Assign**: `cland task edit T-<n> --assignee <name>`; `--assignee none` clears it.
- **Close**: `cland task close T-<n> --comment "<text>"`. An epic (the second configured level, `tracker.levels[1]`) also needs a current clear hub-written QA verdict on the exact `dev` tip, with every criterion verified by QA in that run, and no open children (D16). Refusals name missing verdicts or criterion ids. The human shell may skip epic QA evidence with `--override "reason"`; the journal records `epic-close-overridden`, the reason and unmet criteria. Open children still refuse. Releases keep their own path through `cland release --item`. Reopen an unmerged item with `cland task edit T-<n> --state open`.

### After a task merges

A landed task is complete. Reopening it through `task edit --state open`, a non-done status, or a failing criterion/verdict is refused. Create a follow-up with `cland task create "<title>" --parent T-<epic-or-release>` (omit the parent for unscheduled work), and reference the merged task in its body. Claiming the follow-up starts its own branch and worktree from current `dev`. A prepared merge receipt that fully rolled back does not count as a landing.

Posting in a merged task's topic may reopen the discussion; it leaves the task and its merge complete and does not block `cland push` or `cland sync`. Unfinished checkout recovery or item/claim follow-ups still require `cland merge T-<n>` before publication.

Re-run `cland merge T-<n>` to clean a stale worktree of a closed, landed task. It removes the original merged branch or a recreated branch whose tip is fully contained in the recorded integration base (`dev`). It keeps worktrees with uncommitted changes, unmerged commits, an unrelated branch, or a session inside. Cleanup never lands another squash or deletes another worktree. Move any unmerged work into a follow-up task before retrying cleanup.

## Review before verification

Workbench clients read hub-computed summaries and roll-ups from snapshots and
task deltas. Open items include `summary.text`; closed items retain provenance
and facts and fetch full summaries with `task.list` frames carrying
`projection: "summary", ids: [...]` (at most 100). Repeat with the returned
`remaining` ids; each reply stays within 256 KiB. By-id pages also include the
compact tree row (including canonical id and parent), allowing links to load
missing items and their ancestors without fetching bodies. This uses the existing read
permission and adds no CLI flag. See hub/README.md, the summary projection, for
field definitions and incremental invalidation. Full bodies and acceptance
criteria still require `task.view` when reviewing an item.

`send.to` accepts one recipient string or an array of strings (`string | string[]`); `to: "reviewer"` and `to: ["reviewer"]` route identically. Omit `to` or use `[]` for the human. Malformed values return `to must be a string or an array of strings` before permission checks.

Before requesting review, the Implementer fetches and merges `origin/dev`, commits and pushes its head, sets the claimed item to `review`, and sends `review request T-<n>` to `reviewer` in its topic. After a clear source verdict it runs `cland verify` at the exact reviewed head. A fix or later merge that changes the head needs a new source review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. The Reviewer leaves run-dependent criteria unverified until that same-head result arrives, then records the final verdict. The merge gate and verdict rules are unchanged; see [test guidance](tests.md) and [review and QA](../review-and-qa.md).

## Acceptance criteria

Criteria live under `## Acceptance criteria` in a task or configured container body. Containers also recognize checkboxes under `## Definition of done`; both sections share stable ids. `task view --json` returns `item.criteria` with each criterion's stable id, text, checkbox and marks. Old checkboxes have no ids until the first criterion operation assigns them in list order. `criterion_seq` in frontmatter retains the highest allocated number, including removed criteria; keep it when editing by hand. Ids are never reused.

Use MCP `task.criterion` with `{id, op, criterion?, text?, note?, run?}`, or these CLI commands:

```sh
cland task criterion T-n done C1
cland task criterion T-n verify C1 --run rev-0117
cland task criterion T-n fail C1 --note "Reconnect loses the clause"
cland task criterion T-n add "The clause arrives again on reconnect"
cland task criterion T-n edit C1 --text "The clause survives every reconnect"
cland task criterion T-n remove C1
```

The claiming Implementer marks every criterion done before requesting the final review. Ready requires done marks as well as current verification and clear verdicts. When only done marks are missing, the hub sends the claimant one notice in the item topic naming each missing criterion and its `cland task criterion T-n done C<n>` command. For the same claimant it repeats only when the set changes; the last set survives hub restart. A replacement claimant receives its own first notice.

`done` is for the live claimant Implementer, the Coordinator, an Aide or the human; assignment alone is insufficient. A human CLI caller may use an unknown `--as` name, such as alice, and retains human done/manage rights; known session names keep their session permissions. `verify` and `fail` are for Reviewer or QA. `add`, `edit` and `remove` are for the Coordinator, an Aide or the human. Verify needs a run id without whitespace; fail needs a nonempty, single-line note. An Aide needs no claim for done or criterion management and cannot verify or fail.

Marks are sub-items, such as `  - done: impl-57 · 2026-10-09T10:00Z` or `  - verified: qa-12 [qa] · run q-0117 · 2026-10-09T11:00Z`. Done checks the checkbox. Fail unchecks it, replaces the current done and verification marks with the failure note, and reopens the item (a task at `in progress`, a container without a status). Marking it done again clears the failure; it needs fresh verification. Text edits preserve the existing marks. Verification writes append ` · commit <full-sha>` to the mark, using the verdict's explicit commit or the item's branch tip (planning containers use `dev`). Standalone verify resolves the same build. `task view --json` annotates each verified mark with `current`: it counts only at that exact head, including after an empty commit or an unchanged rebase. Done marks stay in place. Legacy verification marks without a commit remain readable but are stale until verified again; the plain view lists stale marks. Malformed mark sub-items or duplicate ids refuse a write until the source is fixed. Add is refused if the insertion point is inside an unclosed Markdown code fence.

Each successful criterion operation emits a subscribed `task` event with `criterion marked`, the task id, criterion id and operation/mark. Writes use the tracker queue and recheck permission before publication. A concurrent hand save refuses a stale write with a retry reason. Criterion and automatic planned-status writes guard publication with a temporary source; after validating the original file handle, successful writes remove that source and leave no `.conflict` file. A detected concurrent edit retains the source at the `.conflict` path named in the error; recover that source before retrying. A newer save at the task path always wins. The guard covers saves observed during publication, through the final source check; it does not retain old editor inodes indefinitely after a completed write. Recovery files are not tracker items, do not emit task events, and are ignored by Git in provisioned projects. An atomic capture-intent file lets startup restore a missing live item from its temporary source before indexing after a process crash; older intents naming `.conflict` sources remain supported. Existing live files win over recovery sources. Recovery and I/O-error cleanup validate captured bytes against the original hash before deleting them: changed bytes become `.conflict`; an unreadable or unvalidated source is retained for recovery rather than guessed clean. Existing conflict retention and pruning are separate from normal write cleanup.

Verdicts can include criteria in the same write: `cland task comment T-n "checked" --verdict review --scope full --result clear --run rev-1 --verified C1,C3` (or `--verified all`); a not-clear verdict takes repeatable `--failed "C2=reason"`. MCP `task.comment` takes `verified: "C1,C3" | "all"` or `failed: [{ criterion: "C2", note: "reason" }]`. Reviewer and QA only, with their criterion verify grant. Unknown ids refuse the verdict; its topic report lists the marks. See [review and QA](../review-and-qa.md#criteria-in-a-verdict).

## Categories

Categories gather work that belongs to no release or epic. List their ids with `cland task list --kind category --state open --json`; use the category's id as `--parent C-<n>` on `cland task create`, or file an existing item with `cland task link T-<n> --parent C-<n>`. Resolve ids from the list instead of hard-coding numbers.

- **Bugs**: a bug found aside from the item being worked or tested. Keep `bug`, `qa-found` and triage labels when applicable.
- **Tech debt**: tech debt found during work. File it under the category; the `tech-debt` label is retired.
- **Follow-ups**: further work on merged work; name the merged item in the body.
- **Ideas**: an idea or feature proposal outside the current release or epic.

Only the Coordinator and an Aide create or link these items. Leads, Implementers, Reviewers and QA report a find to `lead T-<n>` in their item topic, naming its category and the evidence, so the Coordinator files it. A triaged item with no release or epic is categorised by its category container; `bug` and `enhancement` remain labels describing the request.

Tickets from a source with no release or epic use its existing category, or the category above that fits the work. Keep a map's native child relationship for wayfinding. A source spec is a leaf: keep its reference on the ticket body's Parent line and use its container as the native parent.

The top-level `idle_from` list in `.cland/crew.toml` names open categories in order, for example `idle_from = ["C-216"]`. The default `[]` means never take category work. Set it with `cland crew set idle_from C-<n>`, a TOML list for several, or `'[]'` to empty it. `cland crew show` lists active categories and ignored hand-edited entries with reasons. When the current release has no unblocked task, the Coordinator takes the lowest-ranked open, unblocked task of the first named category that has one. An epic in a category waits for promotion.

Promotion is a message to the Coordinator: name the item and ask to move it into a release or epic, rank it to the top, or plan its work. An item in a category is not unscheduled; unscheduled means no parent at all.

## Pull requests as a triage surface

**PRs as a request surface: no.** cland's tracker has no pull requests; `/triage` works on items only.

## When a skill says "publish to the issue tracker"

Create an item with `cland task create`: kind `spec` for a spec, `task` for a ticket, `map` for a wayfinding map. For `/to-tickets` this is a real issue tracker with native blocking, not the local-files mode: publish the tickets in dependency order (blockers first), each with `--blocked-by` for its blockers. If the source item is a release, epic or map, use `--parent` for it. A spec is a leaf: parent its tickets under the spec's epic or release; when it has neither, use the category named by the Categories section. The ticket body's `## Parent` line names the source spec (for example `T-<spec>: <title>`); that reference is context, not a parenting edge. Never use a spec or another leaf as a ticket's native parent. For another leaf source, use its allowed container or the category named by the Categories section and keep the source reference on the body's Parent line. Report each item as `T-<n>` with its title.

## When a skill says "fetch the relevant ticket"

`cland task view T-<n> --json`. The id may be given as `T-12` or `12`; for a path such as `.cland/tasks/T-12-some-slug.md`, pass the `T-12` it starts with. A GitHub reference `#12` to an imported issue is the item `T-12`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single item with **child** items as tickets. This repo's map is `T-1` (closed: its way is charted; slice 1 is epic `T-19`).

- **Map**: an item of kind `map`, labelled `wayfinder:map`, holding the Destination / Notes / Decisions-so-far / Not-yet-specified / Out-of-scope body: `cland task create "<effort>" --kind map --label wayfinder:map --body-file - <<'EOF'` … `EOF`. Find maps with `cland task list --kind map`.
- **Child ticket**: an item with `--parent T-<map>` and the label `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`), kind `question` (kind `task` for a `wayfinder:task` ticket): `cland task create "<question>" --kind question --parent T-<map> --label wayfinder:grilling --body-file - <<'EOF'` … `EOF`.
- **Blocking**: native `blocked_by` edges, wired in the second pass once every ticket has its id: `cland task link T-<n> --blocked-by T-<b>`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: the map's open children with no assignee, no claim and no open blocker, in map (id) order; the first line wins:

  ```sh
  cland task list --json | jq -r --arg map T-<map> '
    (.items | map({(.id): .state}) | add) as $state
    | .items[]
    | select(.parent == $map and .state == "open" and .assignee == null and .claim == null)
    | select(all(.blocked_by[]; $state[.] == "closed"))
    | "\(.id)\t\(.title)"'
  ```

- **Claim**: the session's first write. `cland task claim T-<n>` takes the hub's live hold and is refused when another session holds the item (pick the next frontier ticket then); then `cland task edit T-<n> --assignee "${CLAND_SESSION_NAME:-human}"`. The assignee is the claim the frontier reads.
- **Resolve**: `cland task comment T-<n> --body-file - <<'EOF'` with the answer, then `cland task close T-<n>`, then append a context pointer (gist + `T-<n>` + the item's path) to the map's Decisions so far: write `cland task view T-<map> --json | jq -r .item.body` to a temporary file, add the line under `## Decisions so far`, and save it back with `cland task edit T-<map> --body-file <file>`. Do the read and the write back to back: another session may be editing the map too.

## Marketing publication

Only `cland publish <branch> --item T-n` pushes to GitHub outside a release. The Coordinator runs it from its own shell, or the human runs it. Before merging the marketing branch, run the command with `--dry-run`, share its commits, paths, source and resulting tips, and obtain the human's approval through an `ask`, just as for release. Re-preview and ask again if the approved build changes. See the `release` skill for the full procedure. Existing projects with explicit role grants add `publish` to the Coordinator’s tools in `.cland/roles.toml`; custom role files are kept by update.

The command selects branch-only commits that dev lacks, so unreleased product commits inherited from dev stay private. Every changed path in every commit must match `[publish] allow_paths` in `.cland/config.toml`: exact paths or directory prefixes ending in `/**`. Defaults are `site/**`, `docs/brand/**`, `README.md`, `LICENSE` and `.github/workflows/pages.yml`. A mixed-path commit or merge commit refuses the entire publish. The dry run prepares exact tips without moving refs.

After approval it atomically fast-forwards GitHub's default branch (normally `main`) and `site` to the same cherry-picked tip, merges the marketing branch and published tip into dev, and syncs the local territory while preserving dev ancestry. It comments the public and dev tips on the named item, leaving it open and unversioned. Commit the resulting tracker comment on root dev and use `cland push`. This is the D56/D59 marketing flow; ordinary `cland sync` may rebase unreleased work and is not a substitute.

Preserve `.cland/publish.tmp` after a failed push reply or follow-up. Repair the obstruction and retry the same branch and item to finish the pinned publication. An unpublished retry revalidates the current allow-list; an already-published receipt may finish local synchronization after the policy changes. Release, ordinary sync, push, merge and offline tracker migration refuse while that receipt is pending.

## Explorer message format

- The explorer's messages come from the human in General or the item's topic: the text, then `from the explorer · scope …` and one line per item (id · kind · status · container · rank · title). Act on them through the tracker.

## Coordinator category filing

- File category work: find the ids with `cland task list --kind category`; file a bug found aside into Bugs, tech debt into Tech debt, a follow-up of merged work into Follow-ups and an idea into Ideas, each with `--parent C-<n>`. Tasks need `--size XS|S|M|L`, a `## Summary` of 1–3 sentences and `--regression-of T-n` for rework of landed tasks.
