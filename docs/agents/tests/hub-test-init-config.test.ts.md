# hub/test/init-config.test.ts

T1 configuration tests exercise init/update's shared `provisionConfig` owner,
independently specified TOML defaults, old-config migration, retained unrelated
values, idempotence, all nine remote/speech writable keys and invalid-write byte
preservation. Configs with no new sections remain valid. These cases need no hub,
platform, browser or native process; each writer owns a scratch directory.

The [T2 config-set guide](hub-test-config-set.test.ts.md) covers actual CLI/frame
requests, factory settings, active messenger receipts and held reload ownership.
