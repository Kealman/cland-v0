// The version cland reports: the root package's. `CLAND_VERSION_OVERRIDE` replaces it, for tests that simulate
// a version bump (`cland update` rewriting the managed files' marks); nothing else sets it.
import { readFileSync } from 'node:fs';

const PACKAGE_VERSION = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

export const VERSION = process.env.CLAND_VERSION_OVERRIDE || PACKAGE_VERSION;
