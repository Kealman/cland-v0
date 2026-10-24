---
title: CLI reference
description: Every cland command, grouped by area, with a one-line description and its key flags.
sidebar:
  order: 10
---

Run `cland --help` for the command reference. `web`, `verify`, `merge`, `push`, `publish`, `release` and `sync` also accept `--help` without a running hub; other commands do not consistently support it. Many commands take `--json` for machine-readable output.

Commands that talk to the hub find it through the project around the current directory, from any folder inside it, including task worktrees.

:::note
In a normally launched session's shell, CLI calls use the inherited cland session identity and are checked against its role. Commands marked **human** require your own shell.
:::

## Project

| Command | What it does |
| --- | --- |
| `cland` | On a terminal: the same as `cland open`. Outside a project: says to run `cland init`. |
| `cland init [dir]` | Prepare a folder or repository for cland: `.cland/`, skills, `AGENTS.md` block, hooks, the local territory, the first commit when needed. Idempotent. Ends with `next: cland setup`. |
| `cland init --undo [--force]` | Undo the territory step: `github` becomes `origin` again. `--force` discards territory-only refs. |
| `cland setup` | Ready the project: harnesses, logins, accounts, favourite harness, trust, the hub, then the Aide in the workbench. Flags: `--yes`, `--install <harness>`, `--harness <h>`, `--no-accounts`, `--no-aide`, `--attach`, `--json`. |
| `cland open [dir]` | Start the hub if needed, then the Neovim workbench. |
| `cland update [dir]` | Bring the project's skills and managed files to the installed version; keeps what you edited. |
| `cland doctor [dir]` | Check harnesses, logins, `gh`, Neovim, the hub and the project. One line per check with its fix. `--fix` ends owned orphan servers, deleted-project hubs and fixtures. |
| `cland config set <section.key> <value>` | Validate and save one `config.toml` value; says whether it applies now or at the next hub start. |
| `cland --version` | Print the version. |

## Web

| Command | What it does |
| --- | --- |
| `cland web` | Print a one-time sign-in link to the web workbench and open it in the browser. `--no-open` only prints it. **human** |
| `cland web --qr` | Print a reachable link as a QR code, for a phone; requires a LAN bind or HTTPS origin. **human** |

`cland web --sessions` lists browser sign-ins; `cland web --revoke <id>` revokes one and closes its sockets. Both are **human** commands.

## Hub

| Command | What it does |
| --- | --- |
| `cland hub start` | Start the project's hub in the background. Does nothing if it runs. |
| `cland hub stop` | Stop the hub. Sessions keep running and reconnect when it starts again. **human** or Coordinator |
| `cland hub status` | The hub's pid, uptime, version and connected sessions with their roles. |
| `cland hub reload` | Re-read `config.toml` and `roles.toml`; a broken file keeps the old settings. Also on SIGHUP. |
| `cland hub journal` | Print the journal of events. `--since 2h`, `--kind <event>`. No hub needed. |
| `cland hub audit` | Every tool call the hub answered, allowed or refused. `--session <name>`, `--since 1d`. |
| `cland hub subscriptions` | Every session's event subscriptions. |
| `cland hub unmute <a> <b>` | Lift the loop breaker's mute between two sessions. **human** |

## Sessions

