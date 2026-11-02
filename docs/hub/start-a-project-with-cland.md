## Start a project with cland

You need Node >=24.13.0 <25, npm, Git, curl and tar. On macOS with Homebrew, the
formula in `Kealman/homebrew-tap` installs the latest release's tagged source:

```sh
brew install kealman/tap/cland
```

On Linux, or macOS without Homebrew, install the latest stable released tag:

```sh
curl -fsSL https://cland.app/install.sh | sh
```

The POSIX installer in `site/public/install.sh` discovers stable tags with
`git ls-remote --tags --refs`, downloads a tag's source from codeload, and works
in a staging directory. It prefers the tag’s `cland-web.tar.gz` and `.sha256`
GitHub Release assets, verifies SHA-256 before extraction and checks the bundle’s
source stamp. With a valid bundle it runs only
`npm ci --omit=dev --ignore-scripts`. Missing, invalid or mismatched assets fall
back to `npm ci --include=dev --ignore-scripts`, `npm run build`, then
`npm prune --omit=dev --ignore-scripts`; no path installs the test browser.
The lockfile and its mtime are restored after dependency installation/prune
so doctor keeps accepting the web build receipt. The resulting source, runtime
dependencies and `web/dist` live
in `~/.local/lib/cland`, with `~/.local/bin/cland` linked to the CLI. Rerun to
update. No sudo is used; failed downloads/builds retain the old installation.
Interrupted publication restores the previous install; a failed restore reports
the preserved backup path. Signal cleanup retains staging while build children
may still be unwinding.

`PREFIX` chooses another writable absolute prefix; `CLAND_VERSION=vX.Y.Z` pins a
released tag and skips discovery. `CLAND_RELEASE_URL` accepts an HTTPS or file URL
to an equivalent source tarball (used by sealed offline tests). A custom source
URL builds from source unless `CLAND_WEB_RELEASE_URL` names the HTTPS or file
directory of matching assets. `sh install.sh --help` lists these inputs. See the [install docs](../../site/src/content/docs/docs/install.md)
for PATH and removal instructions. Stable tags retain their lockfile, build
sources and executable `hub/bin/cland.ts` for the source-build fallback.

In your project folder, initialise cland:

```sh
cd /path/to/your-project
cland init
```

Use an empty folder or a full clone of an existing project. A shallow project clone is refused: the territory needs the full history.

Then run setup in that same project folder:

```sh
cland setup
```

Setup readies the harnesses, their logins and folder trust, the accounts and your Favourite harness, then starts the hub, offers Telegram then Discord remote setup and the speech key, then starts the Aide.

It checks these steps in order: the initialised project; installed Claude Code,
Codex and OpenCode; logins for harnesses used by roles; separate signed-in account
profiles; your Favourite harness; folder trust; the project hub; optional Telegram and Discord remote setup; and `aide-1`.
Each report line starts with `ok` (already ready), `done` (changed and rechecked),
`skip`, `open` (needs action) or `fail`, with a fix when needed. Rerunning setup
reuses the running hub and Aide and asks only about unfinished choices. A declined
installer is remembered in `.cland/config.toml`; `--install <harness>` retries it.

The official user-level installer and the harness's login run in your terminal
after you agree. Setup writes your Favourite to `[aide.launch]` in
`.cland/roles.toml`. Outside the project, accepting the accounts question appends
names, harnesses and profile paths to `~/.config/cland/accounts.toml` (under
`XDG_CONFIG_HOME` when set); it copies no credentials. That question defaults to
No. Setup also trusts this project for every installed harness: Claude Code's
launch profile gets `projects["<root>"].hasTrustDialogAccepted = true` in
`.claude.json` (`~/.claude.json` by default, or inside `CLAUDE_CONFIG_DIR`), under
Claude Code's lock; Codex's short-lived app-server writes
`projects."<folder>".trust_level = "trusted"` to its profile's `config.toml`
(`~/.codex/config.toml` by default, or under `CODEX_HOME`). Selected role accounts
receive trust too. OpenCode has no folder trust gate.

| Flag | Effect |
| --- | --- |
| `--json` | Print one structured report; narration goes to stderr. Uses nonterminal policy. |
| `--yes` | Allow harmless setup writes; installers still require `--install`, and logins and a new Aide require a terminal. Does not accept machine-wide accounts or messenger setup. |
| `--install claude-code\|codex\|opencode` | Explicitly run that harness's installer, including after a decline. |
| `--harness claude-code\|codex\|opencode` | Choose the Favourite from installed harnesses. |
| `--no-accounts` | Skip the machine-wide accounts step. |
| `--no-aide` | Skip hub/Aide startup and workbench handover. |
| `--attach` | Attach the Aide in this terminal instead of opening the workbench. |

Without a terminal, setup asks nothing and reports unfinished steps with their
commands. It exits 1 while a step is open or failed, 0 when all applicable steps
are ready, and 130 on cancelled input. A running hub and Aide can be detected
without a terminal. Explicit flags can permit the actions described above.

The optional [Telegram step](cland-setup.md#telegram-in-setup) guides bot creation, hidden token
input and pairing on a separate identity confirmation; `--yes` accepts neither offer nor grant.

Setup opens the workbench with `CLAND_OPEN_SESSION=aide-1`. Once the hub lists
that session, the workbench opens its terminal in the centre in Terminal mode,
once. `CLAND_OPEN_SESSION` can name another opening session; it is removed at
startup before any child inherits it. An unknown name waits quietly, and a
saved restart view takes precedence.

The Aide leads the Onboarding: who decides what, a first plan you can see, the crew and a Welcome note. On your ok, the generated Codex Aide cannot commit at the project root and has the Coordinator commit and publish the results: its workspace-write sandbox cannot write root Git metadata. An Aide with current root Git write access commits and publishes itself. The Coordinator then starts the approved release, or waits for the first epic with only a map, and the Aide offers the Tour.

To reopen the workbench later, run `cland` in your project folder.

Closing the workbench or leaving an attach can leave the Aide running. Stop it
with `x` on its row in the sessions panel or `cland session stop aide-1`. Then
`cland hub stop` stops the project hub. Both commands run from the project folder.

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

