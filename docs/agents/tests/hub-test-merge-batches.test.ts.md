# hub/test/merge-batches.test.ts

T-1232 injects independent candidate-preparation and blocked-report failures.
Start the controller, join its in-flight tick, assert resolution and the failure
log, then reopen to prove both `failed` and `reportError` remain durable without
landing or dropping a member. This T1 seam does not rely on closed-item routing;
the socket serving assertion lives in merge-queue.test.ts.

For Web regressions use the same `diagnostic.steps` seam: a real Web-capable
candidate plan, two members with passing individual Web receipts and a red
combined repeat. Assert the full Web phase survives selection transport (no
browser starts), the original report's named duration and unresolved refusals.
A missing/conflicting green Web receipt holds across reopen. Successful Web
step diagnosis still requires the original pinned full plan after config changes.
Also fail T1 before Web starts: both unique omission and passing file-repeat
recovery must select a tree for full Web-containing confirmation before landing.

Use the T1 `MergeBatches` + `Suites` seam with `FakeClock`, candidate-tree facts
and semantic executor receipts. No Git, compiler, worker or provider process runs.
For T0 regressions, use two members whose individual trees receive passing check
receipts and whose combined tree receives a named failing `tier T0` receipt.
Observe collected receipts before ticking the controller; assert leave-one-out
step plans, the original-tree repeat, final refusals and the named step duration.
An exit-zero test receipt alone cannot prove that T0 ran. Keep interrupted and
missing/conflicting-step receipts inconclusive through controller restart. Cover
both a unique static omission and a passing static repeat: neither lands until
the exact selected candidate passes the original full plan. Change config and
reopen before confirmation admission, then prove both green and later red tiers.
The real repository command plan is covered
in `verification-commands.test.ts`; shared procedures live in
[Queued merge batches](../tests.md#queued-merge-batches).

The T1 landing regression composes MergeBatches, Suites, the real Tracker, MergeQueue and TaskMerges with immutable Git facts and executor receipts. After a planted green completion, the squash boundary advances only dev between reading its parent and invoking the preparation callback. Every unchanged task must land FIFO using that same receipt, with no member drop. The stable control keeps every ref fixed; a real task-head move must drop only that member, naming prepared and current heads, while the remaining members land after their rebuilt batch completes.

The fixture uses a FakeClock and the scripted executor; no native Git, harness or hub process runs. The boundary routes base-movement errors like the hub dispatcher so the regression reaches the landing guard that caused T-1184.

T-1213 uses that landing seam to dirty then clean a file in the disposable root.
The Git boundary returns a typed `merge-dirty` while the file is dirty; real
TaskMerges/Tracker receipts prove every member lands FIFO after cleaning, with
the original green suite. Controller/Suites cases cover all five recoverable
landing codes across reopen after one completed member, and an untyped failure
whose message resembles a code still holds for human or Coordinator action.
Assert the named cause and automatic-retry or action-required notice.

T-542 M3: the T1 FIFO landing fixture supplies immutable landed-commit paths for the new dependency report through its existing Git-fact seam (`diff-tree`). Keep the three-head FIFO, landing receipt and closed-item assertions. Missing Git facts now appear in the assertion diagnostics. No timing change, native Git or process boundary is needed.
