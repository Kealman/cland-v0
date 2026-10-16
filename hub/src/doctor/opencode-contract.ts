// Release-only contract comparison, adapted from research/opencode-v2's openapi-digest.mjs wirediff.
// Resolve references and discard documentation/type identifiers; compare wire shapes, not operation IDs.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type ObjectValue = { [key: string]: Json };
const object = (v: Json | undefined): ObjectValue => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
export type OpenApi = ObjectValue;

export const OPERATIONS = [
  ['get', '/api/session/{sessionID}'], ['post', '/api/session'],
  ['post', '/api/session/{sessionID}/move'], ['get', '/api/model'],
  ['post', '/api/session/{sessionID}/prompt'], ['get', '/api/session/active'],
  ['get', '/api/session/{sessionID}/permission'], ['get', '/api/session/{sessionID}/form'],
  ['get', '/api/session/{sessionID}/message/{messageID}'], ['get', '/api/event'],
] as const;
const NOISE = new Set(['description', 'title', 'examples', 'example', 'identifier', '$id', 'summary', 'deprecated', 'operationId']);

function wire(doc: OpenApi, value: Json, seen: string[] = []): Json {
  if (Array.isArray(value)) return value.map(v => wire(doc, v, seen));
  if (!value || typeof value !== 'object') return value;
  if (typeof value.$ref === 'string') {
    const ref = value.$ref;
    if (seen.includes(ref)) return { cycle: true };
    if (!ref.startsWith('#/')) throw new Error(`unsupported reference ${ref}`);
    let target: Json = doc;
    for (const key of ref.slice(2).split('/')) target = object(target)[key.replace(/~1/g, '/').replace(/~0/g, '~')] ?? null;
    if (target === null) throw new Error(`unresolved reference ${ref}`);
    return wire(doc, target, [...seen, ref]);
  }
  return Object.fromEntries(Object.keys(value).sort().filter(k => !NOISE.has(k) && !k.startsWith('x-')).map(k => [k, wire(doc, value[k]!, seen)]));
}

/** Conservative compatibility: optional additions are fine; removals and changed wire types need review.
 * Required response fields must stay guaranteed. Additional response fields are ignored by the JSON reader. */
function compare(old: Json, next: Json, path: string, response: boolean, errors: string[]): void {
  if (JSON.stringify(old) === JSON.stringify(next)) return;
  if (Array.isArray(old) && Array.isArray(next)) {
    // Union order is immaterial. Every old branch must retain a compatible branch.
    if (/\.(anyOf|oneOf|enum)$/.test(path)) {
      for (const branch of old) {
        const matches = next.some(candidate => { const e: string[] = []; compare(branch, candidate, path + '[]', response, e); return e.length === 0; });
        if (!matches) errors.push(`${path}: a tested variant was removed or changed`);
      }
      return;
    }
    if (old.length !== next.length) { errors.push(`${path}: array shape changed`); return; }
    old.forEach((v, i) => compare(v, next[i]!, `${path}[${i}]`, response, errors));
    return;
  }
  if (old && next && typeof old === 'object' && typeof next === 'object' && !Array.isArray(old) && !Array.isArray(next)) {
    for (const [key, value] of Object.entries(old)) {
      if ((key === 'required' && (response || Array.isArray(value))) || (response && key === 'additionalProperties' && typeof value === 'boolean')) continue;
      if (!(key in next)) errors.push(`${path}.${key}: removed`);
      else compare(value, next[key]!, `${path}.${key}`, response, errors);
    }
    if (!response) {
      const before = Array.isArray(old.required) ? old.required : [];
      for (const key of Array.isArray(next.required) ? next.required : []) if (!before.includes(key)) errors.push(`${path}: new required field ${key}`);
      // New properties/optional parameters are additive. A new pattern, enum, length bound, etc. can
      // narrow an existing request even when none of its old keys changed.
      for (const key of Object.keys(next)) if (!(key in old) && key !== 'required' && !/\.(properties|parameters)$/.test(path)) errors.push(`${path}.${key}: new request constraint`);
    } else {
      const after = Array.isArray(next.required) ? next.required : [];
      for (const key of Array.isArray(old.required) ? old.required : []) {
        // Upstream made the SSE wrapper id optional in 2.0.27. OpenCodeClient.events reads its data,
        // never this wrapper id; all other response guarantees, including data itself, must remain.
        if (key === 'id' && path === 'GET /api/event.response.content.text/event-stream.schema') continue;
        if (!after.includes(key)) errors.push(`${path}: response no longer guarantees required field ${key}`);
      }
    }
    return;
  }
  errors.push(`${path}: ${JSON.stringify(old).slice(0, 100)} -> ${JSON.stringify(next).slice(0, 100)}`);
}

export function compareOpenCodeContract(tested: OpenApi, newest: OpenApi): string[] {
  const errors: string[] = [];
  for (const [method, path] of OPERATIONS) {
    const label = `${method.toUpperCase()} ${path}`;
    const a = object(object(tested.paths)[path])[method];
    const b = object(object(newest.paths)[path])[method];
    if (!a || !b) { errors.push(`${label}: missing operation in ${a ? 'newest' : 'tested'} document`); continue; }
    const old = object(wire(tested, a));
    const next = object(wire(newest, b));
    // Match parameters by name/location so an optional addition or reordering does not look like a removal.
    const parameters = (op: ObjectValue) => Object.fromEntries((Array.isArray(op.parameters) ? op.parameters : []).map(p => [`${object(p).in}:${object(p).name}`, p]));
    compare(parameters(old), parameters(next), `${label}.parameters`, false, errors);
    for (const p of Array.isArray(next.parameters) ? next.parameters : []) {
      const key = `${object(p).in}:${object(p).name}`;
      if (!(key in parameters(old)) && object(p).required === true) errors.push(`${label}: new required parameter ${key}`);
    }
    compare(old.requestBody ?? null, next.requestBody ?? null, `${label}.requestBody`, false, errors);
    const success = (op: ObjectValue) => object(op.responses)['200'] ?? object(op.responses)['201'] ?? object(op.responses)['204'] ?? null;
    compare(success(old), success(next), `${label}.response`, true, errors);
  }
  return errors;
}

/** Same event-name grep as the research, checked for every event read by today's adapter. */
export function adapterEventNames(sources: string[]): string[] {
  return [...new Set(sources.flatMap(s => [...s.matchAll(/['"]((?:session|permission|form)\.[a-z.]+)['"]/g)].map(m => m[1]!)))].sort();
}

export function compareEventNames(names: string[], tested: string, newest: string): string[] {
  const has = (source: string, name: string) => source.includes(`'${name}'`) || source.includes(`"${name}"`);
  return names.flatMap(name => !has(tested, name) ? [`${name}: absent from tested event source`] : !has(newest, name) ? [`${name}: absent from newest event source`] : []);
}
