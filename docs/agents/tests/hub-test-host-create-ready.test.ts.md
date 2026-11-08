# hub/test/host-create-ready.test.ts

T3 native lifecycle: fake SSH/scp, delivered runtime, supervisor, authenticated
tunnel, territory clone and scripted OpenCode. No real provider API is called.
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
  replaces the fake public key after provider acquisition. Its injected 300 ms
  gate retains real native timers; the production bound is five minutes. It
  asserts failed create, positive provider absence, no registration and no
  supervisor. This does not prove a real provider's boot or network timings.

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
