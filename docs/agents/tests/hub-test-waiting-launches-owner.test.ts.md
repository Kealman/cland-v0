# hub/test/waiting-launches-owner.test.ts

T1 at the exported WaitingLaunches owner, approved in the item topic. No hub,
socket, process, native timer, file or test-only production hook. Run with
supported Node and inherited CLAND_* removed.

A's placed callback queues a microtask that adds B after the pass's final loop
check and before its chained finally. The test waits for B's actual placed
callback within a named budget of 32 JavaScript microtask turns, keeping both
literal attempted/completed arrays and the final empty-owner assertion. This
is a bounded work check, not a latency claim or a timer-count assertion. The
owner is closed/joined in after cleanup. Before the fix only A was attempted;
a finalizer re-arm gives B its own pass.

The frame-level launch/list/stop cases remain in waiting-launch.test.ts at T2.
After-stage QA reports findings to lead T-1744 in its item topic.
