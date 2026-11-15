---
title: Users and sign-in modes
description: Switch a project to users mode, invite people and identify who writes and answers.
---

## The two modes

New projects use **single** mode: browser sign-in links represent the same human.
**users** mode gives each person a named identity, passkeys or a password, and
their own remote pairings. The project setting is `auth.mode`; change it through
the auth commands, rather than editing it or using config set.

## Switching and reset

Run the following commands in your own local human shell, inside a project with
a running hub and its web edge available. The first command switches from single
to users mode, creates the first admin from Git's `user.name`, and prints that
user's invite when web is available. Switching signs out current browser sessions.
Open that invite privately to register your sign-in. Invite links are credentials:
never paste them into topics, logs or screenshots.

The marked blocks form one walkthrough. Replace `teammate` with your second
person's name when using it yourself.

```sh users-invite
cland auth mode users
```

## Users and invites

```sh users-invite
cland user add teammate
cland user list
cland user invite teammate
```

Add creates an invited admin and prints a one-time, 24-hour invite. List shows
name, display name, role and state. Invite replaces that user's open invites with
a fresh 24-hour link; send the latest link privately. Printed output includes the
user's metadata followed by `<one-time invite link>`; this placeholder is not a
working credential. `cland user add <name> --display <name>` sets a display name.

`cland auth reset` is the only way back to single mode. It retains users and
revokes browser sessions and open invites. Use it from your local human shell.
Switching again retains existing users.

## Passkeys and passwords

On the invite page, choose a passkey or set a password of at least 12 characters.
Use HTTPS through your own tunnel for a phone; passkeys require a secure browser
context (localhost also qualifies). Later sign-ins use the registered passkey or
password. See [multi-user web sign-in](/docs/web-and-phone/#multi-user-sign-in)
for the browser's users list and invite controls.

## Attribution with --as

In your human shell, `cland topic answer <ask id> <option number> --as <user>`
selects an active user in users mode; omission uses the first user. Single mode
records a stand-in name. A launched agent's shell keeps its own authenticated
session identity: `--as` does not change that identity or grant permissions.
Messages show who wrote them; answers and approvals keep the person who settled
them. In users mode, session rows and the Agents start line also show the
launching user.

## Remotes in users mode

Pairings belong to each user. General is mirrored to every paired user, and
the first answer wins across remotes and workbenches. Everyone shares one inbox;
there is no separate queue per person. See [Remote control](/docs/remote-control/)
for local pairing approval and remote configuration.

## Setup and doctor

`cland setup` puts **sign-in mode** after the hub and before remotes. It asks
“Let several people sign in to the web (users mode)?” with No as the default,
then confirms the browser sign-out and reset requirement. It shows the first
invite only in terminal narration and waits for the passkey registration.
Pressing Enter skips the wait: the row stays `open`, with
`cland user invite <name>` as the fix.

In single mode, `cland setup --yes` keeps single mode and reads `skip`.
Without a terminal and without `--yes`, single mode also reads `skip`, with
`cland auth mode users` as the fix, preserving unattended setup's exit status.
Already in users mode, the row reads `ok` with its user count.

`cland doctor` reads **sign-in mode** from project config. Single mode reads
`single`. In users mode the running hub supplies active/invited user counts and
admin counts, including active admins. With no active admin it warns with
`cland user invite <name>`. If the running hub refuses the users query, counts
stay unavailable and it suggests `cland hub reload`. Without a hub it says
`hub not running` and suggests `cland hub start`.

## Deferred

OIDC and SSO, and roles beyond admin, wait for 0.4.x. The current user-management
flow creates admins; it does not offer a member role or an external identity provider.
