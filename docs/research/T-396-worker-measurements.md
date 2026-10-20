# T-396 worker measurements

## Ownership and gate

Coordinator decision on T-396, 2026-10-15 15:39Z: the pre-merge gate proves the
configuration, per-run overrides, saved request, price reservation, refusal of
unoffered sizes and result headers with fixtures. Measurements belong to E-387
stage-2 close after merge and a hub restart. The Coordinator runs this procedure,
posts the receipts on T-396 and changes the defaults in a follow-up config commit
only if the numbers justify it. Four workers were the unmeasured default; D53 later set droplet workers to 2, measured on c-8 (T-655, A-4106 and A-4156).

## One build and comparable runs

Use the same clean integrated `dev` head for every measurement. Record its full
SHA, Node/Neovim versions and machine/platform. Do not use an occasion: each
measurement must run the whole suite on one machine rather than close-run shards.
`--fresh` prevents a green tree from replacing timed execution. Each invocation
returns a run id; wait for its result and confirmed cleanup before the next.

The Coordinator opens each batch window. Worker measurements start only with no
holder or waiter in `cland verify queue`. For the Mac, announce cover-quiet,
check the one-minute load is below 15 and check that
`pgrep -f 'node --test hub/test|test:nvim'` returns no PIDs before every run.
Record starting load as well as peak load. Keep the same quiet/loaded conditions;
label an interrupted or nonquiet run and exclude it from a speed comparison.

First run three serial c-16 measurements, replacing N by 4, then 6, then 8:

```sh
node hub/bin/cland.ts verify all --fresh --executor droplet --size c-16 --workers N --report topic-307 --to coordinator --to "lead T-396"
```

Then run three serial local measurements, N = 4, then 5, then 6:

```sh
node hub/bin/cland.ts verify all --fresh --executor local --workers N --report topic-307 --to coordinator --to "lead T-396"
```

A fallback receipt is local evidence, never a c-16 measurement. Stop and resolve
availability or spend capacity before continuing the droplet batch. Do not
create, list or delete droplets outside the hub. At $0.50/hour, three c-16 runs
with 20–30 minute lifetimes estimate $0.50–$0.75 total. The cap is shared with the
crew, and admission reserves the whole allowed lifetime (110m at the built-in
default = about $0.917 per run), so inspect available spend before the batch.
Never raise the cap or lifetime to fit these runs. The day's configured cap and
any Coordinator budget decision must be named with the receipts.

## Evidence and decision

For every run, preserve its result and log as hub artifacts. Fill the table below
and post it on T-396. Wall is the admitted run time through collection from the
hub status/result timing; separately retain `suite duration` for package wall.
Hub phase is the sum of `shard duration hub free` and `hub machine`. Peak is the
package runner's `peak 1m load` (sampled once per second). Keep failures, timeout
names, skips and cancellations visible, even when a run cannot finish.

| Workers | Executor | Repeat | Head / run / artifact | Wall (s) | Hub phase (s) | Peak 1m load | Failure / isolated result | Lifetime / cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | Mac local | 1 | pending | | | | | n/a |
| 5 | Mac local | 1 | pending | | | | | n/a |
| 6 | Mac local | 1 | pending | | | | | n/a |
| 4 | c-16 | 1 | pending | | | | | |
| 6 | c-16 | 1 | pending | | | | | |
| 8 | c-16 | 1 | pending | | | | | |

The 15:35Z Coordinator decision replaces the original six-local-run plan: run
each count once initially, then repeat close contenders when the leader's margin
is within 10%. Record every repeat as another row. A contender with a load-only
failure cannot win. Rerun failing files alone only in an open test window, one
file at a time under the load/queue rule, and record the isolated result. A pass
alone is evidence of load sensitivity, not proof that a parallel red was safe.

Retain four workers locally unless a failure-free leader beats its four-worker
baseline by at least 10%. For close contenders use the mean of comparable
repeats and list both observations. Select droplet workers separately using the
c-16 baseline; this original procedure proposed retaining four if failures or incomplete data prevented a reliable
choice (superseded by D53: 2 workers on c-8). Today's c-8 four-worker Linux timeouts at load 12–14 (E-482) make raw
speed alone insufficient: report whether the exact failing cases pass alone and
whether higher counts introduce additional timeout failures. Do not project a
c-16 result onto c-8 without evidence.

For droplets attach hub create/destroy receipts, size/region/name, lifetime,
actual billed cost, shared daily spend and the final empty `cland` tag listing
from the Coordinator's `cland executor status`. No session calls a provider API.
C2–C4 and the measured trade-off part of C5 remain pending until these receipts
are posted. Update `hub/README.md` Tests with the deciding numbers and artifact
links when the stage closes; name the config commit if a default changes.
