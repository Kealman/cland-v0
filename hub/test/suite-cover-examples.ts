// Canned multi-package reporter output and its independently specified identities.
export const shardOutput = ['--- close shards ---', '--- shard-1 ---', 'test at /home/runner/cland/hub/test/example.test.ts:12:1',
    '✖ fails in first shard (100ms) [shard-1]', '✖ load gate: hub/test/example.test.ts::load gate failure 2/5 passed [shard-1]',
    '--- shard-2 ---', 'test at /home/runner/cland/nvim/test/example.test.ts:8:1', '✖ fails in second shard (200ms) [shard-2]'];
export const shardCover = { status: 'red', cause: 'test-failure', tests: ['hub/test/example.test.ts::fails in first shard', 'hub/test/example.test.ts::load gate failure', 'nvim/test/example.test.ts::fails in second shard'] };
