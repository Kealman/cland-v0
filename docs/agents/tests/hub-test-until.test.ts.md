# hub/test/until.test.ts

T1 pure deadline arithmetic. The case checks local factor 1, droplet default 2,
explicit scale, invalid-scale clamping and finite-positive deadline refusal.
It restores the two noncredential environment controls in finally, performs no
wait and starts no native process. `until` and outer phase envelopes import the
same `waitTimeoutMs` calculation; existing wait behavior remains unchanged.
