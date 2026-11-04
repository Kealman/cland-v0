# T-1607 settle pinned native retirement

Coordinator1393d158 approves the product fix after A-16506 reproduced ordinary
turn-end hook retirement being treated as descendant churn on Linux. A pinned
birth positively exited/replaced is settled, never authority for its replacement.
One bounded re-read resolves a transient unknown; persistent unknown remains
incomplete. New unpinned descendants retain the single recapture bound and the
same UID, ancestry, birth and restart acquisition fences.

The exported Claude-only observation/pruning helpers are shared by adopted
ledger capture, prepare/commit comparisons and SessionEnd joining. Other agent
owners retain their existing reads and signal behavior. Adopted signals accept
positive ESRCH/old-birth replacement without signalling a replacement; unknown
signal outcomes are never replayed. No wire or persisted-record shape changes.

Consumer search covers claudeDescendantCapture/stopClaude/captureForStop,
AgentProcesses adopted capture/commit/signals, native observation callers,
T1 controls and native T3 fixtures; only the adopted path uses the new helpers.
Agent bootstrap, ordinary spawn/signal/stop, local Host and other adapters remain
unchanged. Existing tests across the source inventory/agent boundary and shared
Host/native owners must stay green.

Four new T1 controls were red on the old retained target array and missing
unknown re-read, then green; previous authority/second-churn controls stay.
The original native positive churn case passed5/5 in Linux arm64 with product
changes only, before fixture stabilization. Setup now positively joins initial
transient hook writers with its own bound. A native pinned-hook exit between
prepare/commit requires one successful stop. The async SessionEnd case explicitly
observes root absence before its acquisition census; held-root red A-16506 proves
why async alone was insufficient. Five groups of the final three Linux cases
are recorded separately; these local container receipts are not droplet x64 or
queued verification passes. No duration allowance is introduced.
