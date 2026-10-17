// Coordinators and T3/T4 workers never import the instrumentation or node:test.
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { relative } from 'node:path';

const manifest = process.env.CLAND_TEST_TIER_ASSIGNMENTS;
if (manifest && process.env.NODE_TEST_CONTEXT === 'child-v8' && process.argv[1]) {
  const file = relative(process.env.TEST_SUITE_CWD ?? process.cwd(), realpathSync(process.argv[1])).replaceAll('\\', '/');
  const config = JSON.parse(readFileSync(manifest, 'utf8'));
  const tier = config.tests[file];
  if (tier === 'T1' || tier === 'T2') {
    const { installTierTripwire } = await import('./tier-tripwire.ts');
    // A side receipt survives reporters that intentionally suppress test stdout,
    // notably load-gate repetitions. The parent emits it before phase cleanup.
    installTierTripwire(file, tier, process.env.CLAND_TEST_TIER_MODE ?? 'report-only', line => appendFileSync(process.env.CLAND_TEST_TIER_REPORT ?? config.report, line + '\n'));
  }
}
