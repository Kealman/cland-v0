## The tracker

Branch-tip polling refreshes summaries through the branch index for the branches
that moved, then updates their ancestor projections. Unrelated branch moves keep
demo freshness and criteria projections cached. Demo task membership is reused
between tracker edits and invalidated on edits, reparenting and removal. First
tip discovery, dev moves and a configured verdict-base switch or move retain
shared freshness invalidation, because patch comparisons and epic demos depend
on those integration tips. Freshness Git work remains asynchronous; replies read
cached answers and preserve unknown values until their receipt settles.

Freshness announcements refresh and publish at most sixteen affected rows per
synchronous chunk, yielding between chunks. Each ancestor source is refreshed
once per batch. A chunk shares its item-layer visibility projection; that scope
ends before yielding, so a later write uses a fresh projection. Remaining
announcements read the current row when published, preserving newer writes that
interleave with the batch. Legacy task frames and numbered full/slim deltas keep
their existing shapes.
The internal synchronous publication wrapper also receives the producer's
completion promise, shared across its chunks. Its receipt reports whether all
producer work completed or a stop fence interrupted it; errors reject it. The
promise is not part of task frames, persisted records or client snapshots.

`closed` is an optional ISO timestamp in item frontmatter and the index. Hub close, merge and an edit to closed/done write it; reopen clears it. A hand close without a time stays unresolved. List, view and `task` events expose the field, and session archival reads it before the older receipt/index fallbacks.

`task.list` and `task` event summaries carry `criteria: {total, done, verified, stale, failed}` from indexed marks, without reading an item file. Counts are exclusive: failed takes priority over current verified, stale, then done; a checkbox alone counts as open. Verification is current only at the exact branch tip (the receipt tip for a landed task, `dev` for a planning container). `task.view` retains the full `criteria` array and adds `criteriaCounts` with the same counts.

Plain CLI item output, including `task view` and `task comment`, accepts older hub replies without `criteriaCounts`, `closed` or `verify`. It omits those rows when absent and still prints the remaining item facts, body and comments.

Tasks also carry `verify`, null until a matching verification exists: `{id, state, result, head, finished, artifact, cached?}`. The latest submitted job matching the item number or branch wins; results are `passed`, `failed`, `cancelled`, or null while queued/launching/running. `cached` holds the original run, head and candidate tree. Suites maintains these lookups across saves and reconstructs them on startup. Changes coalesce per task per tick and emit a silent `task` event; successful completion publishes one terminal card with its log artifact. A blocked report still publishes the terminal state. Subscribed sessions receive the usual suite report, with no additional delivery for this projection. The plain CLI view prints the closing time, counts and verification details.

### Migrating prefixes and categories

From the project root's human shell or the Coordinator's session, with the hub stopped, run `cland task migrate --dry-run` to inspect the plan, then `cland task migrate` to apply it. Add `--json` for the plan object; preview and apply share the planner and return the same format. It works directly on item files and `hub.db`, holding the hub startup lock until completion. A running hub refuses both commands; its `task.migrate` frame also refuses. No MCP migration tool is added.

The plan lists file renames preserving existing slugs, each item's kind prefix, rewritten `parent` and `blocked_by`, title changes and unresolved references left as written. It strips leading kind words such as `Epic:`, converts the open root Tech debt container to a category (or seeds it), seeds Bugs, Follow-ups and Ideas on the shared counter, retires every `tech-debt` label and moves unparented labelled items into Tech debt. Existing open root categories are reused by their cleaned titles.

The `closed` part backfills closed items missing their frontmatter time. Sources, in order: the landing receipt's `merged_at`, the latest journal `task-written` record with `op: close`, then the receipt commit's Git committer time. Preview names each source as `closed T-n: <ISO time> (receipt | journal | commit)`. Existing `closed` fields stay untouched; items without a valid source remain under `unresolved`, including on a nothing-to-do rerun. A closing-time-only apply changes only the `closed` frontmatter line, preserving the body, comments and other timestamps. The live backfill uses the same tag, database backup, preview/count check, idempotent rerun and old-id checks as the prefix migration, in the restart window that carries its merge.

Apply renames each file before atomically replacing its frontmatter, so interruption leaves one file per number. References-only changes are written in place. It rebuilds the affected index and records one `task-migrated` journal event with counts and caller through the log tap. Preview writes no item, index or journal record. A clean second run reports `nothing to do` and writes nothing; a partially migrated tree gets only its remaining changes. If the last file was published before an interrupted index write, apply repairs the derived index even with an empty file plan, leaving every item file unchanged. Preview never repairs the index. A pending temporary write or criterion capture must be recovered before retrying.

Both modes refuse a linked worktree or subdirectory, any caller other than the human or Coordinator, an on-disk territory/merge lock, tracker lock or temporary write, a pending criterion capture, an unfinished merge receipt, and pending `cland sync` or `cland release` recovery. A ladder without root `category` refuses with instructions to run `cland update` and restart the hub. These are on-disk checks, since the migration requires the serving hub to be stopped.

Bodies, comments, existing timestamps, journal history, artifacts, topic bindings, branches and worktrees keep their original bytes and ids. Task filenames keep `T-`. Every old `T-<n>` reference keeps resolving by number after restart, including CLI and MCP task operations, topic bindings, inbox and journal references and `gi` in a thread. Older task branches can still squash-merge; an edit to a renamed container follows Git rename detection or refuses with `merge-conflict`, rather than creating a second item file.

#### Live-tracker procedure and rollback

The Coordinator performs the live migration on `dev` after this slice merges, with a green integrated verification and an empty suite queue. Implementers use temporary projects and scratch copies only.

1. Run `cland update` to provision the root category ladder. Arrange the stand-in's maintenance window and stop the hub (`cland hub stop`).
2. On the root's clean `dev`, create `git tag pre-migration` and copy `.cland/hub.db` beside it as `.cland/hub.db.pre-migration`. Stop must have completed before the copy; keep the tag and database backup until acceptance.
3. Run `cland task migrate --dry-run --json` and keep its output as an artifact after restart. Inspect the plan, then run `cland task migrate --json` and compare it with the preview. Run once more to confirm `nothing to do`.
4. Restart the hub on the migrated tree (`cland hub start`) and relaunch every role session: their previously delivered clauses and briefs carry the old ids. Check old ids resolve and the category tree agrees with the plan.
5. Commit the renamed item files on `dev` and publish with `cland push`.

To roll back within minutes, stop the restarted hub and all role sessions. Preserve any later work first. Restore the pre-migration tracker tree with `git restore --source=pre-migration --staged --worktree -- .cland/tasks` (this also removes newly seeded tracked files; remove any still-untracked migration-created category files named by the kept plan). Restore `.cland/hub.db.pre-migration` over `.cland/hub.db` and remove obsolete `.cland/hub.db-wal` and `.cland/hub.db-shm` only while the hub is stopped. Keep the append-only journal. Commit the restored tracker if the migration was committed, restart the hub and relaunch roles. The tag restores the item files; the database copy restores hub state and its index together.

One Markdown file per item in `.cland/tasks/`, `T-<n>-<slug>.md` (spec 4.6, ADR 0002). Ids are sequential per project and never reused: the hub hands out one above the highest in the folder and in the index. The file name keeps the slug of the title the item was created with.

