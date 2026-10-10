# Issue tracker: cland

Issues, specs and tickets for this repo live as **items** in cland's own tracker: one Markdown file per item in `.cland/tasks/` (`T-<n>-<slug>.md`), committed with the work. Use the `cland task` CLI for every operation; in this repo run it as `node hub/bin/cland.ts task …` from the repo root (or put `hub/bin/cland.ts` on PATH as `cland`). It talks to the project's hub, so a hub must be running: if a command says `no hub running`, run `node hub/bin/cland.ts hub start`. Don't write item files by hand when a command can do it.

From a linked Git worktree, the CLI follows its `.git` file to Git's common directory and finds the main worktree's `.cland/hub.json`, even when the worktree is outside the project folder. A copied `.cland/` without `hub.json` does not become a separate project. `CLAND_HUB_FILE`, when set by a launched session or explicitly, overrides discovery from any directory. All tracker writes go through that hub into its root's `.cland/tasks` — the main worktree's item files, never the working session's worktree copy. `cland hub start` starts the cwd's resolved project hub and does not use this override.

- An item's id is `T-<n>`. Refer to an item as `T-<n>`: there is no `#<n>` auto-linking. Its file is `.item.path` in `cland task view T-<n> --json`, relative to the repo root.
- A task has `status`: `backlog` (the creation default), `planned`, `in progress`, `review`, `qa`, `ready` or `done`. Containers, questions, specs and maps have none. Status lives in frontmatter and is returned by view, list and the existing `task` event; the UI reads it. A done task is closed; every other status is open.
- The hub persists status through the tracker queue: an Implementer's new claim and a not-clear verdict set `in progress`; close and merge set `done`; reopen without an explicit status sets `backlog`. Existing tasks gain a status when indexed: a closed task is `done`, an open claimed task is `in progress`, and another open task is `backlog`. Hand-edited status and state are re-indexed and kept consistent.
- The Coordinator, the human and an Aide may set any status with `cland task edit T-n --status <status>` or MCP `task.edit`'s `status`. Setting `done` closes the task and releases its claim; a different status reopens it at that status. An Implementer may set only `review` on its own live claimed item, with no other fields in that edit, when handing it over. Assignment alone does not grant this right. The permission table refuses other sessions, even if their role grants the whole `task.edit` tool. A simultaneous `--state` and `--status` must agree. `ready` uses the merge gate’s own verdict evaluation. During pending patch-id freshness the last settled status remains; unchanged patches keep ready, changed or failed checks return it to in progress. Reviewer and QA take a separate `cland task hold T-n` (or MCP `task.hold`) beside the Implementer claim, setting review or qa; `--release`, their verdict, stop/death or item close releases the hold. Holds appear in view/list and task events.
- An item's `kind` is `release`, `epic`, `spec`, `task`, `question` or `map` (default `task`).
- Every `cland task` command takes `--json`. Read results with `--json` and `jq`; the plain output is for humans.
- You act as `$CLAND_SESSION_NAME` (role `$CLAND_ROLE`) when cland launched your session, else as `human`. `--as <name> [--role <r>]` overrides. "Yourself" below means `${CLAND_SESSION_NAME:-human}`.

## GitHub Issues: retired

The items were imported from this repo's GitHub Issues (`Kealman/cland-v0`) with `cland task import-github --all` (#38). The import gave each of issues #1–#42 the item of the same number (`T-23` is #23), so the `#<n>` references in the imported bodies and comments name the same items. An imported item carries `github: {repo, number, url}` in its frontmatter (`.item.github` in `view --json`).

The GitHub Issues served as the human-facing mirror until v0 was done. At the human's request, every open issue was closed on 2026-10-09, after the v0.0.1 release, and the mirror is retired:

- The tracker is the only source of truth. Create, close, relabel and re-link items only with `cland task`; make no matching change on GitHub.
- Do not run `cland task import-github` on this repo. A refresh rewrites state, labels and edges from the issues, so it would close items that are still open here, such as `T-19`.
- Create new work as items only, never as GitHub issues.

## Conventions

