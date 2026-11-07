# hub/test/init-config.test.ts

T1 configuration tests exercise init/update's shared `provisionConfig` owner,
independently specified TOML defaults, old-config migration, retained unrelated
values, idempotence, all nine remote/speech writable keys and invalid-write byte
preservation. Configs with no new sections remain valid. These cases need no hub,
platform, browser or native process; each writer owns a scratch directory.

The [T2 config-set guide](hub-test-config-set.test.ts.md) covers actual CLI/frame
requests, factory settings, active messenger receipts and held reload ownership.

## Config writer preservation (T-1733)

`managed provisioning preserves hosts and unknown keys across every section` compares all original parsed fields and checks repeated provisioning is byte-stable. `auth mode writer preserves the complete config document` covers the auth writer. The shared provisionConfig seam covers init re-runs, update and setup/onboarding provisioning.

Run `node --test hub/test/init-config.test.ts` on supported Node with inherited
`CLAND_*` variables stripped. These T1/T2 cases need no native host or browser.


T-1738: managed init and update add daily_spend_usd 3 and lease 12h without a pool, retaining existing qa provider and harness pin on update. Preservation fixtures carry explicit slots for custom sizes.
