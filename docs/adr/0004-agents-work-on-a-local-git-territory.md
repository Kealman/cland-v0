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
