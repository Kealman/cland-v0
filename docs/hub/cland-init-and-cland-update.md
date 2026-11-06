## cland init and cland update

Successful `cland init` reports end with `next: cland setup`, including when every managed part is already current. Its `--json` object includes `"next": "cland setup"` beside `root`, `version` and `changes`. `cland update`, `cland init --undo` and refused init attempts omit the next step.

`cland init` seeds the open root categories Bugs, Tech debt, Follow-ups and Ideas through the tracker, using its shared numbering (C-1 through C-4 in a new project). An existing open root category with the same title is preserved. The report names each created category, or reports `unchanged` with "the four categories are present". When init makes the first commit, it includes the four item files. `cland update` does not seed categories. Init and `cland task migrate` share the same category titles.

If the project's `[tracker] levels` has no root `category` kind, including `levels = []`, init preserves that ladder, seeds nothing and reports "categories skipped: the ladder has no root category".

`cland init [dir]` prepares a project (`dir`, else the project around the current directory); `cland update [dir]` rewrites what cland manages there to the running version and refuses a folder without `.cland/`. Both need no hub, are idempotent and print one line per path they touched (`--json`: `{root, version, changes: [{path, action, note?}]}`, actions `created`, `updated`, `unchanged`, `kept`, `removed`). A file is written only when its bytes change, so a second `cland init` changes nothing, mtimes included.

Before writing anything, `cland init` refuses a shallow clone: `cland init: the territory needs the full history: run git fetch --unshallow, then cland init again`. Fetch the full history in that clone, then retry. `cland update` also refuses a shallow project that has a territory, with the same recovery command; projects without a territory can still be updated.

Managed files and blocks carry `managed by cland <version>`. A file or hook without that mark is the project's own and is reported as `kept`, except that the project's `.claude/settings.json` receives the cland hooks and managed `worktree.bgIsolation` key below. The curated skill set is the exception: it includes cland's own skills and kept upstream skills. Kept upstream skills record their origins in their headers and cland's changes in per-skill `CHANGES/` directories (`metadata.changes: CHANGES`), one file per entry, so copied upstream skills retain independent provenance additions through merges and squash landings; see [skill maintenance](../../skills/README.md). The manifest's mark and per-file SHA-256 hashes record each installed skill. Update decides on the whole skill: an untouched copy is refreshed, and a skill edited in the project is kept whole with its install hashes.

Nothing is written or removed through a symbolic link: every destination and each folder above it inside the project is `lstat`ed first, and a link among them leaves the path alone, reported as `kept` with a note starting `symlink:` (a managed skill file or folder, `AGENTS.md`, `docs/agents`, `.claude`, …). A write goes to a fresh temporary file renamed over the destination, so it never follows a link planted after the check at the file itself. The folders above it are pinned too: each one's device and inode is noted before the temporary file is created and compared again just before the rename, so a folder swapped for a link (or another folder) in between refuses the write (`kept`, `symlink:`) and the temporary file is removed. What remains, as Node has no `openat`/`renameat`: a swap in the instant between that second check and the rename, and a temporary file left in a folder moved away after it was created. `CLAND_TEST_INIT_WRITE_PAUSE_MS` with `CLAND_TEST_INIT_WRITE_PAUSE_PATH` (tests only) holds the write of that path still after its checks. The managed set:

