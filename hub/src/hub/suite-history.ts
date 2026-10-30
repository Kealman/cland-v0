// One projection for legacy backfill and new checkpoints. These scheduler facts
// are never written back as full receipts. Plans remain in suite-job:<id>.
const omitted = ['config', 'tierPlan', 'loadProofs', 'timingIdentities', 'selection', 'lease', 'shards'];
const paths = (prefix: string) => omitted.map(key => `'${prefix}.${key}'`).join(', ');
const selection = (value: string, path: string) => `case when json_type(${value}, '${path}') = 'object' then json_object(
  'mode', json_extract(${value}, '${path}.mode'),
  'soak', json(${value} -> '${path}.soak'),
  'loadGate', json(${value} -> '${path}.loadGate'),
  'tiers', json_extract(${value}, '${path}.tiers'),
  'tests', case when json_type(${value}, '${path}.tests') is not null then json('[]') end,
  'nvimTests', case when json_type(${value}, '${path}.nvimTests') is not null then json('[]') end,
  'shard', case when json_type(${value}, '${path}.shard') is not null then json('{}') end
) end`;
const compactJob = (value: string, prefix: string) => `json_set(json_remove(${value}, ${paths(prefix)}),
 '${prefix}.selection', json(${selection(value, prefix + '.selection')}),
 '${prefix}.lease', json_object('execution', json_extract(${value}, '${prefix}.lease.execution')))`;
export const suiteHistoryProjection = `json_set(${compactJob('meta.value', '$.job')}, '$.job.shards',
 case when json_type(meta.value, '$.job.shards') = 'array' then json((select json_group_array(json(${compactJob('s.value', '$')})) from json_each(meta.value, '$.job.shards') s)) else json('null') end)`;
