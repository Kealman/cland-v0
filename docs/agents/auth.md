# Sign-in mode

New and updated managed projects write `[auth] mode = "single"` in
`.cland/config.toml`. Missing auth settings also mean single mode. This is
independent of `[auth]` in `.cland/secrets.toml`, which holds login key storage
settings; the mode never belongs in the secrets file.

From a human shell on the hub machine, `cland auth mode users` creates the first
admin from Git's `user.name` (the OS user name when unset). Its name is the
lowercase ASCII slug with hyphens. Reserved addresses, roles and existing session
names cannot be user names. The command prints the first user's name and role, plus a 24-hour invite when the web edge is available. `cland user list` prints name, display name, role and state
in users mode. The CLI uses the local Unix socket. Auth mode/reset and invite renewal stay
local-only. In users mode authenticated web admins may also call user.add and
user.list; agents and remotes remain refused. Generic `cland config set auth.mode` refuses
all values and points to `cland auth`. Auth/user handlers retain a human guard; an authenticated session shell is refused before any read or
mutation. Invite commands also refuse while a sign-in transition is draining or
retains a fence after failed reload. Successful recovery reload restores admission.

Switching revokes earlier browser sessions and outstanding one-time links.
Repeated switches and hub restarts retain the same first user. Human identities
and the sole `admin` role live in `hub.db`; `auth_state` records the last authorized
mode and its timestamp. A hand edit into users mode is refused at startup and
reload until the authorized switch has created the first admin and checkpoint.
For a stopped hub, restore single mode in config, start it and use
`cland auth mode users`.

## Acting as a user

In users mode local human writes default to the first user. `--as <user>` on
`cland topic create`, `topic answer` and `artifact create` selects an existing
active user's exact name; display names are never selectors. The `topic.send`
and `approval.answer` frames use the same local `as.name` resolution (there are
no CLI verbs for these frames). Both the first user's and the selected user's
stored roles pass through `userAuthorityRefusal` before replay. Unknown or
invited-only users are refused with their name. Outcomes, posted messages,
artifacts and journal/audit records retain the selected user's id. The topic-created
journal receipt includes the user's name in `by` and the optional `userId`. Single mode
keeps the previous stand-in answer attribution and artifact shape. A shell with
`CLAND_SESSION_ID` or `CLAND_SESSION_NAME` set keeps its session identity despite
`--as`; authenticated web and gateway identities retain their transport rules.

## Invites

In users mode, `cland user add <name> [--display <name>]` creates an invited
admin and prints a one-time 24-hour invite URL. Names are unique lowercase
ASCII slugs, excluding `human`, `hub`, `all`, roles and current sessions.
`cland user invite <name>` replaces any open invite for an existing user.
The CLI requires a local human shell; both minting commands require an available web edge.
Accounts also offers user creation to authenticated admins in users mode, with
the same name rules and refusals. Its Users fold lists every user and the count.
The invite is shown for copying only until dismissed or the view is left; it is
not stored in browser settings. Single mode shows no users list and refuses web
user.add/user.list with guidance naming users mode. URLs use `[web]
origin when configured, otherwise the edge address (wildcard binds use loopback).
Tokens are stored only as SHA-256 digests with expiry and state, and appear only
in minting results. Used, expired, unknown and revoked invites are refused with
distinct reasons. Credential registration consumes an invite in its commit
transaction after validating it. Reset revokes every open invite through
`store.users.onReset` while retaining users for attribution.

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

Project login removal uses `cland login remove <name>` from the local human CLI
or Neovim, or an authenticated web user (an active admin in users mode). It deletes only the named key envelope and row, retaining `[auth]`.
Disk removal and partial-deletion retries are documented in
[Logins](../hub/logins.md#removing-a-login).
