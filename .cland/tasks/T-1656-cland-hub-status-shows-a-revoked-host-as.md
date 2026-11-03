---
id: T-1656
kind: task
title: "cland hub status shows a revoked host as plain 'down': host status rows carry no revoked state"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
regression_of: T-1595
topic: null
branch: null
created: 2026-11-03T05:54:30.566Z
updated: 2026-11-03T05:54:30.566Z
---

## Summary

Found while writing the E-1532 stage-2 QA brief. `HostRecords.list()` includes revoked hosts (T-1596), but `HostTunnelStatus` (T-1595) has no revoked state. After `cland host revoke <host>`, `cland hub status` and `hub.status` still list that host as `down`, the same as a host whose tunnel merely dropped, so the human can't tell a revoked host from a broken one.

## What to build

Host status rows show a revoked host as revoked, with the revocation time. The reconnect loop never starts for a revoked host. The additive `hosts` field keeps its existing members, and old clients still parse it (rule 20).

## Acceptance criteria

- [ ] C1. After `cland host revoke qa1`, `cland hub status` and `hub.status` show qa1 as revoked with its revocation time, and qa2 is unchanged (test).
- [ ] C2. The carrier never starts a master for a revoked host, and a client at the previous `hosts` shape still parses the reply (test).
