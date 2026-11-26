import type { SuiteSelection } from './suite-selection.ts';
import type { VerifyOccasion } from './protocol.ts';

export type VerificationTier = 'T1' | 'T2' | 'T3' | 'T4' | 'Web';
export const verificationTierKeys = [['test_unit', 'T1'], ['test_component', 'T2'], ['test_integration', 'T3'], ['test_soak', 'T4']] as const;
export function hasVerificationTests(config: { test: string } & Record<typeof verificationTierKeys[number][0], string>): boolean {
  return !!config.test || verificationTierKeys.some(([key]) => !!config[key]);
}
export type VerificationStep = { name: 'check' | 'test' | VerificationTier; command: string };
export type TierCommands = { prepare: string; check: string; test: string; tiers?: Partial<Record<VerificationTier, string>>; plan?: VerificationStep[] };

export const verificationStepLabel = (name: VerificationStep['name']): string => name === 'check' ? 'T0' : name;
export const verificationInterrupted = (code: number): boolean => [124, 130, 137, 143].includes(code);

/** Completed command receipts, shared by batch diagnosis and its result report. */
export function verificationStepResults(log: string, owner?: { id?: string; tree?: string | null }) {
  const results = [...log.matchAll(/^(?:verification step binding (.*)\n)?tier (T[0-4]|Web): exit (\d+); duration (\d+(?:\.\d+)?) s; output tail:.*$/gm)]
    .map(([, binding, name, code, seconds]) => {
      let identity: { run: string; tree: string; command: string } | undefined;
      try {
        const value = JSON.parse(binding ?? 'null');
        if (value && typeof value.run === 'string' && typeof value.tree === 'string' && typeof value.command === 'string' && value.command) identity = value;
      } catch { /* Older or malformed bindings grant no supersession. */ }
      return { name: name === 'T0' ? 'check' as const : name as VerificationTier, code: Number(code), seconds: Number(seconds), identity, superseded: false };
    });
  const passed = new Set<string>();
  for (let index = results.length - 1; index >= 0; index--) {
    const result = results[index]!;
    const binding = result.identity;
    if (!binding || binding.run !== owner?.id || binding.tree !== owner?.tree) continue;
    const key = JSON.stringify([result.name, binding.run, binding.tree, binding.command]);
    if (verificationInterrupted(result.code)) result.superseded = passed.has(key);
    if (result.code === 0) passed.add(key);
  }
  return results;
}

/** Pin the executable tier plan beside the commands resolved at admission. */
export function pinVerificationPlan(commands: TierCommands, run: { branch: string; mode: string; occasion?: VerifyOccasion; selection?: SuiteSelection; queueEnabled?: boolean }): TierCommands {
  if (!commands.tiers) return commands;
  const tiers: VerificationTier[] = run.selection?.tiers ?? (run.occasion === 'batch' ? ['T1', 'T3']
    : run.occasion === 'dev-t3' ? ['T3']
    : run.occasion || run.selection?.soak ? ['T1', 'T2', 'T3', 'T4']
    : run.branch.startsWith('t/') && run.mode !== 'all' && run.queueEnabled !== false ? ['T1', 'T2'] : ['T1', 'T2', 'T3']);
  const plan: VerificationStep[] = commands.check ? [{ name: 'check', command: commands.check }] : [];
  const web = commands.tiers.Web && run.selection?.web !== 'none' && (!run.selection?.shard || run.selection.shard.nvim)
    && (run.occasion !== 'batch' || run.selection?.web === 'all');
  for (const tier of tiers) {
    if (commands.tiers[tier]) plan.push({ name: tier, command: commands.tiers[tier]! });
    if (web && run.occasion === 'batch' && tier === 'T1') plan.push({ name: 'Web', command: commands.tiers.Web! });
  }
  if (web && (run.occasion !== 'batch' || !tiers.includes('T1'))) plan.push({ name: 'Web', command: commands.tiers.Web! });
  return { ...commands, plan };
}

/** Legacy admission records retain their whole-test behavior. */
export function verificationSteps(commands: TierCommands): VerificationStep[] {
  if (commands.plan) return commands.plan;
  if (commands.tiers) throw new Error('tier commands have no recorded plan; submit verification again');
  return [{ name: 'check', command: commands.check }, { name: 'test', command: commands.test }].filter(step => step.command) as VerificationStep[];
}

const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
// hrtime has a system-wide monotonic origin on both supported executor platforms.
// Separate Node invocations may therefore sample it across a streaming shell command.
const monotonicMilliseconds = 'Number(process.hrtime.bigint()/1000000n)';
const elapsedClockProgram = `process.stdout.write(String(${monotonicMilliseconds}))`;
// Number.toFixed has locale-independent dot-decimal syntax, including when the
// command inherits LC_ALL/LC_NUMERIC or POSIXLY_CORRECT. Keep its locale intact.
const elapsedSecondsProgram = `process.stdout.write(((${monotonicMilliseconds}-Number(process.argv[1]))/1000).toFixed(3))`;

/** Portable streaming shell wrapper: retain the command exit through tee and one bounded tail. */
export function verificationStepCommand(step: VerificationStep): string {
  if (step.name === 'test') return step.command;
  return `/bin/sh -c ${quote(`tier_log=$(mktemp) || exit 1
trap 'rm -f "$tier_log" "$tier_log.status"' EXIT
tier_start=$(node -e ${quote(elapsedClockProgram)}) || exit 1
( /bin/sh -c ${quote(step.command)}; echo $? > "$tier_log.status" ) 2>&1 | tee "$tier_log"
tier_code=$(cat "$tier_log.status") || exit 1
tier_seconds=$(node -e ${quote(elapsedSecondsProgram)} "$tier_start") || exit 1
tier_tail=$(tail -n 8 "$tier_log" | tr '\\n' ' ' | cut -c 1-1200)
${step.name === 'Web' ? `if test \"$tier_code\" -eq 0 && grep -q '^tier Web: not run;' \"$tier_log\"; then exit 0; fi\n` : ''}printf '\\ntier ${verificationStepLabel(step.name)}: exit %s; duration %s s; output tail: %s\\n' "$tier_code" "$tier_seconds" "$tier_tail"
exit "$tier_code"`)}`;
}
