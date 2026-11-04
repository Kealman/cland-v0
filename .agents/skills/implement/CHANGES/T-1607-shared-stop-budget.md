# T-1607 one budget across stop layers

After pinned-exit settlement, an uninstrumented Linux arm64 full native run had
one failed restart-result control: durable settlement did not complete within
2500ms. A bounded diagnostic preserved that failure, observed native stop false
in26–47ms and the cleanup-incomplete cause, and found no later success after
4500ms. This was not repaired by increasing the observer bound.

The helper refused a startup descendant first seen after the outer capture as
already-spent churn, even when that outer comparison had not used its budget.
Coordinator e27c19c6 approves one agent-internal budget per stop admission shared
across the two layers. The agent creates it from its native capture census;
only the context closure passes to stopClaude, never a wire/frame/persisted flag.
Each subsequent admission builds a fresh context. The existing acquisition and
checkpoint gates still apply. A second new-tree change or persistent unknown
stays incomplete. Positive pinned retirement never spends this budget.

Deterministic unused/spent/second-descendant controls were red when the helper
ignored the context, then green; a production factory control proves independent
single-use instances. The canonical process-target key is one shared export,
preserving the previous byte-for-byte key meaning for other native owners.

Consumer inventory: the new factory is called only inside AgentProcesses.stop;
the context is consumed only by its outer comparison and stopClaude admission.
T1 facts supply explicit contexts and test the factory. All stopClaude callers,
targetKey uses and captureForStop/stop consumers were searched: ordinary owners
retain the previous path, direct helper calls without a context remain strict,
and server/prepared/wire/persisted record shapes are unchanged. The existing
prepare census is data only; no spent/unspent state survives a failed call.

The exact failed-Claude-launch-restart-result case then passed5/5 in an isolated
network-disabled Linux arm64 container without diagnostic instrumentation. This
is supplemental local-container proof, not droplet x64 verification. A fresh
source review remains required before the next mode-free verify.