```markdown
---
id: T-1
kind: task            # release | epic | spec | task | question | map
title: Add the login page
state: open           # open | closed
status: backlog       # tasks only: backlog | planned | in progress | review | qa | ready | done
labels:
  - ui
assignee: null
parent: T-2
blocked_by: []
topic: null
branch: t/1-add-the-login-page
created: 2026-10-08T12:38:26.370Z
updated: 2026-10-08T12:38:26.729Z
---

The page the human logs in on.

## Comments

### alice · 2026-10-08T12:38:26.640Z

Session cookie handled.

### rev-1 · 2026-10-08T12:38:26.729Z

verdict: review
result: clear
by: rev-1 [reviewer]
run: r-1
commit: 0123456789abcdef0123456789abcdef01234567

Looks right.
```

A comment is headed `### <author> · <ISO time>`; one whose first lines are `verdict:` (`review` | `qa`), `result:` (`clear` | `not clear`), `by:` (`<session> [<role>]`) and `run:` is a verdict. Its optional `commit:` pins the Git commit covered by that run; older verdicts without it still parse.

`cland task view T-n --json`, MCP `task.view` and the socket's `task.view` return
`item.criteria`, read from the body's `## Acceptance criteria` section. A missing or
empty section returns `[]`. Each criterion has `id` (`C1`, `C2`, etc., or `null` for
a legacy criterion), `text`, `checked`, `marks` and `malformedMarks`. The checkbox
state is kept independently: a checked legacy criterion has `checked: true` and
`marks: []`. Wrapped text is joined with newlines; fenced examples and nested
supporting checklists do not create criteria.

Mark sub-items are indented two spaces below the criterion, in file order:

```markdown
## Acceptance criteria
- [x] C1. The clause arrives again on reconnect
  - done: impl-57 · 2026-10-09T10:00Z
  - verified: qa-12 [QA] · run q-0117 · 2026-10-09T11:00Z
- [ ] C2. A reconnect keeps the clause
  - failed: rev-3 [Reviewer] · 2026-10-09T12:00Z · note Reconnect lost the clause
```

The first criterion's JSON is:

```json
{
  "id": "C1",
  "text": "The clause arrives again on reconnect",
  "checked": true,
  "marks": [
    { "kind": "done", "by": "impl-57", "at": "2026-10-09T10:00Z" },
    { "kind": "verified", "by": "qa-12 [QA]", "run": "q-0117", "at": "2026-10-09T11:00Z" }
  ],
  "malformedMarks": []
}
```

Failed marks carry `kind: "failed"`, `by`, `at` and `note`. Times retain their
original ISO spelling, with minutes, optional seconds/fractions, and a `Z` or
numeric timezone. `by` retains the file's session name and optional `[Role]`;
these marks are parsed file claims, not authenticated verdict evidence. Valid
marks remain visible even beside malformed ones. Each malformed mark is returned
verbatim as `{line, text, reason}` in its criterion's `malformedMarks` and in
`item.criteriaWarnings`; warnings also report orphan mark lines that belong to
no criterion. `line` is one-based within `item.body`. All warnings are an empty
list for valid sections. Spaces or tabs after a mark's bullet are accepted;
tab-indented marks and unrecognized indented list sub-items (including supporting
checklists, empty bullets and ordered items) are reported verbatim. Hand edits
are re-indexed and survive restart, preserving
the ids, text and marks in the file. This slice only reads the section: views do
not assign ids, rewrite marks or change checkboxes.

In the web card, **Criteria** (or physical `e` on that block) opens the full
criterion list through `task.view`. Add, Save, Remove and Mark done use
`task.criterion` as the authenticated human, without an `as` field. Each text
field is one line and excludes its `Ck.` label. Removal never reuses the id;
Mark done records `human` and offers no undo. Open criteria refresh on item
deltas. Legacy criteria with null ids stay read-only, with a tooltip explaining
the normalize path, and **Assign ids** appears beside them: it sends
`task.criterion` `normalize`, and the returned rows become editable without an
add. No positional id is guessed. Errors retain the draft, with their reason in
a tooltip; offline writes are disabled and mutations are never retried
automatically. The Items UI edits no other item field: labels and body stay in
Neovim. The protocol's existing human authority and role grants do not change.