| Command | What it does |
| --- | --- |
| `cland session launch <name>` | Launch a session through the hub. `--role`, `--harness claude-code\|codex\|opencode`, `--model`, `--effort`, `--account`, `--item T-n` (start in the task's worktree with its claim) or `--cwd <dir>`, `--brief <text\|A-n>`. |
| `cland session list` | Launched sessions with role, harness, model, account, state and item. `--archived` lists the archive. |
| `cland session attach <name>` | Print the command that attaches a terminal to the session's harness. **human** |
| `cland session stop <name>` | Stop the session through its harness. |
| `cland session resume <name>` | Re-find the session. `--relaunch` restarts it on its harness conversation, keeping name, role and claim; `--fresh` starts a new conversation with its recorded brief. |
| `cland session archive <name>` | Archive a stopped session. |
| `cland session prune --older-than 7d` | Delete records of archived sessions; the journal stays. `--dry-run`. |
| `cland session retry <name> <message id>` | Send again a message whose delivery is uncertain. **human** |

## Roles and crew

| Command | What it does |
| --- | --- |
| `cland role list` | Each role with its launch settings and holders, and the Coordinator. |
| `cland role set <session> <role>` | Assign a role. `--note-file <file>` or `--move` moves the Coordinator, or a Lead's node with `--item`. **human** |
| `cland role clear <session>` | Revoke a session's role. **human** |
| `cland role launch <role>` | Write a role's launch settings: `--harness`, `--model`, `--effort`, `--account`, `--permissions`. |
| `cland crew show` | The effective staffing policy and its summary. |
| `cland crew set <role>.<key> <value>` | Change staffing: `reviewer.size 2`, `coordinator.heartbeat 30m`, `leads '["epic"]'`, `idle_from C-2`. |
| `cland models <harness>` | The models a harness offers and its default. `--account <name>`, `--refresh`. |

## Accounts

| Command | What it does |
| --- | --- |
| `cland account list` | Registered accounts with their usage windows, resets and the reading's age. `--refresh`. |
| `cland account clear <name>` | Lift an account's limited mark before its reset. **human** or Coordinator |

## Tasks and the tracker

| Command | What it does |
| --- | --- |
| `cland task create <title>` | File an item. `--kind`, `--size XS\|S\|M\|L` (required for tasks), `--parent`, `--blocked-by`, `--follows`, `--version`, `--label`, `--body` or `--body-file`, `--regression-of`. |
| `cland task view <id>` | An item with its path, body, criteria, plan, verdicts and claim. Any prefix or a bare number. |
| `cland task list` | Query items. `--under <id>`, `--state`, `--kind`, `--label`, `--assignee`, `--verdict review=clear`. |
| `cland task edit <id>` | Change fields: `--title`, `--status`, `--size`, `--state`, `--label`, `--assignee`, `--version`. |
| `cland task link <id>` | Set links: `--parent`, `--blocked-by`, `--unblock`, `--follows`, `--unfollow`, `--regression-of`. `none` clears one. |
| `cland task comment <id> <text>` | Comment, or record a verdict: `--verdict review\|qa --result clear\|"not clear" --run <id>`, `--verified C1,C3\|all`, `--failed "C2=note"`. |
| `cland task close <id>` | Close an item. Containers close only when their children are closed. |
| `cland task claim <id>` | Take or `--release` a claim. Claiming a task makes its branch and worktree. |
| `cland task hold <id>` | Reviewer or QA: take or `--release` a verification hold. |
| `cland task criterion <id> <op>` | `add <text>`, or `done`, `verify`, `fail`, `edit`, `remove` with a criterion id. |
| `cland task rank <id>` | Move among siblings: `--top`, `--before <id>`, `--after <id>`. |
| `cland task plan <set\|show\|approve> <epic>` | Set an epic's plan from `--file plan.yaml` (with `--reason`), show it, or approve it. Approve is **human** or Aide. |
| `cland task import-github` | Import GitHub issues as items through `gh`. `--repo owner/name`, otherwise the `github` remote, then `origin`; `--all` for closed ones too. Re-runs update in place. |

## Topics, inbox, rules, artifacts

| Command | What it does |
| --- | --- |
| `cland inbox` | What needs you, in four sections, with ids and waiting ages. `--archive` for the last seven days of departures. |
| `cland topic answer <ask id> <n>` | Answer an ask with option `n`, or `--text "<free answer>"`. **human** |
| `cland rule add <text>` | Add a rule. `--scope all\|<roles>`, `--reason`, `--title`. |
| `cland rule edit <n>` / `retire <n>` | Edit a rule, or retire it with `--reason`. |
| `cland rule list` / `show <n>` | The active rules (`--all` with retired ones, `--role <r>`), or one rule. |
| `cland artifact new` | Create an artifact: `--kind prompt\|note\|page\|diagram\|file --title <t> --topic <topic>` and `--path`, `--content` or `--content-file`. `--folder` for a folder. |
| `cland artifact list` | Artifacts, optionally `--topic <topic>`. |
| `cland artifact open <A-n>` | Open it in your editor. |
| `cland artifact keep <A-n>` | Keep it past its topic's retention (`--release` to undo). |
| `cland artifact move <A-n> <folder A-n>` | Move a file artifact into a folder artifact. |
| `cland artifact archive <A-n>` | Archive it. |
| `cland artifact promote <A-n> <path>` | Copy it into the repository at a project-relative path. |
| `cland subscribe <kind> <subject> --event <e>` | Subscribe to events about a session, item, topic, role or subtree. `--digest turn\|now`. |
| `cland unsubscribe <id>` / `cland subscriptions` | Remove or list subscriptions. |

## Verification, merge and release

| Command | What it does |
| --- | --- |
| `cland verify [--report <topic>]` | Run the project's checks and tests at the committed head through the hub's queue; post the result in Agents, addressed to the Coordinator by default. `--report` chooses another topic. `--executor local\|droplet`, `--to <session>`, `--dry-run`. |
| `cland verify queue` | The running run, cloud runs, waiters and admission estimates. |
| `cland verify cancel [<id>]` | Cancel your active run (**human**: any run). |
| `cland executor status` | Token presence, live cloud machines, today's spend against the cap. **human** or Coordinator |
| `cland executor prepare` | Build the snapshot cloud runs start from; report to the Coordinator in Agents by default (`--report <topic>` overrides). **human** or Coordinator |
| `cland executor reap` | Delete orphaned and expired cland machines. **human** or Coordinator |
| `cland merge <T-n>` | Queue a reviewed task when `[merge] queue = true`; otherwise land it as one squash commit on `dev`. `--override <reason>` (**human**, tracker and docs only). |
| `cland push` | Fast-forward the territory's `dev` to the root's `dev`. **human**, Coordinator or Aide |
| `cland release --item <R-n> [vX.Y.Z]` | Publish a release item: tag, notes, one atomic push to GitHub, close the item. `--dry-run`. **human** or Coordinator |
| `cland release <vX.Y.Z>` | Publish `dev` with a version, without a release item. `--dry-run`. |
| `cland publish <branch> --item T-n` | Publish approved marketing commits matching `[publish] allow_paths` to GitHub main and site, then integrate dev. `--dry-run`. **human** or Coordinator |
| `cland sync` | Bring GitHub `main` back and replay unreleased `dev` work on it. Never pushes to GitHub. |
| `cland worktree list` | Task worktrees with their items, branches and the sessions inside. |
| `cland worktree prune` | Remove worktrees of closed items, after a `y` (`--yes` for all). **human** |
