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
brew install kealman/tap/cland
```

The tap is pending publication: the human must first create
`Kealman/homebrew-tap`, and a release must publish its formula. Until then, use
the [source install](#from-source).

Homebrew supplies `node@24` (at least 24.13), builds the web workbench from the
release's locked dependencies, and puts `cland` on PATH. Its command wrapper
uses that Node runtime even if another Node version is first on your PATH.
The formula's source and dependencies live in its Homebrew keg under `libexec`.

### Linux or macOS without Homebrew: install script

```sh
curl -fsSL https://cland.app/install.sh | sh
```

The script needs **Node >=24.13.0 <25**, npm, curl, tar and Git. If Node is missing,
install Node 24 LTS from [nodejs.org](https://nodejs.org/en/download), put `node`
and `npm` on your PATH, and run the command again.

It fetches the newest stable `vX.Y.Z` tag from the public repository, downloads
that tag’s source tarball and looks for its prebuilt Web release assets. It
verifies the archive’s SHA-256 and source stamp, then installs only locked runtime
dependencies with lifecycle scripts disabled. If the assets are absent, invalid
or for different sources, it installs locked build dependencies, builds the web
workbench, and removes development dependencies.
Older tags without the shared build helper use the equivalent legacy build steps,
so the pinned-version command below also works for those archives.
It prints each step and never uses `sudo`. Download or build failures leave the
current installation in place. An interrupted update restores the old version
and prints any retained staging or recovery path; keep that path until recovery
is complete.

| Path | What the script installs |
| --- | --- |
| `~/.local/bin/cland` | A symlink to the CLI. Add `~/.local/bin` to your PATH if the script asks. |
| `~/.local/lib/cland/` | The released source, runtime dependencies and built web workbench. |

To choose another writable prefix or a specific released tag:

```sh
curl -fsSL https://cland.app/install.sh | PREFIX="$HOME/tools" sh
curl -fsSL https://cland.app/install.sh | CLAND_VERSION=v0.2.0 sh
```

With a custom prefix, the paths become `<prefix>/bin/cland` and
`<prefix>/lib/cland/`. Reuse that prefix when updating. The script refuses to
replace a command or directory it does not manage.

For an offline mirror, `CLAND_RELEASE_URL` accepts an HTTPS or `file://` source
tarball. It builds from source unless `CLAND_WEB_RELEASE_URL` names the directory
containing the matching `cland-web.tar.gz` and `cland-web.tar.gz.sha256` assets.

### From source

Requires Node **24.13 or newer within Node 24** (`>=24.13.0 <25`).

```sh
git clone https://github.com/Kealman/cland-v0 cland
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
| At least one harness | Claude Code (`claude`), Codex (`codex`) or OpenCode (`opencode`). Each one a role uses must be installed, with any login required by its selected provider/model. |
| `gh`, signed in | Importing GitHub issues and the GitHub checks in doctor. Git publication itself uses Git authentication. |
| A terminal | The Neovim workbench and the harness logins. Any modern terminal works; Ghostty, kitty, WezTerm, iTerm2 and tmux are fine. |
| Node >=24.13.0 <25 | The install script and source install. |

You do not need Neovim installed or configured. cland downloads its own pinned Neovim release on first use, checks it against a pinned SHA-256 digest and starts it with a clean configuration, so your own Neovim setup is never loaded and never changed. The download cache is `.cache/nvim/<tag>/` under the cland installation (the source clone for a source install).

## Harnesses and logins

`cland setup` handles this for you. For each harness it:

1. Looks for the binary, also in the official installers' folders, and prints its version.
2. If the harness is missing, shows its official user-level installer and runs it in your terminal when you say yes. A declined install is remembered and not offered again until you ask with `cland setup --install <harness>`. That flag runs the installer directly, without another confirmation, including outside a terminal.
3. Runs the harness's own login in your terminal, in the same environment the hub launches sessions with:

   | Harness | Login |
   | --- | --- |
   | Claude Code | `claude auth login` |
   | Codex | `codex login` |
   | OpenCode | `opencode auth login --standalone` (optional: the free model needs no login) |

cland keeps OpenCode sessions in a database of its own, separate from OpenCode's background service, so that service can never pick up a cland session. That is why the OpenCode login goes through setup: it signs in to cland's database. `cland doctor` prints the exact login line for it.

Without a terminal, ordinary setup reports unresolved steps and exits 1. `--yes` can choose harmless defaults, grant project trust and start the hub; `--harness` can choose the favourite harness; `--install <harness>` explicitly runs an installer. Interactive logins and launching the Aide still need a terminal.

```sh
cland setup --json            # the steps as JSON
cland setup --install codex   # run the Codex installer without another prompt
cland setup --no-accounts     # skip the accounts step
cland setup --no-aide         # skip hub start and the Aide; cland starts the hub later
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

`cland update` preserves existing `roles.toml` and `crew.toml`. Setup may rebuild an untouched generated roles template for the installed harnesses; hub startup also performs narrow compatibility migrations, reporting any changes. A file or hook without cland's `managed by cland` mark is never written. Commit what `cland update` changed.

## Uninstalling

Remove cland itself:

```sh
# Homebrew
brew uninstall cland

# Source
npm unlink -g cland     # then delete the clone
```

For the install script with its default prefix, remove both the command and the
installation directory:

```sh
rm ~/.local/bin/cland
rm -rf ~/.local/lib/cland
```

For a custom `PREFIX`, remove `<prefix>/bin/cland` and `<prefix>/lib/cland/`
instead. `command -v cland` shows the command path. The script uses npm's shared
cache (normally `~/.npm/`); that cache is shared with other Node tools.

Remove cland from a project:

```sh
cland hub stop
cland init --undo      # restores the remotes: github becomes origin again
```

`cland init --undo` undoes only the territory step. It refuses when work would become unreachable and names the refs; keep that work under a surviving branch, or pass `--force` to discard it. Then delete `.cland/`, `.agents/skills/`, the `.claude/skills` link, the cland block in `AGENTS.md` and the cland hooks in `.claude/settings.json` if you no longer want them.

The source-install Neovim cache disappears with the clone. User-level state lives in:

| Path | What it holds |
| --- | --- |
| `~/.config/cland/accounts.toml` | Your account names and paths. No secrets. |
| `~/.local/state/cland/` | The spend ledger of cloud verification runs. |
| `~/.local/share/cland/opencode/` | cland's own OpenCode database. |

:::caution
These paths follow `XDG_CONFIG_HOME`, `XDG_STATE_HOME` and `XDG_DATA_HOME` when set. Delete them only after uninstalling. The spend ledger is what keeps cloud runs under your daily cap across projects.
:::