<!-- cland-allow-closed-wording: pending approval is runtime plan state -->
- **Task status (T-120).** Tasks carry explicit frontmatter `status`: `backlog` at creation, `planned`, `in progress`, `review`, `qa`, `ready` or `done`; containers, questions, specs and maps have none. The hub writes and indexes it on the tracker's single queue and carries it in view, list and the existing `task` event. An accepted epic plan sets the current stage's open backlog tasks to `planned` once per stage entry, including blocked tasks; pending approval moves nothing. New members of the current stage move once too, and the next stage advances after landing and any required after-stage QA. Hand statuses stay, including a reset to `backlog`; without a plan, `planned` stays a hand status. Closed epics report all plan stages closed without task writes; reopening restores their derived states. A new Implementer or Aide claim or a not-clear verdict sets `in progress`; a merge or close sets `done`; a reopen without an explicit status sets `backlog`. Done tasks are closed and all other statuses are open. Migration on index persists `done` for closed tasks and `in progress` for open claimed tasks, otherwise `backlog`. Hand edits are re-indexed, including close/reopen edits to state.
- **Manual status.** The Coordinator, the human and an Aide use `cland task edit T-n --status <status>` or MCP `task.edit`'s `status` to choose any status. `done` closes the task and releases the claim; choosing another status reopens it at that status. The Implementer hands over with `task.edit {id, status: "review"}` on its own live claimed item, with no other edits. The permission table checks this right again after file I/O; assignment alone is insufficient. Other sessions cannot set status, even under a whole-tool `task.edit` grant. An explicit state and status in the same edit must agree. Verifier holds and clear, current verdicts also move status as described below.
<!-- cland-allow-closed-wording: until planned describes optional version assignment -->
- **Release planning (T-118).** Kind `release` adds optional frontmatter `version`, semver without the `v` (for example `0.1.0`, including prerelease/build suffixes). Create it with `cland task create "v0.1" --kind release --version 0.1.0`; omit the version until planned and set it with `task edit --version` (`none` clears it). The first configured level owns version and Notes, even when renamed. Other kinds cannot carry a version; malformed versions are refused. Its body holds the goal and `## Notes`, which creation and kind conversion add if missing. The version is indexed, returned in view/list/events and preserved through writes and restarts. Release from the item with `cland release --item T-n` as described under Release and sync.
<!-- cland-allow-closed-wording: until repaired describes runtime malformed-child recovery -->
- **Parenting rule (T-118).** Container kinds are read at hub start from `[tracker] levels = [["release", "category"], "epic"]` in `.cland/config.toml`, ordered top-down. `cland init` writes them; `cland update` upgrades the old default `["release", "epic"]` and keeps and reports every custom ladder. A string names one kind at a level, while a nonempty list groups peer kinds. The first kind of the first level alone owns versions and current-release selection. Other root kinds have no version, status or rank, take the same children as releases and are led by the Coordinator. The defaults are `release / category` › `epic`: a release or category has no parent; an epic takes either root kind or none; a leaf (`task`, `question`, `spec`) takes any container or none. Categories close with no open children and need no planning-level QA verdict. `cland task create "Docs" --kind category` creates a category; `--parent C-n` files work there. Unscheduled means no parent, so category work is outside the release scope's unscheduled fold. Categories never cycle as release scopes; existing epic cycling remains. Maps stay outside the ladder: no parent, children of kind `question` or `task` only (the wayfinder task exception). Create and link share the hub's check; changing a kind through edit or import cannot leave children under a leaf; both share the child-parenting check, including closed children. A hand edit that changes a kind in conflict with its children remains authoritative and posts a notice naming the file. A refusal names the parenting rule. Legacy imported/hand-edited trees remain readable; unrelated edits do not rewrite them. A container takes any kind of the immediately preceding level or none; leaves take any configured container or none. For example `levels = ["release", "epic", "feature"]` accepts a feature under an epic and refuses it under a release. `levels = []` gives a flat tracker. Names must be unique lowercase kind names with distinct first-letter prefixes, and `task`, `question`, `spec`, `map` are reserved; an invalid ladder produces an Agents refusal notice and the defaults stay in force. Unknown item kinds are refused at index with a notice naming the file; valid items continue loading. Restart the hub after changing levels. Closing a configured container with open children is refused, naming each child; close or move them first. There is no force flag, and `task edit --state closed` applies the same guard. A container close or kind change scans the tasks directory once inside the tracker queue, after the final write await and immediately before rename. It reads every task file to discover children by their current disk parent, including hand reparents not yet indexed. Any unreadable task file blocks the operation and is named; child discovery never relies on watcher timing. A hand edit while the directory scan or rename is in flight remains outside the single-user, non-atomic threat model (T-61/T-78); the accepted disk-edit window covers the scan plus rename. A malformed child retains its last known index row and refuses close with its file named until repaired; only an unknown kind removes the index row.
- **Subtree and header (T-118).** `cland task list --under T-n` lists every descendant, excluding the named root, by effective rank then numeric id. It traverses closed ancestors and combines with all other list filters; an unknown root is refused. `task view` prints the root-to-item path in its first line (`T-1  v0.1 › T-2  Schema › T-4  Parser`). CLI JSON and MCP views return it as `item.ancestry`, an ordered array of `{id, kind, title}` including the item. `item.path` remains the file path. Missing/cyclic legacy parents cannot hang a read. MCP tools mirror CLI arguments: `task.create` takes `kind: release` and `version`, `task.edit` takes `version` (null clears), `task.list` takes `under`, and `task.view` returns ancestry.
- **Criterion writes (T-155).** MCP `task.criterion` takes `id`, `op` (`done`, `verify`, `fail`, `add`, `edit`, `remove`, `normalize`), and the stable `criterion` id (except add and normalize). `text` supplies add/edit text, `run` supplies the verifier run, and `note` supplies a failure's single-line reason. CLI: `cland task criterion T-n done C1`, `verify C1 --run rev-1`, `fail C1 --note "reason"`, `add "text"`, `edit C1 --text "text"`, `remove C1`, `normalize`. The live claimant Implementer, Coordinator, Aide or human may mark done; Reviewer and QA may verify/fail; Coordinator, Aide or human may add/edit/remove/normalize. These limits apply even to a role granted the whole tool. Default grants are Coordinator/Aide `task.criterion`, Implementer `task.criterion:done`, Reviewer/QA `task.criterion:verify` (verify and fail); `task.criterion:manage` is the add/edit/remove/normalize scope. An Aide needs no claim for done or management, and cannot verify/fail. First touch assigns legacy ids in order and persists `criterion_seq` in frontmatter so removed ids survive restart. `normalize` does that assignment alone: it numbers every id-less criterion in list order above `criterion_seq`, leaving text, checkboxes, marks and unrelated prose unchanged, and names the assigned ids in one `criteria normalized` event. An item whose criteria all have ids gets no id, no text change and no write at all, `criterion_seq` and `updated` included; a client can therefore call it before editing legacy rows. Done writes a sub-item and checks the checkbox. Fail replaces current marks with its note, unchecks the checkbox and reopens in progress; done after a failure requires fresh verification. Edit preserves marks. Malformed sub-items and duplicate ids refuse writes; add also refuses an insertion point inside an unclosed Markdown code fence. An unknown human CLI --as name retains human done/manage rights; known session names retain their session permissions. Subscribers receive `task` events naming `criterion marked`, item, criterion and mark/operation, or `criteria normalized` with the assigned ids when normalize assigns them. Criterion and automatic planned-status writes temporarily capture the source and publish without replacing a newer editor save; stale input is refused for retry. Only an observed concurrent save retains a `.conflict` source, named in the error for recovery. Successful writes remove their temporary source after the final original-handle check and leave no conflict capture. The guard covers publication through that check, rather than retaining old editor inodes indefinitely after completion. Recovery files are not indexed and their watcher notifications emit no task events; sources and capture-intent markers are ignored by Git in provisioned projects. Startup recovers a missing live item from an atomic capture-intent marker before indexing, supporting both temporary sources and older `.conflict` intents; existing live files win. Recovery and I/O-error cleanup delete only a source validated against its original hash; changed bytes become `.conflict`, and unreadable or unvalidated sources stay available for recovery. Finalized captures follow the retention policy below; other tracker operations keep their separate policies.

- **Verdict criteria (T-156).** CLI verdict comments accept `--verified C1,C3|all` on clear verdicts or repeated `--failed "C2=note"` on not-clear verdicts. MCP `task.comment` accepts `verified` (the ids string or `all`) and `failed` (`[{criterion, note}]`); socket frames carry them inside `verdict`. Only Reviewer/QA with the criterion verify grant can mark them. The verdict, legacy id assignment and all marks share one tracker write using the criterion hand-save protections. Unknown ids, malformed criteria or invalid notes refuse the whole verdict. Verification carries the verdict run; failure has the same effect as `task.criterion fail`. Successful marks emit criterion events, and the verdict report lists its marks and carries structured `Message.criteria` (message-frame section above).

