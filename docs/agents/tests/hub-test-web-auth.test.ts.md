# hub/test/web-auth.test.ts


`web-auth.test.ts` exercises liveness on an injected clock at T2 (30-second
ping, 60-second silence, incoming traffic renewal), binary close 4003, the exact
1 MiB UTF-8 JSON boundary and oversize close 1009, welcome build stamps and
protocol restart instructions, plus `terminal: 'none'` through `session.list`.
`web/test/connection.test.ts` uses the isolated Headless Shell to prove a stale
page reloads to the current digest and that protocol refusal renders **Restart hub**
without retries. Frame navigation and final live DOM state are separate receipts.
