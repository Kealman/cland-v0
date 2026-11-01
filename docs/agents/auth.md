# Sign-in mode

New and updated managed projects write `[auth] mode = "single"` in
`.cland/config.toml`. Missing auth settings also mean single mode. This is
independent of `[auth]` in `.cland/secrets.toml`, which holds login key storage
settings; the mode never belongs in the secrets file.

From a human shell on the hub machine, `cland auth mode users` creates the first
admin from Git's `user.name` (the OS user name when unset). Its name is the
lowercase ASCII slug with hyphens. Reserved addresses, roles and existing session
names cannot be user names. The command prints the first user's name and role. `cland user list` prints name, display name, role and state
in users mode. These commands use the local Unix socket; agents, web clients and
remotes cannot invoke their frames. Generic `cland config set auth.mode` refuses
all values and points to `cland auth`.

Switching revokes earlier browser sessions and outstanding one-time links.
Repeated switches and hub restarts retain the same first user. Human identities
and the sole `admin` role live in `hub.db`; `auth_state` records the last authorized
mode and its timestamp. A hand edit into users mode is refused at startup and
reload until the authorized switch has created the first admin and checkpoint.
For a stopped hub, restore single mode in config, start it and use
`cland auth mode users`.

## Back to single mode

Run `cland auth reset` while the hub runs. It revokes browser sessions, drains
all tracked sockets and uploads, including owners whose sessions have expired,
clears outstanding one-time links and returns to single
mode. Users remain for attribution. The reset's ordered synchronous revokers run
in the database transaction before its single-mode checkpoint; invite and pairing
owners register cleanup through `store.users.onReset`. Native web drainage happens
before this transaction. Link minting, link redemption, cookie admission and
capability checks stay fenced until the transition has published its loaded mode.
If reload fails after saving the transition, browser admission stays fenced; fix
the reported configuration error and run `cland hub reload` to settle it. A revoker failure rolls back the durable mode change.

A hand edit from users to single is refused at reload, keeping the running mode.
Run `cland auth reset` directly in that case. If the hub is stopped, set
`auth.mode = "users"` in `.cland/config.toml`, start the hub, then run
`cland auth reset`. There is no offline reset path.
