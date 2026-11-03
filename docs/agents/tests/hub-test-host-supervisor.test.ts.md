# hub/test/host-supervisor.test.ts

T3, fake hosts only. `node --test hub/test/host-supervisor.test.ts` uses a disposable
root and the shared environment builder. Node detached spawn supplies setsid on
macOS, where no setsid binary is installed; the initiating shell runs nohup and
exits. Linux deployment uses setsid nohup explicitly. No real SSH or provider.

The C1–C4 case observes the singleton receipt, authenticated hello, a native
harness launch, HUP survival, a stale-identity refusal, SIGKILL and a replacement
hello within three seconds, then checks the original harness identity in the
recovered process table. Setup has separate deadlines. Captured fixture process
ownership drains the supervisor tree and harness before directory removal.

The starter is captured before a launch gate releases its child. It stays alive
until the supervisor receipt is captured, so missing receipt setup retains live
ancestry for cleanup. The setup-failure control observes an independent real PID
while withholding the expected receipt and proves native absence before root
removal. A two-host control copies the other live agent's valid receipt and proves
owner refusal while both original agent identities and harnesses remain usable.