| Path | Committed | How it is managed |
| --- | --- | --- |
| `.cland/.gitignore` | yes | The hub's own rule: rewritten while its first line carries the mark. |
| `.cland/config.toml` | yes | Written with the defaults; `update` rewrites it to the current template and keeps the values it finds. |
| `.cland/crew.toml` | yes | Staffing policy, written once with defaults; reloaded on change, keeping the last good version. |
| `.cland/roles.toml` | yes | Written with the defaults when missing, then the human's: never rewritten (`roles.toml` above). |
| `.cland/tasks/.gitkeep` | yes | A mark line. |
| `.cland/tasks/C-*.md` | yes | Init creates missing open root categories Bugs, Tech debt, Follow-ups and Ideas through the tracker before its first commit. Existing categories keep their bytes; update does not seed them. |
| `.cland/hub.db` | no | The General and Agents topics, created through the store as the hub would at its first start. |
| `.agents/skills/<name>/` | yes | The curated skill set: every skill of cland's own `.agents/skills/` (`skills/README.md`), read relative to the cland package. `.agents/skills/.cland-manifest.json` records each installed file's SHA-256. When all listed files still match and no file was added, `update` refreshes the entire skill, removes obsolete files and records the current hashes (`updated`, or `unchanged` if already current). A changed, deleted or added file keeps the whole skill: `kept`, note "edited in the project", plus "cland ships a newer version" only if cland's current copy differs from the install hashes. Kept entries retain those hashes across runs; undoing an edit makes a skill eligible for refresh again. A project copy equal to cland's current copy is `unchanged` and adopts its hashes. To take cland's version of an edited skill, remove the folder, then run `cland update`. A new skill is `created` unless a folder of that name already belongs to the project: that folder is `kept` and stays out of the manifest. Each kept skill has its own line and note in text and `--json`. Legacy manifests listing paths without hashes retain their earlier update behavior. The manifest is validated before anything is touched: the mark in `managed`, names `[a-z0-9-]+`, relative paths with no `.`, `..` or empty segment inside `.agents/skills/<name>/`, and hashes of 64 lowercase hex characters; an invalid one is `kept` and no skill is installed, updated or removed. |
| `.claude/skills` | yes | A relative symlink to `../.agents/skills`. When the project already has a `.claude/skills/` folder it is kept, and gets one symlink per cland skill (`../../.agents/skills/<name>`) beside the project's own. |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | yes | `skills/templates/docs/agents/*` with a first line `<!-- managed by cland <version>: … -->`. An existing file without it is kept and reported. |
| `AGENTS.md` | yes | A block between `<!-- cland:begin managed by cland <version> … -->` and `<!-- cland:end -->` (`skills/templates/AGENTS.block.md`): obey hub events, tasks through `cland task`, artifacts through the hub, sub-agents never use the hub. With a territory: `cland release` publishes versions; `cland publish` is the only out-of-release GitHub push, after a human approval ask; without one: pushes to GitHub only on the Coordinator's decision. Rewritten in place; appended to a file without it; the whole file when there is none. Text outside the block is never touched. |
| `CLAUDE.md` | yes | Never created (its presence stops Claude Code from reading `AGENTS.md`). An existing one gets `@AGENTS.md` under a mark comment, unless it imports `AGENTS.md` already. |
| `.claude/settings.json` | yes | The cland hooks merged in: one entry per event of the Claude Code adapter (`SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure`, `PermissionRequest`, `PostToolUse`, `Notification`, `Elicitation`, `SessionEnd`), `async`, after the project's own. Their command is `[ -n "$CLAND_SESSION_NAME" ] \|\| ! command -v cland >/dev/null 2>&1 \|\| cland hook <event> # managed by cland <version>`: `cland` from the PATH, no machine path, the mark as a shell comment by which `update` finds and replaces them. `worktree.bgIsolation = "none"` is also managed: Claude Code 2.1.143+ background sessions can edit the working copy without EnterWorktree, with reach controlled by cland's hub and roles. `update` restores `"none"`; a human can restore isolation in `.claude/settings.local.json`, which takes precedence and which `init` and `update` never read or write. Every other hook and setting, including `worktree.baseRef`, is kept, in its order; a file whose content does not change keeps its formatting byte for byte. A file that is not valid JSON is kept and reported. |

The project hooks are for a Claude Code session started by hand, and do nothing where `cland` is not on the PATH. A session the hub launches already gets the same hooks, naming its session and hub file, through `--settings`, plus the cland mod (`--plugin-dir`) and the spoke (`--mcp-config`); there `CLAND_SESSION_NAME` is set and the project hooks stand aside. The mod is therefore not provisioned into the project: it needs the session's identity, which only a launch has, and its path would be a machine path. Committed files never hold a machine path or the secret.

### Local git territory

In an empty folder or a folder with the project's own files outside any repository, `cland init` runs `git init -b main`. In a repository without commits, it keeps the unborn branch name (including `master`). Both receive `Initial commit: cland init`, with the managed paths listed in the commit body. A repository with history keeps its commits and index.

The first commit includes only files created by this run under `AGENTS.md`, `.cland/`, `.agents/`, `.claude/` and `docs/agents/`. Pre-existing files stay outside it, including an `AGENTS.md` or `.claude/settings.json` that init merges into, and pre-existing managed files it refreshes. Whether a future init should adopt previously managed files remains an open question. Human files keep their bytes and mtimes except for the documented managed merges. Human staged entries stay staged with their original blobs; Git's `commit --only` commits cland's paths and leaves them in the real index. Ignored paths are reported as `not committed: ignored by Git` and never forced in. `.cland/.gitignore` excludes volatile state.

When Git has no explicit `user.name`/`user.email`, `author.name`/`author.email` or `committer.name`/`committer.email` configuration and no author, committer or `EMAIL` identity environment variables, this commit uses command-local `cland <cland@local>` and the report says `as cland <cland@local>: no Git identity is set`. Git configuration files are never changed for this fallback; an explicit identity, including a partial one, is left for Git to validate. Commit hooks and signing are disabled for that command. Init seeds the territory's `dev` and default branch from the first commit and switches the root to `dev`, preserving untracked and staged human files because the source and destination commits are identical. The report names `.git` when created and the branch holding the first commit. Running init again makes no commit; `cland update` never creates a repository or a commit.

In a Git project, `cland init` creates the local bare repository `.cland/territory.git`, renames an existing `origin` to `github` (including branch upstreams), and makes the territory `origin`. Without an existing origin, it adds only the territory, including in a folder where init has just created the Git repository. If both `origin` and `github` already exist, it refuses before changing either: rename the existing `github` first. An unrelated repository already at the territory path is also refused.

All effective origin fetch and push destinations must point to the territory. Re-running init repairs extra URLs or push overrides on an existing territory origin; doctor reports them as failures. Git URL rewrite rules that still redirect the repaired URLs outside the territory are refused and must be fixed in Git config.

