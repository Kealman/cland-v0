// The harness versions each adapter was built and tested against (spec 4.9, `cland doctor`): the one place to
// widen when an adapter is re-verified against a newer release. A version outside its range is a warning, not a
// failure: the harness may well work, cland has just not been run against it.

export type Version = readonly [number, number, number];

/** A half-open range: `min` inclusive (the release the adapter was built against), `below` exclusive. */
export type TestedRange = { min: Version; below: Version };

export type HarnessId = 'claude-code' | 'codex' | 'opencode';

export const TESTED_RANGES: Readonly<Record<HarnessId, TestedRange>> = {
  // hub/src/adapters/claude-code.ts: `claude --bg`, `claude agents --json`, the mod's `$` as of 2.1.294
  'claude-code': { min: [2, 1, 294], below: [2, 2, 0] },
  // hub/src/adapters/codex.ts: `codex app-server` and `codex resume --remote` as of 0.160.0 (0.x: a minor may break)
  codex: { min: [0, 160, 0], below: [0, 161, 0] },
  // hub/src/adapters/opencode.ts: `opencode serve`'s 2.x routes and events as of 2.0.24
  opencode: { min: [2, 0, 24], below: [2, 1, 0] },
};

/** The first `x.y.z` in a `--version` output (`2.1.294 (Claude Code)`, `codex-cli 0.160.0`, `opencode v2.0.24`), or null. */
export function parseVersion(text: string): Version | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
  return 0;
}

export const inRange = (v: Version, r: TestedRange): boolean => compareVersions(v, r.min) >= 0 && compareVersions(v, r.below) < 0;

export const formatVersion = (v: Version): string => v.join('.');

export const formatRange = (r: TestedRange): string => `>=${formatVersion(r.min)} <${formatVersion(r.below)}`;
