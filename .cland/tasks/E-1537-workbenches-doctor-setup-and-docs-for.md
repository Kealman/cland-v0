---
id: E-1537
kind: epic
title: Workbenches, doctor, setup and docs for hosts
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1534
  - E-1535
topic: null
branch: null
created: 2026-10-31T18:22:04.429Z
updated: 2026-10-31T18:22:56.261Z
---

## Goal

The human sees and steers hosts, logins and users from the workbenches, and a new project can set them up. Both workbenches get a Hosts row beside Remotes, one line per pool, which expands to the host list. In the web it opens a hosts view where the logins can be added, signed in again, removed and snapshotted. Session rows name their host, and waiting launches show their reasons in both inboxes. Doctor checks the provider token, the pool images, the logins and the hosts' spend. Setup gains optional steps for agent hosts and for the sign-in mode, and the onboarding tour gains a stage on hosts. The site gets pages on hosts, pools and logins, and on users and sign-in modes, with a price table that carries its check date. The epic builds on the hub's host, pool and login frames from the epics before it; its users stage builds on "Users and sign-in modes" (Q-1519 §5, Q-1520 §5, Q-1527, Q-1522 §4).

## Contents

- **The Hosts row** (spec §3.9). In the web's Sessions area and Neovim's sessions panel, beside Remotes: per pool "agents 2/4 hosts · 7/16 slots · logins claude 2/3, codex 1/1", red at once for an unreachable host or a provider failure, expanding to the host list (id, size, region, uptime, sessions, price per hour, spend today). Demo: with two fake hosts, both workbenches show the line and the list, and a host made unreachable turns the row red.
- **The hosts view in the web** (§3.9). The expanded row as a view inside the Sessions area (assumed in the spec): hosts with `stop`, logins with their state, host and last sign-in, and the actions add, sign in again, remove and snapshot, each through the hub's frames with confirmations for destructive ones. Demo: a login added and one removed from the web, read back in `cland login list`.
- **Session rows and waiting launches** (§3.9, §3.5). Session rows name their host; waiting launches show as status lines with their current reason in both inboxes; a host session's attach from Neovim runs the `ssh -t` attach. Demo: a waiting launch's reason changes from "waiting for a login" to "waiting for host <id> to boot" in both inboxes.
- **Doctor** (§3.9). The provider token's presence and fingerprint (no paid call), each pool's image against its key, free logins per pool and harness, signed-out logins, the hosts' reachability, and the hosts' spend against the sub-cap; each `warn` with its fix. Demo: doctor on a scratch project with a stale pool image, a signed-out login and no token reads each line.
- **Setup's agent-hosts step** (§3.9). After the remote step and before the Aide, optional and defaulting to No with `--yes`: the provider token's presence in the hub's environment, the `agents` pool with its defaults written to config, `cland host prepare`, and a first login per harness of the roles placed on the pool. Without a terminal it reports what is open. Demo: a scripted terminal walks the step on the fake provider and leaves a pool and a login.
- **The onboarding tour** (§3.9). A stage on agent hosts: where the Hosts row is, what a waiting launch means, how to add a login. Demo: the tour's stage text reads against the built workbench.
- **Docs** (§3.9). Pages on hosts, pools and logins (configuration, commands, the lifecycle and failures, money, the login rules per harness with the Codex one-place warning) and a price table with its check date; the `cland host` and `cland login` commands in the CLI page. Demo: QA follows the hosts page from a fresh reading and configures a pool on the fake provider.
- **The users stage** (§3.8, §3.9), after "Users and sign-in modes": setup's sign-in mode step (single or users, with the first user's passkey when users is chosen; No with `--yes`); doctor's mode line with the number of users and admins; the user shown on session-launch and approval rows where the hub records it; the users and sign-in modes page and the multi-user section of the web-and-phone page. Demo: setup switches a scratch project to users, and the pages describe what QA then sees.

Not in this epic: the hub's host, pool and login logic (the epics before it); the Kubernetes install page (0.4.x); per-user notifications (deferred).

## Order

