# T-1676 spoke fallback consumer addendum

This adds the missed direct consumer to A-21560; it does not replace that matrix
or the failed configured receipt b401c4c8-a0f9-4e41-af25-763048b1a613 (A-21579).

| Consumer | Contract and disposition |
| --- | --- |
| `hub/test/spoke-unix-edge.test.ts`, four `C1: URL-safe fallback welcomes a spoke with … in root and TMPDIR` cases | Direct `layout(root).spokeSocket` reader with an exact `/tmp` dirname assertion. `tempProject` enrolled the hub root in fixture aliases. Use an unregistered child of an owned temporary parent to preserve production fallback coverage. Keep socket mode, authenticated welcome, compatible human socket path and all four unsafe characters. Capture both exact endpoints before hub startup and include them in the final named residue census. |
| `docs/agents/tests/hub-test-spoke-unix-edge.test.ts.md` | Documents production placement versus fixture enrollment and exact endpoint cleanup/census. Updated with this correction. |
| `hub/test/tiers.json` | This file remains T2. No tier movement, frozen-byte rewrite or historical proof reuse. |

The fixture gate in `shared/fixture-sockets.ts:fixtureFallbackSocket` returns
undefined unless the exact project root is registered or matches the explicit
fixture environment root. `tempProject` registers its returned root;
`projectHub` does not register arbitrary project roots. `project.ts` retains
`shortSocketPath` when the gate returns undefined. Production placement has no
source change in this correction. The four corrected live socket welcomes and
literal `/tmp` assertions are runtime evidence for that production branch.

## Local red and green

Command: `node --test hub/test/spoke-unix-edge.test.ts`, macOS arm64 local,
Node 24.21.0; no browser or remote executor. These are single-file T2 receipts,
not configured verification or whole-project coverage. No intentional load.

- Red: clean source head `498cd04941fdc487b6022d4b654abc7278f065d9`.
  Exit 1, 12 tests, 8 passed, 4 failed, 0 cancelled/skipped, 1996.685833 ms.
  Each failure was `AssertionError [ERR_ASSERTION]: unsafe root and TMPDIR fall
  back to the fixed short directory`; actual dirname was a fixture alias
  `/private/tmp/ct-<32 hex digits>`, expected `/tmp`. The four characters were
  `space here`, `é`, `:` and `#`. Mode and authenticated welcome precede the
  failing assertion. The configured Linux receipt preserves its own literal
  `/tmp/ct-…` failures separately in A-21579.
- Green: the correction to the test and its guide on the same base head.
  Exit 0, 13 tests, 13 passed, 0 failed/cancelled/skipped, 1736.943042 ms.
  All four production fallback welcomes passed, as did the final named
  `fixture file outputs are removed` census. It checks the captured socket
  paths, owned fixture roots and aliases after test cleanup. Hub stop owns
  endpoint removal; no broad `/tmp` sweep or unconditional replacement deletion
  was added.

The configured failed run remains failed. Required process and Web coverage
still needs a new reviewed-head configured receipt; these local receipts do not
supersede its outcomes or imply those phases ran.

## Containing-parent fence correction after A-21582

Source review at `e42babd3697ec4a546074342483b57ce76fe3e77` found that owning
the containing parent did not consult the child hub's exact-root removal guard.
The four production-path cases now register both normal/signal cleanup and an
exact-parent guard before admitting the original startup. Both join that
startup and positive `dispose()` completion. The bounded observer retains an
unknown in-flight close; an actual rejection remains a failure until the owner
can supply positive closure. No shared removal helper or production code changes.

The added T2 case `containing parent cleanup preserves child storage when hub
disposal rejects` runs under the existing positively controlled fake-native
guard and item ownership scope. It invokes the actual registered cleanup hook,
which attempts resource shutdown and then directory removal. Separate observations
prove parent and child retention, a still-writable file descriptor and absence
of its closure receipt. After the owner permits actual descriptor closure, the
same registered cleanup observes a written/read closure receipt and removes the
parent. Its earlier stop rejection is still reported; removal is not inferred
from a successful hook exit.

Same single-file command, local macOS arm64/Node 24.21.0, no browser, subprocess
test worker or remote executor added by the control:

| Working-tree epoch on e42babd3 | Outcome |
| --- | --- |
| New control without exact-parent guard | Exit 1; 14 tests, 13 pass, 1 fail; 1599.069375 ms. Literal error: `retained parent observation: ENOENT: no such file or directory, lstat` at the owned parent. This positively reproduces deletion through registered cleanup despite rejected disposal. |
| Parent guard added, control incorrectly expected its second cleanup hook invocation to succeed | Exit 1; 14 tests, 13 pass, 1 fail; 1922.2155 ms. Literal error: `registered cleanup after positive closure: planted hub disposal rejection`. Shared cleanup correctly retains its earlier failure; the control must retain that assertion instead of erasing the failure. |
| Control preserves earlier failure and separately asserts positive closure/removal | Exit 0; 14/14 pass, no failures/cancellations/skips; 1532.163709 ms. |
| Final acquisition ordering, startup scheduled only after both owners register | Exit 0; 14/14 pass, no failures/cancellations/skips; 2425.908208 ms. Includes all four production fallback welcomes and the final exact-path census. |

These new local epochs extend the earlier consumer evidence. They do not replace
the failed configured run or establish unexecuted process/Web phases.
