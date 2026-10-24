// Pure input selection for the fake app-server; routing uses this same match.
export function answerableEnvelope(text: string, firstInput: boolean): RegExpExecArray | undefined {
  const envelopes = [...text.matchAll(/<channel ([^>]*)>\n([\s\S]*?)\n<\/channel>/g)];
  // A sessionless launch carries its brief as a hub report after the initial
  // clause (or the no-role introduction). Later reports/events are not requests.
  const launch = firstInput && /^(?:cland hub: you hold the role |You are "[^"]+", a session of cland with no role yet\.)/.test(text);
  return envelopes.findLast((match, index) => /\bfrom_kind="(?:human|agent)"/.test(match[1]!)
    || launch && index === 0 && ['from="hub"', 'from_kind="hub"', 'kind="report"', 'topic="agents"']
      .every(attribute => match[1]!.split(/\s+/).includes(attribute)));
}
