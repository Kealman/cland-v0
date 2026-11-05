# hub/test/host-boot-source.test.ts

T2 uses a disposable root and sealed fixture environment, real boot files and
an in-process agent admission. Fake mode without a boot file must reject before
creating the run directory or starting recovery. Missing and invalid files
reject; successive valid file contents determine successive observations.
On Linux, non-fake mode ignores a stray boot-file variable and reads the kernel.
The native host-agent file separately proves hello and native start ticks use
the fixture boot, with an explicit distinct-kernel control.
