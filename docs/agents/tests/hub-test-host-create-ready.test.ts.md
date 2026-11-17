# hub/test/host-create-ready.test.ts

T3 native lifecycle: fake SSH/scp, delivered runtime, supervisor, authenticated
tunnel, territory clone and scripted OpenCode. No real provider API is called.
`projectHub.hostEnvironment` must expose the host owner's current runtime object,
captured at registry creation, rather than the input environment copied before
private credential resolution. Restored membership and direct-create readiness
use that same object; retain the existing restart and settlement assertions.
Use supported Node and the preservation lock specified by the stage brief.
Run `node --test hub/test/host-create-ready.test.ts` with inherited `CLAND_*`
removed. The scratch environment comes from fixtureEnvironment after all overlays.
The setsid shim executes the command without a new session on macOS. OpenCode uses a scripted Unix socket/port route and explicit fake environment at Host.spawn. The npm installer is scripted to use installed test dependencies; this is not
network or package-installation evidence. projectHub hosts the hub in process.
The shared resource phase aborts/releases/joins held direct creates and pending
observations, then closes extra Store/ProcessTable handles. Hub shutdown and the
fixture native census finish before roots are removed.

- `C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts`
  runs prepare/create/list through the scratch CLI, asserts the clone and an
  authenticated Host operation, launches OpenCode on the created host, waits for
  its exact persisted native process row and positive Host liveness, checks inventory facts and explicitly stops it. A fresh hub environment then restores the same host,
  confirms one registration and reconnects through an authenticated Host operation.
- `C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate`
  replaces the fake public key after provider acquisition. The create owner's
  FakeClock starts at the current date and stays frozen through acquisition and
  native SSH startup. A scoped spawn observer records the exact SSH close
  (exit 255, no signal), then blocks that clock by exactly 300 ms before the
  command owner consumes close. The gate therefore reports the failed probe
  independently of native startup wall time. Native transport timers remain real;
  the production gate is five minutes. The observer restores the builtin export
  in a finally block after create joins, including early setup errors. A prearmed
  fixture owner aborts and joins creation before handles close; the test's abort
  signal also cancels the native probe if the test times out while time is frozen.
  The case retains the provision-exit
  reason, failed create, released receipt, positive provider absence, absent
  registration/shared membership and absent supervisor assertions. This does not
  prove a real provider's boot or network timings.

T2 admission/help coverage is in host-create-admission; session/host-secret
refusals in host-secret-admission and web refusals in web-authority.

The settlement table controls return unknown, incomplete inventory, timeout,
leftovers and complete receipts through the public runtime-owner interface after
joining the actual owner removal. Only the positive complete receipt releases
the provider machine. Held final-readiness controls revoke through the public
frame or abort the shutdown signal, then assert a persisted failed checkpoint
and revoked registration. Setup completion is observed separately from the held
boundary; producer failure also completes the setup observer.

`forced fixture body failure joins held creation before storage and root disposal`
returns from a nested scope after an expected body failure while readiness is
held. Only registered resource cleanup may abort/release/join it. Storage and
root guards refuse premature disposal in the red control; an outer emergency
owner drains the producer before removing any retained root. The parent asserts
that registered cleanup completed before fallback and that the root is gone.

The mismatched-key control also checks that gate-only fake membership never
reaches the shared hub environment before registration. Gate and runtime-delivery
commands receive private membership; runtime admission gets it only after the
intended HostRecord is persisted.

T-1743 extends C1/C2's existing native receipt case: it writes Implementer's
agents pool after creation, launches without an explicit host and asserts the
same created Host in the persisted process row. All native stop, liveness,
restart and registration assertions remain. It proves the create-to-pool-launch
seam without a second native fixture or real provider access.

T-1746 adds `T-1746 waiting pool launch creates a leased watchdog host and is
placed`: arm the persisted-process observer before launching; wait through the
real create/readiness path, then assert ready inventory and a durable watchdog
identity. Codex is an in-process fake; its fixture role explicitly uses
`danger-full-access` because sandbox directory validation is outside this case.
The fixture sets min_hosts=0 so manual-create scenarios do not race startup
maintenance before their image preparation. Scaling startup is covered at T2.

T-1778 seeds a directory-backed ready OpenCode login before launch, then checks
the persisted login, in-use binding, mounted link and OPENCODE_DB overlay. The
process-row observer is armed first; the launch reply is asserted before awaiting
that observer so a failed launch surfaces immediately. Cleanup still cancels and
joins the observer if launch refuses. The fake-Codex demand fixture similarly
starts with a ready directory-backed login. No real login or provider is used.
