// Pure policy seam; the static command supplies the shipped workflow baseline.
export function checkWorkflow(source: string, baseline: readonly string[], enforce = false): {
  mode: 'report' | 'enforce'; findings: string[]; exitCode: number;
} {
  const findings = workflowFindings(source, baseline);
  return { mode: enforce ? 'enforce' : 'report', findings, exitCode: enforce && findings.length ? 1 : 0 };
}

export function workflowFindings(source: string, baseline: readonly string[]): string[] {
  const allowed = new Set(baseline.map(paragraph => paragraph.trim()));
  const findings: string[] = [];
  let pendingMarker: number | undefined;
  const report = (line: number) => findings.push(`.agents/skills/implement/SKILL.md:${line}: unmarked or invalid workflow edit; put subsystem guidance in docs/hub/<subsystem>.md (or its indexed implementation note), item provenance in .agents/skills/implement/CHANGES/<item>-<topic>.md; deliberate workflow edits require <!-- cland-workflow-change: T-<n> <reason> --> for each paragraph`);
  for (const match of source.matchAll(/[\s\S]*?(?:\n[ \t]*\n|$)/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    let paragraph = match[0].trim();
    if (!paragraph) continue;
    const marker = /^<!-- cland-workflow-change: T-[1-9]\d* ([^\n]+?) -->($|\n)/.exec(paragraph);
    if (marker && marker[1]!.trim() && !marker[1]!.includes('-->')) {
      if (pendingMarker !== undefined) report(pendingMarker);
      pendingMarker = line;
      paragraph = paragraph.slice(marker[0].length).trim();
      if (!paragraph) continue;
    }
    // Markers apply to exactly one paragraph, never the rest of the document.
    if (paragraph.startsWith('<!-- cland-workflow-change:') ||
        (pendingMarker === undefined && !allowed.has(paragraph))) report(line);
    pendingMarker = undefined;
  }
  if (pendingMarker !== undefined) report(pendingMarker);
  return findings;
}