Init chooses the repository’s default branch before renaming `origin`: the target of `refs/remotes/origin/HEAD`, then local `main`, then `master`, then the sole local branch. An ambiguous repository is refused before writes, naming the branches and how to choose with `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/<branch>` or a branch named `main`. An unborn repository uses the branch of its first commit. The territory records this once as `cland.defaultBranch`; an older territory without the setting reads `main`. It creates `dev` from that default when absent and seeds the default and `dev` with a push to the local bare path, never to GitHub. Existing territory refs are preserved. The territory's `HEAD` points to `dev`, and so does the root's `origin/HEAD` (`dev` fetched from the bare path, then `git remote set-head origin dev`), so tools that branch from origin's default branch start from `dev`. One such tool is Claude Code's sub-agent worktrees under `worktree.baseRef: fresh` (decision D8). For a repository with history, a clean root on the default branch switches to `dev` before any managed files are generated; a dirty root, another branch or detached HEAD stays in place, with a reason in the report. For an unborn repository, init makes the first commit on its existing branch, then seeds `dev` from that commit and switches the root to `dev` while preserving human files and staged entries. All Git steps appear in text and `--json`, including `unchanged` on a second run. Report paths under `territory.git` include named operations (`remotes/origin`, `local-dev`, `root-branch`) as well as real files.

The root lives on `dev`: the Coordinator commits tracker and docs work there directly; task work reaches `dev` through `cland merge`; the default branch (`main` unless the territory records another) moves through `cland release` and `cland sync`. The territory's executable `update` hook reads `cland.defaultBranch` at run time (falling back to `main`) and refuses updates and deletions of that branch and `dev` without cland's marker, naming the protected branch and required commands. Task branches remain free, force pushes included. This is a workflow guard on a local repository, not a security boundary against its owner.

`cland init --undo [--force]` undoes only the territory step; managed skills, configuration and docs remain. It removes the territory origin and renames `github` back to `origin` only if init performed that rename, carrying upstreams back. If init switched the root to `dev`, undo restores the recorded original default branch when the root is still on `dev` and has no tracked changes; other or dirty branches stay put with a note. Git refuses any checkout that would overwrite an untracked file. The local `dev` branch is kept. Before any mutation, undo reads every destination in `remote.origin.fetch`, including custom wildcard and exact mappings, to identify the root tracking refs that remote removal will drop. It checks both those root refs (even without a territory copy) and every territory ref against objects reachable from surviving root refs: branches, tags, other remotes and HEAD. Symbolic aliases do not count as independent copies. If work would become unreachable, undo refuses and names the refs; preserve the work under a surviving ref or use `--force` to discard it. A dropped ref whose tip survives in another ref's history needs no force. Undo state is kept in the bare repository's `cland.*` config. Both undo and update rewrite the instruction block for the resulting presence or absence of a territory; update refreshes an existing territory but does not create one in an opted-out Git project.

The D15 migration interim ended when the repository moved its root checkout and task base onto `dev` after T-59. Task work now reaches `dev` through `cland merge`; only `cland release` pushes the default branch and a release tag to `github`. `cland sync` imports collaborators' work.

<!-- cland-allow-closed-wording: until fulfillment describes runtime lock ownership -->
The module interface for later hub commands is small: `territoryPath(root)` gives the absolute bare path; `withTerritoryLock(root, () => ...)` holds synchronous or asynchronous operations exclusively across processes. A synchronous callback returns its value directly; a Promise callback keeps the lock until fulfillment or rejection and returns a Promise with the same outcome. Do not nest locks. `territoryGit(cwd, args, marked = false, input?)` runs Git without a shell, with a 30-second deadline, and returns trimmed stdout or throws; optional `input` supplies stdin (used for reachability traversal without a command-line size limit). Pass `true` only for a guarded cland operation's push to protected refs; it sets `CLAND_TERRITORY_WRITE=1` for the child. The marker is an accident guard: the local owner can set it manually or change/bypass the hook. The lock `.cland/territory.lock` uses the hub lock implementation (exclusive creation, stale-process recovery); an overlapping caller is refused with the live holder's pid unless it opts into bounded backoff: host receive waits up to 30 seconds and public lease revoke up to 32 seconds. Exhaustion retains the same refusal. `provisionTerritory(report, root)` and `undoTerritory(root, force)` acquire it themselves; `territoryProblems(root)` is read-only. `defaultBranch(root)` reads the recorded default with a `main` fallback; async hub callers may pass their already-read, lowercased Git configuration map as its second argument to avoid synchronous Git. The task worktrees add `taskBase(root)`, `ensureTaskWorktree(root, {id, slug, branch})`, `listTaskWorktrees(root)`, `commitsAhead(root, branch, base)` and `removeTaskWorktree(root, item)`. They return Promises and run Git through `territoryGitAsync` (`execFile`, awaited), so the hub's event loop never waits on Git. The two that write take the lock themselves, through `withTerritoryLockAsync`: the same lock file, taken with `acquireLockAsync` (`src/hub/lock.ts`), which awaits its `ps` probes and asks the process's own start time once. The hub queues these operations one at a time (`src/hub/worktrees.ts`), because the lock refuses a second holder instead of waiting for it. Init runs these without a hub; worktree, merge, release and sync commands call this module from the hub under the same lock (T-20 decision D2).

Merge admission and batch preparation refuse a project root whose Git repository is
bare with `merge-bare: core.bare=true in project root <path>`. This is distinct
from the intentionally bare territory. Inspect the root's shared Git config and,
if it was accidentally changed, restore it with `git -C '<root>' config --local
core.bare false` before retrying. The hub never repairs it automatically. Linked
task worktrees share this config, so Git experiments must use disposable clones,
a scratch HOME/XDG/config and the sealed fixture environment after overlays.

### Git object maintenance

Each project hub start schedules one background collection 30 seconds after its
serving receipt. Maintenance does no Git I/O during startup, and status/ordinary
requests remain available while it runs under the territory lock. The pass
collects the common project repository and existing local bare territory. Once
it runs, it reasserts the same repository-local policy described below.

