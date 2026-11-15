---
id: T-1870
kind: task
title: "Integrated pass on the fakes: hosts, logins, users and restart in one scenario"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1539
blocked_by: []
topic: topic-1524
branch: t/T-1870-integrated-pass-on-the-fakes-hosts
created: 2026-11-15T13:08:09.345Z
updated: 2026-11-15T13:09:12.159Z
---

## Summary

One scenario test runs the paths across R-1530's epics that no single epic's demo covers, on the fake host provider, the fake transport and the test messengers only. It is the integrated pass of E-1539 (C2): hosts, logins, users and the workbenches meeting in one scratch project.

## What to build

A T3 scenario test, `hub/test/scenarios/integrated-v04.test.ts`, on a scratch project with:
- an `agents` pool of two fake hosts, Implementer and Reviewer roles placed on it, and the Coordinator local;
- a fake DigitalOcean API and fake transport, with no real host, token or network.

It walks these five paths in order, asserting each outcome where a human would see it (the hub's state and the web/Neovim projections the existing component tests read):
1. **Login from a card.** A launch waits for a login (`waiting for a login <harness>`). A login added from a remote card (Telegram fake) releases it, and the session runs on a fake host.
2. **Sign-in again with sessions running.** A login is signed out. The web hosts view's sign-in flow (through the hub, as the hosts view does) signs it in again, and that host's running sessions keep running throughout.
3. **Two users.** In users mode with two users, one answers an ask from a remote, and the other sees the answer and who answered in the web.
4. **Restart with busy hosts.** A hub restart with sessions on both hosts loses no session, row or pending delivery.
5. **The sub-cap.** When the hosts' daily sub-cap is reached, new host creation is refused, and the live hosts and their sessions are untouched.

Reuse the existing fixtures: `sshHostFixture`/fake host provider, `projectHub`, the remote fakes, and the users-mode helpers. Where a step needs a helper that only exists inside one test file, lift it into a shared fixture (rule 20 sweep). Invite links are credentials: never in titles, output or evidence. Per-test docs under docs/agents/tests/.

## Acceptance criteria

- [ ] C1. The scenario passes on the fakes through all five paths, asserting each outcome where a human would see it, with no real host, token or network (test).
- [ ] C2. Each path fails when its product behaviour is broken: show a red run per path, for example by withholding the login release, signalling the host's sessions, dropping the second user's projection, losing a row across restart, or letting a new host past the sub-cap (test).
- [ ] C3. The file is registered in T3 with a duration allowance if it needs one, and an exact `/private/tmp` and per-user TMPDIR name set is unchanged around it (test).
