---
id: Q-5
kind: question
title: "Research: self-hostable git engines for an agents-only territory"
state: closed
labels:
  - wayfinder:research
assignee: null
parent: M-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:51:56Z
updated: 2026-10-08T13:17:15.589Z
github:
  repo: Kealman/cland-v0
  number: 5
  url: https://github.com/Kealman/cland-v0/issues/5
---

## Question

Which self-hostable, lightweight git engines or forges could serve as the agents-only territory (local to one developer machine, no human accounts, driven entirely by agents through CLI and API), and what does each offer? Candidates to examine: Forgejo / Gitea, soft-serve, Gerrit, bare repositories plus a custom review layer, Radicle, jj (Jujutsu) as a VCS layer, and others worth naming.

For each: API and CLI surfaces; footprint and install story on a single machine; PR-like change and review primitives usable by agents; how a release-ready version could be pushed to GitHub as one change rather than many PRs.

Also note what GitHub itself now offers that reduces the need for a separate territory, if anything. Primary sources only.

## Comments

### Kealman · 2026-10-07T16:14:20Z

<!-- github-comment: 6041945665 -->

## Resolution

**Bottom line.** As of 2026-10-07 no mature, locally runnable, agent-first git engine exists. The realistic territories are plain Git (a bare or integration repository, worktrees, hooks), a general forge run as a local process (Gitea 28.1 was verified end to end on macOS; Forgejo 16 has the same loop but no official macOS binary), or Radicle (it works locally but is mid-transition). GitHub alone does not remove the need for a territory on a personal account. No engine lands one commit per release by itself, so the squash-and-push to GitHub is a separate step cland would own.

**Findings that matter for the git-strategy decision**