#### Repository auto-maintenance configuration

`cland init` and `cland update` set repository-local `gc.auto=0` and
`maintenance.auto=false` in the common project repository and existing bare
territory. Task worktrees inherit that common configuration, so ordinary
`git fetch` does not start implicit maintenance. Update also repairs changed or
missing values, without creating a territory in projects that have none. Explicit
command overrides or worktree-specific Git config can supersede these values.
Global config, upstream repositories and executor clones are unchanged.
`cland doctor` reports both local values for each repository, warns on missing or
different values, and suggests `cland update`; diagnosis never writes Git config.
This warning is advisory and introduces no failing gate. Existing role clauses
cover init/update and doctor; no additional permission is needed.

With no retained work, `git gc --cruft --prune=2.weeks.ago` applies a 14-day grace
to loose and packed unreachable objects. Fresh objects and their descendants
survive concurrent admission; native verification snapshot writes freshen reused
object identities. See [Git's GC safety notes](https://git-scm.com/docs/git-gc#_notes)
and [cruft expiry](https://git-scm.com/docs/git-gc#Documentation/git-gc.txt-gcpruneExpire).
Any retained `suite-jobs` row, `merge-batch`, cached or on-disk unreleased executor
lease, incomplete lease directory, or unreadable activity state disables expiry
for the entire pass (`--prune=never`). Expired leases stay protected until release
is confirmed. Reflogs and worktree metadata are preserved. An idle pass after a
later restart permits expiry again; landings do not start another pass.

Each native command has a 30-second deadline. A private POSIX Node `execve`
gate records its PID, native UTC start identity and detached process group in
`.cland/run/git-maintenance-owner.json` before Git starts, preserving that
identity across exec. Stop cancels the delay or signals the owned group. Normal
native close and group disappearance clear ownership. If bounded close remains
incomplete, the durable receipt keeps the territory owned by that collector;
maintenance is not announced completed. The parent releases its native child
and pipe observation handles so normal hub shutdown can exit within its bound;
this release never counts as collector death.

After serving on restart, or before the first synchronous/asynchronous territory
mutation, recovery checks that receipt. A gone group recovers; a matching live
group is signalled and checked with a bounded wait. A changed PID identity is
never signalled. An unverified or surviving group retains ownership, refuses
territory mutations and reports its PID to the Coordinator; serving and reads
continue. Recovery clears only its matching dead same-host `gc.pid`, preserving
possible replacement locks after PID reuse. No pack file is manually removed;
fresh interrupted and foreign temporary packs retain the grace. Older native
stale `gc.pid` files without cland receipts still use Git's own recovery rule.

Foreground native GC retries despite a stale `gc.log` and clears it on success.
`.cland/run/git-maintenance.json` records the completed attempt, expiry policy
and repository failures. `cland doctor` reports one `git maintenance` row for
current owner receipts/logs, failed collection or a recovered log. Doctor is read-only,
including with `--fix`. See [agent recovery guidance](../agents/git-maintenance.md).

### Task branches and worktrees

In a project with a territory, a task's branch and worktree come from cland, never from the harness (T-58; T-20 decisions D3, D7, D8):

- **A claim.** The first claim of an open item of kind `task` (`cland task claim T-12`, the `task.claim` tool, anyone's) creates the branch `t/T-12-<slug>` at the base branch's tip, the slug being the item file's (`T-12-fix-the-parser.md` → `t/T-12-fix-the-parser`), and the linked worktree `.cland/worktrees/T-12/`. The worktree is linked to the project's own repository, so it shares the root's objects and refs, and the territory stays `origin`. The hub writes `branch:` into the item and records a `worktree` notice in Agents (`T-12: branch t/T-12-fix-the-parser from dev and worktree .cland/worktrees/T-12 created for impl-12`; journal `task-worktree`). An item that already names a branch keeps that branch. Every later claim, including one after a release, reuses the branch and the worktree, and a worktree folder deleted by hand is made again on the same branch. The claim's result carries `worktree: {item, branch, path, base, createdBranch, createdWorktree}`. When there is no worktree, it carries `worktree: null` and a `reason`, and the claim holds all the same. Releases, epics, specs, questions, maps, closed items and projects without a territory get none (`T-1 is an epic: only a task gets a branch and a worktree`, `T-5 is closed: no worktree`, `the project has no territory (cland init makes one): no branch or worktree`). A Git failure gets none either, with the reason prefixed `no worktree:`.
- **The base branch** is the territory's `cland.taskBase` when set, else `dev` when the project has it, else the recorded default branch (`main` when absent; `taskBase(root)` in `src/territory.ts`). The override must name an existing local branch; `cland doctor`'s `territory` check fails when it does not.
- **A launch with an item.** `cland session launch impl-12 --role implementer --item T-12` (the spoke's `session.launch` with `item`, the launcher form's `item` line) makes or reuses the worktree, starts the session with its cwd there, and only then claims the item for the session, by its session id. A Coordinator's or the human's claim is taken over (Agents: `impl-12 [Implementer] claimed T-12 (taken over from coord)`). Any other session's claim refuses the launch before anything starts, as does a Git failure while making the worktree, so the worktree always exists before its session. If another session takes the claim while the harness is starting, it keeps it: the launch is refused, naming the holder, and the session just started is stopped. A second launch for an item whose launch is under way is refused. `item` is for an Implementer: another role, or `item` together with `cwd`, is refused. A Reviewer or QA session meant to stand in the worktree gets `cwd`. An item that gets no worktree launches at the project root, with the claim and the `reason`. The result is `{process, claim, worktree, reason?}`, and the process row records `item` (the sessions panel shows the item beside the session either way, through its claim).
- **The worktree-creation refusal (D8).** A Claude Code session launched with an item gets a `WorktreeCreate` hook (synchronous, not `async`): `cland hook worktree-create --session <name> --launch <id> --worktree <path>`. Claude Code runs it in place of its own `git worktree add`, for `--worktree` and for sub-agents with worktree isolation alike. It exits 2 with `cland: impl-12 works in its own task worktree <path>; another worktree is refused. Work there (cd <path>), on its branch.` on stderr, which the harness shows. It also tells the hub (journal `worktree-refused`, a `worktree` notice in Agents). Only sessions launched with an item get it: the Coordinator's sub-agents still make their own worktrees, and so does any session launched without an item. Codex and OpenCode make no worktrees of their own.
- **`cland worktree list [--json]`** shows each worktree under `.cland/worktrees/` with its item, branch, the item's title and state, the commits its branch has that the base lacks, and the sessions whose cwd is inside it (connected spokes and running launched harnesses). From a session's shell it is allowed: it only reads.
- **`cland worktree prune [--yes] [--json]`** is the human's (refused from a session's shell with `forbidden: worktree.prune (only the human may do this; …)`). It lists the worktrees of closed items with their unmerged commits (those not on the base branch). It removes each worktree and its branch only after a `y` on stdin (`--yes`: all of them), and keeps one in which a session still stands or a launch for its item is under way. The item's state and the sessions inside are checked again under the territory lock right before each removal, so an item reopened, or a session that entered, while prune read Git keeps its worktree. Git's `worktree remove` refuses a worktree with uncommitted or untracked changes, and the failure is shown. Its first job on cland's own repository is the merged worktrees of T-48 and T-49.

The frames: `worktree.list` → `{worktrees: [{item, path, branch, title, kind, state, sessions, base, ahead}]}`, and `worktree.prune` → `{candidates}` with `dryRun` or no `items`, `{removed, failed}` with `items`.

Task preparation links an absent worktree `node_modules` to the root install,
including root-only tools such as `playwright-core`. Existing directories and
links are preserved. The claim/launch result's optional `worktree.warning` names
the worktree and whether a stale install is its own directory or a link; freshness
compares lockfile package versions/integrities with npm's hidden install lock
and checks actual installed package manifests/versions. Missing optional packages
and optional bindings for other OS/CPU targets are legitimate omissions.
A missing root install is reported for Node projects. Preparation never installs.

### The merge gate

A changed `package-lock.json`, or a `package.json` change to `dependencies`,
`devDependencies`, `optionalDependencies`, `peerDependencies`, `overrides` or
`workspaces` (including workspace manifests), produces a required root
`npm install` notice. Scripts, version and other metadata changes alone omit it.
The queue compares manifests at the candidate's merge base and head; landing
compares the landed commit with its parent. Missing or malformed manifests keep
the warning conservatively. Landing never runs npm or replaces the shared dependency tree. Stop shared readers before the Coordinator
updates that install. Queue entries and landing results add optional
`dependencies: {files, command: "npm install", cwd}`; plain `cland merge queue`
and `cland merge` print it, the durable landing comment retains it, and batch
landing sends it to the enqueuer and item lead. A resumed landing reads the same
facts from the landed commit, so cleanup retries retain the requirement.

`cland merge T-12 [--json]` and the Coordinator spoke's `merge {item: "T-12"}` share one frame, `{"type":"merge","id":…, "item":"T-12"}`. The human may run it from their own shell. Implementer, Reviewer and QA calls, including their shell's CLI calls, are refused by the permission table and recorded in Agents.

Every acceptance criterion must carry both a `done` mark and a `verified` mark. A failed criterion refuses too. `criteria-incomplete` lists each incomplete criterion by id and text and says which marks it lacks; it moves no refs. A checked box alone supplies neither mark. An item with no criteria passes this check. `ready` uses the same check: adding an unmarked criterion or failing one returns a ready task to `in progress`; completing and verifying every criterion permits ready once the required verdicts are clear and current. Verification can come from a clear verdict with `--verified` or a separate Reviewer/QA `task.criterion verify` operation.

The human's `--override "reason"` bypasses verdicts and criteria together only for tracker and documentation changes: `.cland/tasks/**`, `.cland/RULES.md`, `docs/**`, `GLOSSARY.md`, files named `README.md` in any directory, and `qa/briefs/**`. The immutable merge candidate is checked against its task base; deletions and both sides of renames count. Any other path refuses with `merge-override-scope`, naming every disallowed file, before refs or the checkout change. Configuration files and skill instructions require review even when they are Markdown. When incomplete criteria are skipped, each merge validation records a `merge-criteria-overridden` journal event with `id`, `override` and `criteria` (the skipped ids, text and missing marks). These audit events describe the bypass even if a later scope or Git check refuses the merge. Sessions cannot override; conflicts and dirty touched files still refuse.

Before requesting the final review, the claiming Implementer marks every criterion done. When only done marks keep the item from ready, the hub sends one notice to the claimant in its item topic, listing the missing criteria and their `cland task criterion T-n done C<n>` commands. For the same claimant the notice repeats only when the missing set changes; deduplication survives hub restart. A replacement claimant receives its own first notice.

In-flight legacy items use this gate as well. Their checkboxes read as unmarked criteria; the refusal names their text and the migration path. The claiming Implementer runs `cland task criterion T-12 done C1` (the first criterion operation assigns ids in list order), or `cland task criterion T-12 normalize` when only the ids are needed, then reads `cland task view T-12 --json` for the assigned ids and marks the remaining criteria done. The Coordinator, human or Aide may also mark done. A Reviewer or QA records a clear verdict with `--verified all` or selected ids. An old clear verdict without verification does not complete this migration. Keep the existing item and branch; no bulk body rewrite is needed.

Merges run one at a time in the hub's territory queue (shared with task worktree operations), under the async territory lock. The gate checks an open task with a branch, the latest hub-written review verdict, and, when the resolved plan policy has a non-none scope and `when: per-item`, the latest hub-written QA verdict. `task.view` exposes `qaPolicy` and `qaCriteria`, plus `qaSatisfied` for tasks: whether the latest durable hub QA qualifies under the gate's provenance, writer independence and freshness rules, apart from review and criteria completion. Missing or altered durable verdict comments make it false; later file-only headers do not replace accepted hub evidence. `task.view.merged` is true only for a closed task with a durable landing receipt on dev; evidence-only stage completion does not set this flag, and manually assigned done status cannot establish it. A landed task's criteria compare verification to the task head recorded in its durable receipt, retaining completed fractions after branch cleanup and restart. Active or reopened tasks retain live branch freshness checks. Tasks outside a plan take `[plan] qa_default` (none/per-item by default). Each must be clear, current, written by a session holding the corresponding role at write time, and from a session that does not claim the item. File-only headers and Coordinator rescue-run verdicts do not satisfy it. Selection follows durable hub write order; if any recorded verdict comment is missing or altered in the item file, `verdict-missing` names its run and commit rather than reviving earlier clear evidence. The role the writer holds now does not change its provenance. The gate refreshes branch tips and the configured task base asynchronously before reading the freshness cache; an unknown patch comparison refuses with `review-pending` or `qa-pending` until the background answer settles. No check command runs in the gate (D16). The retired `qa-required` label has no gate effect; `cland task plan migrate` converts labelled tasks under existing plans to per-item overrides and reports out-of-plan fallback ids. See [QA policy and migration](../review-and-qa.md#qa-policy-from-the-plan).

The target is `taskBase`: normally `dev`, with the territory's `cland.taskBase` override honored during the D15 interim. The root must be checked out on that base. `git merge-tree --write-tree` builds the merged tree, keeping changes from both the base and the task. Conflicts refuse with `merge-conflict` and `files`, asking the Implementer to rebase; the gate never rewrites a task branch. Dirty files the commit touches refuse with `merge-dirty` and `files`. Unrelated staged and unstaged root edits are preserved. Every gate refusal leaves refs unchanged. A failed local ref update or rejected territory push attempts to restore the root checkout and refs while preserving unrelated edits; if either integration ref still holds the prepared commit, the result reports it as merged with recovery pending; the other typed reasons distinguish item/branch/base/checkout failures and review/QA missing, provenance, role, claimant, not-clear, stale and pending failures.

`git commit-tree` creates one commit with a single parent, the base's old tip. Its message is:

```text
The item's title (T-12)

Item: T-12
Reviewed-by: rev-12 (rev-run-id)
QA-by: qa-12 (qa-run-id)
```

`QA-by` appears when QA is required. The hub advances the root checkout, preserving unrelated edits, and pushes the base to the bare territory by its on-disk path with the protected-write marker. It then comments the full commit on the item, closes it and its topic, and releases its claim. Cleanup removes the worktree and branch once no connected spoke or running launched session stands inside and no launch is under way; while they do, cleanup retries in the background. Git keeps dirty worktrees, reporting the cleanup failure for the human to preserve and prune. The result is `{item, commit, base, cleanup}`. A failure after landing remains a successful merge result with `followUp: {step, error}`, whose error says `merged, follow-up failed: <step>`. The prepared commit, task tip, base and override reason are recorded durably before ref movement. A retry checks both integration refs for the recorded `Item:` commit, repairs an interrupted rollback checkout before pending publication, and finishes close, release, topic closure and cleanup without landing another commit, including across hub restarts. Before changing the root checkout, the hub records the exact expected before and after index trees, including unrelated staged edits, and retains that receipt through ref movement. If restoration fails before either ref moves, `merge-recovery` names the prepared commit and base; the next request restores its checkout before rechecking the gate. These recovery-pending events enter the journal and Agents instead of reporting a gate refusal. Rollback uses those snapshots; recovery refuses a subsequently edited index, and completed receipts preserve later staged edits. Cleanup checks the recorded task tip and deletes its ref by compare-and-swap; a moved tip keeps both branch and worktree. Cleanup can also finish branch deletion after its worktree was already removed. `task-merged`, `merge-refused`, `merge-resumed`, follow-up failures and cleanup failures enter the journal and Agents.

`cland merge T-12 --override "<reason>"` is for the human's own shell only, including when the Coordinator would otherwise be allowed to merge. It skips verdict and criteria checks, keeps conflict and root safety checks, omits verdict trailers, and records the reason on the item, in Agents and in the journal. Skipped incomplete criteria are named in `merge-criteria-overridden` journal events. The shipped `merge` skill forbids delegating a merge to a sub-agent: one in the Coordinator's shell would inherit its authority.

### Root dev push

`cland push [--json]` fast-forwards the local territory’s `dev` to the root’s committed `dev`, under the shared territory queue and lock. The Coordinator commits tracker and docs changes on the root’s `dev`, then runs this command from its own shell; the human may also run it. During onboarding, the generated Codex Aide cannot commit at the project root under workspace-write with no extra writable roots, so the Coordinator commits and publishes on root `dev`. The Aide launches or contacts the Coordinator on the human's ok, including with only a map; the Coordinator publishes first, then starts the approved release or waits for the first epic. An Aide with current root Git write access commits and runs `cland push` itself. Both roles need the `push` grant; existing projects with explicit `[coordinator.permissions] tools` or `[aide.permissions] tools` add `"push"` to the corresponding list. Implementer, Reviewer, QA and Lead shells are refused, even if their environment claims Coordinator. It has no spoke tool. Identity comes from the shell’s session id: sub-agents inheriting a Coordinator or Aide shell inherit its authority, so the responsible role performs this command itself.

Push uses the on-disk territory path and a pinned commit, ignoring configurable push URLs. It fetches objects without writing tracking refs or `FETCH_HEAD`, verifies a fast-forward, and never forces. A behind or divergent root refuses with the territory commits’ hashes and subjects. The root must be on `dev`; pending merge checkout/item completion, release or sync recovery must finish first. Dirty root work is preserved. Repeating a successful push is harmless.

Before publication, authorization, lock, inspection and fast-forward failures leave local and territory refs and the checkout unchanged. A rejected Git push also leaves them unchanged; repair its reported obstruction and retry. If Git loses the reply after acceptance, cland checks the pinned territory commit. If both the push reply and its confirmation fail, `push-outcome-unknown` exits 2, records a distinct outcome event, and names the pinned commit: publication may have occurred. Verify territory `dev` and retry `cland push`; this outcome makes no unchanged-refs claim. Verified refusal exits 1. Success returns `{dev, previous}`; record or lock-release failure after publication returns success with `followUp: {step, error}` saying `pushed; follow-up failed`. In that case dev has landed: repair the named obstruction (a retained lock may need removal once its owner has stopped) and retry to confirm publication without another commit.

`cland merge` refuses unpublished root `dev` before preparing a landing, with `merge-unpublished`, listing those commits and saying `run cland push`. It leaves the checkout, integration refs, item and claim unchanged. Publish explicitly, then retry merge; tracker commits are never silently included in a task landing. A configured task base other than `dev` retains its existing merge behavior.

### Release and sync

Only `cland release` pushes to `github`. Task branches and integration work stay on the local territory. These commands use the hub's queued territory operations, the async Git runner, and the territory lock; no synchronous subprocess runs on a request path.

Worktree operations target a single-user local project and refuse detected path or inode changes, with Git-only rollback of escaped creations; they are not atomic against another local process rearranging directories concurrently.
Escaped worktrees with dirty work or detached HEADs are kept for manual recovery; a branch that moves during rollback keeps or regains its worktree.

`cland release --item T-n [vX.Y.Z] [--dry-run] [--json]` sends a `release` frame with `item`, an optional `version`, and `dryRun`. It reads the release item's version (including SemVer prerelease/build suffixes), refuses a non-release item, a missing version, an explicit version mismatch or any open descendant, and previews the item's Notes, each direct epic's title and first Goal sentence, then the commit notes below. After successful publication and local/territory follow-up, the hub comments the tag and full commit on the release item and closes it; the next open release becomes current. Dry-run keeps the item unchanged.

`cland release vX.Y.Z [--dry-run] [--json]` keeps the version-based flow, with no tracker closure or item Notes. Both forms belong to the human or the Coordinator from its own shell with the `release` grant. Implementer, Reviewer and QA shells are refused even if their environment claims another role. There is no release spoke tool. The shipped `release` skill commits the tracker, previews from the release item, then shows the notes and version in an approval `ask` before publishing. The version comes from the human; an Aide or the human's named stand-in may relay a recorded version decision, never invent one. The Coordinator never delegates a release. New projects include the skill and grant in the Coordinator defaults; existing projects with explicit role lists add them to their own `.cland/roles.toml`.

Release and sync use the default branch (`main` unless the territory records another in `cland.defaultBranch`). Release pins GitHub's single configured push destination (multiple push URLs refuse) and fetches its default-branch objects without changing local tracking refs or tags. It refuses a missing/malformed version (the accepted form is `vX.Y.Z` with three nonnegative integers and no leading zeroes), an existing local or GitHub tag, no commits between the default branch and `dev`, no `github` remote, an in-progress Git operation, or the default branch checked out in any worktree. Keep the root on dev. If GitHub's default branch has commits dev lacks, the error lists their short hashes and subjects and says `run cland sync`. The local default branch must be an ancestor of dev. Refusals and dry-run move no refs. Dry-run prints the release notes and the GitHub refspecs for the default branch and tag and never publishes.

Both release forms, including dry-run, read the root `package.json` at the selected `dev` commit. When it declares a `version`, a mismatch with the release's version refuses with `release-version`, naming both versions. Commit the bump through an ordinary reviewed item and merge it onto `dev` before previewing; an uncommitted bump does not pass, and release never writes it. A project without `package.json` or its `version` key releases as before. Whether other project version files should be checked remains open. Recovery of an already published receipt finishes its pinned build even if later `dev` work has another version.

The notes list one `T-12 <tracker title>` line per `Item:` trailer in the range from the default branch to `dev`, in commit order, followed by non-item commit subjects. If an item was removed, its commit subject supplies the title. Git creates an annotated tag object at the pinned dev commit, then one atomic push sends that commit as GitHub's default branch and the tag object as `refs/tags/<version>`. The Git refs transaction uses no GitHub API and changes no project version file.
Opt-in Web assets use the GitHub Release API through existing gh authentication
after that push, as described below. Only after that push succeeds does cland advance the local default branch, install the local tag and publish that branch and tag to the territory. A GitHub hook rejection reports Git's message and leaves all local and remote refs unchanged.

The result keeps `{version, commit, notes, refs, dryRun, homebrew}` and adds optional
`webBundle` for opted-in releases; older consumers keep their existing fields. A failure after GitHub accepts the push returns `followUp: {step, error}` saying `released; follow-up failed`. Preserve `.cland/release.tmp`, repair the named obstruction and retry the same version and, for an item release, the same item. The receipt, written before pushing, pins the annotated tag object, dev commit, notes and optional item id. A retry with a different item or a version-only command cannot consume an item release receipt. A retry checks that exact tag on GitHub and finishes the local refs and territory even after a hub restart or a lost push reply, without publishing later dev work. The receipt is removed after the item closure and other follow-up complete; retrying an already written closure adds no duplicate release comment.

#### Homebrew formula publication

cland's optional `[release.homebrew] tap = "Kealman/homebrew-tap"` in committed
`.cland/config.toml` enables a second, separate Git push inside `cland release`.
The default empty tap reports **Homebrew skipped** and does no tap work. The human
creates the GitHub tap repository first; cland never creates it. For cland itself
that tap is `Kealman/homebrew-tap`, named by the committed config, and each release
publishes `Formula/cland.rb` there. Only the existing human/Coordinator release
authorization permits publication. Keep another project's tap empty until its
repository exists and Git authentication can write to it.

The dry run names the tap, `main`, `Formula/cland.rb`, version and exact source
URL (`https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/<tag>`).
It explicitly says the SHA-256 follows download after the product push: the tag
archive does not exist during preview. Include this destination and URL in the
human's single release approval. The approved formula points to those tag bytes;
there is no second approval after hashing. Product publication and tap publication
are separate transactions, so a tap failure leaves an already published product.

After the product push and local refs succeed, release hashes the complete HTTPS
archive (120-second/64-MiB bound), records its SHA-256 in `release.tmp`, and renders
`packaging/homebrew/cland.rb.in` from the pinned release commit. It preserves other
tap files and commits only `Formula/cland.rb` on top of tap `main` (or creates the
first commit in an empty tap). A lease refuses concurrent changes; the new commit's
parent guarantees a fast-forward. The result's additive `homebrew` field, CLI
output and release-item comment name the final SHA and tap commit. Preserve the
receipt on a `homebrew` follow-up failure and retry the same item/version. Retry
uses its pinned tap, source commit and recorded SHA, and reads the remote formula
to recognize an accepted push whose reply was lost. Item closure waits for this
follow-up. Legacy receipts without a tap retain their original scope.

The formula uses `node@24` for both build and command execution, with a minimum
24.13 check. It and the curl installer’s source fallback call `packaging/build-install.sh`:
locked dependencies with lifecycle scripts disabled, Web build, then dev-dependency
pruning while preserving the lockfile's build mtime. The curl installer retains
the equivalent legacy build steps for published archives without that helper.
Sealed local archive tests exercise that build; pure Node tests check formula
rendering. Real clean-macOS `brew install kealman/tap/cland`, `cland --version`,
`cland doctor`, upgrade and uninstall remain E-778's launch demo evidence
(C1/C2); a published formula is not an end-to-end install proof. The site,
quickstart and READMEs give the same three paths: the Homebrew formula, the
install script and source. See
[Homebrew's tap convention](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
and [formula cookbook](https://docs.brew.sh/Formula-Cookbook).

`cland sync [--json]` sends a `sync` frame. The human or the Coordinator's shell with the `sync` grant may call it; it has no spoke tool. It refuses while a merge still needs checkout, item, claim or topic completion, preserving that landing's recovery identity. From a clean root on dev it fetches GitHub, requires GitHub's default branch to fast-forward the local default branch, and prepares a replay of the range from the default branch to `dev` on the fetched commit in an isolated checkout. Replay retains merge structure. A dirty root refuses; a conflict aborts preparation, names the files in the error and `files` result field, and leaves every integration ref and the root tree untouched. On success it installs the replay in the root, atomically updates the local default branch and dev, and publishes those refs only to the territory. It never pushes to GitHub.

Sync returns `{main, dev}`; the compatibility field `main` holds the default branch tip. Release and sync recovery receipts keep their existing field names, so receipts from before recorded defaults still resume. A territory failure after the local refs move returns `followUp` saying `synced locally; follow-up failed`. Preserve `.cland/sync.tmp`, repair the obstruction and retry sync to publish the same replay. A changed root or ref during recovery is refused for manual reconciliation. Finish pending sync before merge or release, and finish a GitHub-accepted release before sync. Previews, releases, syncs and their refusals are recorded in the hub log and journal.

