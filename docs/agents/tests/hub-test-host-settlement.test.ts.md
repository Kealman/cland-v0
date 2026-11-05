# hub/test/host-settlement.test.ts

`hub/test/host-settlement.test.ts` exercises the reusable pre-cut owner at T1
with an in-memory Host, generation files and fake clock. It checks three harness
stop steps, released receipt/private-file/forget ordering, unreachable-agent
leftovers and an adoption reply crossing the authority cut. Setup observation is
bounded separately from the deadline. No native worker or browser runs here.

A held private-file inventory reaches its deadline with inventoryComplete=false;
its late response drains without upgrading the captured cut receipt.

A held SSH warm-up receipt crosses revocation: readiness cleanup and the caller
request both stay unstarted after the cut, then the acquisition owner drains.


Pure changed-boot controls share hostBootChanged with the reboot caller and
retirement entry: canonical, different Linux boot ids prove closure; missing,
legacy, malformed and same-boot observations do not.


Merged ref-watch/restore/flush held-boundary controls keep each helper's native
request admission checked after awaits. Post-cut request counts stay unchanged;
unknown-authority Claude inventory remains a named worker/resource obligation
and sends no stop or deletion.