1. **Plain Git works as a territory with no server and no accounts, but Git has no review objects.** Tested on the stock macOS Git 2.39.5: a `pre-receive` hook enforced fast-forward-only and "head commit signed by a reviewer principal, not the author" using per-agent SSH-signed commits; `git merge-tree --write-tree` gives conflict checks without a worktree. Git has no review, comment, approval or check object and no stable change identity, so cland would own the change entity, comment anchoring, approval policy, check results, merge queue and inbox. Apple Git lacks `git replay` and `merge-tree --merge-base` (upstream is 2.56.0).
2. **Gitea 28.1.0 (MIT) ran the whole loop on macOS arm64.** Official `darwin-arm64` binary (116 MB), SQLite, 170 MB RAM at start and 256 MB after 300 PRs. Bot accounts (new in 28.0) and tokens come from the CLI; PRs, reviews by a different account, required approvals and status checks, auto-merge, AGit push-to-PR, stacked-PR retargeting and webhooks were all driven over REST with no browser. **Forgejo 16.0.5 (GPL-3.0-or-later)** has the same loop but ships no macOS binary (Linux binary, container, or third-party Homebrew) and was not run; its v16 line ends support on 2026-10-29 and v17 is due 2026-10-15.
3. **A reviewer's approval must come from a different identity than the author's.** GitHub, Gitea, Forgejo, OneDev and Harness refuse the author's own approval; Gerrit's default allows it (needs a `user=non_uploader` rule); Radicle has no approval gate at all. In Gitea and Forgejo one admin token with `Sudo` can act as every bot user. In Gitea the repo owner can `force_merge` past required approvals unless `block_admin_merge_override` is set (measured).
4. **Hundreds of open PRs on one base branch slow every merge.** Measured on Gitea with SQLite: 300 PRs took 158 s to create; at 223 to 255 open PRs the median wait per merge was 14 s, at 25 to 45 open 2.8 s, at 10 or fewer 1.65 s, and naive clients got HTTP 405 "Please try again later". GitHub documents the same effect and recommends at most 1 merged PR per minute. So open changes per base branch need a bound, or integration needs a queue.
5. **Running a forge as the human's own user has footguns.** Gitea rewrote the real `~/.ssh/authorized_keys` at start-up even with `DISABLE_SSH = true` (measured; `SSH_CREATE_AUTHORIZED_KEYS_FILE = false` avoids it; Forgejo's code has the same path, read but not run); Gitea 28 moved the webhook allow-list to `[security] ALLOWED_HOST_LIST`, so loopback webhooks time out by default; users created by CLI must change their password unless `--must-change-password=false`.
6. **Other engines.** Gerrit 3.14.4 (Apache-2.0, 97 MB war, JRE 21, reviews stored in git, no external DB) has the richest model (relation chains, submit requirements) but dev-mode auth is login-as-anyone, every commit needs a Change-Id, replication pushes all refs by default, and it has no squash submit action. OneDev 16.8.5 (MIT core plus a commercial EE jar, JVM, 1 to 2 GB) ships AI users, a `tod` CLI with agent skills and its own agent workspaces, which overlap cland. Harness Open Source has had no tagged release for 14 months, GitLab CE needs 8 vCPU and 16 GB, and Gogs has no PR API. None of these was run (no JRE or Docker daemon on the test machine).
7. **soft-serve v0.12.3 (MIT, 35 to 40 MB RSS)** has a real no-accounts mode (`SOFT_SERVE_ANON_ACCESS=admin-access`): unauthenticated clone, push and push-to-create worked. It has no PRs or reviews, its webhooks cannot target localhost, it supports only pull mirrors, and it fixed a critical privilege escalation in 0.12.0.
8. **Radicle 1.10.3 worked locally with two identities** (patch, review accept or reject, delegate merge; 38 to 41 MB per node), but merges are not gated by reviews, each identity needs its own `RAD_HOME` and node, the CLI is documented as not a stable API, and a 2026-09-23 disclosure says all released versions have an unauthenticated, unencrypted transport, with a breaking 2.0 as the fix.
9. **jj 0.45.1 and Sapling are clients, not territories.** jj gave stacked `push --change`, safe concurrent workspaces and one-commit landing via `jj restore`; GitButler is FSL-licensed with telemetry on by default. Agent-first layers (Forge v0.13.12 in public beta with a stub GitHub PR provider, Gas Town and Gas City, Entire) bring their own agent launching and review state; the agent-first engines found (SmolForge, Cloudflare Artifacts, Pierre, entire.io) are cloud-only.
10. **Flow to GitHub: nothing opens GitHub PRs or imports review state.** Gitea push mirrors copy every branch and tag with force and have no filter (Forgejo has `branch_filter`); Gerrit replication defaults to all refs including `refs/changes/*`; collaborators' work returns through `git fetch` or a pull mirror. Agent state also leaks to `origin` without any PR (Entire checkpoints, Beads refs, Claude Code `/batch`), so which remote is `origin` inside agent worktrees decides most of it.
11. **Harness coupling.** Claude Code worktrees branch from the remote's default branch unless `worktree.baseRef` is `"head"`, can be created through a `WorktreeCreate` hook, and `--worktree "#N"` falls back to `pull/N/head` on other hosts; the Codex CLI has no worktree feature and OpenCode's is experimental. `claude /code-review` and `codex review --base` review a local branch but only post comments to GitHub or GitLab.
12. **GitHub alone, for a personal account.** Merge queue is unavailable (org-owned public repos or Enterprise Cloud only); rulesets, required approvals and auto-merge on private repos need Pro; a PR author cannot approve their own PR, so agents acting through the human's token leave no counted approval; content creation is capped at about 500 requests per hour (80 per minute); only one free machine account is allowed. Stacked PRs went generally available on 2026-10-06 on all plans, but a stack still creates N PRs and lands n commits.

**Not verified:** Forgejo, Gerrit, OneDev and Harness were not run; whether a GitHub App's approval counts toward required approvals; Gitea on Postgres or with tuned queues; the Claude Code `--worktree "#N"` fallback against a Gitea or Forgejo `refs/pull/N/head`. Details and tags ([V] cited, [M] measured, [I] inferred, [U] unverified) are in the document.

Full findings with sources: `docs/research/git-engines.md` on branch `research/git-engines` (https://github.com/Kealman/cland-v0/tree/research/git-engines).
