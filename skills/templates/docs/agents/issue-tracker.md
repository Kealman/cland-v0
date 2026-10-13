# Issue tracker: cland

Issues, specs and tickets for this project live as **items** in cland's own tracker: one Markdown file per item in `.cland/tasks/` (`<id>-<slug>.md`), committed with the work. Use the `cland task` CLI for every operation. It talks to the project's hub, so a hub must be running: if a command says `no hub running`, run `cland hub start` from anywhere in the project. Don't write item files by hand when a command can do it.

- The number is an item's identity; the displayed id uses its kind's prefix: `R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec and `C-` category. Configured containers use their first letter, and colliding container letters within the configured ladder are refused. Every item command accepts any recognized prefix in either case, or a bare number: `T-107`, `R-107`, `e-107` and `107` find the same epic and return `E-107`. Unknown numbers and unrelated prefixes such as `A-` are refused. There is no `#<n>` auto-linking. Its file is `.item.path` in `cland task view T-<n> --json`, relative to the project root.
- New items use the kind's prefix in their file name and frontmatter id, from one shared counter. A kind edit keeps the number and file slug and renames both the file prefix and frontmatter id. Legacy files are readable before migration: their canonical ids, parent and blocking references already show the target kinds' prefixes. Two files with one number produce a visible warning and a `task-duplicate-number` log record; the file whose prefix matches its kind wins.
- An item's `kind` is `release`, `category`, `epic`, `spec`, `task`, `question` or `map` (default `task`).
- Every `cland task` command takes `--json`. Read results with `--json` and `jq`; the plain output is for humans.
- You act as `$CLAND_SESSION_NAME` (role `$CLAND_ROLE`) when cland launched your session, else as `human`. `--as <name> [--role <r>]` overrides. "Yourself" below means `${CLAND_SESSION_NAME:-human}`.

The container ladder is configured in `.cland/config.toml`: `[tracker] levels = [["release", "category"], "epic"]`. A string is a level of one kind, so the old flat form still parses. Kinds at a level take any kind at the immediately preceding level as parent; leaves take any container. The first kind of the first level alone owns release versions and current-release selection. Other root kinds are led by the Coordinator. Kind names must be unique, exclude leaves and map, and have distinct first-letter prefixes. `cland init` writes the new default; `cland update` upgrades only the old default `["release", "epic"]` and reports custom ladders as kept. Restart the hub to apply a ladder change.

## Conventions

- **Create an item**: `cland task create "<title>" --kind <kind> --label <l> --body-file - <<'EOF'` … `EOF`. `--label` repeats. `--parent T-<p>` and `--blocked-by T-<b>` (repeats) set the edges at creation. The new id is `.item.id` in the `--json` result (`created T-<n>  <path>` in plain output).
- **Plan a release**: `cland task create "v0.1" --kind release --version 0.1.0 --body-file <file>`. `version` is semver without the `v`, optional at creation; `cland task edit T-<n> --version 0.1.0` sets it later (`--version none` clears it). The body holds the goal and `## Notes`; creation and kind conversion add an empty Notes section if absent. A malformed version, or a version on another kind, is refused.
- **Read an item**: `cland task view T-<n> --json`: frontmatter fields, the root-to-item `.item.ancestry` (entries with `id`, `kind`, `title`, including the item), `.item.body`, `.item.comments` (`author`, `at`, `text`), `.item.claim`. The plain header joins the ancestry with `›`; `.item.path` stays the file path.
- **List items**: `cland task list --state open --json`, with `--label <l>` (repeats; every label must match), `--kind <k>`, `--assignee <a>`, `--under T-<p>`. `--under` returns every descendant (excluding the named root), including those under closed ancestors, before the other filters; an unknown root is refused. Drop `--state` for open and closed items. Results sort by effective rank, then numeric id. An absent rank is the numeric id times ten, so new and legacy items retain creation order without a rewrite. A summary has every frontmatter field but no body and no comments: `view` each item you need to read in full. Filter further with `jq`, for example items with no label: `cland task list --state open --json | jq '[.items[] | select(.labels == [])]'`.
- **Rank siblings**: `cland task rank T-n --top`, `--before T-m` or `--after T-m` (exactly one), mirrored by MCP `task.rank` with `id` and `top`, `before` or `after`. Tasks and configured containers below the root level may carry an explicit safe integer `rank`; a new item has no explicit rank. The reference must have the same parent (including a null parent). An item already in the requested position is unchanged. Sparse moves write only the moved item; dense intervals scan outward once on each side and renumber only the smaller feasible window. The response names `changed` ids and ordered `siblings`. Ranking uses the tracker queue; a sibling changed during its file awaits refuses the stale move. The default Coordinator chooses the lowest-ranked unblocked `planned` task in the current release, the open top-level container with the lowest semver version. Move an item to the top to prioritize it.
- **Make an item a sub-item of a parent**: `--parent T-<p>` on `create`, or `cland task link T-<c> --parent T-<p>` afterwards (`--parent none` clears it). The hub enforces the default parenting rule on create and link: a release or category has no parent; an epic takes a release, a category or none; a leaf (`task`, `question`, `spec`) takes any container or none. A category has no version, status or rank, and closes only with no open children; it needs no planning-level QA verdict. Create one with `cland task create "Docs" --kind category` and file work into it with `--parent C-n`. Unscheduled means no parent at all: items in a category are not unscheduled. A map stays outside the ladder and has no parent; it takes `question` and `task` children and refuses containers and other leaves. Kind edits also refuse invalid parent/child relationships. Existing imported/hand-edited trees remain readable; unrelated edits do not rewrite them. The direct children of a parent: `cland task list --json | jq '[.items[] | select(.parent == "T-<p>")]'`.
- **Blocking edges**: native. `--blocked-by T-<b>` on `create`, or `cland task link T-<n> --blocked-by T-<b>` afterwards (repeats; adds to the existing edges); `--unblock T-<b>` removes one. An item is unblocked when every item in its `blocked_by` is closed.
- **Comment on an item**: `cland task comment T-<n> --body-file - <<'EOF'` … `EOF`, or `cland task comment T-<n> "<text>"` for one line.
- **Apply / remove labels**: `cland task edit T-<n> --add-label <l> --remove-label <l>` (each repeats). `--label` instead replaces the whole set. Labels need no setup: any string is a label.
- **Assign**: `cland task edit T-<n> --assignee <name>`; `--assignee none` clears it.
- **Close**: `cland task close T-<n> --comment "<text>"`. Reopen with `cland task edit T-<n> --state open`.

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

`cland task view T-<n> --json`. The id may be given as `T-12` or `12`; for a path such as `.cland/tasks/T-12-some-slug.md`, pass the `T-12` it starts with.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single item with **child** items as tickets.

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

## Migrating prefixes and categories

From the project root's human shell or the Coordinator's session, with the hub stopped, run `cland task migrate --dry-run` to inspect the plan, then `cland task migrate` to apply it. Add `--json` for the plan object; preview and apply share the planner and return the same format. It works directly on item files and `hub.db`, holding the hub startup lock until completion. A running hub refuses both commands; its `task.migrate` frame also refuses. No MCP migration tool is added.

The plan lists file renames preserving existing slugs, each item's kind prefix, rewritten `parent` and `blocked_by`, title changes and unresolved references left as written. It strips leading kind words such as `Epic:`, converts the open root Tech debt container to a category (or seeds it), seeds Bugs, Follow-ups and Ideas on the shared counter, retires every `tech-debt` label and moves unparented labelled items into Tech debt. Existing open root categories are reused by their cleaned titles.

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
