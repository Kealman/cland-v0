# hub/test/hub-status-component.test.ts

The startup relay records exact UTF-8 JSON result frames, with envelope and
newline, for status, rules, General history, artifacts, open item summaries,
events, sessions and accounts. It retains the rendered completion assertion and
waits separately for the eight reply receipts. An oversized rule reply exercises
the per-reply failure guard without depending on an oversized item list.
`hub-status-component.test.ts` checks compact/default and opt-in historical
status, complete-message before-id pages, artifact cursor pages and all eight
budgets on a small durable fixture. It uses the smoke's shared pure byte guard,
including per-reply and total oversize controls. Timing still requires the
rendered Neovim receipt.

The eight framed UTF-8 reply guards are shared through
`hub/test/startup-replies-fixture.ts`. The small synthetic fixture stays in this
T2 file. The T3 `hub/test/startup-replies-scale.test.ts` keeps both its generated
1,004-item scale case and a fixed 24-item pinned shape-corpus case. All hub
execution and writes use sealed scratch roots. Counts come from the fixture
rows; diagnostics retain each reply's measured bytes. The full live-body Lua
comparison runs separately at T4; the manual Neovim startup-budget probe keeps
its explicit full-copy source.

Historical full-copy byte measurements, before T-1421 pinned the T3 corpus:
on 2026-10-24 the local Darwin arm64 implementation tree based on `75951a7d`
measured 1,238 copied items (86 open), with byte guards enforcing these caps:

| Reply | Measured bytes | Existing cap bytes |
| --- | ---: | ---: |
| hub.status | 2,736 | 262,144 |
| rule.list | 59 | 262,144 |
| topic.history | 11,679 | 262,144 |
| artifact.list | 1,772 | 262,144 |
| task.list | 99,795 | 131,072 first item reply; 262,144 per reply |
| events.list | 23,101 | 262,144 |
| session.list | 845 | 262,144 |
| account.list | 188 | 262,144 |
| Total | 140,175 | 1,048,576 |

These historical growing-tracker measurements are not pinned-corpus expected values. Keep
the existing caps: the tightest, first-item cap has 31% headroom over this
measurement; the per-reply caps exceed 2.6 times every measured reply, and
the aggregate cap exceeds seven times the measured total. Oversized individual
and aggregate planted replies must still fail. Reaching a cap requires paging
or trimming the reply; keep the cap unchanged.

Historical headroom projection, not a current pinned-corpus estimate or measured exhaustion date: the larger sample leaves
31,277 bytes under the first-item cap, approximately 27 more open rows at its
observed average of 99,795 / 86 = 1,160 bytes per row. At the Coordinator's
2026-10-24 estimate of 50–100 new tracker items daily, a constant 86 / 1,238 open
share would consume this space in roughly 4–8 days. If all those additions stay
open instead, it lasts only about 6.5–13 hours. Closed rows do not enter this
open-summary reply, and the later sample already fell to 76 open rows, so total
item growth alone cannot establish a deadline. Row sizes and closures can move
either projection; use each run's actual byte diagnostics to plan paging or
trimming before the cap is reached.

This fixture provides byte
receipts only; `startupMs: 0` is an unused placeholder, not a timing measurement.
The existing copied-tracker Lua differential separately retains its 512 KiB
snapshot ceiling and 1 MiB protocol cap; synthetic snapshot/scale guards remain.

Historical follow-up: after fetching and merging `847b7c28`, the same local targeted T2 file passed
9/9 tests: 1,238 copied items, 76 open, `task.list` 86,662 bytes and 126,574 total
bytes. The earlier, larger measurement above remains the headroom reference.
The standalone T0 guard took 0.28, 0.27 and 0.26 seconds wall on local Darwin
arm64, including Node and TypeScript startup (enforcing controls and repository
scan, no suite/executor run). It prefilters candidate source before parsing;
there is no compiler type graph, worker or child process.

Historical relocation: the initial full-copy T2 case at `9a6d8a27` failed the
enforced new-identity 5-second duration gate in Linux run `0c97f1ae` (A-11122):
17.275973484 seconds ordinary, 18.864933431 seconds worst passing load repetition,
all byte/assertion checks passing. Coordinator decision 27508150 moved that
workload to T3. T-1421 subsequently replaced its live copy with the pinned corpus
and removed its obsolete allowance. The synthetic T2 case retains its original
test title and byte/fault assertions. See the startup-scale guide for current
fixture boundaries and the T4 Lua guide for full live-body coverage.