- **Rank (T-122).** Tasks and configured containers below the root level may have an explicit safe integer `rank` in frontmatter. An absent rank resolves to the numeric id times ten; new items omit it and legacy files are not rewritten. Lists (CLI, MCP and subtree queries) use one shared comparator: effective rank ascending, then numeric id ascending. View, list and event rows always carry the resolved rank, including for unranked kinds. They also carry `rank_set: true` only when the file names an explicit rank, written by hand or by `task.rank`; otherwise the field is omitted. Lists and events derive the field from the existing index rank column, without a schema change or item-file reads for lists; views derive it with the rank from the same file read, even before watcher re-index. Plain `cland task view` labels the rank `(set)` or `(default)`. `cland task rank T-n --top`, `--before T-m` or `--after T-m` and MCP `task.rank` move among items with the same parent; another parent or a self-reference refuses. The default Coordinator takes the lowest-ranked unblocked planned task in the current release: the open configured top-level container with the lowest semver version. Ranking is granted to the Coordinator and the human by default.
- **Rank writes.** An item already in position is untouched. Otherwise the hub chooses a sparse integer between its neighbors (equal ranks are allowed when numeric ids retain order); a dense interval scans outward once on each side, picks the smaller feasible window and fills it evenly, retaining the moved rank when possible. The computation is linear. If no bounded gap exists, the whole rankable sibling list gets spacing ten; an unrankable fixed boundary refuses that fallback. Neighbors commit first, the moved item last, through the tracker queue. The response returns `item`, `changed` ids and ordered `siblings`. After the temporary-write awaits, the hub re-reads disk sibling ranks and parents before rename and refuses stale plans or revoked permissions. The directory scan plus rename remains the accepted hand-edit window. Each file commits atomically; a failed batch reports its committed prefix and can be retried, with no rollback of earlier files. The final event has `siblings`; per-file events expose each committed rank.
- **Retiring the priority label.** After merging T-122, restarting the hub and adding `task.rank` to this project's Coordinator permissions, run `node hub/bin/migrate-high-rank.ts` from the root. It lists items through the CLI and refuses before any writes when more than one item under a parent carries the label (open or closed), naming those items. Each singleton is ranked to the top unless already first, then its label is removed through the hub. Multiple-item support would need stable numeric id order: the original implicit ranks are id × 10 and migration never changes ids. Its JSON report names moved items, old/new ranks, parents and changed ids, plus retired ids. A successful rerun writes nothing; a failed label removal retries without moving the already-first item. The JSON report preserves the committed prefix even on failure. No item files are edited by the script.
- **Writes (T-77)** go through the hub and await an ordered read–change–write–rename–index cycle. One tracker-wide queue admits file mutations, import batches, watcher reads, serving-time rescans and views in call order. A view waits for earlier writes; hand renames, moved frontmatter ids and reindexing cannot put writes to the same file on different queues. Verdict Git resolution runs inside its admitted operation, so later tracker operations wait behind it. A task claim writes its status through the queue and publishes the claim after the file and index commit; it survives a racing comment. Fallback directory listings and stats are asynchronous and share the queue. Import batches reserve the queue before lookup and id allocation, so concurrent first imports cannot duplicate a GitHub reference. Nothing is committed to Git.
- **Storage stalls and shutdown (T-103, T-253).** Once an admitted tracker operation has run for 5000 ms, the hub logs and journals one `tracker-storage-stalled` event with `operation`, `item` (null for a tracker-wide operation), `startedAt` and `thresholdMs`. The threshold measures the whole admitted storage transaction, including native I/O and verdict Git waits. Waiting entries do not start their own timers. `hub status --json` exposes `tracker.storage` with `stalled`, the active operation and elapsed time, the queued count and abandoned operations.

  The 5000 ms threshold is a warning: the operation may complete and the hub keeps serving. A separate fatal deadline defaults to 60 seconds from admission, configurable in `.cland/config.toml` as `[tracker] fatal_stall = "60s"` (a positive integer duration in `s`, `m`, `h` or `d`, at most `2147483s` (about 24.8 days), read at hub startup). Both timers belong to the same operation and are cancelled when it completes or fails; a later operation gets its own deadlines. A slow operation that finishes before the fatal deadline only costs a warning, and its stalled health status clears.

  **Serving-time recovery: fail-fast.** During service, only an operation still outstanding at the fatal deadline immediately freezes tracker admission and all guarded native/index continuations. The hub rejects outstanding calls, including the held operation and its queued successors, with an error naming the stalled operation and item; it never acknowledges them as completed. It records `tracker-storage-abandoned` and `tracker-storage-fatal`, writes the fatal diagnostic to stderr, and tells sessions and the workbench through an Agents notice and a warning in Events. It closes the hub and exits with code 1, even if the held native operation returns during shutdown. Fatal cleanup has a 2000 ms bound; if another shutdown dependency stalls, the CLI reports incomplete cleanup on stderr and exits anyway. The queue is never released to continue serving.

  Writes completed or acknowledged before the stall survive the exit and restart. An unfinished temporary write stays unpublished, and temporary and criterion capture files remain available for startup recovery. An already-issued native rename/link has an uncertain outcome: an in-process fencing token cannot revoke an operation handed to the OS. The hub does not claim to cancel it. Restart rebuilds the index from the durable item files.

  **Restart path.** A supervisor may restart the failed process, or the human runs `cland hub start` in the project. Inspect the operation and item named in `.cland/log/hub.log` or `.cland/journal.jsonl`, read the affected item with `cland task view T-n`, and check the files before retrying any outstanding mutation: an uncertain native publication may already be present. Acknowledged writes need no retry.

  Ordinary hub stop freezes new admission and drains for at most 2000 ms. Freshness shutdown cancels its active native Git command, waits for child close (PID and pipes reaped), and prevents subsequent commands in a patch or epic-demo scan. If work remains, `tracker-storage-abandoned` records the active and queued operations (queued entries have null `startedAt`), rejects their callers and closes the index. Background maintenance can outlive the drain with no active or queued operations, so this event can contain `operations: []`. Shutdown decisions use the tracker's actual abandonment flag, independently of that diagnostic list. Guarded continuations cannot issue further storage calls or index changes. The daemon flushes its shutdown logs and exits with code 1 after abandonment so a pending native request cannot keep it alive. A completed drain leaves the flag false and exits normally. Startup storage work retains stall detection; automatic fail-fast applies once the hub is serving. Tests can independently shorten the warning with `CLAND_TEST_TRACKER_STALL_MS`, the fatal deadline with `CLAND_TEST_TRACKER_FATAL_MS`, and the shutdown drain with `CLAND_TEST_TRACKER_STOP_MS`; these overrides accept finite positive milliseconds; the fatal override also respects the platform timer maximum of 2147483647 ms, otherwise the configured/default deadline applies.

- **Atomicity and completion.** Item text is written to a temporary file in the same directory, then renamed over the item. A failed temporary write or rename rejects the call and cleans up its temporary file; the old item stays intact. A process crash before rename may leave a temporary file, which scans ignore. Results wait for rename, index/evidence updates and notifications; verdict evidence is available when the call returns. As before, there is no `fsync`: completion promises process-crash durability of the replacement, not a power-loss guarantee. Every mutation rechecks the caller's permission immediately before rename; a revoked call removes its temporary file and refuses. Comment writers also recheck their identity, preserving verdict provenance. Each synchronous continuation after Git or file I/O is measured as resumed request work; nested scopes of the same request count as one continuous stretch; disk waits are excluded. Shutdown drains admitted commits and watcher work before closing the index.

**Epic plans (T-183).** The second configured container level (`tracker.ladder[1]`,
`epic` by default) keeps its plan in one `## Plan` section containing
one fenced `yaml` (or `yml`) block. Stages run in list order; each lane is an ordered
list of tasks worked in parallel with the other lanes of that stage. For example,
where T-55, T-57, T-58 and T-63 are tasks under the epic and T-63 has criterion C1:

```yaml
stages:
  - name: schema and CLI
    qa: { scope: affected, when: after-stage }
    lanes:
      - [T-55, T-57]
      - [T-58]
  - name: panels
    qa: { scope: full, when: per-item }
    lanes:
      - [T-63]
items:
  T-58:
    qa: { scope: none, when: per-item }
  T-63:
    qa: { scope: affected, when: per-item }
    qa_criteria: [C1]
```

Stage names are unique, nonempty single lines. Stages, lanes and each lane's item
list must be nonempty. Each task appears once, must exist, and must be a descendant
of the epic. Plans may cover a subset of its tasks. Every stage supplies `qa.scope`
(`none`, `affected`, `full`) and `qa.when` (`per-item`, `after-stage`). The optional
root `items` mapping holds per-item `qa` overrides and/or `qa_criteria`: stable
criterion ids that exist on that task. Overrides for items outside the lanes,
duplicate criterion ids, unknown fields and malformed or duplicate YAML keys are
refused with a reason. This slice stores the policy; gate enforcement, approval,
stage QA and the plan view follow in later slices of T-114.

Save the example as `plan.yaml`, then run:

```sh
cland task plan set T-<epic> --file plan.yaml
cland task plan show T-<epic>
cland task plan show T-<epic> --json
```

`--file -` reads YAML from stdin. Split L tasks into 2–3 M tasks before planning; to keep one, repeat `--allow-large <id>=<reason>` for every L lane task. MCP set accepts `allow_large: { "T-n": "reason" }`. Non-empty reasons are recorded in plan history, including when the plan YAML is unchanged. MCP `task.plan` takes `{id, op: "set", yaml}` or
`{id, op: "show"}`; frames use `type: "task.plan"` and `item` in place of `id`.
Set/show return `{id, plan}`; no plan is `null`. `task view --json` and MCP
`task.view` also return `item.plan`. Set replaces only the Plan section, preserving
other body sections and comments, and never changes the lane items. Generic body
writes validate plans too, so `task.edit` cannot publish an invalid plan.

