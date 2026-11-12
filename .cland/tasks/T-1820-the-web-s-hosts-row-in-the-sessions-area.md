---
id: T-1820
kind: task
title: The web's Hosts row in the Sessions area
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1819
topic: null
branch: null
created: 2026-11-12T10:07:19.502Z
updated: 2026-11-12T10:07:41.289Z
---

## Summary

The web's Sessions area shows a Hosts row beside Remotes, one line per pool, such as "agents 2/4 hosts · 7/16 slots · logins claude 2/3, codex 1/1". The line turns red at once when its pool is alerted, and the row folds open to the host list: id, size, region, uptime, sessions, price per hour and spend today.

## What to build

A Hosts row drawn from T-1819's frame, built as the Remotes row is (the Sessions area's fold, its own CSS Module, tokens only), on desktop and phone widths. Each pool gets one line of facts, with the harness labels of question 9. The line uses the error token while the pool is alerted and names the unreachable host or the provider failure. The folded-open row lists the hosts. Uptime advances from each host's creation time between pushes; spend is shown as the hub last pushed it. Each fact has a tooltip that explains it. The row is hidden when no pool is configured and no host is live. Opening and closing the fold goes through the existing fold control and the key map's existing actions; no key binding is added. T-1825 turns the open row into the hosts view.

## Acceptance criteria

- [ ] C1. With two fake hosts in one pool, the Sessions area shows the pool's line with hosts, slots and logins per harness as the hub reports them, at desktop and phone widths with no horizontal scroll (test).
- [ ] C2. Opening the row's fold lists each host with id, size, region, uptime, sessions, price per hour and spend today (test).
- [ ] C3. A fake host made unreachable turns its pool's line red within one second and names the host, and the line is plain again when the tunnel returns (test).
- [ ] C4. A project without a host pool shows no Hosts row (test).
- [ ] C5. The typecheck's colour and contrast checks pass, and the hooks check finds no key listener outside the key map (test).

## Blocked by

- T-1819

## Notes

- Hot files: `web/src/sessions/HostsLine.tsx` and `HostsLine.module.css` (new), `web/src/sessions/SessionsArea.tsx`, `web/src/connection.ts`, `web/src/sessions/state.ts`.
- Tests: new `web/test/hosts.test.ts` (Web, `projectHub` with the fake host provider and the fake transport, isolated Headless Shell), after `web/test/remotes.test.ts`.
- Serves epic C1.
