---
id: T-1592
kind: task
title: The spoke edge on a Unix socket
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1329
branch: t/T-1592-the-spoke-edge-on-a-unix-socket
created: 2026-11-02T03:33:53.512Z
updated: 2026-11-02T05:58:20.592Z
---

## Summary

The hub listens for spokes on `.cland/run/spoke.sock`, mode 0600, beside its loopback port. It uses the same WebSocket protocol and the same bearer admission, so a spoke can dial `ws+unix:`. Local spokes and `hub.json` are unchanged.

Hot files: `hub/src/hub/server.ts`, `hub/src/hub/daemon.ts`, `hub/test/spoke-unix-edge.test.ts` (new)

## Acceptance criteria

- [x] C1. A started hub binds `.cland/run/spoke.sock` at 0600 (with the short-path fallback), and a spoke connecting through `ws+unix:` with the project secret gets a welcome like one on the loopback port (test).
  - done: impl-1592 · 2026-11-02T05:56:29.658Z
- [x] C2. A connection there without the bearer secret, or with a wrong one, is refused and logged as on the loopback edge (test).
  - done: impl-1592 · 2026-11-02T05:56:31.016Z
- [x] C3. A stale socket file left by a dead hub is replaced at start, and a hub stop removes only the file it bound (test).
  - done: impl-1592 · 2026-11-02T05:56:32.075Z
- [x] C4. A client hello is refused on the Unix spoke edge exactly as on the spokes' WebSocket, and the spoke-reconnect and hub-socket test files pass with no test edited.
  - done: impl-1592 · 2026-11-02T05:56:33.739Z

## Notes

Shared files: `hub/src/hub/daemon.ts` (edge startup; 13 and 26 later)

## Comments

### impl-1592 · 2026-11-02T05:44:14.469Z

Consumer inventory (rule 20): searched createWebSocketEdge/WebSocketEdge/createSocketEdge across hub, shared, nvim, web, qa, docs and shipped skills. WebSocket production callers: server.createHub and daemon. Socket edge callers: daemon plus visibility-component, web-authority, session-brief[-component], session-credential-io, task-card-component, request-guard, plan-stage-fixture, item-lead, tracker-rank, prompt-races, artifact-lifecycle, name-reservation, artifact-host, roles-snapshot-cli, hub-status-component. Existing APIs/wire shape/discovery remain unchanged; additive Unix path option reuses WebSocket dispatch edge identity and bearer check. Shared bind lifecycle will retain socket edge API. project.layout gains additive spokeSocket; old layout consumers remain unaffected. Prior-shape coverage: existing hub/socket and spoke reconnect tests remain unedited. No per-host admission added (T-1596).

### impl-1592 · 2026-11-02T05:53:06.537Z

Implementation complete; final checks waiting on load ≤10. macOS arm64 / Node v24.21.0, local executor, no browser: npm run typecheck passed. Targeted receipts: spoke-unix-edge.test.ts 8/8 (short bind + long-root fallback bind, missing/wrong bearer vs loopback, stale socket replacement/removal, replacement preservation, client refusal vs loopback, UTF-8 path limits); unchanged daemon.test.ts T3 18/18, resilience.test.ts T3 3/3, edges-component.test.ts T2 1/1. No full suite or Linux run yet. Initial C1 red was ENOENT on spoke.sock before edge implementation. Lint caught and fixed missing tier entry and guide heading; final lint pending. Consumer search additionally covered colocated hub/src tests and QA briefs; local discovery/wire shape unchanged, no fixture migration required. Shared binder captures inode before publication and uses distinct short staging names for the two Unix listeners.

### impl-1592 · 2026-11-02T05:58:20.592Z

C4 preservation filename mapping: the draft's spoke-reconnect file refers to current hub/test/resilience.test.ts (3 native tests, including a spoke surviving hub outage/reconnecting); hub-socket refers to current hub/test/daemon.test.ts (18 native tests including wrong-secret refusal, long socket path, both-edge protocol, and owned socket cleanup). Neither draft filename exists at reviewed head cb4454659b8ff019913d8c2ceab712cc138860ec. Both current files passed unchanged locally on macOS arm64/Node 24.21.0. Supplement: unchanged hub/test/edges-component.test.ts 1/1. These executable owners are also named in A-15601 and the committed per-test guide.
