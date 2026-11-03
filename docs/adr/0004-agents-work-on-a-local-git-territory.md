# Agents work on a local git territory

Agents produce many branches, reviews and merges that humans should not have to see on GitHub, and a personal GitHub account offers no server-side gates. The project's `origin` is a local bare repository, the territory, inside the project's cland folder; GitHub is the remote `github`, touched only by releases. Each item gets a task branch `t/<id>-<slug>` and a worktree created by cland. cland merges a task into `dev` as one squash commit only when the tracker holds a clear review verdict from a Reviewer session and, where the item requires it, a clear QA verdict from a QA session. A release fast-forwards `main` to `dev`, tags it and pushes `main` to GitHub; collaborators' work returns by fetching `main` from GitHub.

## Considered options

- **A local forge (Gitea or Forgejo)**: rejected for v0. Gitea runs on macOS and has bot accounts and a review API, but it is a second system with accounts, mirrors that force-push every branch, and merges that slow down with hundreds of open pull requests. It stays the fallback if a pull-request UI for humans becomes necessary.
- **Radicle**: rejected. Reviews do not gate merges, each identity needs its own node, and its unauthenticated transport is fixed only in a breaking 2.0.
- **GitHub as the territory**: rejected. No merge queue or required approvals on a personal account, rate-limited content creation, and agent traffic in the humans' space.
- **Squashing a whole release into one commit**: rejected. The per-task history is worth keeping on GitHub.

## Consequences

Amendment (T-652, v0.1.4): init discovers the repository’s default branch before renaming `origin` and records it once in the territory’s `cland.defaultBranch`. Provisioning, protection, doctor, task-base fallback and undo use that branch; a territory without the setting reads `main`.

- The merge gate is cland's, not git's: verdict presence and reviewer identity are enforced by the hub, which knows the calling session's role. Commit signing per role stays in the fog.
- Tools that push to `origin` on their own reach only the territory.
- `cland init` re-points an existing project (the GitHub remote becomes `github`, the bare repository becomes `origin`) and is reversible.

## Addendum: the hub runs territory commands (T-59, D2)

Spec 4.2's boundary is amended: the hub runs the territory's Git commands for task worktrees, merges, releases and syncs. One territory module owns those commands and the shared lock; `cland init` uses it without a hub. Hub request paths use the async runner and async lock, with resumed synchronous writes measured by the request guard. The hub queues territory operations so two merges land serially.

The gate selects the latest hub-written review and, when the epic plan or `[plan] qa_default` requires per-item QA, QA verdict, preserving the writer's role at write time. The writer cannot claim the item. Freshness comes from the async cache (tip equality or the same whole-task patch id). Coordinator rescue-run verdicts do not satisfy the gate; only the human's shell overrides verdicts with a recorded reason. No check command runs in the gate in v0 (D16).

`merge-tree --write-tree` refuses conflicts and names the files; the Implementer rebases in its worktree, and the gate never rewrites the task branch (D9). `commit-tree` lands one commit on the task base with the item title/id and the `Item:`, `Reviewed-by:` and required `QA-by:` trailers. Touched uncommitted root changes refuse before refs move. After the local checkout and territory agree, the item and topic close, the claim releases, and worktree/branch removal waits for sessions inside to stop (D10).

The product task base is `dev`. Historically, cland's own D15 interim used
`cland.taskBase` set to `main`; T-59 honored that same base as T-58. The transition
to `dev` was recorded on T-20. The interim is no longer a future migration.


## Amendment — 2026-11-03: Territory access through the Tunnel (T-1591, T-1597)

The bare territory stays local to the hub's machine. A remote
[Host](../../GLOSSARY.md#hosts) and its [Host agent](../../GLOSSARY.md#hosts) reach
it through the hub-owned [Tunnel](../../GLOSSARY.md#hosts), following
[v0.4 §3.2](../spec/v0.4.md#32-the-ssh-transport-the-tunnel-layout-and-the-host-agent),
[§3.3](../spec/v0.4.md#33-git-through-the-tunnel) and
[§3.12](../spec/v0.4.md#312-security-and-secrets). Each admitted connection on a
per-host Unix socket at mode 0600 gets its own `git daemon --inetd` over the
territory. The Host's git proxy joins Git's stdin/stdout to the forwarded
`git.sock`. Half-open sockets preserve request EOF while draining clone/fetch
responses. No Git TCP listener is added on either end.

The hub supplies `CLAND_PUSH_HOST` from the socket's Host identity and drops
`CLAND_TERRITORY_WRITE`. Its explicit receive configuration enables object
checking, disables automatic GC, denies deletions and caps input at 128 MiB.
The territory's update hook accepts a Host push only to a `t/` task branch in
that Host's allow list, leased to its sessions. It refuses ref deletion, tags,
other refs and any move of `dev` or `main` (also the configured default branch).
Hub startup refreshes the hook in existing territories. Guarded hub operations
without `CLAND_PUSH_HOST` retain their existing policy.

Grant and revoke atomically rewrite the allow list under the territory lock.
A `git-receive-pack` connection holds that same lock through native Git process
close, with a 30-second stalled-push cap; `git-upload-pack` remains concurrent.
Public lease revoke waits for release using bounded lock backoff, by default
up to the push cap plus two seconds, and reuses a matching lock already held by
its caller. Receive and merge retain immediate contention refusal. Before an
immediate merge or merge batch reads a task branch, it revokes every Host's lease
on that branch under the lock. Batch preparation pins member heads in that short
critical section and builds from those heads after releasing it. A push therefore
finishes before revocation or is refused after it; later pushes cannot alter the
branch selected for merge. Lock order remains worktree serialization, territory
lock, then Git locks.

Item branches are created in the territory before their worktrees are added on
a Host. A new local task uses the root's task-base tip, including unpublished
commits; a nonlocal task uses the territory's task-base tip. Existing territory
task refs supply their own tip. Merge, verification and the merge queue remain
owned by the hub.
