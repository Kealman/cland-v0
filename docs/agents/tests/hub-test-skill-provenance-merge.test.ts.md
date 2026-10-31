# hub/test/skill-provenance-merge.test.ts

C1 for T-1455 provisions the shipped skills into a disposable project, then creates two native Git branches. Each branch adds a separate implement CHANGES entry, extends a different command help module and adds a test guide. Both ordinary merge and merge-tree/one-parent squash preserve every entry. The derived index includes both new guides after merging. Git uses fixtureEnvironment, scratch HOME/XDG/Git settings, gc.auto=0, bounded awaited children and no inherited credentials. No hub or browser starts.