- **Create an item**: `cland task create "<title>" --kind <kind> --label <l> --body-file - <<'EOF'` … `EOF`. `--label` repeats. `--parent T-<p>` and `--blocked-by T-<b>` (repeats) set the edges at creation. The new id is `.item.id` in the `--json` result (`created T-<n>  <path>` in plain output).
- **Plan a release**: `cland task create "v0.1" --kind release --version 0.1.0 --body-file <file>`. `version` is semver without the `v`, optional at creation; `cland task edit T-<n> --version 0.1.0` sets it later (`--version none` clears it). The body holds the goal and `## Notes`; creation and kind conversion add an empty Notes section if absent. A malformed version, or a version on another kind, is refused.
- **Read an item**: `cland task view T-<n> --json`: frontmatter fields, the root-to-item `.item.ancestry` (entries with `id`, `kind`, `title`, including the item), `.item.body`, `.item.comments` (`author`, `at`, `text`), `.item.claim`. The plain header joins the ancestry with `›`; `.item.path` stays the file path.
- **List items**: `cland task list --state open --json`, with `--label <l>` (repeats; every label must match), `--kind <k>`, `--assignee <a>`, `--under T-<p>`. `--under` returns every descendant (excluding the named root), including those under closed ancestors, before the other filters; an unknown root is refused. Drop `--state` for open and closed items. Results sort by effective rank, then numeric id. An absent rank is the numeric id times ten, so new and legacy items retain creation order without a rewrite. A summary has every frontmatter field but no body and no comments: `view` each item you need to read in full. Filter further with `jq`, for example items with no label: `cland task list --state open --json | jq '[.items[] | select(.labels == [])]'`.
- **Rank siblings**: `cland task rank T-n --top`, `--before T-m` or `--after T-m` (exactly one), mirrored by MCP `task.rank` with `id` and `top`, `before` or `after`. Tasks and configured containers below `tracker.levels[0]` may carry an explicit safe integer `rank`; a new item has no explicit rank. The reference must have the same parent (including a null parent). An item already in the requested position is unchanged. Sparse moves write only the moved item; dense intervals scan outward once on each side and renumber only the smaller feasible window. The response names `changed` ids and ordered `siblings`. Ranking uses the tracker queue; a sibling changed during its file awaits refuses the stale move. The default Coordinator chooses the lowest-ranked unblocked `planned` task in the current release, the open top-level container with the lowest semver version. Move an item to the top to prioritize it.
- **Make an item a sub-item of a parent**: `--parent T-<p>` on `create`, or `cland task link T-<c> --parent T-<p>` afterwards (`--parent none` clears it). The hub enforces the default parenting rule on create and link: a release has no parent; an epic takes a release or none; a leaf (`task`, `question`, `spec`) takes a release, an epic or none. A map stays outside the ladder and has no parent; it takes `question` and `task` children and refuses containers and other leaves. Kind edits also refuse invalid parent/child relationships. Existing imported/hand-edited trees remain readable; unrelated edits do not rewrite them. The direct children of a parent: `cland task list --json | jq '[.items[] | select(.parent == "T-<p>")]'`.
- **Blocking edges**: native. `--blocked-by T-<b>` on `create`, or `cland task link T-<n> --blocked-by T-<b>` afterwards (repeats; adds to the existing edges); `--unblock T-<b>` removes one. An item is unblocked when every item in its `blocked_by` is closed.
- **Comment on an item**: `cland task comment T-<n> --body-file - <<'EOF'` … `EOF`, or `cland task comment T-<n> "<text>"` for one line.
- **Apply / remove labels**: `cland task edit T-<n> --add-label <l> --remove-label <l>` (each repeats). `--label` instead replaces the whole set. Labels need no setup: any string is a label.
- **Assign**: `cland task edit T-<n> --assignee <name>`; `--assignee none` clears it.
- **Close**: `cland task close T-<n> --comment "<text>"`. Reopen with `cland task edit T-<n> --state open`.

## Acceptance criteria

Criteria live under `## Acceptance criteria` in the task body. `task view --json` returns `item.criteria` with each criterion's stable id, text, checkbox and marks. Old checkboxes have no ids until the first criterion operation assigns them in list order. `criterion_seq` in frontmatter retains the highest allocated number, including removed criteria; keep it when editing by hand. Ids are never reused.

Use MCP `task.criterion` with `{id, op, criterion?, text?, note?, run?}`, or these CLI commands:

```sh
cland task criterion T-n done C1
cland task criterion T-n verify C1 --run rev-0117
cland task criterion T-n fail C1 --note "Reconnect loses the clause"
cland task criterion T-n add "The clause arrives again on reconnect"
cland task criterion T-n edit C1 --text "The clause survives every reconnect"
cland task criterion T-n remove C1
```

`done` is for the live claimant Implementer, the Coordinator, an Aide or the human; assignment alone is insufficient. A human CLI caller may use an unknown `--as` name, such as alice, and retains human done/manage rights; known session names keep their session permissions. `verify` and `fail` are for Reviewer or QA. `add`, `edit` and `remove` are for the Coordinator, an Aide or the human. Verify needs a run id without whitespace; fail needs a nonempty, single-line note. An Aide needs no claim for done or criterion management and cannot verify or fail.

Marks are sub-items, such as `  - done: impl-57 · 2026-10-09T10:00Z` or `  - verified: qa-12 [qa] · run q-0117 · 2026-10-09T11:00Z`. Done checks the checkbox. Fail unchecks it, replaces the current done and verification marks with the failure note, and reopens the task at `in progress`. Marking it done again clears the failure; it needs fresh verification. Text edits preserve the existing marks. Malformed mark sub-items or duplicate ids refuse a write until the source is fixed. Add is refused if the insertion point is inside an unclosed Markdown code fence.

Each successful criterion operation emits a subscribed `task` event with `criterion marked`, the task id, criterion id and operation/mark. Writes use the tracker queue and recheck permission before publication. A concurrent hand save refuses a stale write with a retry reason. A save racing publication retains the captured source at the `.conflict` path named in the error; recover that source before retrying. A newer save at the task path always wins. Successful writes also retain the captured `.conflict` source, recording its path as `task-criterion-source` in the hub log: an already open editor handle may complete a late save there. Keep these recovery files until editors have closed them; they are not tracker items and are ignored by Git in provisioned projects. An atomic capture-intent file lets startup restore a missing live item from its captured source before indexing after a process crash. Existing live files win over recovery sources.

## Pull requests as a triage surface

**PRs as a request surface: no.** cland's tracker has no pull requests; `/triage` works on items only.

## When a skill says "publish to the issue tracker"

Create an item with `cland task create`: kind `spec` for a spec, `task` for a ticket, `map` for a wayfinding map. For `/to-tickets` this is a real issue tracker with native blocking, not the local-files mode: publish the tickets in dependency order (blockers first), each with `--blocked-by` for its blockers. If the source item is a release, epic or map, use `--parent` for it. A spec is a leaf: parent its tickets under the spec's epic or release, or leave them unparented when the spec is unscheduled. The ticket body's `## Parent` line names the source spec (for example `T-<spec>: <title>`); that reference is context, not a parenting edge. Never use a spec or another leaf as a ticket's native parent. For another leaf source, use its allowed container or none and keep the source reference on the body's Parent line. Report each item as `T-<n>` with its title.

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
