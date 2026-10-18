# T-723: PID identity fixture contention

The intermittent `database is locked` failure came from the Claude fixture's
stale-identity UPDATE opening `hub.db` through a raw `DatabaseSync` handle with
SQLite's default zero busy timeout while the live hub wrote the same database
through Store, ProcessTable and TrackerIndex. T-763 fixed the shared cause in
commit `447064753250a8627f9d14c90ff96a07d5adb202`; its red/green evidence is A-4909.
The regression observes real SQLITE_BUSY contention before releasing the writer
and verifies the exact ownership snapshot after the reader completes.

An audit of `hub/test/pid-identity.test.ts` confirms that all three direct handles
use `openDatabase` from `hub/src/database.ts`: `reusePid`, `pidRow`, and the Claude
stale-identity UPDATE. The opener installs `pragma busy_timeout = 5000` before
returning the handle. Each fixture handle closes in `finally`. No raw
`DatabaseSync` construction or `node:sqlite` import remains in that file.

T-763 changes only connection setup and guaranteed closure in this fixture; the
assertions retain their meaning. In particular, the Claude case still proves
that a running row names a live bystander with a different start identity,
`claude stop` fails for the staged missing harness identity, stop is refused,
and the bystander remains alive. This remains a T3 process lifecycle test.

No additional source change is necessary for T-723. This note records the cause
and the confirmation of the shared fix. The task item and its topic hold the
Mac repetition evidence and the reviewed-head droplet verification receipt.

## Mac confirmation

On 2026-10-18, attempts 19–28 passed consecutively as fresh serial whole-file
runs: 30 test passes, no failures, cancellations or skips. Each run sampled the
one-minute load at start, every second and exit; the combined qualifying range
was 9.275390625–14.81884765625, from 03:49:56.546Z through 03:52:16.566Z. A-4946
contains all ten qualifying logs. A-4944 retains all 28 target passes, including
18 below-threshold warmups, and the primary companion receipts. A-4945 records
the two additional companion lanes.

The Coordinator reserved the local window and authorized four total serial
lanes: the target plus `session-native-lifecycle.test.ts`, `daemon.test.ts` and
`orphan-servers.test.ts`. No busy loop supplied load. A later aggregate load
spike reached 18.01123046875 while companions drained, after the final target
run had ended. The additional companion watchdogs stopped both active files;
their cancellations are explicit in A-4945 and supply no passing proof. All
lanes exited by 03:52:42.755Z.

Mac proof ran at `53c0509f0fb689fc68768ebfd052e73dce240012`; the final pre-review
merge of `origin/dev` brought in `a9947875`. The target file, shared database
opener, Store, ProcessTable and TrackerIndex are unchanged between those heads.
Typechecking passed before that merge. Droplet verification follows source
review at the committed evidence head, with its result retained in the topic.
