// The version cland reports: the hub package's.
import { readFileSync } from 'node:fs';

export const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
