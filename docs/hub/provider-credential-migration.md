# Provider credentials and shell startup

Store a DigitalOcean token with `cland secret set digitalocean.token` in the
project. Use its hidden prompt or stdin from a credential source; never put a
value in argv, shell history or a report. Restart the hub to apply the store to
all provider owners. The hub resolves the token into its private environment;
host providers and droplet verification share it, and child launches filter it.
An explicit `DIGITALOCEAN_TOKEN` in the hub launch environment still overrides
the store for compatibility, including an empty override that disables access.

One-time human step: move the export out of your shell startup files, store the
token using that command, then restart the hub and role sessions. Check all
startup files you source, including `.zshenv`, `.zprofile`, `.zshrc`, `.zlogin`,
`.profile`, `.bash_profile`, `.bash_login` and `.bashrc`, and any `ZDOTDIR`,
`BASH_ENV` or `ENV` configuration. Only the human edits these files. Cland never
edits them and preserves PATH, aliases and tool discovery. Each project using
the provider needs its own stored token.

`cland doctor` reports literal exports of the shared hub-only credential names,
using names only. This advisory does not change exit status or block launches.
It reads at most 64 KiB per candidate startup file without executing it; missing
files are allowed, unreadable/oversized files report an incomplete scan.
Computed exports, indirect source chains and system startup files remain
unverified. A clean scan is not proof that a shell is credential-free.

The launch filter alone cannot prevent a startup file from adding a token back.
This migration removes that source; cland does not impose shell isolation.
Sessions run with full filesystem access, so this is protection against
accidental inheritance, not a security sandbox against reading local files.

Harness startup evidence and limits (2026-11-16):

- [Codex](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/unified_exec.rs)
  defaults tool commands to login shells unless `allow_login_shell=false`.
  The selected bash/zsh shell and snapshot path determine which profiles run.
- [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
  records skipping login initialization when a shell snapshot is available;
  without that snapshot, login initialization can still run. Bash/zsh selection
  depends on the installed harness and shell configuration.
- OpenCode's installed-version shell contract was not pinned or executed in this
  item. An unpinned search excerpt for its mutable dev branch showed login and
  explicit rc sources; that excerpt was stale at source review and does not
  establish current behavior. The test's explicit-source mode is a conservative
  historical/unverified emulation, not an assertion about current OpenCode.
  Non-login shells are also covered: zsh can read `.zshenv` even with `-c`.

The adapters launch harness executables directly, locally or through the host
agent; they do not own these internal shell choices. Remote hosts need the same
startup-file hygiene. Tests emulate non-login and login bash/zsh, interactive
zsh, and a historical explicit-source mode under scratch HOME/ZDOTDIR. They are not native
harness execution receipts; planted-export controls precede migration and
names-only assertions. No real account, token, provider or network is used.
