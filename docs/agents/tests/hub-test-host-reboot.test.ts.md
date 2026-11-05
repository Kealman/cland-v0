# hub/test/host-reboot.test.ts

T2 recording Hosts prove changed-boot retirement for Claude, Codex and OpenCode,
including cleanup-incomplete pending owners. Same-boot/unavailable resumes retain
rows; another host stays running. Confirmed generation obligations precede exit,
pending resource undo survives retries, and repeated readiness emits no second
exit. Recording Hosts must receive no operation. A held resume returns a stale
found result after readiness: the durable reboot fence prevents resurrection.
Native supervisor/agent/tunnel evidence lives in host-reboot-native.test.ts.

Normal stopped generations, including archived rows, also become exited on a
proven boot change. The stopped-row iterator streams one host's candidates,
shares the existing recovery flight, checkpoints each retirement and yields
after 32 candidates; the 100-row regression keeps same-boot and other-host
stopped controls and asserts the per-slice work bound.