A refused tool write leaves the file and accepted plan intact. An invalid hand
save remains on disk for repair: the watcher logs `task-plan-refused`, retains the
last accepted plan in the index, and view/show report its `planError` beside that
plan. The retained version survives hub restarts. A valid hand save replaces the
snapshot; removing the section clears the plan. When child criteria or membership
change, the tracker retries dependent plan candidates, including an epic save
indexed before its child save. A read that sees a valid save before the watcher
retains and journals that same version before showing it. The files remain the source of
truth: a fresh database rebuild reads valid plans after indexing their lane tasks.
Changes are journalled as `task-plan-changed` with the epic id, author, source,
and full previous/new plans; rejected hand saves name the validation reason.

The default Coordinator has `task.plan` (set and show). Implementer, Reviewer and
QA have `task.plan:show`; `task.plan:set` grants writes separately. The human can
set/show from their own shell. Existing projects with explicit permission lists
must add `"task.plan"` to `[coordinator.permissions] tools` and `"task.plan:show"`
to the Implementer, Reviewer and QA lists to use these tools. Lead/Aide grants and
approval arrive in their own slices. No role clause changes in T-183.

- **Synchronous read API.** Construction, the initial `start()` scan and its initial directory stamp run before serving and retain synchronous filesystem calls. `view()`, `mergeView()`, `files()`, `reserveId()` and `rescan()` remain synchronous for standalone/bootstrap use; `cland init` awaits tracker category writes during provisioning before the hub starts. The task CLI has no offline tracker writer: its mutations and reads all call the hub. Serving-time `task.view`, mutations, imports, topic creation and the shared item-launch path use asynchronous APIs. Merge/worktree/release/sync checks also use queued asynchronous views (T-78), including `mergeViewAsync()` for durable verdict evidence; native adapter spawn filesystem calls remain T-79.
- **Conflict capture retention (T-452).** Finalized `<item>.md.<uuid>.conflict` captures are retained for seven days since their latest modification, inode metadata change or creation (the latest of mtime, ctime and birthtime); exactly seven days is still retained. Using the latest timestamp protects a freshly captured or promoted editor source with an old item mtime. The hub schedules asynchronous pruning after tracker startup/recovery and once per hour after each pass, outside the task request queue. Only regular files with that exact capture shape are eligible; canonical `<item>.md` files, symlinks, directories, `.tmp` sources and capture-intent markers are never deleted by retention. Sources named by active capture intents are preserved; malformed/unreadable intents stop that pass conservatively, with failures logged and retried on the next hourly pass. `cland doctor` reports a `tracker conflicts` row with the number of live regular captures and the filenames whose bytes differ from their current item file (including a missing item). It warns when any differ, and never prunes, including with `--fix`. Recover differing bytes before they expire; copy any source needed for longer outside `.cland/tasks`.

