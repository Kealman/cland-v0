# hub/test/login-capacity-list.test.ts

T2 projectHub and local CLI. `capacity counts regional exclusive disks and unlimited shared and key logins` proves regional counts, the pool cap, in-use shared/key reuse, and settled/pending exclusive exclusion. Run with supported Node 24 and inherited CLAND variables stripped. Uses scratch fixtures and a FakeClock; no native host or browser. JSON login array compatibility remains in login-list.test.ts.
