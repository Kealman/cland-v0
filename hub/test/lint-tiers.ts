import { fileURLToPath } from 'node:url';
import { hubShards } from '../src/suite-shards.ts';
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('usage: npm run test:tiers [-- --help]\nLint test manifests and print shard counts. Duration allowance owners must be standing containers: categories or epics directly under a category (for example E-880). Refusals name the allowance key and owner source line when available.');
} else {
  const shards = await hubShards(fileURLToPath(new URL('../../', import.meta.url)));
  for (const shard of shards) console.log(`${shard.name}: ${shard.targets.length} files, ${shard.workers} workers`);
}