- **Hand edits** are picked up by a folder watcher (debounced 100 ms). A safety check every 5 s compares the listing and each item’s mtime, ctime, size and inode even while the native watcher is healthy; only added, removed or changed paths trigger body reads and parsing, avoiding an all-body scan on the tracker request queue. On supported APFS (macOS) and ext4 (Linux), ctime catches same-size rewrites even when mtime is restored; a change invisible in all four fields requires native notifications or an explicit full rescan as its backstop, rather than a periodic full-body audit. If native watching is refused or errors, the check runs every 500 ms instead. Timers are unreferenced and stopped with the tracker. Re-index completion is recorded by the exact file’s `task-reindexed` log receipt (removal uses `task-removed`); delivery and scheduling under load can add delay; a hand-edited file is read leniently (a missing field takes its default). Last writer wins: a hand edit landing within 2 s of a hub write of the same item, or a hub write finding a hand edit the watcher has not reached yet (the hub's change is then applied on top of it), or a hand edit landing while the hub writes the item (between its read and its rename: the file is checked just before the rename and the replaced file just after; the hand edit is overwritten), is logged as `task-conflict` in the hub's log. A file that cannot be parsed is logged as `task-unreadable` and keeps its last indexed version.
- **Verdict commits and provenance.** `task.comment` accepts `verdict.commit` on the wire, `commit` on the spoke tool, or `--commit <sha>` on the CLI. An explicit SHA must resolve to a commit and is written in full; without it, the hub records the tip of the item's local `branch`, if it resolves. The result includes `commit: {sha, source: "explicit" | "branch" | "none", note}` and the plain CLI prints the note, including when no commit could be recorded. Text verdict headers accept `commit:` too.
- **Verdict findings (T-477).** CLI verdict comments accept repeated `--finding "high|medium|low:text[@file:line]"`; the terminal `@file:line` suffix is optional. MCP `task.comment` accepts `findings: [{severity, text, file?, line?}]` (inside `verdict` on the socket). Each entry needs a supported severity and nonempty text; an optional line is a positive integer with a file. Use `findings: []` for an explicitly empty review. The header stores single-line JSON `findings:` and derived `finding_counts:`. View, list and verdict journal records expose `findings` and `findingCounts: {high, medium, low}`; plain view prints the counts and every entry. Counts are recomputed from entries, never trusted from input. Legacy verdicts without findings retain unknown counts. Findings are part of the durable comment fingerprint, so editing them invalidates its evidence. Clear review verdicts with high or medium entries are refused with an error naming those findings and directing the caller to record `not clear`; low-only clear and omitted legacy findings remain accepted. QA result validation is unchanged. Reviewers record every finding, lows included. Relaunch Reviewer sessions after merge for the new MCP schema and clause.
- **Review scope (T-332).** Review verdicts require `verdict.scope` on the wire, `scope` on MCP `task.comment`, or `--scope full|delta|evidence` on the CLI: full for a first review or reworked design, delta after dev moved under a reviewed branch, evidence for suite evidence alone. QA, including stage QA, refuses scope. The verdict header writes `scope:` after `run:` and `commit:`; text headers carry it too. Additive `scope` columns in `tracker_verdicts` and `tracker_written_verdicts` preserve it through view, list, task events and restart. Older unscoped verdicts remain unknown; scope changes no merge-gate rule. The verdict-posted event names the scope. Relaunch Reviewer sessions after merge to load the MCP schema and clause.
- **Durable verdict evidence.** `tracker_written_verdicts` holds item, kind, result, run, commit, writer session id, role at write time and comment time, plus a fingerprint of the exact comment. This table is never rebuilt from item files. The separate file index gains `commit_sha` and `comment_key` with additive migrations. `task.view` and `task.list` give every verdict `source: "hub" | "file"`; a hub verdict also carries `writer: {sessionId, role}` from the stored evidence, never from `by:`. Each durable record matches at most one comment in write order; duplicate comments and out-of-order replays have file provenance, including when the original occurrence is removed. An unrelated hand edit preserves it; changing the verdict or its comment removes the match. Imported and hand-written verdicts have `file` provenance, even if their `by:` claims a Reviewer.
- **Freshness.** The latest verdict of each kind in file order carries `current: true | false` on view and list. It is current when its commit is the branch tip, or the whole diff from its own merge base has the same `git patch-id --stable` as the tip's diff from its own merge base. The base is the territory’s configured `cland.taskBase`, else `dev` when present, else the recorded default branch (`main` when absent); `verdictBase` says which was used (null if neither exists). Missing or unresolvable commits are stale, and so is a branch with no tip (once a tip read that started after the question finds none: until then it is unknown); unavailable Git facts never establish patch equivalence. Earlier verdicts omit `current`. The Neovim item view and plain CLI show the short commit, current/stale and from the hub/file; Neovim marks stale red. The merge gate selects the latest hub-written verdict, separately from file-only headers.
<!-- cland-allow-closed-wording: until the cache reply arrives describes runtime freshness -->
- **When freshness is computed** (T-67). Read requests (`task.list`, `task.view`) read only the cache; Git work for writes and merges is asynchronous. The hub keeps a cache of answers keyed by (verdict commit, branch tip, base, base tip) and reads every branch tip with one `git for-each-ref` every 2 seconds and about 50 ms after any tracker change; a verdict written through the hub records the tip it just resolved, so it is current at once. An answer the cache does not hold yet (a tip that moved, a verdict hand-edited in) is computed in the background, with separate task/stage and demo lanes, and `current` is absent until then: absent means unknown, not stale. When it arrives, the item is announced again as a `task` event, only if its freshness changed. So after a commit, a rebase or a branch rename, `view` and `list` can show the old answer for up to about 2 seconds, then no answer, then the new one. The background work never starts inside a read: a read that finds a new question only queues it. `verdictBase` comes from the same tip read (null until the first read). A verdict's commit (`--commit`, or the branch tip by default) is resolved with Git before the item is written, asynchronously, so a verdict write blocks no event-loop work; later queued tracker operations wait for it. When Git does not answer at all (it timed out or could not start), the write is refused with code `git-unavailable` and a message naming the commit or branch it could not resolve; nothing is written.
<!-- cland-allow-closed-wording: pending freshness is runtime readiness state -->
- **Ready and pending freshness (T-121).** Ready uses the merge gate's own durable provenance and freshness evaluation: a current clear Review is always required, plus current clear QA when the resolved stage or item override requires per-item QA. Tasks outside a plan use `[plan] qa_default`. QA-marked criteria require QA verification; plan changes recheck descendant tasks. It rejects evidence from the holder of an Implementer or Aide claim. Verdicts and branch-tip changes schedule this check off the merge path; status writes use the tracker queue and recheck branch tips, file evidence and the item index revision before rename. Every item index change requeues the check; a changed revision drops a prepared write. Status converges after queued watcher/index events, and merge always re-reads the gate evidence. During `review-pending` or `qa-pending`, the UI keeps the last settled status and the gate still refuses merge. Once the check settles, an unchanged patch keeps `ready`; a changed patch or failed/timed-out patch-id check returns it to `in progress`. A new verdict or changed branch/base tips provides a new cache key for another check. Invalidated or failed readiness checks retry with a 50 ms–1 s backoff and stop after ten failed attempts, posting one Agents notice with the item and error. The next item index, verdict or branch-tip event starts the check again.
- **Verifier holds.** Reviewer and QA take `task.hold` (`cland task hold T-n [--release]`) beside the Implementer claim; Reviewer sets `review`, QA sets `qa`. The assignee and claim stay independent. Holds live in `hub.db`, appear as `holds` in view/list/task events, and release on their holder's verdict, explicit release, session stop/death, or item close. A first hello atomically adopts claims, holds and durable verdict writer provenance (including text-header verdict comments) from the provisional name to the session id. The in-memory alias is published only after commit; a failed adoption fences verdict, claim and hold work until a queued retry succeeds. At hub startup and Sessions binding, the hub scans durable provisional claims, holds and writer provenance, reconstructs fences for every known session identity, and retries atomic adoption before real-id work. Unknown identities remain provisional. Gate and ready evidence also resolve identities through the hub’s authoritative session mapping. At startup, binding Sessions reconciles holds of known non-running process identities; unknown and direct identities keep their holds. Release without a verdict preserves the review or QA status while gate evidence is missing or pending, including release on stop and startup reconciliation. If the required verdicts are already clear and current, the gate evidence takes priority and the queued check settles at ready, including after a repeated hold is released.
- **The index** (items, labels, blockers, verdicts) is rebuilt from the files at every start. `--verdict review=clear` matches the item's latest verdict of that kind.
- **Claims** are a session's live hold on an item, kept in `hub.db` (they survive a restart), never written to the file and distinct from `assignee`. A claim is held by the claimer's identity, not its name: a spoke's session id (a rename keeps the claim; another session taking the old name gets none of it), or `human` / `cli:<name>` for the CLI, which is never a session. `view` shows the holder's name (`session`) beside its identity (`sessionId`); the holder claiming again refreshes the name. Another holder's claim is refused unless forced; closing an item releases its claim.

`cland task …` speaks to the project's hub over its socket (a hub must be running: `cland hub start`); every subcommand prints a human-readable summary, or the raw result with `--json`. In a launched session's shell (`$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` set), it sends its identity and its session credential. An explicitly present `$CLAND_LAUNCH_TOKEN` wins; otherwise the CLI reads the private fallback file bound to `$CLAND_SESSION_ID`. An invalid environment credential never falls back to the file. The hub attributes a session claim only when that credential belongs to the claimed stable session id; the project discovery secret grants socket access, not session attribution. The stored role controls permissions, regardless of `$CLAND_ROLE` or `--role`. `--as` cannot change a launched shell's identity. A known-session `--as` claim likewise needs its own credential. Unknown CLI labels remain human actors.

The session credential is retained privately in `hub.db`, outside snapshots, session lists, audit arguments and errors. It survives hub restart, native resume and PID replacement. Each accepted own MCP spoke connection or reconnect provisions a 0600 fallback file in `.cland/run/sessions/<session-id-hash>/` (0700 directory), with the session id inside the file as well. The reader refuses a mismatched id, a symlink, non-private permissions or a different OS owner. Relaunch rotates the credential after a confirmed stop and passes the new value to the new process. The serving hub performs credential persistence/removal asynchronously, serializing I/O by stable session id. Spoke welcome and queued delivery wait for credential readiness; relaunch waits for persisted rotation. Archiving a stopped session drains outstanding credential writers before removing its private run directory and publishing archive, including Claude's settings and fallback credential. Lifecycle ownership excludes a concurrent resume, and shutdown drains owned credential I/O before closing its storage. Claude Code's background shell and MCP configuration use private settings files (0600, in a 0700 directory), so native re-exec retains the credential without putting it in argv. Codex and OpenCode receive it in their own process environment; the spoke receives the same launch credential. Other sessions' environment values are filtered out at launch.

Sessions launched before this storage shipped keep their CLI after the shipping hub restart: their existing own MCP spoke reconnects, the hub retains any existing token supplied by that accepted own spoke (otherwise mints one), provisions the fallback file, and the same tokenless shell authenticates as its session without a relaunch. Until that reconnect, a call without a valid credential is refused with the claimed session name and guidance to reconnect its own spoke or resume with `--relaunch`. Ordinary native resume preserves the existing shell environment; its fallback file supplies the migration credential.

Relaunch rechecks the calling session's current permission after asynchronous credential preparation and through the native adapter's authorization callback. Preparation errors and revoked admission settle the attempt's role reservation before returning; a failed preparation never enters native resume. Shutdown waits for this lifecycle settlement before closing its storage.

This remains a single-user local trust model: all sessions run as the same OS user and can access the project's files. A shell presenting no session identity keeps acting as the human, by design. The credential check prevents casual or accidental use of another session's identity; it does not stop a deliberate process running as the same OS user, which can access those files. It is not OS-user isolation. Never log credentials or pass them in argv.

| Command | Tool | What it does |
| --- | --- | --- |
| `cland task create <title> [--kind] [--size] [--regression-of] [--found-by] [--version] [--body \| --body-file] [--label]… [--assignee] [--parent] [--blocked-by]… [--topic] [--branch]` | `task.create` | Writes a new item file. |
| `cland task view <id>` | `task.view` | Frontmatter, file path, ancestry, body, plan (and planError on an invalid hand save), criteria and their warnings, comments, verdicts and the claim. |
| `cland task plan <set\|show> <epic-id> [--file plan.yaml]` | `task.plan` | Validates and writes, or shows, the epic plan (Epic plans above). |
| `cland task list [--under T-n] [--state] [--label]… [--kind] [--assignee] [--verdict review=clear]` | `task.list` | Queries the index. Each item carries its claim and its verdicts in file order (the latest last). |
| `cland task comment <id> <text> [--verdict review\|qa --result clear\|"not clear" --run <id> [--commit <sha>] [--scope full\|delta\|evidence]]` | `task.comment` | Appends a comment, or a verdict. |
| `cland task edit <id> [--version] [--title] [--body] [--kind] [--size] [--state] [--status] [--label]… [--add-label]… [--remove-label]… [--assignee]` | `task.edit` | Changes fields; `none` clears the assignee. |
| `cland task close <id> [--comment]` | `task.close` | Closes the item. |
| `cland task link <id> [--regression-of] [--parent] [--blocked-by]… [--unblock]… [--follows]… [--unfollow]… [--topic] [--branch]` | `task.link` | Sets the links; `none` clears one. |
| `cland task hold <id> [--release]` | `task.hold` | Reviewer or QA takes/releases its own verifier hold beside the Implementer claim. |
| `cland task criterion <id> <op> …` | `task.criterion` | Done, verify, fail, add, edit, remove and normalize criteria with role and claim checks. |
| `cland task rank <id> --top/--before T-n/--after T-n` | `task.rank` | Moves among siblings with minimal rank writes; returns changed and ordered sibling ids. |
| `cland task claim <id> [--release] [--force]` | `task.claim` | Takes or releases the claim. Claiming an open task in a project with a territory makes or reuses its branch and worktree (Task branches and worktrees). |
| `cland task import-github [--repo owner/name] [--all]` | — (`task.import` frames) | Imports GitHub Issues as items (below). |

UI clients can send `{type: "task.list", id: "open-items", projection: "summary", state: "open"}`.
The optional `summary` projection returns id, kind, title, state, task status and size,
labels, parent, blockers, claim, verifier holds and criteria counts.
`open_blockers` resolves the still-open blocker ids in the hub's complete index.
Task events carry this field too; closing, reopening or deleting a blocker refreshes
its dependents. Unknown blockers remain open.
It retains version, explicit rank, updated/closed times for ordering and cache invalidation, and only the
latest verdict per kind in file order, including its original `round`, `scope` and
one-line `reason` for open items. Closed rows defer these three card fields to
the bounded by-id read below. Findings, bodies, comments, full criteria, plans, verification
and index bookkeeping are excluded; clients read those details through `task.view`. State and other existing
filters combine normally. Unknown projections refuse. Omitting `projection` preserves
the existing response, including the CLI's `cland task list --json`; the CLI adds no
projection flag. Neovim requests `state:"open", include_containers:true, paged:true` first:
this traverses the same item set as the connection snapshot: open rows and their ancestors.
`paged:true` is additive and accepts only open summaries, optional
`include_containers:true`, `cursor` and `limit` (1–100, default 100).
It returns `{items, total, next}` in numeric identity order. Each page admits at most
120 KiB of encoded UTF-8 rows, reserving space below the 128 KiB first-reply cap;
a single oversized summary refuses explicitly. Repeat with `cursor:next` until
`next:null`. Counts and row fields come from the complete index. Neovim accumulates
all pages before installing the initial item set, then replays task events buffered
throughout traversal. Retained replay plus the shared page journal have a
2,048-event / 2 MiB encoded-event bound. A page keeps its oldest valid late answer
and newest retry, with the existing retry backoff; both attempts share one capture
of task events, so retries preserve earlier-row updates without duplicating retained
events. Overflow discards all collected rows and replay, then restarts at the first
page. Other snapshot consumers keep their
per-read retry behaviour. A previous hub that omits `next` supplies one complete legacy
reply. Without `paged`, the legacy list response and ordering remain unchanged.
Web uses the existing items snapshot and CLI lists keep their full response.

The items snapshot contains open rows and the complete ancestor chain of each
open row, including a closed ancestor when legacy data puts open work below it.
Fully closed container subtrees stay outside the first payload. Retained rows
keep complete roll-ups from the full tracker index. The items domain also carries `done_items`,
the complete number of rows whose state is closed or task status is done. Task
mutation deltas, including file removals with `item:null`, carry the same
authoritative count, so hiding unloaded rows
preserves the total without client counting. Closed items of every kind are read per direct parent:
`{type:"task.list", id:"closed", projection:"summary", state:"closed", parent:"E-12", limit:100}`
returns `{items:[...], total, next}`. `parent:""` selects closed roots and closed items whose
parent is missing. Newly loaded containers expose their own child pages. A page contains at most 100 compact rows and reserves envelope
space below the 256 KiB reply budget; one oversized row refuses explicitly. Repeat
with `cursor:next` until `next:null`. Numeric task identity orders the cursor, so
re-ranking or deleting the cursor row does not skip later identities. `total`
counts matching closed items at that read; concurrent changes arrive as normal
task deltas. Clients replay those changes over a page in flight and deduplicate by
item identity. Closing tasks still arrive in deltas, leave the client's open set,
and update any loaded closed parent page. Reconnection renews requested pages.
Parent pages accept only parent, cursor and limit alongside the summary/closed
selector; ids and other list filters cannot combine with them.
Container summaries (including default lists and task events) include `child_counts`:
`total`, `done`, a sparse `statuses` histogram and `work` counts for `in progress`,
`review` and `qa`. The complete tracker index supplies these before list filters
apply, so unloaded closed children count from the first render. Progress counts a
release's direct containers and other containers' direct tasks; release work counts
all descendant tasks. Other work counts direct tasks. Closing, reopening, moving,
creating or removing a child publishes changed parent/ancestor task events;
clients do not need to re-read the list. Closed rows still load only on demand.

Item snapshots, summary lists and task deltas also carry `summary: {text?, from,
provenance}`, `blocked`, `derived_status`, `glyph` and `layer`. The summary follows
the plugin's `explorer_summary.lua` rule (v0.1.2 §3.9): an explicit `## Summary`
wins verbatim; otherwise the first eligible prose paragraph or list item supplies
up to two sentences and 50 words, after leading provenance sentences are removed.
`from` is `written`, the source section heading, or null for the body. `provenance`
is the fallback line shown by the Lua card, or null for written/empty summaries.
`blocked` means an unfinished item has an unresolved blocker, including an unknown
id; an active task keeps its status glyph even when blocked.

For open items, card facts also travel in snapshots, summary lists and task deltas:

- `verdicts[].reason` is the matching verdict comment's first sentence, collapsed
  to one line and capped at 96 Unicode code points. The subtree's
  `rollup.latest_verdict` carries the reason too. `round` counts that verdict kind
  in file order; `scope` remains the recorded source/evidence review scope.
- `decision: {text, by, at}` is the latest comment beginning with `Resolution`
  or `Decided` (optional Markdown heading/emphasis), using the Lua card's summary
  rule. Its single-line text preview is capped at 300 code points. Both prose
  previews end with `…` when truncated; full comments stay in `task.view`.
- `created`, `branch`, `regression_of` and `follows` supply the card's dates and
  relations. `verify` is null or the latest compact receipt: `{id, executor,
  state, result, head, finished, cached?:true}`. It omits artifact paths and the
  full cache lineage. These transport-only fields travel in open item snapshots
  and deltas; ordinary `task.list` summaries omit them to protect Neovim's first
  payload budget. By-id pages include the complete compact tree row (identity, kind, title, state,
  parent, counts and relations) alongside those card facts for any item, so item-id
  links can load a missing row and walk its ancestors without reading its body.
  Each page retains the 256 KiB bound. Closed rows receive
  them only on that page.
- `agents_text: {sections, words}` lists the body's level-two headings in order
  and its whitespace-delimited word count, matching `explorer_summary.outline`.
- Every container with an accepted plan, open or closed, carries `stages`, in plan order:
  `{name, state, qa, merged, total, statuses}`. States use the existing stage gate;
  `merged` counts closed members with a dev landing receipt (closed non-task
  members need no task receipt), and `total` includes every planned member,
  including unloaded closed items. `statuses` is the complete sparse histogram.
  Stage facts refresh on member changes, plan edits and stage-cover settlement.
  Lane membership, QA evidence and full plan history remain on demand through
  `task.plan show`; that detail response includes the same stage counts.

These facts let a card read verdict reasons, decisions, stage states and the text
fold line without fetching each item's full text or each epic's plan. Neovim's
stage counters consume the hub's counts; the rest of its card-detail adoption is
separate work. Older hubs retain explicitly labelled loaded-only counters.

A container has `next` (the first unblocked planned task in rank-ordered tree
order, with open ancestors, or null) and `rollup`: the highest descendant-task
`layer` (or null for no tasks), `stage` (`{number,total,name}` for the first open
stage, else null), `claims` (`{item,claim}`), `holds` (`{item,hold}`),
`latest_verdict` (the subtree verdict with its item id, title and round, else null),
and `last_activity` (`{at,item,title,source}`). Verdicts come from descendants;
activity includes the container itself and topic messages. Equal verdict times
choose the later row in rank-ordered traversal; equal activity times retain the
first source. Open containers whose children are all done remain backlog until
the container closes, matching Lua. The top-level `layer` is the item's visibility;
`rollup.layer` is the container card's derived task layer.

The 2026-10-21 T-1052 decision keeps the items snapshot cap at 1 MiB. Only open
items carry `summary.text` in ordinary snapshots, lists and deltas. Closed items
retain provenance and the inexpensive fields. Read their full text in batches:
`{type:"task.list", id:"closed-text", projection:"summary", ids:["T-12","T-14"]}`
returns `{items:[{id,summary,agents_text,decision?,verdicts,created,branch,regression_of?,follows?,verify}], remaining:[...]}`.
The 2026-10-21 T-1058 Coordinator decision puts closed items' card facts on these
same pages: verdict reasons, rounds and scopes, Decision previews and text outlines
stay out of closed snapshot/list/delta rows. Stage facts remain on all planned
containers. The copied-live boundary test measures and asserts the items snapshot
at or below 50% of 1 MiB after excluding fully closed subtrees. The Lua differential
guard recursively restores closed rows through parent pages, deduplicates retained
ancestors by identity, and compares every body.
Supply at most 100 ids and repeat
with `remaining` until empty. Each page reserves envelope space within the 256 KiB
reply budget; an individual text-and-card row exceeding that budget refuses explicitly.
Ids require the summary projection and the existing `task.list` read permission.
The CLI's flags are unchanged. Full agents' text still comes from `task.view`.

These fields are in-memory projections, never written to item files (ADR 0002).
Parsed-body summaries are cached at indexing. A change recomputes that row and
its ancestor chain from cached child aggregates; a move also invalidates the old
chain. Ancestor state/reparenting changes also invalidate descendant containers
whose effective `next` changes, since Lua checks parents above the scoped
container too. Ordinary task edits still touch only their ancestor chain.
Blocker-state changes invalidate dependents and their ancestors; topic
messages and visibility changes invalidate the affected context and chains.
Only changed rows are published, including stage-only changes on asynchronous
cover/tree settlement and freshness/claim/hold changes. Pending verdict
freshness remains guarded.
`explorer-recomputed` diagnostics name the touched ids and synchronous duration;
they exclude file I/O, transport and Git waits. The differential test preserves
Lua parity on every copied tracker body, fetching closed text through bounded
pages, and checks the copied snapshot cap (833,088 bytes for 1,063 copied items plus three ancestor-regression rows on
2026-10-21). Oversized open sets still refuse atomically; item-domain paging is
separate work.

Lane order is a separate `follows` list beside `blocked_by` in epic frontmatter. Set it with `cland task create "Next epic" --kind epic --follows E-1`, or `cland task link E-2 --follows E-1`; remove an edge with `--unfollow E-1`. Repeated flags and the matching `task.create` / `task.link` tool fields take multiple ids. Any recognized prefix or bare number resolves to the canonical epic id; non-epic endpoints and cycles refuse. `task.view`, the card and explorer show follows beside blockers. Only `blocked_by` marks an item blocked.

A follow is met when its predecessor is closed, or has task children all closed with its last ticket merged on dev. Plain `task view` shows `follows E-1: met` or the open tickets (and explains an empty or unmerged predecessor); JSON supplies `followStatus`. Prepare the next epic’s tickets and plan while every ticket of the predecessor’s last stage is in review, then launch its first stage on the last merge, subject to real blockers and plan approval.

While that open predecessor’s follow is met and its demo is pending, the merge gate returns `merge-hold` only for follower tickets touching its merge surfaces. The exported `epicMergeFiles(root, taskIds, ref, env?)` helper in `src/tracker/epic-surfaces.ts` reads `Item:` trailers on dev and includes both sides of renames and deleted paths. The gate names the predecessor, pending demo and overlapping files. Unrelated files merge at once; either recorded hub QA demo verdict (clear or not clear, excluding stage verdicts) or predecessor closure releases the hold. Epic demos still close epics and gate release.

The frames are `{"type":"task.<op>","id":"<request id>","item":"T-1",…}` with fields named as in the frontmatter (`labels`, `blocked_by`, `add_labels`, …); a CLI frame may carry `"as":{"name":…,"role":…}`, a spoke's always acts as its own session. The tools take the item as `id`.

### Importing GitHub Issues

`cland task import-github [--repo owner/name] [--all]` is the one-shot bootstrap of the tracker from a repository's GitHub Issues (spec 6). During onboarding, an Aide imports the existing project's open issues on the human's confirmation; existing projects with an explicit `[aide.permissions] tools` list add `"task.import"`. It reads GitHub through the `gh` CLI with the user's own login (no token is stored anywhere): the issues (pull requests skipped; open ones, closed too with `--all`; the repository defaults to the first GitHub repository named by `github`, then `origin`; pass `--repo owner/name` when neither names one), each issue's comments and its `blocked_by` dependencies; the parent comes from the issue's sub-issue relation. The hub then writes one item per issue:

- `kind` from the labels: `epic` → `epic`, `wayfinder:map` → `map`, `wayfinder:task` → `task`, any other `wayfinder:*` → `question`, else `task` (as the own-tracker template files them); `title`, `state`, `labels`, `assignee` (the first assignee) and `created` as on GitHub; the body verbatim (CRLF made LF, and a line the file format would read as structure, `## Comments` or a `### <author> · <time>` header, escaped with a backslash).
- `parent` and `blocked_by` mapped to the items of those issues; an edge to an issue that has no item (a closed one without `--all`) is kept as `github:#<n>` and resolves on a later run that imports it.
- Comments as `### <login> · <GitHub time>`, each opening with `<!-- github-comment: <id> -->`.
- An optional `github: {repo, number, url}` in the frontmatter, kept through every write and otherwise ignored by the hub.

It is idempotent: a re-run finds each item by its `github` reference, rewrites title, body, labels, state, assignee, kind and edges from GitHub, appends only the comments whose id it does not hold yet, and keeps what GitHub does not own (`topic`, `branch`, local comments, the id and the file name). An item whose text would not change is not written, so with GitHub unchanged the files stay byte-identical and `updated` does not move. It prints the counts (created, updated, unchanged, comments added) and one line per issue (`--json` for the raw summary).

