# T-1607 release-loss repetition receipts

Requested by Coordinator message 541b82bf-5354-4682-8b0f-70779b0e900a.
Head: 88297e2b350534efb35ad41a8c0470853a891db8. Local executor,
macOS arm64, Node 24.21.0. No browser, real Claude or real SSH.
Each invocation selects only `lost native release reply settles without replaying native stop`.
Load and free disk are checked before each invocation; tests own disposable roots
and independently join their native writers. These are targeted receipts,
not a queued verification run or a full suite.

## Result and limits

20/20 targeted invocations passed at the named head; each recorded one executed
case, zero failures, cancellations and skips, and exit 0. Disk stayed at 121 GiB
available. Load receipts below are the OS load averages, not a machine-exclusive
slot or CPU-utilization measurement. No suite, Linux, browser or QA claim follows.

The earlier full-file failure was:
`could not stop "worker": its process identity cannot be verified; it is still watched`
where the assertion expected `/release cleanup incomplete/`. It occurred before
the intended lost-release boundary; the requested repetitions did not reproduce it.

Best hypothesis (unproven): a short-lived hook/mod child changed the captured
tree between prepare-stop and commit/capture or the initial stop snapshot. The
strict target-set/birth checks then conservatively refused Host stop before the
release RPC. These checks remain intact; no retry, identity bypass or relaxed
assertion was added to make the repetition pass. A targeted rerun and a full
13/13 remote-file rerun also passed before these twenty runs. The original
failure remains recorded, rather than being relabelled as a pass.

## Runs

### Run 1

Load: { 2.17 2.47 2.49 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2127.288875ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2494.22075
```

### Run 2

Load: { 2.24 2.48 2.49 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2100.189583ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2423.867917
```

### Run 3

Load: { 2.24 2.48 2.49 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2144.931417ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2474.312792
```

### Run 4

Load: { 2.38 2.51 2.50 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2217.869625ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2544.7685
```

### Run 5

Load: { 2.38 2.51 2.50 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2090.852917ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2436.035333
```

### Run 6

Load: { 2.52 2.53 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2054.057625ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2383.081791
```

### Run 7

Load: { 2.52 2.53 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2166.45425ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2492.13725
```

### Run 8

Load: { 2.72 2.57 2.52 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2297.95175ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2630.593584
```

### Run 9

Load: { 2.72 2.57 2.52 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2095.185167ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2432.525
```

### Run 10

Load: { 2.74 2.58 2.52 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2125.430208ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2473.351875
```

### Run 11

Load: { 2.51 2.53 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2139.036875ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2463.36675
```

### Run 12

Load: { 2.51 2.53 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2143.6705ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2493.032417
```

### Run 13

Load: { 2.55 2.54 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2127.954ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2477.853167
```

### Run 14

Load: { 2.55 2.54 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2136.872042ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2467.097084
```

### Run 15

Load: { 2.58 2.55 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2130.093708ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2456.93375
```

### Run 16

Load: { 2.51 2.53 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2193.812042ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2517.041541
```

### Run 17

Load: { 2.51 2.53 2.51 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2117.023083ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2457.358542
```

### Run 18

Load: { 2.47 2.52 2.50 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2118.357584ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2446.697584
```

### Run 19

Load: { 2.47 2.52 2.50 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2202.084ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2532.671084
```

### Run 20

Load: { 2.67 2.56 2.52 }; exit 0.

```text
✔ lost native release reply settles without replaying native stop (2246.926042ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2577.961709
```

<!-- receipts -->
