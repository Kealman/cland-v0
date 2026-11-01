# hub/test/host-limit-poller.test.ts

T1 AccountPoller lifecycle with scratch Store, fake clock, injected Host flag
and reader. Refresh while forbidden must produce no read; allowing admits one;
a subsequent forbidden refresh after the minimum checks the flag anew.
Close poller and core before Store and root removal. No harness is started.
Keep account-poller.test.ts and account-poller-clock.test.ts unedited.
