# hub/test/host-boot.test.ts

Pure T1 boot evidence controls compare the recorded remote Linux birth with
an agent hello boot id. A changed canonical UUID proves reboot; the same boot,
a missing hello, legacy birth, and malformed identities do not. This file
makes no claim about native reboot, session retirement, or tunnel recovery.
