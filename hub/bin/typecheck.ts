// Resolve the pinned alias through ancestor installs as well as worktree-local ones.
// Import its launcher so compiler arguments and exit status pass through unchanged.
await import(new URL('./bin/tsc', import.meta.resolve('typescript7/package.json')).href);
