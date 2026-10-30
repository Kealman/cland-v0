"""Stream V8 heap snapshots into compact arrays; calculate strong-edge dominators.
Usage: python3 hub/test/analyze-memory.py PRIVATE.heapsnapshot > PRIVATE-analysis.json
No raw string contents are exported. Analysis is offline, after the hub stops.
"""
import sys, json, re
from array import array

# V8 emits nodes/edges as numeric arrays. Tokenize incrementally, including strings
# split across chunks, without holding the JSON document or its string table.
def tokens(path):
    # Bounded tokenizer: long string payloads are scanned and discarded, never
    # concatenated. Keep only enough bytes for safe constructor/field labels.
    with open(path, encoding='utf8') as f:
        state = 'outside'; text = ''; escaped = False; long = False
        while True:
            chunk = f.read(65536)
            if not chunk: break
            for c in chunk:
                if state == 'string':
                    if c == '"' and not escaped:
                        if long: yield '<redacted>'
                        else:
                            try: yield json.loads('"' + text + '"')
                            except json.JSONDecodeError: yield '<redacted>'
                        text = ''; state = 'outside'; continue
                    if len(text) < 192: text += c
                    else: long = True
                    escaped = c == '\\' and not escaped
                    continue
                if state == 'number':
                    if c in '0123456789.eE+-': text += c; continue
                    yield json.loads(text); text = ''; state = 'outside'
                if c == '"': state = 'string'; escaped = False; long = False
                elif c in '0123456789-': state = 'number'; text = c
                elif c in '[]{}': yield ('punctuation', c)
                elif c.isspace() or c in ',:': pass
                else: raise ValueError('unexpected heap snapshot token')
        if state == 'number': yield json.loads(text)
        elif state != 'outside': raise ValueError('incomplete heap snapshot')


