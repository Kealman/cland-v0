# Agents work on a local git territory

Agents produce many branches, reviews and merges that humans should not have to see on GitHub, and a personal GitHub account offers no server-side gates. The project's `origin` is a local bare repository, the territory, inside the project's cland folder; GitHub is the remote `github`, touched only by releases. Each item gets a task branch `t/<id>-<slug>` and a worktree created by cland. cland merges a task into `dev` as one squash commit only when the tracker holds a clear review verdict from a Reviewer session and, where the item requires it, a clear QA verdict from a QA session. A release fast-forwards `main` to `dev`, tags it and pushes `main` to GitHub; collaborators' work returns by fetching `main` from GitHub.

## Considered options

- **A local forge (Gitea or Forgejo)**: rejected for v0. Gitea runs on macOS and has bot accounts and a review API, but it is a second system with accounts, mirrors that force-push every branch, and merges that slow down with hundreds of open pull requests. It stays the fallback if a pull-request UI for humans becomes necessary.
- **Radicle**: rejected. Reviews do not gate merges, each identity needs its own node, and its unauthenticated transport is fixed only in a breaking 2.0.
- **GitHub as the territory**: rejected. No merge queue or required approvals on a personal account, rate-limited content creation, and agent traffic in the humans' space.
- **Squashing a whole release into one commit**: rejected. The per-task history is worth keeping on GitHub.

## Consequences

- The merge gate is cland's, not git's: verdict presence and reviewer identity are enforced by the hub, which knows the calling session's role. Commit signing per role stays in the fog.
- Tools that push to `origin` on their own reach only the territory.
- `cland init` re-points an existing project (the GitHub remote becomes `github`, the bare repository becomes `origin`) and is reversible.

## Addendum: the hub runs territory commands (T-59, D2)

Spec 4.2's boundary is amended: the hub runs the territory's Git commands for task worktrees, merges, releases and syncs. One territory module owns those commands and the shared lock; `cland init` uses it without a hub. Hub request paths use the async runner and async lock, with resumed synchronous writes measured by the request guard. The hub queues territory operations so two merges land serially.

The gate selects the latest hub-written review and, when the epic plan or `[plan] qa_default` requires per-item QA, QA verdict, preserving the writer's role at write time. The writer cannot claim the item. Freshness comes from the async cache (tip equality or the same whole-task patch id). Coordinator rescue-run verdicts do not satisfy the gate; only the human's shell overrides verdicts with a recorded reason. No check command runs in the gate in v0 (D16).

`merge-tree --write-tree` refuses conflicts and names the files; the Implementer rebases in its worktree, and the gate never rewrites the task branch (D9). `commit-tree` lands one commit on the task base with the item title/id and the `Item:`, `Reviewed-by:` and required `QA-by:` trailers. Touched uncommitted root changes refuse before refs move. After the local checkout and territory agree, the item and topic close, the claim releases, and worktree/branch removal waits for sessions inside to stop (D10).

The product task base is `dev`. During cland's own D15 interim, `cland.taskBase` in the territory config names `main`; T-59 honors that same base as T-58. Once this item lands and the hub restarts, the Coordinator removes that setting and moves the root to `dev`, as recorded on T-20.
