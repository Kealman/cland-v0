# hub/test/git-maintenance-startup.test.ts

T2 exercises actual `projectHub` serving and fake-clock delayed maintenance.
Status replies before and during collection; no maintenance command starts
before thirty seconds. Normal cancellation keeps the lock through native close.
Stopping during the delay starts no command.

The exact legacy runner `cleanup incomplete` result is a separate control: it
creates a durable owner, never emits maintenance-completed, and remains owned
after bounded hub stop. Actual next hub starts recover dead, matching live and
reused identities through the injected native-observation boundary. Reused PIDs
are never signalled, and status remains available during recovery. No native
process runs in this file.

Native group reaping, PID reuse, dead `gc.pid` and temporary packs are covered in
`hub/test/git-maintenance.test.ts`; pure bounded policy is in the recovery file.
Legacy five-argument doctor results remain in `hub/test/doctor-run.test.ts`.
Run each file separately under cover-quiet admission.
