# T-1961 close ownership

Search scope: production, hub/src tests, hub/test (all tiers), nvim/test,
web/test, shipped skills, docs and QA briefs. Searched `createHub`,
`createHubBase`, `projectSessions`, `ProjectSessions`, `ProcessTable`, `Store`,
their imports and direct `.close()` calls, including retry/reset paths.

| Consumer | Disposition |
| --- | --- |
| `hub/test/harness.ts` `startHub` | Retains its owner after a rejected close and resets its in-flight promise. The same owner can now retry only failed cleanup parts. No API migration. |
| `hub/src/hub/daemon.ts` `serveProject.stop` | Uses `createHubBase` and `projectSessions` independently; resets `stopping` after failure. Store and ProcessTable now retain successful native closes; Sessions skips successfully closed adapters. Its existing first-failure aggregation remains. |
| `hub/src/cli/hub.ts` `stop` and `serve` | Socket stop, stdin EOF and signals reach the daemon stop owner. CLI stop may fall back to an identity-checked signal; it does not construct or close a second Store. No CLI or wire change. |
| `hub/src/hub/server.ts` `createHub` | Joins concurrent closes, records completed edge/sessions/base parts, retries failed parts and preserves the first error with secondary failures in an AggregateError. |
| `hub/src/adapters/index.ts` construction rollback | Unregistered adapters remain owned on a failed close; successful ones leave the pending set. ProcessTable makes repeated successful native close a no-op. |
| `hub/src/adapters/sessions.ts` | Records successful synchronous/asynchronous adapter closes separately; failed adapters stay retryable. Existing quiescence/drain steps remain. |
| Direct Store / ProcessTable users and persisted-record readers | No schema, stored bytes, returned rows, method signature or wire shape changes. Only a repeated successful close becomes a no-op; failed native closes remain retryable. |
| Tests and fixtures | Existing T2 `fake-harness.test.ts` now covers direct createHub retry, original error identity, per-adapter attempts and actual SQLite close receipts. Existing construction rollback and fixture retry tests keep their assertions. T3 resilience and daemon lifecycle callers require no API migration. |
| QA briefs, shipped skills, startup probes, web and Neovim clients | No close result shape or method change; process stop callers retain their existing lifecycle protocol. No frozen CLI usage bytes change. |

The previous `close(): Promise<void>` wire-independent interface is retained.
The regression uses three in-process fake adapters, a fake clock, isolated
environment and a positively controlled native-launch guard. It launches no
harness, droplet or browser and opens no live database.
