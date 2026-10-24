import type { SuiteSelection } from './suite-selection.ts';
import type { VerifyOccasion } from './protocol.ts';

export type VerificationTier = 'T1' | 'T2' | 'T3' | 'T4' | 'Web';
export type VerificationStep = { name: 'check' | 'test' | VerificationTier; command: string };
export type TierCommands = { prepare: string; check: string; test: string; tiers?: Partial<Record<VerificationTier, string>>; plan?: VerificationStep[] };

export const verificationStepLabel = (name: VerificationStep['name']): string => name === 'check' ? 'T0' : name;

/** Completed command receipts, shared by batch diagnosis and its result report. */
export function verificationStepResults(log: string): { name: VerificationStep['name']; code: number; seconds: number }[] {
  return [...log.matchAll(/^tier (T[0-4]|Web): exit (\d+); duration (\d+(?:\.\d+)?) s; output tail:.*$/gm)]
    .map(([, name, code, seconds]) => ({ name: name === 'T0' ? 'check' : name as VerificationTier, code: Number(code), seconds: Number(seconds) }));
}

/** Pin the executable tier plan beside the commands resolved at admission. */
export function pinVerificationPlan(commands: TierCommands, run: { branch: string; mode: string; occasion?: VerifyOccasion; selection?: SuiteSelection; queueEnabled?: boolean }): TierCommands {
  if (!commands.tiers) return commands;
  const tiers: VerificationTier[] = run.selection?.tiers ?? (run.occasion === 'batch' ? ['T1', 'T3']
    : run.occasion === 'dev-t3' ? ['T3']
    : run.occasion || run.selection?.soak ? ['T1', 'T2', 'T3', 'T4']
    : run.branch.startsWith('t/') && run.mode !== 'all' && run.queueEnabled !== false ? ['T1', 'T2'] : ['T1', 'T2', 'T3']);
  const plan: VerificationStep[] = commands.check ? [{ name: 'check', command: commands.check }] : [];
  for (const tier of tiers) if (commands.tiers[tier]) plan.push({ name: tier, command: commands.tiers[tier]! });
  if (commands.tiers.Web && run.occasion !== 'batch' && run.selection?.web !== 'none' && (!run.selection?.shard || run.selection.shard.nvim)) plan.push({ name: 'Web', command: commands.tiers.Web });
  return { ...commands, plan };
}

/** Legacy admission records retain their whole-test behavior. */
export function verificationSteps(commands: TierCommands): VerificationStep[] {
  if (commands.plan) return commands.plan;
  if (commands.tiers) throw new Error('tier commands have no recorded plan; submit verification again');
  return [{ name: 'check', command: commands.check }, { name: 'test', command: commands.test }].filter(step => step.command) as VerificationStep[];
}

const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Portable streaming shell wrapper: retain the command exit through tee and one bounded tail. */
export function verificationStepCommand(step: VerificationStep): string {
  if (step.name === 'test') return step.command;
  return `/bin/sh -c ${quote(`tier_log=$(mktemp) || exit 1
trap 'rm -f "$tier_log" "$tier_log.status"' EXIT
tier_start=$(date +%s)
( /bin/sh -c ${quote(step.command)}; echo $? > "$tier_log.status" ) 2>&1 | tee "$tier_log"
tier_code=$(cat "$tier_log.status") || exit 1
tier_seconds=$(( $(date +%s) - tier_start ))
tier_tail=$(tail -n 8 "$tier_log" | tr '\\n' ' ' | cut -c 1-1200)
${step.name === 'Web' ? `if test \"$tier_code\" -eq 0 && grep -q '^tier Web: not run;' \"$tier_log\"; then exit 0; fi\n` : ''}printf '\\ntier ${verificationStepLabel(step.name)}: exit %s; duration %s s; output tail: %s\\n' "$tier_code" "$tier_seconds" "$tier_tail"
exit "$tier_code"`)}`;
}
