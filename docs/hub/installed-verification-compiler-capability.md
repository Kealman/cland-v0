## Installed verification compiler capability

TypeScript remains a development dependency of the hub. On an installation that
prunes development dependencies, verification admission for a project with source
duration identities or compiler-based tier/test lint refuses with one line naming
the unavailable TypeScript compiler and the unknown check. Use a source
installation with development dependencies for those checks. Projects without
these manifests do not need the compiler for admission. The shared lazy compiler
loader runs only when a check needs syntax analysis; ordinary hub and CLI startup
do not load it. Existing admission error codes and policies are unchanged.

### Compiler capability refusal formatting

When a source verification check needs TypeScript and an installed runtime has
pruned development dependencies, admission refuses with one line naming the
unavailable compiler and unknown check. This capability refusal has no source
location or provenance suffix. Source lint findings continue to include their
HEAD/worktree provenance and locations; result codes and fields are unchanged.
Use a source installation with development dependencies to run these checks.

### Memory measurement slots

An explicitly Coordinator-granted allocated-swap waiver uses the manual probe's
`--quiet-slot-until ISO` option. It expires with the slot and replaces used-swap
thresholds with load1 ≤6, kern.memorystatus_vm_pressure_level ≤1 and no new swap-out pages, sampled
by parent and worker every five seconds with separate preflights. Missing facts
refuse; owned shutdown/native receipts still apply. Without the option, the
original 80% initial/90% stop swap thresholds apply. This is an authorized manual
measurement occasion, never an automatic budget gate or a standing slot grant.

The native pressure level governs the slot guard; the transient
`vm.memory_pressure` counter and `kern.memorystatus_level` free-memory percentage
are recorded as context only.

### macOS cover repetition reruns (report mode)

Integrated and occasion cland-runner covers on macOS automatically rerun one
recent-green identity once when the executed prefix has exactly one load-gate
repetition failure and no other failure or timeout. Recent means the last five
completed reported covers within seven days, using explicit passing identities
checkpointed by the hub; absent evidence supplies no green. Task runs are excluded.
Both original and rerun receipts name head, platform and repetition. The original
cover stays red, and the finding still needs flaky-rerun filing. Logs name the
executed and unexecuted phases: eligibility covers only the executed prefix.
Changing the cover result needs a separate enforce item that completes the tail.
See `docs/agents/tests.md`, "macOS cover load-gate reruns (report mode)".


