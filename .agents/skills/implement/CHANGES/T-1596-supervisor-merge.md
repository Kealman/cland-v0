T-1596: resolve the authorized post-T-1594 merge with both tier entries retained.
The conflicting HOST_USAGE row in commands.json was produced by JSON.stringify
of the auto-merged HOST_USAGE export, preserving every byte outside that conflict
block. This deterministic projection keeps revoke and supervisor help together;
all other frozen rows and formatting remain unchanged. No generator is shipped.
