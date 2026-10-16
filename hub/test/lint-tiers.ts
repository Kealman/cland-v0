import { fileURLToPath } from 'node:url';
import { hubShards } from '../src/suite-shards.ts';
const shards = await hubShards(fileURLToPath(new URL('../../', import.meta.url)));
for (const shard of shards) console.log(`${shard.name}: ${shard.targets.length} files, ${shard.workers} workers`);
