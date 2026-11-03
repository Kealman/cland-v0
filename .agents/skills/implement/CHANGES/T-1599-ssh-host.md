# T-1599: SSH Host

The SSH Host uses the agent's base environment plus explicit command additions.
Apply `hostCommandEnvironment` at adapter command boundaries; remote additions
are filtered again by `remoteCommandEnvironment` on the agent. Local effective
environments retain their previous merge/filter order.

Coordinator decisions 04ee649d, 12a3c390 and 87a51dc5 authorize additive prepared
operations for Host callbacks and one optional expected-value parameter in the
shared Host contract. No behavioral rows may be skipped; local expectations stay
unchanged. Prepared state needs expiry/restart cleanup, capability refusal and
native completion receipts. E-1533 supplies the versioned remote code directory.

Coordinator decision 11a86342 splits OpenCode evidence: its builder and existing
pre-spawn refusal are covered here; T-1644 owns the later complete fake-host
spawn with the planted hub-only key. Claude and Codex exercise the SSH agent.
Decision 6e7c91b2 accepts shared digest fallback and reciprocal socket aliases;
assert actual connected-path bytes and remove only owned fallbacks after census.
Native error replies add optional `code` so LaunchFiles can handle ENOENT/EEXIST
without inspecting prose. Older errors remain accepted.

A-16248 source-review repairs: reconcile admitted UUID/recovery-key outcomes;
persist accepted native ownership before release; keep missing outcomes fenced;
autonomously recover pending native completion receipts; preserve descendant
ownership after root exit; capture checkout directory/.git/metadata/tip proofs;
attempt every lifecycle cleanup independently and retain failed obligations.
Coordinator a5d3ae17 permits exactly shared/executor-credentials.ts as an external
Node-only leaf imported only by the agent environment owner. Usage now lives
inside host/agent and is imported by local. The boundary guard retains omission
and forbidden-transitive-import controls. The SSH Host now supplies the shared
contract's descriptor-close fault fixture too; no behavioral row is omitted.

Coordinator baaf0066 authorized the pre-existing T-1588-area stop race here:
positive native end between ps and birth observation is closure, while unknown
birth remains a mismatch. Deterministic pre-fix false!==true/ended:true receipt
and post-fix controls are retained; host-agent.test.ts remains unedited.

A-16257: register prepared ownership before effects, centralize failure fencing
and retain unresolved close obligations; persist and reconcile native command
cleanup results on stream loss; fence and join late client acquisition. The
new held-writer, second-connection refusal and held-acquisition tests preserve
positive receipts and explicit incomplete outcomes.

Native Git inspection failures propagate the same structured incomplete outcome
as Git mutations, through the shared native-command failure owner. Such a failure
keeps the preparation phase and storage fenced instead of claiming cleanup.
