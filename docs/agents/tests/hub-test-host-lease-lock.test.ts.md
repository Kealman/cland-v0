# hub/test/host-lease-lock.test.ts

Filesystem-only lock tests prove the locked grant requires a matching active owner and refuses
no owner or a different root's concurrent lock. No child process or Git is needed.
