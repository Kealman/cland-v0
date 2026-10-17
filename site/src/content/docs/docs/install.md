---
title: Install
description: Install cland on macOS or Linux, set up the harnesses, keep cland and your project's skills up to date, and remove it.
sidebar:
  order: 3
---

cland runs on **macOS** and **Linux**. Windows is not supported.

## Install cland

### macOS: Homebrew

```sh
brew install cland
```

### Linux: install script

```sh
curl -fsSL https://cland.app/install.sh | sh
```

### From source

Requires Node 24.

```sh
git clone https://github.com/[owner]/cland
cd cland
npm ci
npm link
```

`npm link` puts the `cland` command on your PATH, pointing at the clone.

### Check the install

```sh
cland --version
cland doctor
```

`cland doctor` checks the harnesses, `gh`, Neovim, the hub and what `cland init` provisioned. It prints one line per check, `ok`, `warn` or `fail`, with the fix after `— fix:`. It exits 1 only when a check fails; a warning never fails it. Run it inside a project to include the project checks.

## Requirements

| What | Needed for |
| --- | --- |
| macOS or Linux | Everything. |
| Git | Every project. cland keeps the crew's work in a local Git territory. |
| At least one harness | Claude Code (`claude`), Codex (`codex`) or OpenCode (`opencode`). Each one a role uses must be installed and signed in. |
| `gh`, signed in | Only when the project has a GitHub remote, and for importing GitHub issues. |
| A terminal | The Neovim workbench and the harness logins. Any modern terminal works; Ghostty, kitty, WezTerm, iTerm2 and tmux are fine. |
| Node 24 | Only for the source install. |

You do not need Neovim installed or configured. cland downloads its own pinned Neovim release on first use, checks it against a pinned SHA-256 digest and starts it with a clean configuration, so your own Neovim setup is never loaded and never changed.

## Harnesses and logins

`cland setup` handles this for you. For each harness it:

1. Looks for the binary, also in the official installers' folders, and prints its version.
2. If the harness is missing, shows its official user-level installer and runs it in your terminal when you say yes. A declined install is remembered and not offered again until you ask with `cland setup --install <harness>`.
3. Runs the harness's own login in your terminal, in the same environment the hub launches sessions with:

   | Harness | Login |
   | --- | --- |
   | Claude Code | `claude auth login` |
   | Codex | `codex login` |
   | OpenCode | `opencode auth login --standalone` (optional: the free model needs no login) |

cland keeps OpenCode sessions in a database of its own, separate from OpenCode's background service, so that service can never pick up a cland session. That is why the OpenCode login goes through setup: it signs in to cland's database. `cland doctor` prints the exact login line for it.

Without a terminal, setup changes nothing: it prints each open step with its exact command and exits 1.

```sh
cland setup --json            # the steps as JSON
cland setup --install codex   # offer the Codex installer again
cland setup --no-accounts     # skip the accounts step
cland setup --no-aide         # do not launch the Aide
```

Harnesses update themselves. cland does not pin their versions; `cland doctor` prints each version for information.

## Updating

Update cland the same way you installed it:

```sh
# Homebrew
brew upgrade cland

# Install script: run it again
curl -fsSL https://cland.app/install.sh | sh

# Source
cd cland && git pull && npm ci
```

After an update, restart each project's hub so it runs the new version:

```sh
cland hub stop && cland hub start
```

`cland doctor` warns when a project's hub runs another version than the CLI.

### Updating a project's skills and managed files

Each project carries its own copy of cland's curated skill set in `.agents/skills/`, plus a few managed files (`AGENTS.md`'s cland block, `docs/agents/`, the Claude Code hooks, `config.toml`). Bring them to the installed version with:

```sh
cland update
```

`cland update` decides per skill:

- A skill you never touched is refreshed.
- A skill edited in the project is kept and reported as "edited in the project". It belongs to the project now.
- A skill new to the set is added, unless the project already has a folder of that name.
- A skill dropped from the set is removed if untouched, and left to the project if edited.

It never rewrites `roles.toml` or `crew.toml`: those are yours. A file or hook without cland's `managed by cland` mark is never written. Commit what `cland update` changed.

## Uninstalling

Remove cland itself:

```sh
# Homebrew
brew uninstall cland

# Source
npm unlink -g cland     # then delete the clone
```

For the install script, delete the `cland` command it installed (`command -v cland` shows where).

Remove cland from a project:

```sh
cland hub stop
cland init --undo      # restores the remotes: github becomes origin again
```

`cland init --undo` undoes only the territory step. It refuses when work would become unreachable and names the refs; keep that work under a surviving branch, or pass `--force` to discard it. Then delete `.cland/`, `.agents/skills/`, the `.claude/skills` link, the cland block in `AGENTS.md` and the cland hooks in `.claude/settings.json` if you no longer want them.

User-level state lives in:

| Path | What it holds |
| --- | --- |
| `~/.config/cland/accounts.toml` | Your account names and paths. No secrets. |
| `~/.local/state/cland/` | The spend ledger of cloud verification runs. |
| `~/.local/share/cland/opencode/` | cland's own OpenCode database. |

:::caution
Delete these only after uninstalling. The spend ledger is what keeps cloud runs under your daily cap across projects.
:::