def analyze(path):
    stream = iter(tokens(path)); nodes = array('Q'); edges = array('Q'); names = []
    # Header is small; rebuild it from tokens via original first line instead.
    with open(path) as f:
        header = f.readline()
    meta = json.loads(header.removesuffix('\n').rstrip(',') + '}')['snapshot']
    for tok in stream:
        if tok == 'nodes':
            assert next(stream) == ('punctuation', '[')
            for v in stream:
                if v == ('punctuation', ']'): break
                nodes.append(v)
        elif tok == 'edges':
            assert next(stream) == ('punctuation', '[')
            for v in stream:
                if v == ('punctuation', ']'): break
                edges.append(v)
        elif tok == 'strings':
            assert next(stream) == ('punctuation', '[')
            for v in stream:
                if v == ('punctuation', ']'): break
                # Keep constructor/property names only, never string contents.
                names.append(v if isinstance(v, str) and re.fullmatch(r'[A-Za-z_$][A-Za-z0-9_$ .:/<>-]{0,95}', v) else '<redacted>')
    fields = meta['meta']['node_fields']; ef = meta['meta']['edge_fields']
    width = len(fields); ew = len(ef); n = len(nodes)//width
    namecol = fields.index('name'); sizecol = fields.index('self_size'); countcol = fields.index('edge_count'); typecol = fields.index('type')
    tocol = ef.index('to_node'); etypecol = ef.index('type'); enamecol = ef.index('name_or_index')
    weak = meta['meta']['edge_types'][etypecol].index('weak')
    starts = array('I', [0]); targets = array('I'); edge_names = array('I'); owners = array('I')
    e = 0
    for u in range(n):
        for _ in range(nodes[u*width+countcol]):
            if edges[e+etypecol] != weak:
                targets.append(edges[e+tocol]//width); owners.append(u); edge_names.append(0xffffffff if meta['meta']['edge_types'][etypecol][edges[e+etypecol]] in ('element', 'hidden') else edges[e+enamecol])
            e += ew
        starts.append(len(targets))
    del edges
    # DFS numbering, then Lengauer-Tarjan immediate dominators (iterative eval).
    dfs = array('I', [0])*n; vertex = array('I', [0]); parent = array('I', [0])*n
    dfs[0] = 1; vertex.append(0); stack = [(0, starts[0])]
    while stack:
        u, edge = stack[-1]
        if edge == starts[u+1]: stack.pop(); continue
        stack[-1] = (u, edge+1); v = targets[edge]
        if not dfs[v]:
            dfs[v] = len(vertex); vertex.append(v); parent[v] = u; stack.append((v, starts[v]))
    pred_start = array('I', [0])*(n+1)
    for v in targets: pred_start[v+1] += 1
    for i in range(n): pred_start[i+1] += pred_start[i]
    cursor = array('I', pred_start); pred = array('I', [0])*len(targets)
    for i, v in enumerate(targets): pred[cursor[v]] = owners[i]; cursor[v] += 1
    del cursor, owners
    semi = array('I', dfs); label = array('I', range(n)); ancestor = array('q', [-1])*n
    dom = array('I', [0])*n; buckets = {}
    def evaluate(v):
        if ancestor[v] == -1: return label[v]
        work = []; x = v
        while ancestor[x] != -1 and ancestor[ancestor[x]] != -1:
            work.append(x); x = ancestor[x]
        for x in reversed(work):
            a = ancestor[x]
            if semi[label[a]] < semi[label[x]]: label[x] = label[a]
            ancestor[x] = ancestor[a]
        return label[v]
    for w in reversed(vertex[2:]):
        for j in range(pred_start[w], pred_start[w+1]):
            v = pred[j]
            if dfs[v]: semi[w] = min(semi[w], semi[evaluate(v)])
        buckets.setdefault(vertex[semi[w]], []).append(w)
        ancestor[w] = parent[w]
        for v in buckets.pop(parent[w], []):
            u = evaluate(v); dom[v] = u if semi[u] < semi[v] else parent[w]
    for w in vertex[2:]:
        if dom[w] != vertex[semi[w]]: dom[w] = dom[dom[w]]
    retained = array('Q', (nodes[i*width+sizecol] for i in range(n)))
    for w in reversed(vertex[2:]): retained[dom[w]] += retained[w]
    types = meta['meta']['node_types'][typecol]
    def describe(i):
        kind = types[nodes[i*width+typecol]]
        return {'index': i, 'type': kind, 'name': names[nodes[i*width+namecol]] if kind in ('object', 'closure', 'native', 'code', 'synthetic') else '<'+kind+'>', 'selfBytes': nodes[i*width+sizecol], 'retainedBytes': retained[i]}
    top = sorted((i for i in vertex[2:] if types[nodes[i*width+typecol]] != 'synthetic'), key=lambda i: retained[i], reverse=True)[:10]
    result = []
    for i in top:
        row = describe(i); chain = []; p = dom[i]
        for _ in range(12):
            chain.append(describe(p))
            if p == 0: break
            p = dom[p]
        row['dominators'] = chain
        # Incoming edges identify the field holding a top object.
        incoming = []
        for u in range(n):
            for j in range(starts[u], starts[u+1]):
                if targets[j] == i and len(incoming) < 12:
                    incoming.append({'owner': describe(u), 'edge': names[edge_names[j]] if edge_names[j] < len(names) else '<index>'})
        row['incoming'] = incoming; result.append(row)
    return {'nodes': n, 'reachable': len(vertex)-1, 'strongEdges': len(targets), 'selfBytes': sum(nodes[i*width+sizecol] for i in range(n)), 'topTen': result, 'method': 'Lengauer-Tarjan dominators from synthetic root, weak edges excluded; overlapping retained subtrees must not be summed; strings redacted'}

def analyze_profiles(root):
    from pathlib import Path
    root = Path(root)
    boundaries = [json.loads(line) for line in (root / 'boundaries.jsonl').read_text().splitlines()]
    previous = set(); stages = []
    for boundary in boundaries:
        file = root / ('stage-%d.heapprofile' % boundary['ordinal'])
        if not file.exists():
            stages.append({'boundary': boundary['boundary'], 'unavailable': 'missing sampling receipt'})
            continue
        if file.stat().st_size > 32 * 1024 * 1024:
            raise ValueError('sampling receipt exceeds 32 MiB analysis bound')
        profile = json.loads(file.read_text()); sites = {}; stack = [(profile['head'], [])]
        while stack:
            node, parents = stack.pop(); frame = node['callFrame']
            name = frame.get('functionName', '')
            # Source locations and function names only; no script source or messages.
            label = {'function': name[:160], 'url': frame.get('url', '')[:512], 'line': frame.get('lineNumber', -1) + 1, 'column': frame.get('columnNumber', -1) + 1}
            sites[node['id']] = [label] + parents[:7]
            for child in node.get('children', []): stack.append((child, [label] + parents[:7]))
        samples = profile.get('samples', []); current = {sample['ordinal'] for sample in samples}
        totals = {}; surviving = {}
        for sample in samples:
            surviving[sample['nodeId']] = surviving.get(sample['nodeId'], 0) + sample['size']
            if sample['ordinal'] not in previous:
                totals[sample['nodeId']] = totals.get(sample['nodeId'], 0) + sample['size']
        rows = [{'sampledBytes': size, 'stack': sites.get(node, [])} for node, size in sorted(totals.items(), key=lambda row: row[1], reverse=True)[:10]]
        stages.append({'boundary': boundary['boundary'], 'ms': boundary['ms'], 'sampledNewBytes': sum(totals.values()), 'topSites': rows, 'sampledSurvivingBytes': sum(surviving.values()), 'survivingSites': [{'sampledBytes': size, 'stack': sites.get(node, [])} for node, size in sorted(surviving.items(), key=lambda row: row[1], reverse=True)[:10]]})
        previous = current
    return {'method': '1 MiB V8 allocation sampling; new sample ordinals between checkpoints; CLI default surviving-object samples, not retained sizes or exact allocation totals; GC can remove earlier samples', 'stages': stages}

if __name__ == '__main__':
    print(json.dumps(analyze_profiles(sys.argv[2]) if sys.argv[1] == '--profiles' else analyze(sys.argv[1]), indent=2))
