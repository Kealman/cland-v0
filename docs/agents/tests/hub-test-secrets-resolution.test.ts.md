# hub/test/secrets-resolution.test.ts

T1 at the shared resolver/file API: all four synthetic environment values override
stored values, absent and partial environments fall back per key, and overrides
work without a file. Boolean comparisons keep values out of failure diagnostics.
The file-edit case temporarily supplies the four names to the isolated test
worker, restores them on cleanup, and proves set/unset/read remain file-only.
No hub, platform, process or real-time wait is needed at this seam.
