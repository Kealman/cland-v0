# T-2055 merge admission consumer audit

Searches cover MergeCode, merge refusals, candidate, gateVerdicts, merge.queue,
raw merge frames/calls and ready status across hub/src, shared/wire, hub/test,
nvim/test, web, skills, docs and QA briefs/cases. No live database was read.
No tests changed tier. Existing result fields remain optional and unchanged;
old hubs continue to return the existing result/error shape.

| Consumer | Disposition |
| --- | --- |
| TaskMerges message, preflight, final enqueue and immediate squash callback | Shared Tracker validation prepared per view and rechecked synchronously at mutation; human override/recovery retained. |
| MergeQueue.candidate | Same readiness policy and final receipt validation. |
| Tracker automatic readiness | Shared receipt predicate, existing empty-patch cache retained. |
| Suites.latest/verifyResult, restored job reader, dispatch | Existing latest-admitted receipt producer unchanged; batch receipts remain separate. |
| hub/src/protocol.ts and shared/wire/index.ts | Add refusal codes; preserve old result/error fields. CLI, spoke, Web and Neovim render generic errors, with no exhaustive code switches. |
| merge-queue.test.ts (T2) | Explicit passed receipts retained; claim scenarios now explicitly restore ready status; added missing/pending/red/cache/disposition controls. |
| merge-queue-unit.test.ts (T1) | Direct candidate fixtures now explicitly ready. |
| merge-gate, merge-policy, merge-checkout, merge-recovery-native, host-allow-list tests (T3) | merge-support/preparedProject no-command fixtures retain verification disposition; verdict gates remain first. Recovery retains receipt path. Configured importer execution deferred to authorized verification. |
| suite-stage-cover.test.ts (T3) | Already supplies explicit same-head receipt from T-2050. |
| merge-batches tests (T1), suite protocol/selection/task-selection/tier-report/soak tests | Fake batch callbacks or planner inputs, no new task admission; unchanged. |
| aide-claims, tracker status/native-boundary/ready-native, release, project-probes, accounts, roles, lazy tools tests | Forbidden calls, verdict refusals, recovery or no-command flow; unchanged. |
| CLI usage frozen commands.json, cli-help and cli-usage-compatibility | Exact help bytes migrated; old result reply tests retained. |
| qa/briefs E-1281, E-1531-stage-2, E-1533-stage-3, E-1535-stage-4, E-1537-stage-2, E-1883, E-414 through E-420, E-617, E-678 | Historical run instructions or normal reviewed/verified enqueue; no direct production admission fake. Existing historical evidence retained. qa/cases has no merge admission caller. |
| merge skill refusal list, hub index, running and tracker docs | Document ready status, receipt, exceptions, restart and separate batch evidence. No role-clause lines per assignment. |

Red-before on macOS Node 24.21.0, local fake-only T2: absent, launching,
running, failed and cancelled cases each failed `true !== false` (merge
accepted); passed control green. No browser, droplet, credential or network
provider call. Existing queue frame/CLI cases preserve previous wire shape.

Local validation on the implementation working tree (macOS, Node 24.21.0,
local executor, no browser): reachable T1 files plus three conservatively
selected parser-unknown files passed; merge-queue 64/64 and cli-help 9/9
passed. Frozen CLI usage compatibility passed within T1. T1 queue 10/10
includes actual empty-diff enqueue and resolved-head/readiness-head mismatch.
The parser limitation is tracked separately as T-2058.

Authorized native slot: merge-gate 7/7, merge-policy 26/26, merge-checkout 9/9,
merge-recovery-native 12/12, host-allow-list 12/12 and suite-stage-cover 1/1
passed sequentially below load 12; counts include nested cases. These are
targeted importer receipts, not a complete T3 pass. Full configured task
verification and integrated batch evidence remain separate required receipts.

## Source-review M1 migration

The initial review at bccfb5366 found missing encompassing ownership on the new
callbacks (A-22595). All admission/refusal, receipt transition, queue state and
disposition assertions are retained. `admissionCase` now installs the shared
stage owner before every new T2 acquisition; `candidateCase` does so for both
new T1 callbacks. Named setup and behaviour observations stay in the original
owned sequence. Partial hub startup is a required resource-close group before
database fallback closure. Fenced directory/UI cleanup runs afterwards; it is
not inside its own required-close group. Queue/Store/Tracker acquisition and
positive close are explicitly owned on the T1 path.

The first migration attempt failed teardown with `stage resource close
unconfirmed; root retained` (13 new T2 callbacks): directory cleanup was itself
in the required-close group. The corrected resource/directory ordering then
passed the full T2 file 64/64 locally. Existing shared-owner controls passed
5/5 by exact names in tracker-summary: file setup cancellation, file callback
cancellation, rejected file resource close, and rejecting tracker construction
with confirmed and rejected-then-confirmed database closure. Those controls
exercise real guarded removal and independent root/native-restoration receipts.
They prove shared ownership machinery; no new production behaviour or complete
configured suite evidence is claimed by this migration.

## Source-review M1 Store fallback residual

Source2 at e695a3bb8 (A-22597) found that an always-async Store stopper suppressed
the captured connection fallback before Store assignment. The stopper now
returns undefined until acquisition; an acquired Store supplies a close Promise.
Exact `Store constructor failure preserves primary with confirmed native closure`
and `Store constructor failure preserves primary with rejected then repaired native closure`
controls exercise the same candidate fixture. Both failed before the fix:
`controlled candidate cleanup rejected`, and the native-close error-identity
predicate received false because fallback was skipped. Both pass after correction.
The full T1 unit file passes 12/12 on local macOS Node 24.21.0, no browser or
provider. Captured handle isOpen, actual guarded root and native-boundary
restoration are separate receipts. A genuine rejected native close retains all
three until explicit owner repair; the original constructor error and earlier
registered cleanup rejection remain recorded after repair. Production and T2
ownership paths are unchanged from source2; configured verification remains
pending at the next reviewed head.

## Source-review M1 independent directory guard receipt

Source3 at eeac3f721 (A-22599) established that the rejected owner close exited
before ancillary directory cleanup; the prior root stat proved ordering only.
That earlier assertion supplied no independent guard-attempt coverage. The
control now captures tempProject's actual registered cleanup hook through a
context used exclusively for root setup, forwards the same hook to normal
teardown, and invokes it independently while native close is still rejected.
The call follows ownDirectory/guardRemoval and refuses with `stage resource
close unconfirmed; root retained`. The control separately checks one registered
hook before native open, one completed independent attempt, unchanged native
close count/open handle, retained actual root and unchanged installed boundary.
Explicit owner repair still establishes closed connection, removed root and
restored boundary, preserving primary and earlier cleanup rejection.
The new registration control was red before capture (`0 !== 1`), then the full
T1 unit file passed 12/12 on macOS Node 24.21.0 locally. No production, T2,
shared-helper, tier or runtime-policy change is part of this correction.