1. **The Hosts row and session rows.** Both workbenches. Demo: the row, the list and the red state.
2. **The web's hosts view and waiting launches.** Demo: a login added from the web; the waiting reason changing in both inboxes.
3. **Doctor and setup's hosts step.** Demo: doctor's lines; the scripted setup step.
4. **The tour and the hosts docs.** Demo: a pool configured from a fresh reading of the page.
5. **The users stage**, after "Users and sign-in modes". Demo: setup's sign-in step and the users pages.

## Definition of done

QA runs the demo below on `dev` through the `cland` CLI, headless Chromium and a headless Neovim workbench, with the fake host provider, the fake transport and the fake harness in the suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real provider is involved.

In a scratch project QA runs setup with a scripted terminal through the agent-hosts step and the sign-in mode step (choosing users), and reads the pool, the first login and the first user. It launches sessions onto two fake hosts and reads the Hosts row and the expanded list in both workbenches, the host on each session row, and the row turning red when a host is made unreachable. It fills the logins so a launch waits, and reads the reason in both inboxes change as a login is added from the web's hosts view. It removes a login from the web and reads it gone from `cland login list`. It runs doctor with a stale pool image, a signed-out login and the token unset, and reads each line and fix. It walks the tour's hosts stage. From a fresh reading of the hosts page it configures a second pool, and from the users page it invites a user. It reads the price table's check date and the web-and-phone page's multi-user section.

- [ ] C1. Both workbenches show a Hosts row per pool with hosts, slots and logins in use, expanding to the host list, red at once for an unreachable host.
- [ ] C2. The web's hosts view lists hosts and logins and adds, signs in again, removes and snapshots logins through the hub.
- [ ] C3. Session rows name their host, and waiting launches show their current reason in both inboxes.
- [ ] C4. Doctor checks the provider token, the pool images, free and signed-out logins, reachability and the hosts' spend, each with its fix, and makes no paid call.
- [ ] C5. Setup's agent-hosts step and sign-in mode step are optional, default to No with `--yes`, and leave a pool, a first login and, in users mode, a first user.
- [ ] C6. The onboarding tour has a stage on agent hosts.
- [ ] C7. The site has pages on hosts, pools and logins and on users and sign-in modes, a price table with its check date, and a multi-user section in the web-and-phone page, each matching the build.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The web.** CSS Modules and `var(--token)` from `web/src/tokens.css` (colour values only there), structure copied from `web/src/Shell.tsx`, secondary text at 4.5:1 on ground and selection, no UI library, key bindings only through `web/src/keymap.ts`. Names, counts and facts in the interface; explanations in tooltips, help and docs.
- **Neovim.** The panel follows the Remotes row's pattern in the sessions panel; no new key binding outside the plugin's key map.
- **Doctor and setup.** Doctor reports presence and fingerprints only and makes no provider or paid call. Setup never prints a token and never creates a paid host without the human's yes; `--yes` alone does not enable hosts.
- **Docs.** The site's docs live in `site/src/content/docs/docs/`; the pages describe the release as built, and prices carry the date they were checked. Site pages reach GitHub only through `cland release`, or `cland publish` after the human's approval.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** After "Pools, placement and the scheduler" and "Logins"; its users stage after "Users and sign-in modes".

## References

- Spec: `docs/spec/v0.4.md` §3.9 (workbenches, doctor, setup, onboarding and docs), §3.5 (waiting launches), §3.7 (login operations), §3.8 (users) and §4.
- Items: R-1530; the map M-1511; Q-1519 §5; Q-1520 §5; Q-1527 §1 and §3; Q-1522 §4; E-1313 (the v0.3 workbench, setup and docs epic, the model for this one).
- Code: `web/src/` (the Sessions area and its Remotes row), `nvim/lua/cland/` (the sessions panel), `hub/src/doctor/` (`remotes.ts` as the pattern), `hub/src/setup/`, the onboarding skill in `.claude/skills/onboarding/`; `site/src/content/docs/docs/` (`remote-control.md`, `web-and-phone.mdx`, `cli.md`, `accounts.md`).
- GLOSSARY: Host, Host pool, Waiting launch, Login, User, Sign-in mode (added for v0.4); Setup (amended).
